import { test, expect, APIRequestContext } from "@playwright/test"
import { apiAs, db, fixtures, registerUser } from "./support"

/**
 * Advanced exams: exam window, attempt limit, random question subsets,
 * server-side time limit, tab-switch counting, essay questions graded by the
 * teacher, and the question bank (CRUD, filters, permissions, import).
 * Uses its own "QA Exams" course owned by ahmed; seeded quizzes are untouched.
 */
test.describe.configure({ mode: "serial" })

type Student = { email: string; api: APIRequestContext; id: string }

let ahmed: APIRequestContext
let sara: APIRequestContext
let s1: Student
let s2: Student
let courseId: string
let courseSlug: string
let lessonA: string
let lessonB: string
let quizA: { id: string; questionIds: string[] }
let quizB: { id: string; mcId: string; essayId: string }
let essayAttemptId: string
let bankItemId: string
let gradeId: string

const mc = (n: number, extra: Record<string, unknown> = {}) => ({
  question: `QA question ${n}`,
  questionAr: `سؤال ${n}`,
  type: "MULTIPLE_CHOICE",
  points: 1,
  position: n,
  explanation: `secret explanation ${n}`,
  options: [
    { id: "a", text: "right", isCorrect: true },
    { id: "b", text: "wrong", isCorrect: false },
  ],
  ...extra,
})

const quizUrl = (lessonId: string) => `/api/instructor/courses/${courseId}/lessons/${lessonId}/quiz`

async function newStudent(): Promise<Student> {
  const u = await registerUser("STUDENT")
  const id = (await db().user.findUniqueOrThrow({ where: { email: u.email } })).id
  await db().enrollment.create({ data: { userId: id, courseId } })
  return { email: u.email, api: u.api, id }
}

test("EX-00 ahmed creates a QA course with two exam lessons", async () => {
  ahmed = await apiAs("ahmed")
  sara = await apiAs("sara")
  const created = await ahmed.post("/api/instructor/courses", {
    data: {
      title: `QA Exams ${Date.now()}`,
      titleAr: "QA امتحانات",
      description: "QA exams course",
      categoryId: fixtures().categoryId,
      level: "BEGINNER",
      language: "ar",
    },
  })
  expect(created.status(), await created.text()).toBe(201)
  const course = await created.json()
  courseId = course.id
  courseSlug = course.slug
  const chapter = await (await ahmed.post(`/api/instructor/courses/${courseId}/chapters`, { data: { title: "QA chapter" } })).json()
  const lessonUrl = `/api/instructor/courses/${courseId}/chapters/${chapter.id}/lessons`
  lessonA = (await (await ahmed.post(lessonUrl, { data: { title: "QA exam A" } })).json()).id
  lessonB = (await (await ahmed.post(lessonUrl, { data: { title: "QA exam B" } })).json()).id
  for (const id of [lessonA, lessonB]) {
    const r = await ahmed.patch(`${lessonUrl}/${id}`, { data: { isPublished: true } })
    expect(r.status(), await r.text()).toBe(200)
  }
  s1 = await newStudent()
  s2 = await newStudent()
})

test("EX-01 exam settings and questions are validated", async () => {
  const base = { title: "QA bad", questions: [mc(0), mc(1)] }
  const badImage = await ahmed.post(quizUrl(lessonA), { data: { ...base, questions: [mc(0, { imageUrl: "javascript:alert(1)" })] } })
  expect(badImage.status()).toBe(400)
  const badWindow = await ahmed.post(quizUrl(lessonA), {
    data: { ...base, availableFrom: "2030-01-02T10:00:00.000Z", availableUntil: "2030-01-01T10:00:00.000Z" },
  })
  expect(badWindow.status()).toBe(400)
  const tooMany = await ahmed.post(quizUrl(lessonA), { data: { ...base, questionsPerAttempt: 5 } })
  expect(tooMany.status()).toBe(400)
  const twoCorrect = await ahmed.post(quizUrl(lessonA), {
    data: { ...base, questions: [mc(0, { options: [{ id: "a", text: "x", isCorrect: true }, { id: "b", text: "y", isCorrect: true }] })] },
  })
  expect(twoCorrect.status()).toBe(400)
  expect(await db().quiz.count({ where: { lessonId: lessonA } })).toBe(0)
})

