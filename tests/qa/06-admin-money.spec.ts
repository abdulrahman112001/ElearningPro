import { test, expect } from "@playwright/test"
import { apiAs, db, fixtures } from "./support"

test.describe("Withdrawals (instructor payouts)", () => {
  test("ADM-01 invalid status is rejected", async () => {
    const admin = await apiAs("admin")
    const res = await admin.patch(`/api/admin/withdrawals/${fixtures().withdrawals.race}`, { data: { status: "PAID_TWICE" } })
    expect(res.status()).toBe(400)
  })

  test("ADM-02 @known-bug a REJECTED withdrawal cannot later be COMPLETED (double payout)", async () => {
    const f = fixtures()
    const admin = await apiAs("admin")
    const before = await db().instructorProfile.findUniqueOrThrow({ where: { userId: f.users.ahmed } })
    await admin.patch(`/api/admin/withdrawals/${f.withdrawals.rejectThenComplete}`, { data: { status: "REJECTED" } })
    const second = await admin.patch(`/api/admin/withdrawals/${f.withdrawals.rejectThenComplete}`, { data: { status: "COMPLETED" } })
    const after = await db().instructorProfile.findUniqueOrThrow({ where: { userId: f.users.ahmed } })
    const credited = after.pendingEarnings - before.pendingEarnings + (after.paidEarnings - before.paidEarnings)
    expect(second.status(), `instructor credited ${credited} for one 100 withdrawal`).toBe(400)
  })

  test("ADM-03 @known-bug concurrent COMPLETED approvals pay out only once (race: may pass intermittently)", async () => {
    const f = fixtures()
    const admin = await apiAs("admin")
    const before = await db().instructorProfile.findUniqueOrThrow({ where: { userId: f.users.ahmed } })
    await Promise.all(
      Array.from({ length: 10 }, () => admin.patch(`/api/admin/withdrawals/${f.withdrawals.race}`, { data: { status: "COMPLETED" } }))
    )
    const after = await db().instructorProfile.findUniqueOrThrow({ where: { userId: f.users.ahmed } })
    expect(after.paidEarnings - before.paidEarnings).toBe(100)
  })

  test("ADM-04 instructor withdrawal request validates amount and minimum", async () => {
    const ahmed = await apiAs("ahmed")
    expect((await ahmed.post("/api/instructor/withdrawals", { data: { amount: -5, method: "paypal", paymentDetails: {} } })).status()).toBe(400)
    expect((await ahmed.post("/api/instructor/withdrawals", { data: { amount: 10, method: "paypal", paymentDetails: {} } })).status()).toBe(400)
  })
})

test.describe("Admin user management", () => {
  test("ADM-10 admin cannot change own role or delete self", async () => {
    const f = fixtures()
    const admin = await apiAs("admin")
    expect((await admin.patch(`/api/admin/users/${f.users.admin}`, { data: { role: "STUDENT" } })).status()).toBe(400)
    expect((await admin.delete(`/api/admin/users/${f.users.admin}`)).status()).toBe(400)
  })

  test("ADM-11 @known-bug invalid role value -> 400 not 500", async () => {
    const f = fixtures()
    const admin = await apiAs("admin")
    expect((await admin.patch(`/api/admin/users/${f.users.student}`, { data: { role: "SUPER" } })).status()).toBe(400)
  })

  test("ADM-12 @known-bug unknown ids on admin routes -> 404 not 500", async () => {
    const admin = await apiAs("admin")
    expect((await admin.patch("/api/admin/coupons/nope", { data: { isActive: false } })).status()).toBe(404)
    expect((await admin.delete("/api/admin/reviews/nope")).status()).toBe(404)
  })

  test("ADM-13 admin analytics returns data", async () => {
    const res = await (await apiAs("admin")).get("/api/admin/analytics")
    expect(res.status()).toBe(200)
  })
})

test.describe("Messaging", () => {
  test("ADM-20 @known-bug instructor's 'my students' list includes enrolled students", async () => {
    const res = await (await apiAs("ahmed")).get("/api/messages/students")
    expect(res.status()).toBe(200)
    const emails = (await res.json()).students.map((s: any) => s.email)
    expect(emails, "student@elearning.com is enrolled in Ahmed's course").toContain("student@elearning.com")
  })

  test("ADM-21 @known-bug message to a non-existent user -> 404 not 500", async () => {
    const res = await (await apiAs("student")).post("/api/messages/does-not-exist", { data: { content: "hi" } })
    expect(res.status()).toBeLessThan(500)
  })
})
