import { test, expect } from "@playwright/test"
import { anon, apiAs, db, fixtures, rawJson, registerUser } from "./support"

test.describe("Enrollment", () => {
  test("COM-01 free course: enroll -> 201, second time -> 400", async () => {
    const f = fixtures()
    const u = await registerUser()
    const first = await u.api.post(`/api/courses/${f.courses.free.id}/enroll`)
    expect(first.status(), await first.text()).toBe(201)
    const again = await u.api.post(`/api/courses/${f.courses.free.id}/enroll`)
    expect(again.status()).toBe(400)
  })

  test("COM-02 paid course cannot be enrolled for free (402 + checkout redirect)", async () => {
    const f = fixtures()
    const u = await registerUser()
    const res = await u.api.post(`/api/courses/${f.courses.react.id}/enroll`)
    expect(res.status()).toBe(402)
    expect((await res.json()).redirectTo).toContain(`/checkout/${f.courses.react.slug}`)
    expect(await db().enrollment.count({ where: { courseId: f.courses.react.id, user: { email: u.email } } })).toBe(0)
  })

  test("COM-03 unknown course -> 404; anonymous -> 401", async () => {
    const u = await registerUser()
    expect((await u.api.post("/api/courses/does-not-exist/enroll")).status()).toBe(404)
    expect((await (await anon()).post(`/api/courses/${fixtures().courses.free.id}/enroll`)).status()).toBe(401)
  })
})

test.describe("Coupon validation", () => {
  const validate = async (code: string, courseKey: "react" | "uiux" | "nextjs" = "react") => {
    const u = await registerUser()
    const res = await u.api.post("/api/coupons/validate", { data: { code, courseId: fixtures().courses[courseKey].id } })
    return { status: res.status(), body: await res.json().catch(() => ({})) }
  }

  test("COM-10 percentage coupon is capped by maxDiscount", async () => {
    // react course effective price 199 -> 50% = 99.5, capped at 60
    const r = await validate("QA-PCT50")
    expect(r.status).toBe(200)
    expect(r.body.discount).toBe(60)
  })

  test("COM-11 codes are case-insensitive on input", async () => {
    expect((await validate("qa-pct50")).status).toBe(200)
  })

  test("COM-12 fixed coupon subtracts its value", async () => {
    const r = await validate("QA-FIXED30")
    expect(r.body.discount).toBe(30)
  })

  test("COM-13 discount never exceeds the course price", async () => {
    const r = await validate("QA-HUGEFIXED")
    expect(r.status).toBe(200)
    expect(r.body.discount).toBe(199)
  })

  test("COM-14 expired, inactive, unknown coupons -> 404", async () => {
    expect((await validate("QA-EXPIRED")).status).toBe(404)
    expect((await validate("QA-INACTIVE")).status).toBe(404)
    expect((await validate("QA-NOPE")).status).toBe(404)
  })

  test("COM-15 exhausted coupon (maxUses reached) -> 400", async () => {
    expect((await validate("QA-MAXED")).status).toBe(400)
  })

  test("COM-16 minimum purchase not met -> 400", async () => {
    expect((await validate("QA-MINBUY")).status).toBe(400)
  })

  test("COM-17 coupon bound to another course is rejected", async () => {
    expect((await validate("QA-OTHERCOURSE", "react")).status).toBe(404)
    expect((await validate("QA-OTHERCOURSE", "uiux")).status).toBe(200)
  })

  test("COM-18 missing fields -> 400; anonymous -> 401", async () => {
    const u = await registerUser()
    expect((await u.api.post("/api/coupons/validate", { data: { code: "QA-PCT50" } })).status()).toBe(400)
    expect((await (await anon()).post("/api/coupons/validate", { data: {} })).status()).toBe(401)
  })

  test("COM-19 @known-bug malformed JSON -> 400 not 500", async () => {
    const u = await registerUser()
    expect((await rawJson(u.api, "post", "/api/coupons/validate")).status()).toBe(400)
  })

  test("COM-20 @known-bug admin-created lowercase coupon code can be redeemed", async () => {
    const admin = await apiAs("admin")
    const code = `qa-lower-${Date.now()}`
    const c = await admin.post("/api/admin/coupons", { data: { code, discountType: "percentage", discountValue: 10 } })
    expect(c.status(), await c.text()).toBe(201)
    const created = await c.json()
    // The PATCH route stores codes verbatim; lookups uppercase the input.
    await admin.patch(`/api/admin/coupons/${created.id ?? created.coupon?.id}`, { data: { code } })
    const r = await validate(code)
    expect(r.status, "coupon saved in lowercase can never match").toBe(200)
  })

  test("COM-21 @known-bug admin coupon PATCH rejects an unknown discountType", async () => {
    const admin = await apiAs("admin")
    const coupon = await db().coupon.findUniqueOrThrow({ where: { code: "QA-FIXED30" } })
    const res = await admin.patch(`/api/admin/coupons/${coupon.id}`, { data: { discountType: "bogus" } })
    const after = await db().coupon.findUniqueOrThrow({ where: { id: coupon.id } })
    await db().coupon.update({ where: { id: coupon.id }, data: { discountType: "fixed" } })
    expect(res.status()).toBe(400)
    expect(after.discountType).toBe("fixed")
  })
})