test("EX-02 ahmed creates exam A (random 3 of 5, 2 attempts, tab detection); sara cannot touch it", async () => {
  const res = await ahmed.post(quizUrl(lessonA), {
    data: {
      title: "QA Exam A",
      passingScore: 50,
      timeLimit: 10,
      maxAttempts: 2,
      questionsPerAttempt: 3,
      detectTabSwitch: true,
      questions: [0, 1, 2, 3, 4].map((n) => mc(n, n === 0 ? { imageUrl: "https://example.com/graph.png" } : {})),
    },
  })
  expect(res.status(), await res.text()).toBe(201)
  const quiz = await res.json()
  expect(quiz).toMatchObject({ maxAttempts: 2, questionsPerAttempt: 3, detectTabSwitch: true, timeLimit: 10 })
  expect(quiz.questions[0].imageUrl).toBe("https://example.com/graph.png")
  quizA = { id: quiz.id, questionIds: quiz.questions.map((q: any) => q.id) }

  expect((await sara.get(quizUrl(lessonA))).status()).toBe(404)
  expect((await sara.patch(quizUrl(lessonA), { data: { title: "x", questions: [mc(0)] } })).status()).toBe(404)
  expect((await s1.api.get(quizUrl(lessonA))).status()).toBe(404)
  const own = await ahmed.get(quizUrl(lessonA))
  expect(own.status()).toBe(200)
  expect(await own.text()).toContain("isCorrect")
})

test("EX-03 the exam window is enforced on start", async () => {
  const opensAt = new Date(Date.now() + 3600_000)
  await db().quiz.update({ where: { id: quizA.id }, data: { availableFrom: opensAt } })
  const early = await s1.api.post("/api/quiz/start", { data: { quizId: quizA.id } })
  expect(early.status()).toBe(403)
  const body = await early.json()
  expect(body.code).toBe("exam_not_open")
  expect(new Date(body.opensAt).getTime()).toBe(opensAt.getTime())

  await db().quiz.update({ where: { id: quizA.id }, data: { availableFrom: null, availableUntil: new Date(Date.now() - 60_000) } })
  const late = await s1.api.post("/api/quiz/start", { data: { quizId: quizA.id } })
  expect(late.status()).toBe(403)
  expect((await late.json()).code).toBe("exam_closed")

  await db().quiz.update({ where: { id: quizA.id }, data: { availableUntil: new Date(Date.now() + 86400_000) } })
  expect(await db().quizAttempt.count({ where: { quizId: quizA.id } })).toBe(0)
})

let s1Attempt: { attemptId: string; questions: any[] }

test("EX-04 start serves a stored random subset without the answer key", async () => {
  const res = await s1.api.post("/api/quiz/start", { data: { quizId: quizA.id } })
  expect(res.status(), await res.text()).toBe(200)
  const text = await res.text()
  expect(text).not.toContain("isCorrect")
  expect(text).not.toContain("secret explanation")
  s1Attempt = JSON.parse(text)
  expect(s1Attempt.questions.length).toBe(3)
  expect((s1Attempt as any).attemptNumber).toBe(1)
  expect((s1Attempt as any).deadline).toBeTruthy()

  const stored = await db().quizAttempt.findUniqueOrThrow({ where: { id: s1Attempt.attemptId } })
  expect(stored.questionIds).toEqual(s1Attempt.questions.map((q) => q.id))
  expect(stored.questionIds.every((id) => quizA.questionIds.includes(id))).toBe(true)

  // Resuming returns the same questions
  const again = await (await s1.api.post("/api/quiz/start", { data: { quizId: quizA.id } })).json()
  expect(again.attemptId).toBe(s1Attempt.attemptId)
  expect(again.questions.map((q: any) => q.id)).toEqual(stored.questionIds)

  // Quiz GET for a student: no answer key, but the image URL
  const get = await s1.api.get(`/api/quizzes/${lessonA}`)
  const getText = await get.text()
  expect(getText).not.toContain("isCorrect")
  expect(getText).not.toContain("secret explanation")
  expect(getText).toContain("https://example.com/graph.png")
})

