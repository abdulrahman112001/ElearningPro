import { test, expect, APIRequestContext } from "@playwright/test"
import Stripe from "stripe"
import { anon, apiAs, db, fixtures, loginApi, uniqueEmail } from "./support"

/**
 * The owner's end-to-end story, step by step:
 *   teacher "عبد الرحمن معلم" and student "عبد الرحمن طالب" register; the
 *   teacher publishes lessons for a grade; the student pays a monthly
 *   subscription, watches, asks questions, messages the teacher, takes the
 *   quiz and earns a certificate; the teacher sees the best and weakest
 *   students and alerts a student and the guardian; the admin can see every
 *   action and conversation.
 */
test.describe.configure({ mode: "serial" })

const WEBHOOK_SECRET = "whsec_dummy_qa"
const PASSWORD = "Scenario123!"

type Account = { id: string; email: string; api: APIRequestContext }

async function register(name: string, role: "STUDENT" | "INSTRUCTOR"): Promise<Account> {
  const email = uniqueEmail(role === "STUDENT" ? "talib" : "moalem")
  const res = await (await anon()).post("/api/auth/register", {
    data: { name, email, password: PASSWORD, role },
    headers: { "x-forwarded-for": `10.50.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
  })
  expect(res.status(), await res.text()).toBe(201)
  const user = await db().user.findUniqueOrThrow({ where: { email } })
  return { id: user.id, email, api: await loginApi(email, PASSWORD) }
}

/** What Stripe sends after a successful subscription checkout. */
async function payTeacherSubscription(studentId: string, instructorId: string, amount: number) {
  const pi = `pi_sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const payload = JSON.stringify({
    id: `evt_${pi}`,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${pi}`,
        object: "checkout.session",
        payment_intent: pi,
        amount_total: amount * 100,
        metadata: {
          type: "teacher_subscription",
          userId: studentId,
          instructorId,
          amount: String(amount),
          instructorShare: String(amount * 0.7),
          platformShare: String(amount * 0.3),
        },
      },
    },
  })
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET })
  const res = await (await anon()).post("/api/webhooks/stripe", {
    data: Buffer.from(payload),
    headers: { "stripe-signature": signature, "content-type": "application/json" },
  })
  expect(res.status(), await res.text()).toBe(200)
  return pi
}

let teacher: Account
let student: Account
let weakStudent: Account
let admin: APIRequestContext
let gradeId: string
let groupId: string
let courseId: string
let courseSlug: string
let videoLessonId: string
let quizLessonId: string
let quizId: string
let questionIds: string[]
let groupCourseId: string

test("SC-01 teacher and student register", async () => {
  teacher = await register("عبد الرحمن معلم", "INSTRUCTOR")
  student = await register("عبد الرحمن طالب", "STUDENT")
  weakStudent = await register("طالب يحتاج متابعة", "STUDENT")
  admin = await apiAs("admin")

  const profile = await db().instructorProfile.findUniqueOrThrow({ where: { userId: teacher.id } })
  expect(profile.isApproved, "a new teacher waits for admin approval").toBe(false)
})

test("SC-02 admin approves the teacher", async () => {
  const res = await admin.patch(`/api/admin/instructors/${teacher.id}`, { data: { action: "approve" } })
  expect(res.status(), await res.text()).toBe(200)
})

test("SC-03 teacher sets a monthly subscription price", async () => {
  const res = await teacher.api.patch("/api/instructor/subscription", { data: { enabled: true, monthlyPrice: 200 } })
  expect(res.status(), await res.text()).toBe(200)
  const offer = await (await (await anon()).get(`/api/instructors/${teacher.id}/subscription`)).json()
  expect(offer).toMatchObject({ enabled: true, monthlyPrice: 200, subscribed: false })
})

test("SC-04 grades exist and the teacher creates a class group", async () => {
  const grades = await (await (await anon()).get("/api/grade-levels")).json()
  expect(grades.length).toBeGreaterThanOrEqual(12)
  gradeId = grades.find((g: any) => g.nameAr === "الصف الثالث الثانوي").id

  const res = await teacher.api.post("/api/instructor/groups", {
    data: { name: "مجموعة السبت", description: "حصص السبت", gradeLevelId: gradeId },
  })
  expect(res.status(), await res.text()).toBe(201)
  groupId = (await res.json()).id
})

test("SC-05 teacher publishes a course with lessons and a quiz for the grade", async () => {
  const api = teacher.api
  const created = await api.post("/api/instructor/courses", {
    data: {
      title: `Physics 3rd Secondary ${Date.now()}`,
      titleAr: "فيزياء الصف الثالث الثانوي",
      description: "Full physics curriculum",
      categoryId: fixtures().categoryId,
      level: "BEGINNER",
      language: "ar",
      gradeLevelId: gradeId,
    },
  })
  expect(created.status(), await created.text()).toBe(201)
  const course = await created.json()
  courseId = course.id
  courseSlug = course.slug
  expect((await api.patch(`/api/instructor/courses/${courseId}`, { data: { price: 300 } })).status()).toBe(200)

  const chapter = await (await api.post(`/api/instructor/courses/${courseId}/chapters`, { data: { title: "الكهربية" } })).json()
  const lessonUrl = `/api/instructor/courses/${courseId}/chapters/${chapter.id}/lessons`
  const video = await (await api.post(lessonUrl, { data: { title: "قانون أوم", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } })).json()
  const quizLesson = await (await api.post(lessonUrl, { data: { title: "اختبار الكهربية" } })).json()
  videoLessonId = video.id
  quizLessonId = quizLesson.id
  for (const id of [videoLessonId, quizLessonId]) {
    const r = await api.patch(`${lessonUrl}/${id}`, { data: { isPublished: true } })
    expect(r.status(), await r.text()).toBe(200)
  }

  const quiz = await api.post(`/api/instructor/courses/${courseId}/lessons/${quizLessonId}/quiz`, {
    data: {
      title: "اختبار الكهربية",
      passingScore: 50,
      questions: [
        {
          question: "وحدة قياس المقاومة؟",
          type: "MULTIPLE_CHOICE",
          position: 0,
          points: 1,
          options: [
            { id: "a", text: "أوم", isCorrect: true },
            { id: "b", text: "فولت", isCorrect: false },
          ],
        },
        {
          question: "التيار يقاس بـ",
          type: "MULTIPLE_CHOICE",
          position: 1,
          points: 1,
          options: [
            { id: "a", text: "أمبير", isCorrect: true },
            { id: "b", text: "وات", isCorrect: false },
          ],
        },
      ],
    },
  })
  expect(quiz.status(), await quiz.text()).toBe(201)
  const q = await db().quiz.findUniqueOrThrow({ where: { lessonId: quizLessonId }, include: { questions: { orderBy: { position: "asc" } } } })
  quizId = q.id
  questionIds = q.questions.map((x) => x.id)

  const pub = await api.post(`/api/instructor/courses/${courseId}/publish`)
  expect(pub.status(), await pub.text()).toBe(200)
  expect((await pub.json()).status, "approved teacher publishes directly").toBe("PUBLISHED")
})

test("SC-06 the course is listed under its grade", async () => {
  const body = await (await (await anon()).get(`/api/courses?grade=${gradeId}&limit=50`)).json()
  expect(body.courses.map((c: any) => c.id)).toContain(courseId)
})

test("SC-07 student sets grade and guardian; paid course is locked before subscribing", async () => {
  const res = await student.api.patch("/api/user/profile", {
    data: { gradeLevelId: gradeId, guardianName: "ولي أمر عبد الرحمن", guardianEmail: "guardian.abdelrahman@qa.test", guardianPhone: "01000000000" },
  })
  expect(res.status(), await res.text()).toBe(200)
  await weakStudent.api.patch("/api/user/profile", { data: { gradeLevelId: gradeId, guardianEmail: "guardian.weak@qa.test" } })

  expect((await student.api.post(`/api/courses/${courseId}/enroll`)).status()).toBe(402)
  expect((await student.api.get(`/api/lessons/${videoLessonId}/questions`)).status()).toBe(403)
})

test("SC-08 student pays the monthly subscription and gets access", async () => {
  await payTeacherSubscription(student.id, teacher.id, 200)
  await payTeacherSubscription(weakStudent.id, teacher.id, 200)

  const offer = await (await student.api.get(`/api/instructors/${teacher.id}/subscription`)).json()
  expect(offer.subscribed).toBe(true)
  expect(new Date(offer.endsAt).getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 3600 * 1000)

  const enroll = await student.api.post(`/api/courses/${courseId}/enroll`)
  expect(enroll.status(), await enroll.text()).toBe(201)
  expect((await enroll.json()).via).toBe("subscription")
  expect((await weakStudent.api.post(`/api/courses/${courseId}/enroll`)).status()).toBe(201)

  const subs = await (await student.api.get("/api/subscriptions")).json()
  expect(subs[0].instructor.id).toBe(teacher.id)

  const teacherSubs = await (await teacher.api.get("/api/instructor/subscribers")).json()
  expect(teacherSubs.stats.active).toBe(2)
})

test("SC-09 student watches the lesson page", async ({ page, context }) => {
  await context.addCookies((await student.api.storageState()).cookies)
  const res = await page.goto(`/courses/${courseSlug}/learn/${videoLessonId}`)
  expect(res?.status()).toBe(200)
  expect(new URL(page.url()).pathname).toContain("/learn/")
  const done = await student.api.post("/api/progress/lesson", { data: { lessonId: videoLessonId, completed: true, watchedDuration: 600 } })
  expect(done.status(), await done.text()).toBe(200)
})

test("SC-10 student asks a question under the lesson; teacher answers", async () => {
  const asked = await student.api.post(`/api/lessons/${videoLessonId}/questions`, {
    data: { content: "يا أستاذ، ما الفرق بين المقاومة والمقاومية؟" },
  })
  expect(asked.status(), await asked.text()).toBe(201)
  const questionId = (await asked.json()).id

  const inbox = await (await teacher.api.get("/api/instructor/questions?status=unanswered")).json()
  expect(inbox.unanswered).toBe(1)
  expect(inbox.questions[0].id).toBe(questionId)

  const answered = await teacher.api.post(`/api/questions/${questionId}/answers`, {
    data: { content: "المقاومة تعتمد على أبعاد الموصل، والمقاومية خاصية للمادة نفسها." },
  })
  expect(answered.status(), await answered.text()).toBe(201)

  const thread = await (await student.api.get(`/api/lessons/${videoLessonId}/questions`)).json()
  expect(thread[0].answeredByInstructor).toBe(true)
  expect(thread[0].answers[0].isInstructor).toBe(true)

  const notes = await db().notification.findMany({ where: { userId: student.id, type: "QUESTION_ANSWERED" } })
  expect(notes.length).toBe(1)
})

test("SC-11 student messages the teacher and the teacher replies", async () => {
  const sent = await student.api.post(`/api/messages/${teacher.id}`, { data: { content: "شكرًا يا أستاذ، عندي سؤال عن الواجب" } })
  expect(sent.status(), await sent.text()).toBe(200)
  const reply = await teacher.api.post(`/api/messages/${student.id}`, { data: { content: "تفضل يا عبد الرحمن" } })
  expect(reply.status(), await reply.text()).toBe(200)
})

test("SC-12 students take the quiz; the top student earns a certificate", async () => {
  // Strong student: all correct
  const start = await student.api.post("/api/quiz/start", { data: { quizId } })
  expect(start.status(), await start.text()).toBe(200)
  const { attemptId } = await start.json()
  const submit = await student.api.post("/api/quiz/submit", {
    data: { attemptId, answers: questionIds.map((id) => ({ questionId: id, answer: "a" })) },
  })
  expect(submit.status(), await submit.text()).toBe(200)
  expect(await submit.json()).toMatchObject({ score: 100, passed: true })

  const cert = await db().certificate.findUnique({ where: { userId_courseId: { userId: student.id, courseId } } })
  expect(cert, "certificate issued after finishing lessons and passing the quiz").toBeTruthy()
  expect((await student.api.post(`/api/certificates/${courseId}`)).status()).toBe(200)

  // Weak student: all wrong
  const s2 = await (await weakStudent.api.post("/api/quiz/start", { data: { quizId } })).json()
  const r2 = await weakStudent.api.post("/api/quiz/submit", {
    data: { attemptId: s2.attemptId, answers: questionIds.map((id) => ({ questionId: id, answer: "b" })) },
  })
  expect(await r2.json()).toMatchObject({ score: 0, passed: false })
})

test("SC-13 teacher sees the best and the weakest students", async () => {
  const res = await teacher.api.get(`/api/instructor/results?courseId=${courseId}`)
  expect(res.status(), await res.text()).toBe(200)
  const body = await res.json()
  expect(body.ranking[0]).toMatchObject({ studentId: student.id, averageScore: 100, rank: 1 })
  expect(body.ranking.at(-1)).toMatchObject({ studentId: weakStudent.id, averageScore: 0 })
  expect(body.quizStats[0]).toMatchObject({ students: 2, passRate: 50 })
  // Other teachers cannot see these results
  const other = await (await apiAs("sara")).get(`/api/instructor/results?courseId=${courseId}`)
  expect((await other.json()).ranking).toEqual([])
})

test("SC-14 teacher alerts the weak student and emails the guardian", async () => {
  const res = await teacher.api.post("/api/alerts", {
    data: {
      studentId: weakStudent.id,
      title: "متابعة مستوى الطالب",
      message: "حصل الطالب على 0% في اختبار الكهربية، نرجو المتابعة والمراجعة.",
      toGuardian: true,
    },
  })
  expect(res.status(), await res.text()).toBe(201)
  const alert = await res.json()
  expect(alert).toMatchObject({ toGuardian: true, guardianEmail: "guardian.weak@qa.test", emailDelivered: true })
  const note = await db().notification.findFirst({ where: { userId: weakStudent.id, type: "STUDENT_ALERT" } })
  expect(note?.title).toBe("متابعة مستوى الطالب")

  // A teacher cannot alert someone who is not their student
  const stranger = await (await apiAs("sara")).post("/api/alerts", {
    data: { studentId: weakStudent.id, title: "x", message: "y" },
  })
  expect(stranger.status()).toBe(403)
})

test("SC-15 group-only lessons are visible to group members only", async () => {
  const api = teacher.api
  const created = await (await api.post("/api/instructor/courses", {
    data: {
      title: `Saturday group revision ${Date.now()}`,
      titleAr: "مراجعة مجموعة السبت",
      description: "Revision for the Saturday group",
      categoryId: fixtures().categoryId,
      level: "BEGINNER",
      language: "ar",
      gradeLevelId: gradeId,
      classGroupId: groupId,
    },
  })).json()
  groupCourseId = created.id
  const chapter = await (await api.post(`/api/instructor/courses/${groupCourseId}/chapters`, { data: { title: "مراجعة" } })).json()
  const lesson = await (await api.post(`/api/instructor/courses/${groupCourseId}/chapters/${chapter.id}/lessons`, { data: { title: "مراجعة 1" } })).json()
  await api.patch(`/api/instructor/courses/${groupCourseId}/chapters/${chapter.id}/lessons/${lesson.id}`, { data: { isPublished: true } })
  expect((await api.post(`/api/instructor/courses/${groupCourseId}/publish`)).status()).toBe(200)

  // Subscribed but not in the group: refused
  const refused = await weakStudent.api.post(`/api/courses/${groupCourseId}/enroll`)
  expect(refused.status()).toBe(403)
  expect((await refused.json()).code).toBe("group_only")

  // Added to the group: allowed
  const add = await api.post(`/api/instructor/groups/${groupId}/members`, { data: { email: student.email } })
  expect(add.status(), await add.text()).toBe(201)
  expect((await student.api.post(`/api/courses/${groupCourseId}/enroll`)).status()).toBe(201)

  const group = await (await api.get(`/api/instructor/groups/${groupId}`)).json()
  expect(group.members.map((m: any) => m.student.id)).toEqual([student.id])
})

test("SC-16 admin sees every action and every conversation", async () => {
  const feed = await (await admin.get(`/api/admin/activity?limit=100`)).json()
  const actions = new Set(
    feed.items.filter((i: any) => [teacher.id, student.id, weakStudent.id].includes(i.actorId)).map((i: any) => i.action)
  )
  for (const a of [
    "user.registered",
    "group.created",
    "course.created",
    "course.published",
    "subscription.activated",
    "enrollment.created",
    "question.asked",
    "question.answered",
    "message.sent",
    "quiz.submitted",
    "alert.sent",
    "group.member_added",
  ]) {
    expect(actions, `activity feed has ${a}`).toContain(a)
  }

  const convs = await (await admin.get(`/api/admin/conversations?q=${encodeURIComponent(student.email)}`)).json()
  const pair = convs.conversations.find((c: any) => c.participants.some((p: any) => p.id === teacher.id))
  expect(pair?.messageCount).toBe(2)
  const thread = await (await admin.get(`/api/admin/conversations/${student.id}/${teacher.id}`)).json()
  expect(thread.messages.map((m: any) => m.content)).toEqual(["شكرًا يا أستاذ، عندي سؤال عن الواجب", "تفضل يا عبد الرحمن"])

  // Non-admins cannot read the oversight APIs
  expect((await teacher.api.get("/api/admin/activity")).status()).toBe(403)
  expect((await student.api.get("/api/admin/conversations")).status()).toBe(403)
})

test("SC-17 an expired subscription closes the course again", async () => {
  await db().teacherSubscription.updateMany({
    where: { studentId: weakStudent.id, instructorId: teacher.id },
    data: { endsAt: new Date(Date.now() - 1000) },
  })
  expect((await weakStudent.api.get(`/api/progress/course/${courseId}`)).status()).toBe(403)
  // The student who still has an active subscription keeps access
  expect((await student.api.get(`/api/progress/course/${courseId}`)).status()).toBe(200)
})
