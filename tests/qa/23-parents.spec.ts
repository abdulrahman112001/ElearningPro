import { test, expect, APIRequestContext } from "@playwright/test"
import { anon, apiAs, db, loginApi, registerUser, uniqueEmail } from "./support"

/**
 * Parents register, link to a child with the code from the student's
 * /student/family page, see only their linked children, and receive the
 * weekly report on WhatsApp/email (sent here through the admin "send now"
 * API, since CRON_SECRET is not set on the test server).
 */
test.describe.configure({ mode: "serial" })

const ip = () => `10.23.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`

async function registerParent(phone = `0102${Math.floor(1_000_000 + Math.random() * 8_999_999)}`) {
  const email = uniqueEmail("parent")
  const password = "QaPass123!"
  const ctx = await anon()
  const res = await ctx.post("/api/auth/register", {
    data: { name: "QA Parent", email, password, role: "PARENT", phone },
    headers: { "x-forwarded-for": ip() },
  })
  expect(res.status(), await res.text()).toBe(201)
  const user = await db().user.findUniqueOrThrow({ where: { email } })
  return { email, id: user.id, api: await loginApi(email, password) }
}

let child: { email: string; api: APIRequestContext; id: string }
let otherStudent: { email: string; api: APIRequestContext; id: string }
let parent: Awaited<ReturnType<typeof registerParent>>
let code: string

test("PA-01 a parent registers with a phone and gets the PARENT role", async () => {
  const noPhone = await (await anon()).post("/api/auth/register", {
    data: { name: "QA Parent", email: uniqueEmail("parent"), password: "QaPass123!", role: "PARENT" },
    headers: { "x-forwarded-for": ip() },
  })
  expect(noPhone.status()).toBe(400)
  expect((await noPhone.json()).code).toBe("invalid_phone")

  parent = await registerParent("+20 100 123 4567")
  const user = await db().user.findUniqueOrThrow({ where: { id: parent.id } })
  expect(user.role).toBe("PARENT")
  expect(user.phone).toBe("+20 100 123 4567")
  const session = await (await parent.api.get("/api/auth/session")).json()
  expect(session.user.role).toBe("PARENT")

  // Role "ADMIN" from the client is never honoured.
  const sneaky = await (await anon()).post("/api/auth/register", {
    data: { name: "QA Sneaky", email: uniqueEmail("sneaky"), password: "QaPass123!", role: "ADMIN" },
    headers: { "x-forwarded-for": ip() },
  })
  expect(sneaky.status()).toBe(201)
  expect((await sneaky.json()).user.role).toBe("STUDENT")
})

test("PA-02 a student gets a stable 8-char link code", async () => {
  const s = await registerUser("STUDENT")
  child = { ...s, id: (await db().user.findUniqueOrThrow({ where: { email: s.email } })).id }
  const o = await registerUser("STUDENT")
  otherStudent = { ...o, id: (await db().user.findUniqueOrThrow({ where: { email: o.email } })).id }

  const first = await (await child.api.get("/api/student/parent-code")).json()
  expect(first.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/)
  const again = await (await child.api.get("/api/student/parent-code")).json()
  expect(again.code).toBe(first.code)
  code = first.code

  expect((await parent.api.get("/api/student/parent-code")).status()).toBe(403)
  expect((await (await anon()).get("/api/student/parent-code")).status()).toBe(401)
})

test("PA-03 linking validates the code and the relation", async () => {
  const garbage = await parent.api.post("/api/parent/children", { data: { code: "nope" } })
  expect(garbage.status()).toBe(400)
  expect((await garbage.json()).code).toBe("invalid_code")

  const wrong = await parent.api.post("/api/parent/children", { data: { code: "ZZZZ2222" } })
  expect(wrong.status()).toBe(404)
  expect((await wrong.json()).code).toBe("invalid_code")

  const badRelation = await parent.api.post("/api/parent/children", { data: { code, relation: "uncle" } })
  expect(badRelation.status()).toBe(400)
})

test("PA-04 a parent links by code; the student is notified and it is logged", async () => {
  // Lower-case with a dash still matches.
  const res = await parent.api.post("/api/parent/children", {
    data: { code: `${code.slice(0, 4).toLowerCase()}-${code.slice(4)}`, relation: "father" },
  })
  expect(res.status(), await res.text()).toBe(201)
  expect((await res.json()).student.id).toBe(child.id)

  const link = await db().parentLink.findUniqueOrThrow({
    where: { parentId_studentId: { parentId: parent.id, studentId: child.id } },
  })
  expect(link).toMatchObject({ status: "ACTIVE", relation: "father" })
  expect(await db().notification.count({ where: { userId: child.id, link: "/student/family" } })).toBe(1)
  expect(await db().activityLog.count({ where: { action: "parent.linked", entityId: child.id } })).toBe(1)

  const dup = await parent.api.post("/api/parent/children", { data: { code } })
  expect(dup.status()).toBe(409)
  expect((await dup.json()).code).toBe("already_linked")

  const list = await (await parent.api.get("/api/parent/children")).json()
  expect(list.children.map((c: any) => c.id)).toEqual([child.id])
  expect(list.children[0].indicators).toHaveProperty("avgProgress")

  const parents = await (await child.api.get("/api/student/parents")).json()
  expect(parents.parents.map((p: any) => p.parent.id)).toEqual([parent.id])
})