test("EX-05 submit accepts only the attempt's own questions", async () => {
  const notServed = quizA.questionIds.find((id) => !s1Attempt.questions.some((q) => q.id === id))!
  const bad = await s1.api.post("/api/quiz/submit", {
    data: { attemptId: s1Attempt.attemptId, answers: [{ questionId: notServed, answer: "a" }] },
  })
  expect(bad.status()).toBe(400)
  expect((await bad.json()).code).toBe("question_not_in_attempt")

  const [q1, q2, q3] = s1Attempt.questions
  const ok = await s1.api.post("/api/quiz/submit", {
    data: {
      attemptId: s1Attempt.attemptId,
      answers: [
        { questionId: q1.id, answer: "a" },
        { questionId: q2.id, answer: "a" },
        { questionId: q3.id, answer: "b" },
      ],
    },
  })
  expect(ok.status(), await ok.text()).toBe(200)
  const result = await ok.json()
  expect(Math.round(result.score)).toBe(67)
  expect(result.passed).toBe(true)
  expect(result.needsGrading).toBe(false)
  expect(await db().quizAnswer.count({ where: { attemptId: s1Attempt.attemptId } })).toBe(3)
})

test("EX-06 the attempt limit is enforced", async () => {
  const second = await (await s1.api.post("/api/quiz/start", { data: { quizId: quizA.id } })).json()
  expect(second.attemptNumber).toBe(2)
  const sub = await s1.api.post("/api/quiz/submit", { data: { attemptId: second.attemptId, answers: [] } })
  expect(sub.status()).toBe(200)
  const third = await s1.api.post("/api/quiz/start", { data: { quizId: quizA.id } })
  expect(third.status()).toBe(403)
  expect((await third.json()).code).toBe("max_attempts_reached")
})

test("EX-07 tab switches are counted for the owner's attempt in progress only", async () => {
  const { attemptId } = await (await s2.api.post("/api/quiz/start", { data: { quizId: quizA.id } })).json()
  const url = `/api/quiz/attempts/${attemptId}/tab-switch`
  expect((await (await s2.api.post(url)).json()).tabSwitches).toBe(1)
  expect((await (await s2.api.post(url)).json()).tabSwitches).toBe(2)
  expect((await s1.api.post(url)).status()).toBe(403)
  expect((await (await apiAs("student")).post(url)).status()).toBe(403)

  await s2.api.post("/api/quiz/submit", { data: { attemptId, answers: [] } })
  expect((await s2.api.post(url)).status()).toBe(409)
  expect((await db().quizAttempt.findUniqueOrThrow({ where: { id: attemptId } })).tabSwitches).toBe(2)

  // The teacher sees the count
  const all = await (await ahmed.get("/api/instructor/grading?status=all")).json()
  const row = all.attempts.find((a: any) => a.id === attemptId)
  expect(row.tabSwitches).toBe(2)
  const detail = await (await ahmed.get(`/api/instructor/grading/${attemptId}`)).json()
  expect(detail.tabSwitches).toBe(2)

  // Disabled detection -> not counted
  await db().quiz.update({ where: { id: quizA.id }, data: { detectTabSwitch: false, maxAttempts: null } })
  const next = await (await s2.api.post("/api/quiz/start", { data: { quizId: quizA.id } })).json()
  expect((await s2.api.post(`/api/quiz/attempts/${next.attemptId}/tab-switch`)).status()).toBe(400)
  await s2.api.post("/api/quiz/submit", { data: { attemptId: next.attemptId, answers: [] } })
  await db().quiz.update({ where: { id: quizA.id }, data: { detectTabSwitch: true } })
})

