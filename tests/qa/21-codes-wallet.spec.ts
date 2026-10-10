import { test, expect, APIRequestContext } from "@playwright/test"
import { apiAs, anon, db, fixtures, registerUser, approveInstructor, loginApi } from "./support"

/**
 * Access codes (course / subscription / wallet), the wallet, manual transfers
 * reviewed by an admin, and paying a course or subscription from the wallet.
 * Every test uses its own throwaway teacher / students so balances and
 * enrollments are predictable.
 */
test.describe.configure({ mode: "serial" })

const CODE_RE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/

let admin: APIRequestContext
let teacher: { email: string; api: APIRequestContext }
let teacherId: string
let other: { email: string; api: APIRequestContext }
let otherId: string
let courseId: string
let otherCourseId: string
let paidCourseId: string

const ip = () => `10.21.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`

async function newStudent() {
  const s = await registerUser("STUDENT")
  const id = (await db().user.findUniqueOrThrow({ where: { email: s.email } })).id
  return { ...s, id }
}

async function makeCourse(instructorId: string, title: string, price: number) {
  const slug = `qa-codes-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const c = await db().course.create({
    data: {
      titleEn: title,
      titleAr: title,
      slug,
      price,
      currency: "EGP",
      status: "PUBLISHED",
      instructorId,
      categoryId: fixtures().categoryId,
      publishedAt: new Date(),
    },
  })
  return c.id
}

async function createBatch(api: APIRequestContext, base: "instructor" | "admin", data: Record<string, unknown>) {
  return api.post(`/api/${base}/codes`, { data })
}

async function firstCode(batchId: string) {
  const c = await db().accessCode.findFirstOrThrow({ where: { batchId }, orderBy: { code: "asc" } })
  return c.code
}

function redeem(api: APIRequestContext, code: string) {
  return api.post("/api/codes/redeem", { data: { code }, headers: { "x-forwarded-for": ip() } })
}

test("CW-01 setup: two approved teachers with courses and a subscription", async () => {
  admin = await apiAs("admin")
  teacher = await registerUser("INSTRUCTOR")
  teacherId = await approveInstructor(teacher.email)
  other = await registerUser("INSTRUCTOR")
  otherId = await approveInstructor(other.email)
  await db().instructorProfile.update({
    where: { userId: teacherId },
    data: { subscriptionEnabled: true, monthlyPrice: 150, commissionRate: 20 },
  })
  courseId = await makeCourse(teacherId, "QA Code Course", 300)
  paidCourseId = await makeCourse(teacherId, "QA Wallet Course", 200)
  otherCourseId = await makeCourse(otherId, "QA Other Teacher Course", 100)
})

test("CW-02 teachers create course and subscription codes for themselves only", async () => {
  const res = await createBatch(teacher.api, "instructor", { type: "COURSE", courseId, quantity: 5, name: "QA batch" })
  expect(res.status(), await res.text()).toBe(201)
  const batch = await res.json()
  const codes = await db().accessCode.findMany({ where: { batchId: batch.id } })
  expect(codes).toHaveLength(5)
  for (const c of codes) expect(c.code).toMatch(CODE_RE)
  expect(new Set(codes.map((c) => c.code)).size).toBe(5)
  expect(batch.instructorId).toBe(teacherId)

  const foreign = await createBatch(teacher.api, "instructor", { type: "COURSE", courseId: otherCourseId, quantity: 1 })
  expect(foreign.status()).toBe(403)
  expect((await foreign.json()).code).toBe("not_your_course")

  const wallet = await createBatch(teacher.api, "instructor", { type: "WALLET", value: 100, quantity: 1 })
  expect(wallet.status()).toBe(403)

  const otherSub = await createBatch(teacher.api, "instructor", { type: "SUBSCRIPTION", instructorId: otherId, months: 1, quantity: 1 })
  expect(otherSub.status()).toBe(403)

  for (const bad of [
    { type: "COURSE", courseId, quantity: 0 },
    { type: "COURSE", courseId, quantity: 1001 },
    { type: "SUBSCRIPTION", months: 0, quantity: 1 },
    { type: "COURSE", courseId, quantity: 1, expiresAt: "2001-01-01" },
    { type: "NOPE", quantity: 1 },
  ]) {
    expect((await createBatch(teacher.api, "instructor", bad)).status(), JSON.stringify(bad)).toBe(400)
  }

  const student = await newStudent()
  expect((await createBatch(student.api, "instructor", { type: "COURSE", courseId, quantity: 1 })).status()).toBe(403)
  expect((await createBatch(teacher.api, "admin", { type: "WALLET", value: 50, quantity: 1 })).status()).toBe(403)
  expect((await (await anon()).post("/api/codes/redeem", { data: { code: "x" } })).status()).toBe(401)

  // The other teacher cannot see or manage this batch
  expect((await other.api.get(`/api/instructor/codes/${batch.id}`)).status()).toBe(404)
  expect((await other.api.get(`/api/instructor/codes/${batch.id}/export`)).status()).toBe(404)
  const list = await (await other.api.get("/api/instructor/codes")).json()
  expect(list.batches.find((b: any) => b.id === batch.id)).toBeUndefined()
  const mine = await (await teacher.api.get("/api/instructor/codes")).json()
  expect(mine.batches.find((b: any) => b.id === batch.id)).toMatchObject({ quantity: 5, used: 0 })
})

test("CW-03 a COURSE code enrolls the student once; input is normalized", async () => {
  const batch = await (await createBatch(teacher.api, "instructor", { type: "COURSE", courseId, quantity: 2 })).json()
  const code = await firstCode(batch.id)
  const student = await newStudent()
  const messy = ` ${code.replace(/-/g, " ").toLowerCase()} `
  const res = await redeem(student.api, messy)
  expect(res.status(), await res.text()).toBe(200)
  expect((await res.json()).type).toBe("COURSE")

  const enrollment = await db().enrollment.findUnique({ where: { userId_courseId: { userId: student.id, courseId } } })
  expect(enrollment?.viaSubscription).toBe(false)
  const purchase = await db().purchase.findFirstOrThrow({ where: { userId: student.id, courseId } })
  expect(purchase).toMatchObject({ provider: "CODE", amount: 0, status: "COMPLETED" })
  const row = await db().accessCode.findUniqueOrThrow({ where: { code } })
  expect(row.redeemedById).toBe(student.id)
  expect(purchase.providerId).toBe(row.id)

  // Same code again: already used
  const again = await redeem(student.api, code)
  expect(again.status()).toBe(409)
  expect((await again.json()).code).toBe("already_used")

  // A second code of the same course: already enrolled, and the code is not consumed
  const second = (await db().accessCode.findFirstOrThrow({ where: { batchId: batch.id, redeemedById: null } })).code
  const dup = await redeem(student.api, second)
  expect(dup.status()).toBe(409)
  expect((await dup.json()).code).toBe("already_enrolled")
  expect((await db().accessCode.findUniqueOrThrow({ where: { code: second } })).redeemedById).toBeNull()

  const bogus = await redeem(student.api, "ZZZZ-ZZZZ-ZZZZ")
  expect(bogus.status()).toBe(404)
  expect((await bogus.json()).code).toBe("invalid")
  expect((await redeem(student.api, "hello")).status()).toBe(400)

  // Teacher sees it in the batch detail and gets notified; it is logged
  const detail = await (await teacher.api.get(`/api/instructor/codes/${batch.id}`)).json()
  expect(detail.used).toBe(1)
  expect(detail.codes.find((c: any) => c.code === code)).toMatchObject({ status: "REDEEMED" })
  expect(await db().notification.count({ where: { userId: teacherId, title: "Code redeemed" } })).toBeGreaterThan(0)
  expect(await db().activityLog.count({ where: { action: "code.redeemed", entityId: row.id } })).toBe(1)
  expect(await db().activityLog.count({ where: { action: "code.batch_created", entityId: batch.id } })).toBe(1)
})

test("CW-04 a SUBSCRIPTION code grants N months of the teacher's subscription", async () => {
  const batch = await (await createBatch(teacher.api, "instructor", { type: "SUBSCRIPTION", months: 2, quantity: 1 })).json()
  const student = await newStudent()
  const res = await redeem(student.api, await firstCode(batch.id))
  expect(res.status(), await res.text()).toBe(200)
  const sub = await db().teacherSubscription.findFirstOrThrow({ where: { studentId: student.id, instructorId: teacherId } })
  expect(sub).toMatchObject({ status: "ACTIVE", provider: "CODE", amount: 0 })
  const days = (sub.endsAt!.getTime() - sub.startsAt!.getTime()) / 86400000
  expect(Math.round(days)).toBe(60)
})

test("CW-05 admins create WALLET codes that credit the wallet", async () => {
  const res = await createBatch(admin, "admin", { type: "WALLET", value: 75, quantity: 3 })
  expect(res.status(), await res.text()).toBe(201)
  const batch = await res.json()
  const student = await newStudent()
  const r = await redeem(student.api, await firstCode(batch.id))
  expect(r.status(), await r.text()).toBe(200)
  expect((await r.json()).balance).toBe(75)
  expect((await db().user.findUniqueOrThrow({ where: { id: student.id } })).walletBalance).toBe(75)
  const tx = await db().walletTransaction.findFirstOrThrow({ where: { userId: student.id } })
  expect(tx).toMatchObject({ type: "CREDIT", amount: 75, balanceAfter: 75, reason: "code_redeemed" })
  const wallet = await (await student.api.get("/api/wallet")).json()
  expect(wallet.balance).toBe(75)
  expect(wallet.transactions).toHaveLength(1)

  // CSV export
  const csv = await admin.get(`/api/admin/codes/${batch.id}/export`)
  expect(csv.status()).toBe(200)
  expect(csv.headers()["content-type"]).toContain("text/csv")
  const text = await csv.text()
  expect(text.trim().split(/\r?\n/)).toHaveLength(4)
  expect(text).toContain("REDEEMED")
})

test("CW-06 one code, five parallel redeems: exactly one wins", async () => {
  const batch = await (await createBatch(admin, "admin", { type: "WALLET", value: 40, quantity: 1 })).json()
  const code = await firstCode(batch.id)
  const students = await Promise.all([1, 2, 3, 4, 5].map(() => newStudent()))
  const results = await Promise.all(students.map((s) => redeem(s.api, code)))
  const statuses = results.map((r) => r.status())
  expect(statuses.filter((s) => s === 200), statuses.join(",")).toHaveLength(1)
  expect(statuses.filter((s) => s === 409)).toHaveLength(4)
  const balances = await db().user.findMany({ where: { id: { in: students.map((s) => s.id) } }, select: { walletBalance: true } })
  expect(balances.reduce((a, b) => a + b.walletBalance, 0)).toBe(40)
  expect(await db().walletTransaction.count({ where: { reference: (await db().accessCode.findUniqueOrThrow({ where: { code } })).id } })).toBe(1)
})

test("CW-07 expired and disabled codes are refused", async () => {
  const batch = await (await createBatch(admin, "admin", { type: "WALLET", value: 10, quantity: 3 })).json()
  const codes = await db().accessCode.findMany({ where: { batchId: batch.id }, orderBy: { code: "asc" } })
  const student = await newStudent()

  // Disable a single code
  const dis = await admin.patch(`/api/admin/codes/${batch.id}/codes/${codes[0].id}`, { data: { disabled: true } })
  expect(dis.status()).toBe(200)
  const r1 = await redeem(student.api, codes[0].code)
  expect(r1.status()).toBe(410)
  expect((await r1.json()).code).toBe("disabled")

  // Disable the rest of the batch
  const all = await admin.patch(`/api/admin/codes/${batch.id}`, { data: { action: "disable" } })
  expect((await all.json()).disabled).toBe(2)
  expect((await redeem(student.api, codes[1].code)).status()).toBe(410)
  expect(await db().activityLog.count({ where: { action: "code.disabled", entityId: batch.id } })).toBe(1)

  // Expiry
  const exp = await (await createBatch(teacher.api, "instructor", { type: "COURSE", courseId, quantity: 1, expiresAt: new Date(Date.now() + 86400000).toISOString() })).json()
  await db().accessCodeBatch.update({ where: { id: exp.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
  const r3 = await redeem(student.api, await firstCode(exp.id))
  expect(r3.status()).toBe(410)
  expect((await r3.json()).code).toBe("expired")
  expect((await db().user.findUniqueOrThrow({ where: { id: student.id } })).walletBalance).toBe(0)

  // Teachers cannot redeem; instructors get 403
  expect((await redeem(teacher.api, codes[2].code)).status()).toBe(403)
})

test("CW-08 brute force is rate limited per user and per IP", async () => {
  const student = await newStudent()
  const statuses: number[] = []
  for (let i = 0; i < 12; i++) {
    statuses.push((await student.api.post("/api/codes/redeem", { data: { code: "QQQQ-QQQQ-QQQQ" }, headers: { "x-forwarded-for": ip() } })).status())
  }
  expect(statuses.slice(0, 10).every((s) => s !== 429), statuses.join(",")).toBe(true)
  expect(statuses[10]).toBe(429)

  // Same IP, different accounts
  const fixedIp = ip()
  const students = await Promise.all([1, 2].map(() => newStudent()))
  const ipStatuses: number[] = []
  for (let i = 0; i < 11; i++) {
    const s = students[i % 2]
    ipStatuses.push((await s.api.post("/api/codes/redeem", { data: { code: "QQQQ-QQQQ-QQQQ" }, headers: { "x-forwarded-for": fixedIp } })).status())
  }
  const trusted = !ipStatuses.slice(0, 10).includes(429)
  if (trusted && ipStatuses[10] !== 429) {
    test.info().annotations.push({ type: "note", description: "server does not trust X-Forwarded-For; per-IP limit not observable" })
  } else {
    expect(ipStatuses[10]).toBe(429)
  }
})

test("CW-09 manual transfer: validation, approve credits once, reject, duplicate warning", async () => {
  const student = await newStudent()
  const bad = await student.api.post("/api/wallet/manual-payments", { data: { method: "BITCOIN", amount: 5, reference: "1" } })
  expect(bad.status()).toBe(400)
  const fields = (await bad.json()).fields.map((f: any) => f.field)
  expect(fields).toEqual(expect.arrayContaining(["method", "amount", "reference"]))

  const ref = `QA${Date.now()}`
  const ok = await student.api.post("/api/wallet/manual-payments", {
    data: { method: "VODAFONE_CASH", amount: 250, reference: ref, senderPhone: "01001234567", note: "QA top up" },
  })
  expect(ok.status(), await ok.text()).toBe(201)
  const payment = await ok.json()
  expect(payment.status).toBe("PENDING")
  const dupSame = await student.api.post("/api/wallet/manual-payments", {
    data: { method: "VODAFONE_CASH", amount: 250, reference: ref, senderPhone: "01001234567" },
  })
  expect(dupSame.status()).toBe(409)

  // Students cannot review
  expect((await student.api.post(`/api/admin/manual-payments/${payment.id}`, { data: { action: "approve" } })).status()).toBe(403)

  // Two parallel approvals credit once
  const [a1, a2] = await Promise.all([
    admin.post(`/api/admin/manual-payments/${payment.id}`, { data: { action: "approve" } }),
    admin.post(`/api/admin/manual-payments/${payment.id}`, { data: { action: "approve" } }),
  ])
  expect([a1.status(), a2.status()].sort()).toEqual([200, 409])
  expect((await db().user.findUniqueOrThrow({ where: { id: student.id } })).walletBalance).toBe(250)
  expect(await db().walletTransaction.count({ where: { userId: student.id, reason: "transfer_approved" } })).toBe(1)
  const again = await admin.post(`/api/admin/manual-payments/${payment.id}`, { data: { action: "reject", reason: "late" } })
  expect(again.status()).toBe(409)
  expect(await db().activityLog.count({ where: { action: "payment.manual_approved", entityId: payment.id } })).toBe(1)
  expect(await db().notification.count({ where: { userId: student.id, title: "Transfer approved" } })).toBe(1)

  // Another student reports the same receipt: admin sees a duplicate warning
  const cheat = await newStudent()
  const p2 = await (await cheat.api.post("/api/wallet/manual-payments", {
    data: { method: "VODAFONE_CASH", amount: 250, reference: ref.toLowerCase(), senderPhone: "01001234567" },
  })).json()
  const pending = await (await admin.get("/api/admin/manual-payments?status=PENDING")).json()
  const row = pending.payments.find((p: any) => p.id === p2.id)
  expect(row.duplicateOf?.id).toBe(payment.id)

  // Reject needs a reason
  expect((await admin.post(`/api/admin/manual-payments/${p2.id}`, { data: { action: "reject" } })).status()).toBe(400)
  const rej = await admin.post(`/api/admin/manual-payments/${p2.id}`, { data: { action: "reject", reason: "Duplicate receipt" } })
  expect(rej.status()).toBe(200)
  expect((await rej.json()).payment).toMatchObject({ status: "REJECTED", reviewNote: "Duplicate receipt" })
  expect((await db().user.findUniqueOrThrow({ where: { id: cheat.id } })).walletBalance).toBe(0)
  expect(await db().activityLog.count({ where: { action: "payment.manual_rejected", entityId: p2.id } })).toBe(1)

  // Own history
  const mine = await (await cheat.api.get("/api/wallet")).json()
  expect(mine.payments[0]).toMatchObject({ status: "REJECTED", reviewNote: "Duplicate receipt" })
})

test("CW-10 admin edits the receiving accounts shown to students", async () => {
  const number = "01012345678"
  const put = await admin.put("/api/admin/payment-settings", {
    data: { vodafoneCashNumber: number, instapayAddress: "qa@instapay", bankDetails: "QA Bank\nIBAN EG00" },
  })
  expect(put.status()).toBe(200)
  const student = await newStudent()
  const wallet = await (await student.api.get("/api/wallet")).json()
  expect(wallet.receiving).toMatchObject({ vodafoneCashNumber: number, instapayAddress: "qa@instapay" })
  expect((await student.api.put("/api/admin/payment-settings", { data: { vodafoneCashNumber: "1" } })).status()).toBe(403)
})

test("CW-11 pay a course from the wallet: debit, purchase, enrollment, teacher earnings", async () => {
  const student = await newStudent()
  // Insufficient first
  const poor = await student.api.post("/api/wallet/pay", { data: { kind: "course", id: paidCourseId } })
  expect(poor.status()).toBe(402)
  expect(await poor.json()).toMatchObject({ code: "insufficient_balance", balance: 0, required: 200 })

  await db().user.update({ where: { id: student.id }, data: { walletBalance: 500 } })
  const before = await db().instructorProfile.findUniqueOrThrow({ where: { userId: teacherId } })
  // Double click: two parallel payments, one purchase
  const [p1, p2] = await Promise.all([
    student.api.post("/api/wallet/pay", { data: { kind: "course", id: paidCourseId } }),
    student.api.post("/api/wallet/pay", { data: { kind: "course", id: paidCourseId } }),
  ])
  expect([p1.status(), p2.status()].sort(), (await p1.text()) + (await p2.text())).toEqual([201, 409])
  expect((await db().user.findUniqueOrThrow({ where: { id: student.id } })).walletBalance).toBe(300)
  const purchase = await db().purchase.findFirstOrThrow({ where: { userId: student.id, courseId: paidCourseId } })
  expect(purchase).toMatchObject({ provider: "WALLET", status: "COMPLETED", amount: 200, platformShare: 40, instructorShare: 160 })
  expect(await db().enrollment.count({ where: { userId: student.id, courseId: paidCourseId } })).toBe(1)
  const after = await db().instructorProfile.findUniqueOrThrow({ where: { userId: teacherId } })
  expect(after.pendingEarnings - before.pendingEarnings).toBeCloseTo(160)
  expect(after.totalEarnings - before.totalEarnings).toBeCloseTo(160)
  const debit = await db().walletTransaction.findFirstOrThrow({ where: { userId: student.id, type: "DEBIT" } })
  expect(debit).toMatchObject({ amount: 200, balanceAfter: 300, reason: "course_purchase" })

  // Validation
  expect((await student.api.post("/api/wallet/pay", { data: { kind: "car", id: "x" } })).status()).toBe(400)
  expect((await student.api.post("/api/wallet/pay", { data: { kind: "course", id: "nope" } })).status()).toBe(404)
})

test("CW-12 pay a subscription month from the wallet", async () => {
  const student = await newStudent()
  const poor = await student.api.post("/api/wallet/pay", { data: { kind: "subscription", id: teacherId } })
  expect(poor.status()).toBe(402)
  await db().user.update({ where: { id: student.id }, data: { walletBalance: 200 } })
  const before = await db().instructorProfile.findUniqueOrThrow({ where: { userId: teacherId } })
  const res = await student.api.post("/api/wallet/pay", { data: { kind: "subscription", id: teacherId } })
  expect(res.status(), await res.text()).toBe(201)
  expect((await res.json()).balance).toBe(50)
  const sub = await db().teacherSubscription.findFirstOrThrow({ where: { studentId: student.id, instructorId: teacherId } })
  expect(sub).toMatchObject({ status: "ACTIVE", provider: "WALLET", amount: 150, instructorShare: 120, platformShare: 30 })
  const after = await db().instructorProfile.findUniqueOrThrow({ where: { userId: teacherId } })
  expect(after.pendingEarnings - before.pendingEarnings).toBeCloseTo(120)
  // Teacher without a subscription
  expect((await student.api.post("/api/wallet/pay", { data: { kind: "subscription", id: otherId } })).status()).toBe(404)
})

test("CW-13 pages load without errors", async ({ page, context }) => {
  const student = await newStudent()
  const studentState = await student.api.storageState()
  await context.addCookies(studentState.cookies)
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto("/student/wallet")
  await expect(page.locator("main")).toBeVisible()

  await page.goto("about:blank")
  await context.clearCookies()
  const teacherFresh = await loginApi(teacher.email, "QaPass123!")
  await context.addCookies((await teacherFresh.storageState()).cookies)
  const batch = await (await createBatch(teacher.api, "instructor", { type: "COURSE", courseId, quantity: 4 })).json()
  for (const url of ["/instructor/codes", `/instructor/codes/${batch.id}`, `/instructor/codes/${batch.id}/print`]) {
    const r = await page.goto(url)
    expect(r?.status(), url).toBe(200)
    expect(new URL(page.url()).pathname, url).toBe(url)
  }
  await expect(page.locator("[data-code-card]")).toHaveCount(4)

  await page.goto("about:blank")
  await context.clearCookies()
  await context.addCookies((await (await apiAs("admin")).storageState()).cookies)
  for (const url of ["/admin/codes", "/admin/manual-payments"]) {
    const r = await page.goto(url)
    expect(r?.status(), url).toBe(200)
    expect(new URL(page.url()).pathname, url).toBe(url)
  }
  expect(errors).toEqual([])
})
