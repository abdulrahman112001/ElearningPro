import { test, expect, APIRequestContext, Page } from "@playwright/test"
import { ACCOUNTS, BASE_URL, anon, apiAs, db, fixtures, registerUser } from "./support"
import {
  evaluateDailyLimit,
  parseDailyLimit,
  parseGenerateRequest,
  startOfDay,
  validateGeneratedQuestions,
} from "../../lib/ai/validate"

/**
 * AI features (Claude). The test server has no ANTHROPIC_API_KEY, so every
 * request that would reach the model ends in 503 ai_not_configured. Order of
 * checks on every AI endpoint: auth -> validation -> permission -> configured
 * -> daily limit, so everything before "configured" is fully testable here;
 * the limit itself is covered through /api/ai/status and the pure helpers.
 */
test.describe.configure({ mode: "serial" })

let ahmed: APIRequestContext
let sara: APIRequestContext
let admin: APIRequestContext
let student: APIRequestContext
let outsider: { api: APIRequestContext; id: string }
let enrolled: { api: APIRequestContext; id: string }
let saraCourseId: string | undefined

const LIMIT_KEY = "ai.dailyLimit"
let previousLimit: string | null = null

test.beforeAll(async () => {
  ahmed = await apiAs("ahmed")
  sara = await apiAs("sara")
  admin = await apiAs("admin")
  student = await apiAs("student")
  const o = await registerUser("STUDENT")
  outsider = { api: o.api, id: (await db().user.findUniqueOrThrow({ where: { email: o.email } })).id }
  const e = await registerUser("STUDENT")
  enrolled = { api: e.api, id: (await db().user.findUniqueOrThrow({ where: { email: e.email } })).id }
  await db().enrollment.create({ data: { userId: enrolled.id, courseId: fixtures().courses.react.id } })
  saraCourseId = (await db().course.findFirst({ where: { instructorId: fixtures().users.sara }, select: { id: true } }))?.id
  previousLimit = (await db().setting.findUnique({ where: { key: LIMIT_KEY } }))?.value ?? null
})

test.afterAll(async () => {
  if (previousLimit === null) await db().setting.deleteMany({ where: { key: LIMIT_KEY } })
  else await db().setting.update({ where: { key: LIMIT_KEY }, data: { value: previousLimit } })
  await db().aiUsage.deleteMany({ where: { userId: { in: [outsider.id, enrolled.id] } } })
})

const lessonId = () => fixtures().courses.react.lessonIds[0]
const courseId = () => fixtures().courses.react.id

test("AI-01 anonymous callers are refused everywhere", async () => {
  const a = await anon()
  expect((await a.post("/api/ai/generate-questions", { data: { lessonId: lessonId() } })).status()).toBe(401)
  expect((await a.post("/api/ai/tutor", { data: { courseId: courseId(), message: "hi" } })).status()).toBe(401)
  expect((await a.get(`/api/ai/tutor?courseId=${courseId()}`)).status()).toBe(401)
  expect((await a.delete(`/api/ai/tutor?courseId=${courseId()}`)).status()).toBe(401)
  expect((await a.post("/api/ai/diagnose", { data: { studentId: enrolled.id } })).status()).toBe(401)
  expect((await a.get("/api/ai/status")).status()).toBe(401)
  expect((await a.get("/api/ai/admin")).status()).toBe(401)
  expect((await a.patch(`/api/instructor/lessons/${lessonId()}/transcript`, { data: { transcript: "x" } })).status()).toBe(401)
})