test("EX-08 the time limit is enforced on the server (60s grace)", async () => {
  // 10-minute exam, started 12 minutes ago -> rejected and closed with 0
  const late = await (await s2.api.post("/api/quiz/start", { data: { quizId: quizA.id } })).json()
  await db().quizAttempt.update({ where: { id: late.attemptId }, data: { startedAt: new Date(Date.now() - 12 * 60_000) } })
  const answers = late.questions.map((q: any) => ({ questionId: q.id, answer: "a" }))
  const res = await s2.api.post("/api/quiz/submit", { data: { attemptId: late.attemptId, answers } })
  expect(res.status()).toBe(400)
  expect((await res.json()).code).toBe("time_limit_exceeded")
  const closed = await db().quizAttempt.findUniqueOrThrow({ where: { id: late.attemptId } })
  expect(closed.completedAt).not.toBeNull()
  expect(closed.score).toBe(0)
  expect(closed.passed).toBe(false)

  // Within the grace period -> accepted
  const ok = await (await s2.api.post("/api/quiz/start", { data: { quizId: quizA.id } })).json()
  await db().quizAttempt.update({ where: { id: ok.attemptId }, data: { startedAt: new Date(Date.now() - 10.5 * 60_000) } })
  const res2 = await s2.api.post("/api/quiz/submit", {
    data: { attemptId: ok.attemptId, answers: ok.questions.map((q: any) => ({ questionId: q.id, answer: "a" })) },
  })
  expect(res2.status(), await res2.text()).toBe(200)
  expect((await res2.json()).score).toBe(100)
})

test("EX-09 essay answers wait for the teacher; the attempt is not passed yet", async () => {
  const res = await ahmed.post(quizUrl(lessonB), {
    data: {
      title: "QA Exam B",
      passingScore: 60,
      questions: [
        mc(0),
        { question: "QA explain Ohm's law", type: "ESSAY", points: 4, position: 1, options: [{ id: "x", text: "ignored", isCorrect: true }] },
      ],
    },
  })
  expect(res.status(), await res.text()).toBe(201)
  const quiz = await res.json()
  const essay = quiz.questions.find((q: any) => q.type === "ESSAY")
  expect(essay.options).toEqual([])
  quizB = { id: quiz.id, mcId: quiz.questions.find((q: any) => q.type !== "ESSAY").id, essayId: essay.id }

  const start = await (await s1.api.post("/api/quiz/start", { data: { quizId: quizB.id } })).json()
  essayAttemptId = start.attemptId
  const submit = await s1.api.post("/api/quiz/submit", {
    data: {
      attemptId: essayAttemptId,
      answers: [
        { questionId: quizB.mcId, answer: "a" },
        { questionId: quizB.essayId, answer: "V = I × R: voltage equals current times resistance." },
      ],
    },
  })
  expect(submit.status(), await submit.text()).toBe(200)
  const result = await submit.json()
  expect(result).toMatchObject({ needsGrading: true, passed: false })
  expect(result.score).toBe(20)

  const answer = await db().quizAnswer.findUniqueOrThrow({
    where: { attemptId_questionId: { attemptId: essayAttemptId, questionId: quizB.essayId } },
  })
  expect(answer.textAnswer).toContain("V = I × R")
  expect(answer.gradedAt).toBeNull()

  const note = await db().notification.findFirst({
    where: { userId: fixtures().users.ahmed, link: `/instructor/grading?attempt=${essayAttemptId}` },
  })
  expect(note, "teacher notified of an essay to grade").toBeTruthy()
})

test("EX-10 the result page shows 'awaiting teacher grading'", async ({ page, context }) => {
  await context.addCookies((await s1.api.storageState()).cookies)
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  const res = await page.goto(`/courses/${courseSlug}/lessons/${lessonB}/quiz/result?attemptId=${essayAttemptId}`)
  expect(res?.status()).toBe(200)
  await expect(page.locator("h1")).toContainText(/awaitingTitle|في انتظار تصحيح المعلم|Awaiting teacher grading/)
  expect(errors).toEqual([])
})

