import { test, expect } from "@playwright/test"
import { apiAs, db, fixtures, registerUser } from "./support"

test.describe("Quiz delivery", () => {
  test("LRN-01 enrolled student sees questions without correct answers", async () => {
    const f = fixtures()
    const res = await (await apiAs("student")).get(`/api/quizzes/${f.quizzes.react.lessonId}`)
    expect(res.status()).toBe(200)
    const text = await res.text()
    expect(text).not.toContain("isCorrect")
    expect(JSON.parse(text).questions.length).toBe(2)
  })

  test("LRN-02 instructor owner sees the answer key", async () => {
    const res = await (await apiAs("ahmed")).get(`/api/quizzes/${fixtures().quizzes.react.lessonId}`)
    expect(await res.text()).toContain("isCorrect")
  })

  test("LRN-03 non-enrolled student gets 403 for quiz and for quiz/start", async () => {
    const f = fixtures()
    const u = await registerUser()
    expect((await u.api.get(`/api/quizzes/${f.quizzes.react.lessonId}`)).status()).toBe(403)
    expect((await u.api.post("/api/quiz/start", { data: { quizId: f.quizzes.react.id } })).status()).toBe(403)
  })

  test("LRN-04 the quiz page HTML does not leak the answer key", async ({ page, context }) => {
    const f = fixtures()
    await context.addCookies((await (await apiAs("student")).storageState()).cookies)
    const res = await page.goto(`/courses/${f.courses.react.slug}/lessons/${f.quizzes.react.lessonId}/quiz`)
    expect(res?.status()).toBeLessThan(500)
    expect(await page.content()).not.toContain("isCorrect")
  })
})

test.describe("Quiz grading", () => {
  test("LRN-10 server grades: all correct -> 100 and passed; resubmit -> 400", async () => {
    const f = fixtures()
    const u = await registerUser()
    // enroll the throwaway user directly (paid course)
    const user = await db().user.findUniqueOrThrow({ where: { email: u.email } })
    await db().enrollment.create({ data: { userId: user.id, courseId: f.courses.react.id } })

    const start = await u.api.post("/api/quiz/start", { data: { quizId: f.quizzes.react.id } })
    expect(start.status()).toBe(200)
    const { attemptId } = await start.json()
    const again = await (await u.api.post("/api/quiz/start", { data: { quizId: f.quizzes.react.id } })).json()
    expect(again.attemptId, "open attempt is reused").toBe(attemptId)

    const [q1, q2] = f.quizzes.react.questionIds
    const submit = await u.api.post("/api/quiz/submit", { data: { attemptId, answers: [{ questionId: q1, answer: "a" }, { questionId: q2, answer: ["y", "x"] }] } })
    expect(submit.status(), await submit.text()).toBe(200)
    const result = await submit.json()
    expect(result.score).toBe(100)
    expect(result.passed).toBe(true)

    const resubmit = await u.api.post("/api/quiz/submit", { data: { attemptId, answers: [] } })
    expect(resubmit.status()).toBe(400)
  })

  test("LRN-11 partial multi-select earns no point; wrong single -> 0", async () => {
    const f = fixtures()
    const u = await registerUser()
    const user = await db().user.findUniqueOrThrow({ where: { email: u.email } })
    await db().enrollment.create({ data: { userId: user.id, courseId: f.courses.react.id } })
    const { attemptId } = await (await u.api.post("/api/quiz/start", { data: { quizId: f.quizzes.react.id } })).json()
    const [q1, q2] = f.quizzes.react.questionIds
    const result = await (await u.api.post("/api/quiz/submit", { data: { attemptId, answers: [{ questionId: q1, answer: "b" }, { questionId: q2, answer: ["x"] }] } })).json()
    expect(result.score).toBe(0)
    expect(result.passed).toBe(false)
  })

  test("LRN-12 cannot submit someone else's attempt", async () => {
    const f = fixtures()
    const u = await registerUser()
    const res = await u.api.post("/api/quiz/submit", { data: { attemptId: f.quizzes.timed.staleAttemptId, answers: [] } })
    expect(res.status()).toBe(403)
  })

  test("LRN-13 @known-bug time limit is enforced on submit", async () => {
    const f = fixtures()
    const student = await apiAs("student")
    const [q1, q2] = f.quizzes.timed.questionIds
    const res = await student.post("/api/quiz/submit", {
      data: { attemptId: f.quizzes.timed.staleAttemptId, answers: [{ questionId: q1, answer: "a" }, { questionId: q2, answer: ["x", "y"] }] },
    })
    expect(res.status(), "submission 3h into a 5-minute quiz was accepted").toBe(400)
  })

  test("LRN-14 @known-bug non-array answers -> 400 not 500", async () => {
    const f = fixtures()
    const u = await registerUser()
    const user = await db().user.findUniqueOrThrow({ where: { email: u.email } })
    await db().enrollment.create({ data: { userId: user.id, courseId: f.courses.react.id } })
    const { attemptId } = await (await u.api.post("/api/quiz/start", { data: { quizId: f.quizzes.react.id } })).json()
    const res = await u.api.post("/api/quiz/submit", { data: { attemptId, answers: "x" } })
    expect(res.status()).toBeLessThan(500)
  })

  test("LRN-15 quiz/start is rate-limited (21st call -> 429)", async () => {
    const u = await registerUser()
    let last = 0
    for (let i = 0; i < 21; i++) last = (await u.api.post("/api/quiz/start", { data: { quizId: "nonexistent" } })).status()
    expect(last).toBe(429)
  })
})

test.describe("Progress & certificates", () => {
  test("LRN-20 progress requires enrollment", async () => {
    const f = fixtures()
    const u = await registerUser()
    const res = await u.api.post("/api/progress/lesson", { data: { lessonId: f.courses.react.lessonIds[0], completed: true } })
    expect(res.status()).toBe(403)
    expect((await u.api.get(`/api/progress/course/${f.courses.react.id}`)).status()).toBe(403)
  })

  test("LRN-21 certificate refused before course completion", async () => {
    const f = fixtures()
    const u = await registerUser()
    const user = await db().user.findUniqueOrThrow({ where: { email: u.email } })
    await db().enrollment.create({ data: { userId: user.id, courseId: f.courses.react.id } })
    const res = await u.api.post(`/api/certificates/${f.courses.react.id}`)
    expect(res.status()).toBe(400)
  })

  test("LRN-22 @known-bug certificate cannot be earned by skipping a failed/untaken quiz", async () => {
    // Marks every lesson complete via the API without ever passing the quiz
    // attached to lesson 1, then asks for a certificate.
    const f = fixtures()
    const u = await registerUser()
    const user = await db().user.findUniqueOrThrow({ where: { email: u.email } })
    await db().enrollment.create({ data: { userId: user.id, courseId: f.courses.react.id } })
    const lessons = await db().lesson.findMany({ where: { chapter: { courseId: f.courses.react.id }, isPublished: true } })
    for (const l of lessons) {
      await u.api.post("/api/progress/lesson", { data: { lessonId: l.id, completed: true, watchedDuration: 1 } })
    }
    const res = await u.api.post(`/api/certificates/${f.courses.react.id}`)
    expect(res.status(), "certificate issued with quizzes never taken and 1s watch time").toBe(400)
  })

  test("LRN-23 certificate verification: unknown number -> 404", async ({ request }) => {
    expect((await request.get("/api/certificates/verify/CERT-DOES-NOT-EXIST")).status()).toBe(404)
  })
})