test("AI-02 generate-questions validates its input before anything else", async () => {
  const cases: [Record<string, unknown>, string][] = [
    [{}, "lessonId"],
    [{ lessonId: lessonId(), count: 0 }, "count"],
    [{ lessonId: lessonId(), count: 21 }, "count"],
    [{ lessonId: lessonId(), count: 2.5 }, "count"],
    [{ lessonId: lessonId(), types: [] }, "types"],
    [{ lessonId: lessonId(), types: ["MULTIPLE_CHOICE", "ORAL"] }, "types"],
    [{ lessonId: lessonId(), difficulty: "insane" }, "difficulty"],
    [{ lessonId: lessonId(), language: "fr" }, "language"],
    [{ lessonId: 42 }, "lessonId"],
  ]
  for (const [data, field] of cases) {
    const res = await ahmed.post("/api/ai/generate-questions", { data })
    expect(res.status(), JSON.stringify(data)).toBe(400)
    expect((await res.json()).fields.map((f: any) => f.field)).toContain(field)
  }
  expect((await ahmed.post("/api/ai/generate-questions", { data: { lessonId: "nope", count: 3 } })).status()).toBe(404)
  expect((await ahmed.post("/api/ai/generate-questions", { data: { courseId: "nope", count: 3 } })).status()).toBe(404)
})

test("AI-03 only the course owner or an admin can generate; then 503 without a key", async () => {
  const body = { lessonId: lessonId(), count: 5, types: ["MULTIPLE_CHOICE"], difficulty: "easy", language: "ar" }
  expect((await student.post("/api/ai/generate-questions", { data: body })).status()).toBe(403)
  expect((await sara.post("/api/ai/generate-questions", { data: body })).status()).toBe(403)
  expect((await sara.post("/api/ai/generate-questions", { data: { courseId: courseId(), count: 3 } })).status()).toBe(403)

  for (const who of [ahmed, admin]) {
    const res = await who.post("/api/ai/generate-questions", { data: body })
    expect(res.status()).toBe(503)
    expect((await res.json()).code).toBe("ai_not_configured")
  }
  const course = await ahmed.post("/api/ai/generate-questions", { data: { courseId: courseId(), count: 20, language: "both" } })
  expect(course.status()).toBe(503)
})

test("AI-04 tutor: validation, course access, then 503 without a key", async () => {
  expect((await enrolled.api.post("/api/ai/tutor", { data: { courseId: courseId(), message: "  " } })).status()).toBe(400)
  expect((await enrolled.api.post("/api/ai/tutor", { data: { courseId: courseId(), message: "x".repeat(2001) } })).status()).toBe(400)
  expect((await enrolled.api.post("/api/ai/tutor", { data: { message: "hi" } })).status()).toBe(400)
  expect((await enrolled.api.post("/api/ai/tutor", { data: { courseId: "nope", message: "hi" } })).status()).toBe(404)

  // No enrollment / subscription -> no tutor.
  const denied = await outsider.api.post("/api/ai/tutor", { data: { courseId: courseId(), message: "hi" } })
  expect(denied.status()).toBe(403)
  expect((await outsider.api.get(`/api/ai/tutor?courseId=${courseId()}`)).status()).toBe(403)

  // A lesson from another course is rejected before reaching the model.
  const otherLesson = fixtures().courses.uiux.lessonIds[0]
  expect(
    (await enrolled.api.post("/api/ai/tutor", { data: { courseId: courseId(), lessonId: otherLesson, message: "hi" } })).status()
  ).toBe(404)

  for (const who of [enrolled.api, ahmed]) {
    const res = await who.post("/api/ai/tutor", { data: { courseId: courseId(), lessonId: lessonId(), message: "اشرح لي الدرس" } })
    expect(res.status()).toBe(503)
    expect((await res.json()).code).toBe("ai_not_configured")
    const history = await who.get(`/api/ai/tutor?courseId=${courseId()}`)
    expect(history.status()).toBe(503)
  }
  // Nothing was stored for refused requests.
  expect(await db().aiTutorMessage.count({ where: { userId: enrolled.id } })).toBe(0)

  // Clearing works even with AI disabled, and only touches the caller's own rows.
  await db().aiTutorMessage.createMany({
    data: [
      { userId: enrolled.id, courseId: courseId(), role: "user", content: "QA q" },
      { userId: enrolled.id, courseId: courseId(), role: "assistant", content: "QA a" },
    ],
  })
  const otherClear = await outsider.api.delete(`/api/ai/tutor?courseId=${courseId()}`)
  expect((await otherClear.json()).deleted).toBe(0)
  const clear = await enrolled.api.delete(`/api/ai/tutor?courseId=${courseId()}`)
  expect(clear.status()).toBe(200)
  expect((await clear.json()).deleted).toBe(2)
  expect((await enrolled.api.delete("/api/ai/tutor")).status()).toBe(400)
})