test.describe("Payment creation", () => {
  test("COM-30 unknown payment method -> 400", async () => {
    const u = await registerUser()
    const res = await u.api.post("/api/payments/create", { data: { courseId: fixtures().courses.react.id, paymentMethod: "bitcoin" } })
    expect(res.status()).toBe(400)
  })

  test("COM-31 already enrolled -> 400", async () => {
    const student = await apiAs("student")
    const res = await student.post("/api/payments/create", { data: { courseId: fixtures().courses.react.id, paymentMethod: "stripe" } })
    expect(res.status()).toBe(400)
  })

  test("COM-32 unpublished / unknown course -> 404", async () => {
    const u = await registerUser()
    const res = await u.api.post("/api/payments/create", { data: { courseId: "nope", paymentMethod: "stripe" } })
    expect(res.status()).toBe(404)
  })

  for (const method of ["paypal", "paymob", "tap"]) {
    test(`COM-33 @known-bug unimplemented ${method} must not answer 2xx (UI shows fake success)`, async () => {
      const u = await registerUser()
      const res = await u.api.post("/api/payments/create", { data: { courseId: fixtures().courses.react.id, paymentMethod: method } })
      const body = await res.json()
      expect(res.ok(), `HTTP ${res.status()} with body ${JSON.stringify(body)}`).toBe(false)
    })
  }

  test("COM-34 @known-bug a 100% coupon on a paid course leads to enrollment, not a 500", async () => {
    const u = await registerUser()
    const res = await u.api.post("/api/payments/create", { data: { courseId: fixtures().courses.react.id, paymentMethod: "stripe", couponCode: "QA-FULL100" } })
    expect(res.status(), await res.text()).toBeLessThan(500)
  })

  test("COM-35 webhook without a valid Stripe signature is rejected", async () => {
    const res = await (await anon()).post("/api/webhooks/stripe", {
      data: JSON.stringify({ type: "checkout.session.completed", data: { object: { metadata: {} } } }),
      headers: { "stripe-signature": "t=1,v1=forged", "content-type": "application/json" },
    })
    expect(res.status()).toBe(400)
  })
})

test.describe("Reviews", () => {
  test("COM-40 non-enrolled user cannot review", async () => {
    const u = await registerUser()
    const res = await u.api.post(`/api/courses/${fixtures().courses.uiux.id}/reviews`, { data: { rating: 5, comment: "great" } })
    expect(res.status()).toBe(403)
  })

  test("COM-41 rating outside 1..5 -> 400", async () => {
    const student = await apiAs("student")
    const res = await student.post(`/api/courses/${fixtures().courses.react.id}/reviews`, { data: { rating: 9, comment: "x" } })
    expect(res.status()).toBe(400)
  })

  test("COM-42 second review by same user updates instead of duplicating", async () => {
    const f = fixtures()
    const u = await registerUser()
    await u.api.post(`/api/courses/${f.courses.free.id}/enroll`)
    expect((await u.api.post(`/api/courses/${f.courses.free.id}/reviews`, { data: { rating: 4, comment: "ok" } })).status()).toBe(201)
    expect((await u.api.post(`/api/courses/${f.courses.free.id}/reviews`, { data: { rating: 2, comment: "meh" } })).status()).toBe(200)
    expect(await db().review.count({ where: { courseId: f.courses.free.id, user: { email: u.email } } })).toBe(1)
  })

  test("COM-43 @known-bug non-integer rating -> 400 not 500", async () => {
    const student = await apiAs("student")
    const res = await student.post(`/api/courses/${fixtures().courses.react.id}/reviews`, { data: { rating: 4.5, comment: "x" } })
    expect(res.status()).toBe(400)
  })
})