test("EX-11 only the course owner (or admin) can see and grade the attempt", async () => {
  expect((await sara.get(`/api/instructor/grading/${essayAttemptId}`)).status()).toBe(403)
  expect(
    (await sara.post(`/api/instructor/grading/${essayAttemptId}`, { data: { grades: [{ questionId: quizB.essayId, score: 4 }] } })).status()
  ).toBe(403)
  expect((await s1.api.get(`/api/instructor/grading/${essayAttemptId}`)).status()).toBe(403)
  const saraInbox = await (await sara.get("/api/instructor/grading?status=pending")).json()
  expect(saraInbox.attempts.some((a: any) => a.id === essayAttemptId)).toBe(false)

  const inbox = await (await ahmed.get("/api/instructor/grading?status=pending")).json()
  const row = inbox.attempts.find((a: any) => a.id === essayAttemptId)
  expect(row).toMatchObject({ needsGrading: true, essayCount: 1, ungradedCount: 1 })
  expect(inbox.pending).toBeGreaterThanOrEqual(1)

  const detail = await (await ahmed.get(`/api/instructor/grading/${essayAttemptId}`)).json()
  expect(detail.questions.find((q: any) => q.id === quizB.essayId).answer.textAnswer).toContain("V = I")

  const admin = await apiAs("admin")
  expect((await admin.get(`/api/instructor/grading/${essayAttemptId}`)).status()).toBe(200)
})

test("EX-12 the teacher grades the essay: score recomputed, passed, student notified", async () => {
  const url = `/api/instructor/grading/${essayAttemptId}`
  const tooHigh = await ahmed.post(url, { data: { grades: [{ questionId: quizB.essayId, score: 5 }] } })
  expect(tooHigh.status()).toBe(400)
  const notEssay = await ahmed.post(url, { data: { grades: [{ questionId: quizB.mcId, score: 1 }] } })
  expect(notEssay.status()).toBe(400)
  expect((await ahmed.post(url, { data: { grades: [{ questionId: quizB.essayId, score: -1 }] } })).status()).toBe(400)

  const res = await ahmed.post(url, { data: { grades: [{ questionId: quizB.essayId, score: 3, feedback: "QA good, mention units" }] } })
  expect(res.status(), await res.text()).toBe(200)
  const body = await res.json()
  expect(body.needsGrading).toBe(false)
  expect(body.passed).toBe(true)
  expect(body.score).toBe(80)

  const attempt = await db().quizAttempt.findUniqueOrThrow({ where: { id: essayAttemptId } })
  expect(attempt).toMatchObject({ needsGrading: false, passed: true, score: 80 })
  const answer = await db().quizAnswer.findUniqueOrThrow({
    where: { attemptId_questionId: { attemptId: essayAttemptId, questionId: quizB.essayId } },
  })
  expect(answer).toMatchObject({ manualScore: 3, feedback: "QA good, mention units", gradedById: fixtures().users.ahmed })
  expect(answer.gradedAt).not.toBeNull()

  const note = await db().notification.findFirst({ where: { userId: s1.id, link: { contains: essayAttemptId } } })
  expect(note, "student notified with a link to the result").toBeTruthy()
  expect(note!.link).toContain(`/quiz/result?attemptId=${essayAttemptId}`)

  const log = await db().activityLog.findFirst({ where: { action: "exam.graded", entityId: essayAttemptId } })
  expect(log).toBeTruthy()

  const progress = await db().progress.findUnique({ where: { userId_lessonId: { userId: s1.id, lessonId: lessonB } } })
  expect(progress?.isCompleted).toBe(true)

  const pendingAfter = await (await ahmed.get("/api/instructor/grading?status=pending")).json()
  expect(pendingAfter.attempts.some((a: any) => a.id === essayAttemptId)).toBe(false)
  const graded = await (await ahmed.get("/api/instructor/grading?status=graded")).json()
  expect(graded.attempts.some((a: any) => a.id === essayAttemptId)).toBe(true)
})