test("AI-05 diagnose: teachers of the student's course or admins only", async () => {
  expect((await student.post("/api/ai/diagnose", { data: { studentId: enrolled.id } })).status()).toBe(403)
  expect((await ahmed.post("/api/ai/diagnose", { data: {} })).status()).toBe(400)
  expect((await ahmed.post("/api/ai/diagnose", { data: { studentId: enrolled.id, courseId: 7 } })).status()).toBe(400)
  expect((await ahmed.post("/api/ai/diagnose", { data: { studentId: "nope" } })).status()).toBe(404)
  // An instructor id is not a student.
  expect((await ahmed.post("/api/ai/diagnose", { data: { studentId: fixtures().users.sara } })).status()).toBe(404)

  // Sara does not teach a course this student is enrolled in.
  expect((await sara.post("/api/ai/diagnose", { data: { studentId: enrolled.id } })).status()).toBe(403)
  // Ahmed cannot use Sara's course, nor diagnose a student not enrolled with him.
  if (saraCourseId) {
    expect((await ahmed.post("/api/ai/diagnose", { data: { studentId: enrolled.id, courseId: saraCourseId } })).status()).toBe(403)
  }
  expect((await ahmed.post("/api/ai/diagnose", { data: { studentId: outsider.id } })).status()).toBe(403)
  expect((await ahmed.post("/api/ai/diagnose", { data: { studentId: enrolled.id, courseId: "nope" } })).status()).toBe(404)

  for (const [who, data] of [
    [ahmed, { studentId: enrolled.id }],
    [ahmed, { studentId: enrolled.id, courseId: courseId() }],
    [admin, { studentId: enrolled.id }],
  ] as const) {
    const res = await who.post("/api/ai/diagnose", { data })
    expect(res.status()).toBe(503)
    expect((await res.json()).code).toBe("ai_not_configured")
  }
})

test("AI-06 transcript: owner/admin only, string up to 50k characters", async () => {
  const url = `/api/instructor/lessons/${lessonId()}/transcript`
  const original = (await db().lesson.findUniqueOrThrow({ where: { id: lessonId() } })).transcript
  try {
    expect((await student.patch(url, { data: { transcript: "x" } })).status()).toBe(403)
    expect((await sara.patch(url, { data: { transcript: "x" } })).status()).toBe(403)
    expect((await ahmed.patch(url, { data: { transcript: 5 } })).status()).toBe(400)
    expect((await ahmed.patch(url, { data: {} })).status()).toBe(400)
    const long = await ahmed.patch(url, { data: { transcript: "ا".repeat(50_001) } })
    expect(long.status()).toBe(400)
    expect((await long.json()).code).toBe("too_long")
    expect((await ahmed.patch("/api/instructor/lessons/nope/transcript", { data: { transcript: "x" } })).status()).toBe(404)

    const ok = await ahmed.patch(url, { data: { transcript: "QA transcript\r\nسطر ثانٍ" } })
    expect(ok.status()).toBe(200)
    expect((await db().lesson.findUniqueOrThrow({ where: { id: lessonId() } })).transcript).toBe("QA transcript\nسطر ثانٍ")
    expect((await ahmed.patch(url, { data: { transcript: "ب".repeat(50_000) } })).status()).toBe(200)
    expect((await admin.patch(url, { data: { transcript: "   " } })).status()).toBe(200)
    expect((await db().lesson.findUniqueOrThrow({ where: { id: lessonId() } })).transcript).toBeNull()
    const log = await db().activityLog.findFirst({
      where: { action: "lesson.transcript_updated", entityId: lessonId() },
      orderBy: { createdAt: "desc" },
    })
    expect(log).toBeTruthy()
  } finally {
    await db().lesson.update({ where: { id: lessonId() }, data: { transcript: original } })
  }
})

