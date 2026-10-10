import { test, expect, APIRequestContext } from "@playwright/test"
import { apiAs, db, fixtures, registerUser, approveInstructor } from "./support"

test.describe.configure({ mode: "serial" })

type Account = { id: string; email: string; api: APIRequestContext }
type Course = {
  id: string
  instructor: Account
  quizIds: string[]
  questionsByQuiz: Record<string, string[]>
}

let teachers: Account[]
let students: Account[]
let courses: Course[]

async function createTeacher(): Promise<Account> {
  const account = await registerUser("INSTRUCTOR")
  const user = await db().user.findUniqueOrThrow({ where: { email: account.email } })
  await approveInstructor(account.email)
  return { id: user.id, email: account.email, api: account.api }
}

async function createCourse(instructor: Account, index: number): Promise<Course> {
  const created = await instructor.api.post("/api/instructor/courses", {
    data: {
      title: `QA Cohort ${index} ${Date.now()}`,
      titleAr: `مسار المجموعة ${index}`,
      description: "Multi-student and multi-exam QA cohort",
      categoryId: fixtures().categoryId,
      level: "BEGINNER",
      language: "ar",
    },
  })
  expect(created.status(), await created.text()).toBe(201)
  const course = await created.json()
  const chapterRes = await instructor.api.post(`/api/instructor/courses/${course.id}/chapters`, {
    data: { title: `QA unit ${index}` },
  })
  expect(chapterRes.status(), await chapterRes.text()).toBe(201)
  const chapter = await chapterRes.json()
  const lessonsUrl = `/api/instructor/courses/${course.id}/chapters/${chapter.id}/lessons`
  const lessons: string[] = []

  for (let i = 0; i < 4; i++) {
    const lessonRes = await instructor.api.post(lessonsUrl, {
      data: { title: `QA lesson ${index}.${i + 1}`, videoUrl: `https://example.com/qa-${index}-${i + 1}` },
    })
    expect(lessonRes.status(), await lessonRes.text()).toBe(201)
    const lesson = await lessonRes.json()
    lessons.push(lesson.id)
    const published = await instructor.api.patch(`${lessonsUrl}/${lesson.id}`, {
      data: { isPublished: true },
    })
    expect(published.status(), await published.text()).toBe(200)
  }

  const questionsByQuiz: Record<string, string[]> = {}
  const quizIds: string[] = []
  for (const lessonIndex of [1, 3]) {
    const quizRes = await instructor.api.post(
      `/api/instructor/courses/${course.id}/lessons/${lessons[lessonIndex]}/quiz`,
      {
        data: {
          title: `QA cohort ${index} exam ${lessonIndex + 1}`,
          passingScore: 60,
          maxAttempts: 2,
          timeLimit: 20,
          detectTabSwitch: true,
          questions: [0, 1, 2].map((position) => ({
            question: `Cohort ${index} question ${lessonIndex + 1}.${position + 1}`,
            type: "MULTIPLE_CHOICE",
            points: 1,
            position,
            options: [
              { id: `correct-${position}`, text: "correct", isCorrect: true },
              { id: `wrong-${position}`, text: "wrong", isCorrect: false },
            ],
          })),
        },
      },
    )
    expect(quizRes.status(), await quizRes.text()).toBe(201)
    const quiz = await quizRes.json()
    quizIds.push(quiz.id)
    questionsByQuiz[quiz.id] = quiz.questions.map((question: { id: string }) => question.id)
  }

  const published = await instructor.api.post(`/api/instructor/courses/${course.id}/publish`)
  expect(published.status(), await published.text()).toBe(200)
  return { id: course.id, instructor, quizIds, questionsByQuiz }
}

async function submitQuiz(
  student: Account,
  quizId: string,
  questionIds: string[],
  correctCount: number,
) {
  const started = await student.api.post("/api/quiz/start", { data: { quizId } })
  expect(started.status(), await started.text()).toBe(200)
  const attempt = await started.json()
  const submit = await student.api.post("/api/quiz/submit", {
    data: {
      attemptId: attempt.attemptId,
      answers: questionIds.map((questionId, index) => ({
        questionId,
        answer: index < correctCount ? `correct-${questionIds.indexOf(questionId)}` : `wrong-${questionIds.indexOf(questionId)}`,
      })),
    },
  })
  expect(submit.status(), await submit.text()).toBe(200)
  return { attemptId: attempt.attemptId, result: await submit.json() }
}