test("EX-13 editing the quiz keeps saved questions (and past answers)", async () => {
  const quiz = await (await ahmed.get(quizUrl(lessonB))).json()
  const res = await ahmed.patch(quizUrl(lessonB), {
    data: {
      title: "QA Exam B v2",
      passingScore: 60,
      questions: quiz.questions.map((q: any, i: number) => ({ ...q, position: i, imageUrl: q.imageUrl ?? null })),
    },
  })
  expect(res.status(), await res.text()).toBe(200)
  const after = await res.json()
  expect(after.questions.map((q: any) => q.id).sort()).toEqual([quizB.mcId, quizB.essayId].sort())
  expect(await db().quizAnswer.count({ where: { attemptId: essayAttemptId } })).toBe(2)
})

test("EX-14 question bank CRUD with filters, owner only", async () => {
  const grades = await (await ahmed.get("/api/grade-levels")).json()
  gradeId = grades[0].id
  const tag = `qa-${Date.now()}`
  const item = {
    question: "QA bank: unit of resistance?",
    questionAr: "وحدة قياس المقاومة؟",
    type: "MULTIPLE_CHOICE",
    points: 2,
    options: [
      { id: "a", text: "Ohm", isCorrect: true },
      { id: "b", text: "Volt", isCorrect: false },
    ],
    subject: "QA Physics",
    gradeLevelId: gradeId,
    tags: [tag, "electricity"],
    difficulty: "easy",
    imageUrl: "https://example.com/r.png",
  }
  expect((await ahmed.post("/api/instructor/question-bank", { data: { ...item, imageUrl: "ftp://x" } })).status()).toBe(400)
  expect((await ahmed.post("/api/instructor/question-bank", { data: { ...item, gradeLevelId: "nope" } })).status()).toBe(400)
  expect((await ahmed.post("/api/instructor/question-bank", { data: { ...item, difficulty: "insane" } })).status()).toBe(400)
  expect((await s1.api.post("/api/instructor/question-bank", { data: item })).status()).toBe(403)
  expect((await s1.api.get("/api/instructor/question-bank")).status()).toBe(403)

  const created = await ahmed.post("/api/instructor/question-bank", { data: item })
  expect(created.status(), await created.text()).toBe(201)
  bankItemId = (await created.json()).id
  const essay = await ahmed.post("/api/instructor/question-bank", {
    data: { question: "QA bank essay", type: "ESSAY", points: 5, tags: [tag], difficulty: "hard" },
  })
  expect(essay.status()).toBe(201)

  const byTag = await (await ahmed.get(`/api/instructor/question-bank?tag=${tag}`)).json()
  expect(byTag.total).toBe(2)
  expect(byTag.tags).toContain(tag)
  expect(byTag.subjects).toContain("QA Physics")
  const byType = await (await ahmed.get(`/api/instructor/question-bank?tag=${tag}&type=ESSAY`)).json()
  expect(byType.items.map((i: any) => i.question)).toEqual(["QA bank essay"])
  const byDiff = await (await ahmed.get(`/api/instructor/question-bank?tag=${tag}&difficulty=easy`)).json()
  expect(byDiff.items.map((i: any) => i.id)).toEqual([bankItemId])
  const byGrade = await (await ahmed.get(`/api/instructor/question-bank?tag=${tag}&gradeLevelId=${gradeId}`)).json()
  expect(byGrade.items.map((i: any) => i.id)).toEqual([bankItemId])
  const bySearch = await (await ahmed.get(`/api/instructor/question-bank?tag=${tag}&q=${encodeURIComponent("المقاومة")}`)).json()
  expect(bySearch.items.map((i: any) => i.id)).toEqual([bankItemId])

  // Another teacher can't see or change it
  expect((await sara.get(`/api/instructor/question-bank/${bankItemId}`)).status()).toBe(404)
  expect((await sara.patch(`/api/instructor/question-bank/${bankItemId}`, { data: item })).status()).toBe(404)
  expect((await sara.delete(`/api/instructor/question-bank/${bankItemId}`)).status()).toBe(404)
  const saraList = await (await sara.get(`/api/instructor/question-bank?tag=${tag}`)).json()
  expect(saraList.total).toBe(0)

  const patched = await ahmed.patch(`/api/instructor/question-bank/${bankItemId}`, { data: { ...item, difficulty: "medium" } })
  expect(patched.status()).toBe(200)
  expect((await patched.json()).difficulty).toBe("medium")
})