test("AI-07 admin settings: daily limit validation and usage counting", async () => {
  expect((await ahmed.get("/api/ai/admin")).status()).toBe(403)
  expect((await student.patch("/api/ai/admin", { data: { dailyLimit: 5 } })).status()).toBe(403)
  for (const dailyLimit of [-1, 1.5, "10", 1001, null]) {
    expect((await admin.patch("/api/ai/admin", { data: { dailyLimit } })).status(), String(dailyLimit)).toBe(400)
  }
  expect((await admin.patch("/api/ai/admin", { data: { dailyLimit: 2 } })).status()).toBe(200)

  let status = await (await enrolled.api.get("/api/ai/status")).json()
  expect(status).toMatchObject({ configured: false, limit: 2, used: 0, remaining: 2, exceeded: false })

  await db().aiUsage.createMany({
    data: [
      { userId: enrolled.id, feature: "tutor", model: "qa", inputTokens: 100, outputTokens: 50 },
      { userId: enrolled.id, feature: "tutor", model: "qa", inputTokens: 10, outputTokens: 5 },
      // Yesterday's usage does not count toward today's limit.
      { userId: enrolled.id, feature: "tutor", model: "qa", createdAt: new Date(Date.now() - 36 * 3600 * 1000) },
    ],
  })
  status = await (await enrolled.api.get("/api/ai/status")).json()
  expect(status).toMatchObject({ used: 2, remaining: 0, exceeded: true })
  // Without a key, "not configured" still wins over the limit (documented order).
  const res = await enrolled.api.post("/api/ai/tutor", { data: { courseId: courseId(), message: "hi" } })
  expect((await res.json()).code).toBe("ai_not_configured")

  const stats = await (await admin.get("/api/ai/admin")).json()
  expect(stats.configured).toBe(false)
  expect(stats.dailyLimit).toBe(2)
  expect(stats.totals.requests).toBeGreaterThanOrEqual(3)
  expect(JSON.stringify(stats)).not.toMatch(/sk-ant/)
  expect(stats.topUsers.some((u: any) => u.user.id === enrolled.id)).toBe(true)
})