test("PA-05 a student can have at most 4 parents", async () => {
  for (let i = 0; i < 3; i++) {
    const p = await registerParent()
    const r = await p.api.post("/api/parent/children", { data: { code, relation: "guardian" } })
    expect(r.status(), await r.text()).toBe(201)
  }
  const fifth = await registerParent()
  const r = await fifth.api.post("/api/parent/children", { data: { code } })
  expect(r.status()).toBe(409)
  expect((await r.json()).code).toBe("parent_limit")
  expect(await db().parentLink.count({ where: { studentId: child.id } })).toBe(4)
})

test("PA-06 a parent sees only linked children; others cannot use parent APIs", async () => {
  const own = await parent.api.get(`/api/parent/children/${child.id}`)
  expect(own.status()).toBe(200)
  const body = await own.json()
  expect(body.student.id).toBe(child.id)
  for (const k of ["enrollments", "quizAttempts", "attendance", "fees", "homework", "gradeEntries", "alerts", "upcoming"]) {
    expect(body).toHaveProperty(k)
  }

  expect((await parent.api.get(`/api/parent/children/${otherStudent.id}`)).status()).toBe(403)

  const student = await apiAs("student")
  const teacher = await apiAs("ahmed")
  for (const ctx of [student, teacher]) {
    expect((await ctx.get("/api/parent/children")).status()).toBe(403)
    expect((await ctx.get(`/api/parent/children/${child.id}`)).status()).toBe(403)
    expect((await ctx.post("/api/parent/children", { data: { code } })).status()).toBe(403)
  }
  expect((await (await anon()).get("/api/parent/children")).status()).toBe(401)

  // Admin may look at any student but cannot link.
  const admin = await apiAs("admin")
  expect((await admin.get(`/api/parent/children/${otherStudent.id}`)).status()).toBe(200)
  expect((await admin.post("/api/parent/children", { data: { code } })).status()).toBe(403)
})

test("PA-07 regenerating the code invalidates the old one, links stay", async () => {
  const res = await child.api.post("/api/student/parent-code")
  expect(res.status()).toBe(200)
  const fresh = (await res.json()).code
  expect(fresh).not.toBe(code)

  // Free a slot so the limit does not mask the result.
  const extra = await db().parentLink.findFirstOrThrow({ where: { studentId: child.id, parentId: { not: parent.id } } })
  await db().parentLink.delete({ where: { id: extra.id } })

  const p = await registerParent()
  const old = await p.api.post("/api/parent/children", { data: { code } })
  expect(old.status()).toBe(404)
  expect(await db().parentLink.count({ where: { studentId: child.id } })).toBe(3)
  code = fresh
})

test("PA-08 parent settings: phone, language and report channels", async () => {
  const bad = await parent.api.patch("/api/parent/settings", { data: { phone: "abc" } })
  expect(bad.status()).toBe(400)
  const ok = await parent.api.patch("/api/parent/settings", {
    data: { phone: "01001234567", preferredLanguage: "en", emailReports: false },
  })
  expect(ok.status()).toBe(200)
  expect(await ok.json()).toMatchObject({ phone: "01001234567", preferredLanguage: "en", whatsappReports: true, emailReports: false })
  const back = await parent.api.patch("/api/parent/settings", { data: { emailReports: true } })
  expect((await back.json()).emailReports).toBe(true)
  expect((await (await apiAs("student")).get("/api/parent/settings")).status()).toBe(403)
})

test("PA-09 the cron endpoint is protected", async () => {
  const a = await anon()
  const none = await a.get("/api/cron/weekly-reports")
  // The test server has no CRON_SECRET: 503; with one configured it is 401.
  expect([401, 503]).toContain(none.status())
  const wrong = await a.get("/api/cron/weekly-reports", { headers: { Authorization: "Bearer wrong" } })
  expect([401, 503]).toContain(wrong.status())
})

