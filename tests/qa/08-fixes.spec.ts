import { test, expect } from "@playwright/test"
import Stripe from "stripe"
import { anon, apiAs, db, fixtures, registerUser, approveInstructor } from "./support"

/**
 * Regression tests for fixes that had no direct test in the first QA round.
 */

// 1x1 transparent PNG, a real image so the server-side sharp check passes.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
)

const WEBHOOK_SECRET = "whsec_dummy_qa" // matches playwright.qa.config.ts

function signedCheckoutEvent(metadata: Record<string, string>, paymentIntent: string) {
  const payload = JSON.stringify({
    id: `evt_${paymentIntent}`,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${paymentIntent}`,
        object: "checkout.session",
        payment_intent: paymentIntent,
        amount_total: 19900,
        metadata,
      },
    },
  })
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET })
  return { payload, signature }
}

test.describe("Stripe webhook", () => {
  test("FIX-01 concurrent duplicate deliveries record one purchase and credit once", async () => {
    const f = fixtures()
    const u = await registerUser()
    const user = await db().user.findUniqueOrThrow({ where: { email: u.email } })
    const before = await db().instructorProfile.findUniqueOrThrow({ where: { userId: f.users.ahmed } })
    const pi = `pi_qa_${Date.now()}`
    const { payload, signature } = signedCheckoutEvent(
      {
        userId: user.id,
        courseId: f.courses.react.id,
        instructorId: f.users.ahmed,
        instructorShare: "139.3",
        platformShare: "59.7",
        discountAmount: "0",
        couponId: "",
      },
      pi
    )
    const ctx = await anon()
    const send = () =>
      ctx.post("/api/webhooks/stripe", {
        data: Buffer.from(payload),
        headers: { "stripe-signature": signature, "content-type": "application/json" },
      })
    const statuses = (await Promise.all([send(), send(), send()])).map((r) => r.status())
    expect(statuses.every((s) => s === 200), `statuses ${statuses}`).toBe(true)

    expect(await db().purchase.count({ where: { providerId: pi } })).toBe(1)
    expect(await db().enrollment.count({ where: { userId: user.id, courseId: f.courses.react.id } })).toBe(1)
    const after = await db().instructorProfile.findUniqueOrThrow({ where: { userId: f.users.ahmed } })
    expect(after.totalEarnings - before.totalEarnings).toBeCloseTo(139.3, 5)
  })

  test("FIX-02 payment from an already-enrolled user is recorded, not a 500 loop", async () => {
    const f = fixtures()
    const pi = `pi_qa_enrolled_${Date.now()}`
    const { payload, signature } = signedCheckoutEvent(
      {
        userId: f.users.student, // already enrolled in react
        courseId: f.courses.react.id,
        instructorId: f.users.ahmed,
        instructorShare: "10",
        platformShare: "5",
        discountAmount: "0",
        couponId: "",
      },
      pi
    )
    const res = await (await anon()).post("/api/webhooks/stripe", {
      data: Buffer.from(payload),
      headers: { "stripe-signature": signature, "content-type": "application/json" },
    })
    expect(res.status(), await res.text()).toBe(200)
    expect(await db().purchase.count({ where: { providerId: pi } })).toBe(1)
  })
})

test.describe("Uploads", () => {
  test("FIX-10 upload folder is whitelisted (no path traversal)", async () => {
    const student = await apiAs("student")
    const res = await student.post("/api/upload", {
      multipart: { file: { name: "x.png", mimeType: "image/png", buffer: PNG }, type: "../../qa-traversal" },
    })
    expect(res.status()).toBe(400)
  })

  test("FIX-11 only the uploader (or an admin) can delete a file", async () => {
    const student = await apiAs("student")
    const up = await student.post("/api/upload", {
      multipart: { file: { name: "a.png", mimeType: "image/png", buffer: PNG }, type: "avatars" },
    })
    expect(up.status(), await up.text()).toBe(200)
    const { url } = await up.json()

    const other = await registerUser()
    expect((await other.api.delete("/api/upload", { data: { url } })).status()).toBe(403)
    expect((await student.delete("/api/upload", { data: { url } })).status()).toBe(200)
  })
})

test.describe("Learning progress", () => {
  test("FIX-20 periodic watch-time saves never un-complete a lesson", async () => {
    const f = fixtures()
    const u = await registerUser()
    const lesson = await db().lesson.findFirst({ where: { chapter: { courseId: f.courses.react.id }, quiz: null } })
    test.skip(!lesson, "seed has no quiz-free lesson")
    const user = await db().user.findUniqueOrThrow({ where: { email: u.email } })
    await db().enrollment.create({ data: { userId: user.id, courseId: f.courses.react.id } })
    expect((await u.api.post("/api/progress/lesson", { data: { lessonId: lesson!.id, completed: true, watchedDuration: 600 } })).status()).toBe(200)
    expect((await u.api.post("/api/progress/lesson", { data: { lessonId: lesson!.id, watchedDuration: 30 } })).status()).toBe(200)
    const p = await db().progress.findUniqueOrThrow({ where: { userId_lessonId: { userId: user.id, lessonId: lesson!.id } } })
    expect(p.isCompleted).toBe(true)
  })

  test("FIX-21 a lesson with a quiz cannot be self-marked complete", async () => {
    const f = fixtures()
    const u = await registerUser()
    const user = await db().user.findUniqueOrThrow({ where: { email: u.email } })
    await db().enrollment.create({ data: { userId: user.id, courseId: f.courses.react.id } })
    const res = await u.api.post("/api/progress/lesson", { data: { lessonId: f.quizzes.react.lessonId, completed: true } })
    expect(res.status()).toBe(400)
  })
})

test.describe("Admin review flow", () => {
  test("FIX-30 pending course can be approved from the admin API", async () => {
    const u = await registerUser("INSTRUCTOR")
    const userId = await approveInstructor(u.email)
    const course = await (await u.api.post("/api/instructor/courses", {
      data: { title: `QA review ${Date.now()}`, description: "d", categoryId: fixtures().categoryId, level: "BEGINNER", language: "ar" },
    })).json()
    const ch = await (await u.api.post(`/api/instructor/courses/${course.id}/chapters`, { data: { title: "c" } })).json()
    const ls = await (await u.api.post(`/api/instructor/courses/${course.id}/chapters/${ch.id}/lessons`, { data: { title: "l" } })).json()
    await u.api.patch(`/api/instructor/courses/${course.id}/chapters/${ch.id}/lessons/${ls.id}`, { data: { isPublished: true } })
    // Publishing without approval (here: approval revoked) goes to review.
    await db().instructorProfile.update({ where: { userId }, data: { isApproved: false } })
    const pub = await u.api.post(`/api/instructor/courses/${course.id}/publish`)
    expect((await pub.json()).status).toBe("PENDING_REVIEW")

    const admin = await apiAs("admin")
    expect((await admin.patch(`/api/admin/courses/${course.id}`, { data: { action: "approve" } })).status()).toBe(200)
    expect((await db().course.findUniqueOrThrow({ where: { id: course.id } })).status).toBe("PUBLISHED")
  })

  test("FIX-31 approved instructors still publish directly", async () => {
    const ahmed = await apiAs("ahmed")
    const f = fixtures()
    const res = await ahmed.post(`/api/instructor/courses/${f.courses.react.id}/publish`)
    expect(res.status(), await res.text()).toBe(200)
    expect((await res.json()).status).toBe("PUBLISHED")
  })

  test("FIX-32 deleting a review recomputes the course rating", async () => {
    const f = fixtures()
    const u = await registerUser()
    await u.api.post(`/api/courses/${f.courses.free.id}/enroll`)
    await u.api.post(`/api/courses/${f.courses.free.id}/reviews`, { data: { rating: 1, comment: "qa" } })
    const review = await db().review.findFirstOrThrow({ where: { courseId: f.courses.free.id, user: { email: u.email } } })
    const admin = await apiAs("admin")
    expect((await admin.delete(`/api/admin/reviews/${review.id}`)).status()).toBe(200)
    const agg = await db().review.aggregate({ where: { courseId: f.courses.free.id }, _avg: { rating: true }, _count: true })
    const course = await db().course.findUniqueOrThrow({ where: { id: f.courses.free.id } })
    expect(course.totalReviews).toBe(agg._count)
    expect(course.averageRating).toBeCloseTo(agg._avg.rating ?? 0, 5)
  })

  test("FIX-33 coupon values are range-checked", async () => {
    const admin = await apiAs("admin")
    const res = await admin.post("/api/admin/coupons", { data: { code: `QA-BAD-${Date.now()}`, discountType: "percentage", discountValue: 150 } })
    expect(res.status()).toBe(400)
  })
})

test.describe("Access scoping", () => {
  test("FIX-40 an instructor only lists their own withdrawals", async () => {
    const f = fixtures()
    const sara = await apiAs("sara")
    const body = await (await sara.get("/api/instructor/withdrawals")).json()
    expect(body.withdrawals.every((w: any) => w.userId === f.users.sara)).toBe(true)
  })

  test("FIX-41 users cannot message strangers", async () => {
    const u = await registerUser()
    const res = await u.api.post(`/api/messages/${fixtures().users.sara}`, { data: { content: "spam" } })
    expect(res.status()).toBe(403)
  })

  test("FIX-42 enrolled student can message their instructor", async () => {
    const res = await (await apiAs("student")).post(`/api/messages/${fixtures().users.ahmed}`, { data: { content: "hello" } })
    expect(res.status(), await res.text()).toBe(200)
  })

  test("FIX-43 set-locale returns to the page and refuses open redirects", async () => {
    const ctx = await anon()
    const ok = await ctx.get("/api/set-locale?locale=en&redirect=/courses", { maxRedirects: 0 })
    expect(ok.status()).toBe(307)
    expect(new URL(ok.headers()["location"]).pathname).toBe("/courses")
    expect(ok.headers()["set-cookie"]).toContain("locale=en")

    const evil = await ctx.get("/api/set-locale?locale=xx&redirect=//evil.example", { maxRedirects: 0 })
    expect(new URL(evil.headers()["location"]).host).toBe("localhost:3010")
    expect(evil.headers()["set-cookie"]).toContain("locale=ar")
  })

  test("FIX-44 student cannot see a course-bound live class by id", async () => {
    const f = fixtures()
    const sara = await apiAs("sara")
    const cls = await (await sara.post("/api/live", {
      data: { title: "QA hidden class", courseId: f.courses.uiux.id, scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), duration: 30 },
    })).json()
    const stranger = await registerUser()
    expect((await stranger.api.get(`/api/live/${cls.id}`)).status()).toBe(404)
    expect((await sara.get(`/api/live/${cls.id}`)).status()).toBe(200)
  })
})