test("AI-08 output validator and limit helpers (unit)", () => {
  const opts = { types: ["MULTIPLE_CHOICE", "TRUE_FALSE", "MULTIPLE_SELECT", "ESSAY"] as any, language: "en" as const, max: 10 }
  const mc = (over: any = {}) => ({
    type: "MULTIPLE_CHOICE",
    question: "Q?",
    questionAr: "",
    options: [
      { id: "a", text: "A", textAr: "", isCorrect: true },
      { id: "b", text: "B", textAr: "", isCorrect: false },
    ],
    explanation: "because",
    explanationAr: "",
    points: 2,
    ...over,
  })
  const { questions, rejected } = validateGeneratedQuestions(
    [
      mc(),
      mc({ options: [{ id: "a", text: "A", isCorrect: true }, { id: "a", text: "B", isCorrect: false }] }),
      mc({ options: [{ id: "a", text: "A", isCorrect: true }, { id: "b", text: "B", isCorrect: true }] }),
      mc({ type: "TRUE_FALSE", options: [{ id: "t", text: "T", isCorrect: false }, { id: "f", text: "F", isCorrect: false }] }),
      mc({ type: "MULTIPLE_SELECT", options: [{ id: "a", text: "A", isCorrect: false }, { id: "b", text: "B", isCorrect: false }] }),
      mc({ type: "MULTIPLE_SELECT", options: [{ id: "a", text: "A", isCorrect: true }, { id: "b", text: "B", isCorrect: true }] }),
      mc({ type: "ESSAY", options: [] }),
      mc({ type: "ESSAY" }),
      mc({ question: "" }),
      "junk",
    ],
    opts
  )
  expect(questions.map((q) => q.type)).toEqual(["MULTIPLE_CHOICE", "MULTIPLE_SELECT", "ESSAY"])
  expect(rejected.map((r) => r.reason)).toEqual([
    "duplicate_option_id",
    "correct_count",
    "correct_count",
    "correct_count",
    "essay_has_options",
    "empty_question",
    "not_an_object",
  ])
  expect(questions[0]).not.toHaveProperty("questionAr")

  // Types not requested and anything beyond `max` are dropped.
  expect(validateGeneratedQuestions([mc(), mc()], { ...opts, types: ["ESSAY"] }).questions).toHaveLength(0)
  expect(validateGeneratedQuestions([mc(), mc(), mc()], { ...opts, max: 2 }).questions).toHaveLength(2)

  // Arabic-only sets keep the Arabic text in the main fields; "both" requires Arabic.
  const ar = validateGeneratedQuestions([mc({ question: "", questionAr: "سؤال؟", options: [{ id: "a", text: "", textAr: "نعم", isCorrect: true }, { id: "b", text: "", textAr: "لا", isCorrect: false }] })], { ...opts, language: "ar" })
  expect(ar.questions[0]).toMatchObject({ question: "سؤال؟", questionAr: "سؤال؟" })
  expect(ar.questions[0].options[0]).toMatchObject({ text: "نعم" })
  expect(validateGeneratedQuestions([mc()], { ...opts, language: "both" }).rejected[0].reason).toBe("missing_arabic")

  expect(parseGenerateRequest({ lessonId: "l1" })).toMatchObject({ ok: true, value: { count: 5, language: "ar", difficulty: "medium" } })
  expect(parseGenerateRequest({ lessonId: "l1", courseId: "c1" })).toMatchObject({ ok: true, value: { lessonId: "l1", courseId: undefined } })

  expect(parseDailyLimit(undefined)).toBe(30)
  expect(parseDailyLimit("abc")).toBe(30)
  expect(parseDailyLimit("-3")).toBe(30)
  expect(parseDailyLimit("0")).toBe(0)
  expect(parseDailyLimit('"12"')).toBe(12)
  expect(evaluateDailyLimit(3, 3)).toEqual({ used: 3, limit: 3, remaining: 0, exceeded: true })
  expect(evaluateDailyLimit(0, 0).exceeded).toBe(true)
  expect(evaluateDailyLimit(1, 30)).toMatchObject({ remaining: 29, exceeded: false })

  // Cairo midnight: 2026-01-15 10:00Z -> 2026-01-14 22:00Z (UTC+2).
  expect(startOfDay(new Date("2026-01-15T10:00:00Z")).toISOString()).toBe("2026-01-14T22:00:00.000Z")
})

async function loginPage(page: Page, who: keyof typeof ACCOUNTS) {
  const csrf = await (await page.request.get(`${BASE_URL}/api/auth/csrf`)).json()
  await page.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    form: { ...ACCOUNTS[who], csrfToken: csrf.csrfToken, callbackUrl: BASE_URL, json: "true" },
    maxRedirects: 0,
  })
}

test("AI-09 pages load without errors", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  await loginPage(page, "ahmed")
  const res = await page.goto("/instructor/ai-insights")
  expect(res?.status()).toBe(200)
  await page.waitForLoadState("networkidle")
  await loginPage(page, "admin")
  const res2 = await page.goto("/admin/ai")
  expect(res2?.status()).toBe(200)
  await page.waitForLoadState("networkidle")
  expect(errors).toEqual([])
})