test("PA-10 weekly reports go to linked parents and guardians, once a week", async () => {
  const admin = await apiAs("admin")
  expect((await parent.api.post("/api/admin/messaging/weekly-reports", { data: {} })).status()).toBe(403)

  // Some activity for the report.
  const alertSender = await db().user.findUniqueOrThrow({ where: { email: "ahmed@elearning.com" } })
  await db().studentAlert.create({
    data: { senderId: alertSender.id, studentId: child.id, title: "QA alert: missed homework", message: "QA" },
  })

  const before = new Date()
  const res = await admin.post("/api/admin/messaging/weekly-reports", { data: { studentId: child.id } })
  expect(res.status(), await res.text()).toBe(200)
  const run = await res.json()
  expect(run.failed).toBe(0)

  const rows = await db().messageDelivery.findMany({
    where: { template: "weekly_report", createdAt: { gte: before }, body: { contains: child.id } },
  })
  const parentWa = rows.find((r) => r.channel === "WHATSAPP" && r.userId === parent.id)
  expect(parentWa, "WhatsApp to the parent").toBeTruthy()
  expect(parentWa!.status).toBe("LOGGED")
  expect(parentWa!.to).toBe("201001234567")
  // preferredLanguage was set to English in PA-08.
  expect(parentWa!.body).toContain("Weekly report for")
  expect(parentWa!.body).toContain("QA alert: missed homework")
  const parentEmail = rows.find((r) => r.channel === "EMAIL" && r.userId === parent.id)
  expect(parentEmail?.status).toBe("LOGGED")
  // Three linked parents -> 3 WhatsApp + 3 emails.
  expect(rows.filter((r) => r.channel === "EMAIL").length).toBe(3)
  expect(rows.filter((r) => r.channel === "WHATSAPP").length).toBe(3)

  // Idempotent: a second run sends nothing new for this student.
  const again = await (await admin.post("/api/admin/messaging/weekly-reports", { data: { studentId: child.id } })).json()
  expect(again.sent + again.logged).toBe(0)
  expect(again.skipped).toBeGreaterThan(0)

  // A student with no linked parent but a guardian contact.
  await db().user.update({
    where: { id: otherStudent.id },
    data: { guardianName: "QA Guardian", guardianPhone: "01112223334", guardianEmail: "qa-guardian@qa.test" },
  })
  const g = await (await admin.post("/api/admin/messaging/weekly-reports", { data: { studentId: otherStudent.id } })).json()
  expect(g.logged).toBe(2)
  const gRows = await db().messageDelivery.findMany({
    where: { template: "weekly_report", body: { contains: otherStudent.id } },
  })
  expect(gRows.map((r) => r.to).sort()).toEqual(["201112223334", "qa-guardian@qa.test"])
  expect(gRows.find((r) => r.channel === "WHATSAPP")!.body).toContain("التقرير الأسبوعي")

  const log = await (await admin.get("/api/admin/messaging?template=weekly_report&channel=EMAIL")).json()
  expect(log.items.every((i: any) => i.channel === "EMAIL" && i.template === "weekly_report")).toBe(true)
  expect(log.counts).toHaveProperty("LOGGED")
  expect((await parent.api.get("/api/admin/messaging")).status()).toBe(403)
})

test("PA-11 admin test WhatsApp", async () => {
  const admin = await apiAs("admin")
  expect((await admin.post("/api/admin/messaging/test", { data: { to: "x" } })).status()).toBe(400)
  const r = await admin.post("/api/admin/messaging/test", { data: { to: "01005550000" } })
  expect(r.status()).toBe(200)
  expect((await r.json()).status).toBe("LOGGED")
})

test("PA-12 unlinking from either side", async () => {
  const del = await parent.api.delete(`/api/parent/children/${child.id}`)
  expect(del.status()).toBe(200)
  expect((await parent.api.get(`/api/parent/children/${child.id}`)).status()).toBe(403)
  expect((await parent.api.delete(`/api/parent/children/${child.id}`)).status()).toBe(404)

  const remaining = await db().parentLink.findFirstOrThrow({ where: { studentId: child.id } })
  const rm = await child.api.delete(`/api/student/parents?parentId=${remaining.parentId}`)
  expect(rm.status()).toBe(200)
  expect(await db().parentLink.count({ where: { id: remaining.id } })).toBe(0)
  expect(await db().notification.count({ where: { userId: remaining.parentId, link: "/parent" } })).toBe(1)
  expect(await db().activityLog.count({ where: { action: "parent.unlinked", entityId: child.id } })).toBe(2)
  // A student cannot remove someone else's link.
  expect((await otherStudent.api.delete(`/api/student/parents?parentId=${parent.id}`)).status()).toBe(404)
})

test("PA-13 pages load", async ({ page }) => {
  test.setTimeout(300_000) // first compile of several dev pages
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.context().addCookies(
    (await parent.api.storageState()).cookies.map((c) => ({ ...c }))
  )
  for (const path of ["/parent", "/parent/reports", "/parent/settings"]) {
    const r = await page.goto(path)
    expect(r?.status(), path).toBe(200)
    expect(new URL(page.url()).pathname).toBe(path)
  }
  await page.context().clearCookies()
  await page.context().addCookies((await child.api.storageState()).cookies)
  const r = await page.goto("/student/family")
  expect(r?.status()).toBe(200)
  await expect(page.getByText(code)).toBeVisible()

  // Admin can open any child's parent page and the messaging log.
  await page.context().clearCookies()
  await page.context().addCookies((await (await apiAs("admin")).storageState()).cookies)
  for (const path of [`/parent/children/${child.id}`, "/admin/messaging?channel=WHATSAPP"]) {
    const res = await page.goto(path)
    expect(res?.status(), path).toBe(200)
  }
  expect(errors).toEqual([])
})