test("EX-15 import from the bank copies questions into the teacher's own quiz only", async () => {
  const sarasQuiz = fixtures().quizzes.sara.id
  expect(
    (await ahmed.post("/api/instructor/question-bank/import", { data: { quizId: sarasQuiz, itemIds: [bankItemId] } })).status()
  ).toBe(403)
  const saraImport = await sara.post("/api/instructor/question-bank/import", { data: { quizId: sarasQuiz, itemIds: [bankItemId] } })
  expect(saraImport.status()).toBe(404)
  expect((await s1.api.post("/api/instructor/question-bank/import", { data: { quizId: quizA.id, itemIds: [bankItemId] } })).status()).toBe(403)

  const before = await db().quizQuestion.count({ where: { quizId: quizA.id } })
  const res = await ahmed.post("/api/instructor/question-bank/import", { data: { quizId: quizA.id, itemIds: [bankItemId] } })
  expect(res.status(), await res.text()).toBe(201)
  expect((await res.json()).imported).toBe(1)
  const questions = await db().quizQuestion.findMany({ where: { quizId: quizA.id }, orderBy: { position: "asc" } })
  expect(questions.length).toBe(before + 1)
  const copy = questions[questions.length - 1]
  expect(copy).toMatchObject({ question: "QA bank: unit of resistance?", points: 2, imageUrl: "https://example.com/r.png" })
  expect(copy.position).toBe(Math.max(...questions.slice(0, -1).map((q) => q.position)) + 1)

  // The copy is independent of the bank
  await ahmed.delete(`/api/instructor/question-bank/${bankItemId}`)
  expect(await db().questionBankItem.count({ where: { id: bankItemId } })).toBe(0)
  expect(await db().quizQuestion.count({ where: { id: copy.id } })).toBe(1)
  expect(await db().activityLog.count({ where: { action: "question_bank.imported", entityId: quizA.id } })).toBeGreaterThan(0)
})

test("EX-16 certificate eligibility ignores attempts awaiting grading", async () => {
  // A fresh essay attempt that is still pending must not count as passed.
  const s3 = await newStudent()
  const start = await (await s3.api.post("/api/quiz/start", { data: { quizId: quizB.id } })).json()
  await s3.api.post("/api/quiz/submit", {
    data: { attemptId: start.attemptId, answers: [{ questionId: quizB.mcId, answer: "a" }, { questionId: quizB.essayId, answer: "QA text" }] },
  })
  const passed = await db().quizAttempt.count({ where: { userId: s3.id, quizId: quizB.id, passed: true } })
  expect(passed).toBe(0)
  const cert = await db().certificate.findUnique({ where: { userId_courseId: { userId: s3.id, courseId } } })
  expect(cert).toBeNull()
})

test("EX-17 grading and question-bank pages render for the teacher; quiz page for the student", async ({ page, context }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  await context.addCookies((await ahmed.storageState()).cookies)
  for (const path of ["/instructor/grading", "/instructor/question-bank"]) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBe(200)
    await page.waitForLoadState("networkidle")
  }
  await context.clearCookies()
  await context.addCookies((await s2.api.storageState()).cookies)
  const res = await page.goto(`/courses/${courseSlug}/lessons/${lessonA}/quiz`)
  expect(res?.status()).toBe(200)
  expect(await page.content()).not.toContain("isCorrect")
  expect(errors).toEqual([])
})