test("COHORT-01 creates two approved test teachers, five students and two four-lesson courses", async () => {
  teachers = await Promise.all([createTeacher(), createTeacher()])
  students = await Promise.all(Array.from({ length: 5 }, async () => {
    const account = await registerUser("STUDENT")
    const user = await db().user.findUniqueOrThrow({ where: { email: account.email } })
    return { id: user.id, email: account.email, api: account.api }
  }))
  courses = await Promise.all(teachers.map((teacher, index) => createCourse(teacher, index + 1)))

  for (let courseIndex = 0; courseIndex < courses.length; courseIndex++) {
    const enrolledStudents = courseIndex === 0 ? students : students.slice(0, 4)
    await db().enrollment.createMany({
      data: enrolledStudents.map((student) => ({ userId: student.id, courseId: courses[courseIndex].id })),
    })
  }

  expect(courses).toHaveLength(2)
  expect(courses.every((course) => course.quizIds.length === 2)).toBe(true)
  expect(await db().lesson.count({ where: { chapter: { courseId: { in: courses.map(({ id }) => id) } } } })).toBe(8)
})

test("COHORT-02 students see only enrolled exams and never the answer key", async () => {
  for (const course of courses) {
    for (const quizId of course.quizIds) {
      const questionIds = course.questionsByQuiz[quizId]
      const quiz = await db().quiz.findUniqueOrThrow({
        where: { id: quizId },
        include: { lesson: true },
      })
      const studentQuiz = await students[0].api.get(`/api/quizzes/${quiz.lessonId}`)
      expect(studentQuiz.status(), await studentQuiz.text()).toBe(200)
      const body = await studentQuiz.text()
      expect(body).not.toContain("isCorrect")
      expect(body).not.toContain("explanation")
      expect(questionIds).toHaveLength(3)
    }
  }

  const excluded = courses[1]
  const excludedQuiz = await db().quiz.findUniqueOrThrow({ where: { id: excluded.quizIds[0] }, include: { lesson: true } })
  expect((await students[4].api.get(`/api/quizzes/${excludedQuiz.lessonId}`)).status()).toBe(403)
  expect((await students[4].api.post("/api/quiz/start", { data: { quizId: excluded.quizIds[0] } })).status()).toBe(403)
})

test("COHORT-03 four learners complete all exams with high, borderline, failing and resumed attempts", async () => {
  const scores = [3, 2, 0, 3]
  for (const course of courses) {
    for (const quizId of course.quizIds) {
      const questionIds = course.questionsByQuiz[quizId]
      for (let studentIndex = 0; studentIndex < 4; studentIndex++) {
        const result = await submitQuiz(students[studentIndex], quizId, questionIds, scores[studentIndex])
        if (studentIndex === 0) expect(result.result).toMatchObject({ score: 100, passed: true })
        if (studentIndex === 1) {
          expect(Math.round(result.result.score)).toBe(67)
          expect(result.result.passed).toBe(true)
        }
        if (studentIndex === 2) expect(result.result).toMatchObject({ score: 0, passed: false })
        if (studentIndex === 3) expect(result.result.passed).toBe(true)
      }
    }
  }

  const quizId = courses[0].quizIds[0]
  const questionIds = courses[0].questionsByQuiz[quizId]
  const retry = await students[3].api.post("/api/quiz/start", { data: { quizId } })
  expect(retry.status()).toBe(200)
  const secondAttempt = await retry.json()
  const resumed = await students[3].api.post("/api/quiz/start", { data: { quizId } })
  expect((await resumed.json()).attemptId).toBe(secondAttempt.attemptId)

  const secondSubmit = await students[3].api.post("/api/quiz/submit", {
    data: {
      attemptId: secondAttempt.attemptId,
      answers: questionIds.map((questionId, index) => ({ questionId, answer: `wrong-${index}` })),
    },
  })
  expect(secondSubmit.status()).toBe(200)
  expect((await secondSubmit.json()).passed).toBe(false)

  const exhausted = await students[3].api.post("/api/quiz/start", { data: { quizId } })
  expect(exhausted.status()).toBe(403)
  expect((await exhausted.json()).code).toBe("max_attempts_reached")
})

test("COHORT-04 exam owners see their own rankings and cannot access the other teacher's cohort", async () => {
  for (const course of courses) {
    const results = await course.instructor.api.get(`/api/instructor/results?courseId=${course.id}`)
    expect(results.status(), await results.text()).toBe(200)
    const body = await results.json()
    expect(body.ranking.map((entry: { studentId: string }) => entry.studentId)).toContain(students[0].id)
    expect(body.ranking.map((entry: { studentId: string }) => entry.studentId)).toContain(students[2].id)
  }

  const foreignA = await courses[0].instructor.api.get(`/api/instructor/results?courseId=${courses[1].id}`)
  const foreignB = await courses[1].instructor.api.get(`/api/instructor/results?courseId=${courses[0].id}`)
  expect(foreignA.status()).toBe(200)
  expect(foreignB.status()).toBe(200)
  expect((await foreignA.json()).ranking).toEqual([])
  expect((await foreignB.json()).ranking).toEqual([])
})
