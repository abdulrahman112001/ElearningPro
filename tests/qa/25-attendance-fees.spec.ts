import { test, expect, APIRequestContext, Page } from "@playwright/test"
import { anon, apiAs, approveInstructor, db, registerUser, uniqueEmail } from "./support"

/**
 * Group schedules, attendance (manual + rotating QR check-in) and monthly
 * fees: who may manage a group, session generation from weekly slots, QR
 * check-in rules, closing a session (absentees + parent WhatsApp), fee dues,
 * cash receipts, wallet payments, undo and reminder rate limiting.
 */
// Generous timeout: the shared dev server compiles routes on first use.
test.describe.configure({ mode: "serial", timeout: 240_000 })

const MIN = 60_000
let ahmed: APIRequestContext
let sara: APIRequestContext
let admin: APIRequestContext
let s1: { email: string; api: APIRequestContext; id: string }
let s2: { email: string; api: APIRequestContext; id: string }
let outsider: { email: string; api: APIRequestContext; id: string }
let manager: { email: string; api: APIRequestContext; id: string }
let orgTeacher: { email: string; api: APIRequestContext; id: string }
let groupId: string
let orgId: string
let sessionA: string // started 5 min ago
let sessionB: string // started 30 min ago
let sessionC: string // two days ago (manual marking)
const parentPhone = "01001112233"
const guardianPhone = "01204445566"
const G = () => `/api/instructor/groups/${groupId}`

const cairoParts = (d: Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Cairo",
      hourCycle: "h23",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      year: "numeric",
      month: "2-digit",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  )
  return { dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday), time: `${p.hour}:${p.minute}`, period: `${p.year}-${p.month}` }
}

async function student() {
  const u = await registerUser("STUDENT")
  const id = (await db().user.findUniqueOrThrow({ where: { email: u.email } })).id
  return { ...u, id }
}

test("AF-01 setup: a QA group with two members, a parent and an organization", async () => {
  ahmed = await apiAs("ahmed")
  sara = await apiAs("sara")
  admin = await apiAs("admin")
  s1 = await student()
  s2 = await student()
  outsider = await student()
  const ahmedId = (await db().user.findUniqueOrThrow({ where: { email: "ahmed@elearning.com" } })).id

  const group = await db().classGroup.create({ data: { name: `QA Attendance ${Date.now()}`, instructorId: ahmedId } })
  groupId = group.id
  for (const s of [s1, s2]) {
    const res = await ahmed.post(`${G()}/members`, { data: { email: s.email } })
    expect(res.status(), await res.text()).toBe(201)
  }
  // s2 has a linked parent with a phone and a guardian phone of their own.
  const parent = await db().user.create({
    data: { email: uniqueEmail("parent"), name: "QA Parent", role: "PARENT", phone: parentPhone },
  })
  await db().parentLink.create({ data: { parentId: parent.id, studentId: s2.id, relation: "father" } })
  await db().user.update({ where: { id: s2.id }, data: { guardianPhone } })

  const m = await registerUser("INSTRUCTOR")
  manager = { ...m, id: await approveInstructor(m.email) }
  const t = await registerUser("INSTRUCTOR")
  orgTeacher = { ...t, id: await approveInstructor(t.email) }
  const org = await db().organization.create({
    data: { name: "QA Center", slug: `qa-center-${Date.now()}`, ownerId: ahmedId },
  })
  orgId = org.id
  await db().organizationMember.createMany({
    data: [
      { organizationId: orgId, userId: manager.id, role: "MANAGER" },
      { organizationId: orgId, userId: orgTeacher.id, role: "TEACHER" },
    ],
  })
})

test("AF-02 only the teacher, an org manager or an admin can manage the group", async () => {
  expect((await (await anon()).get(`${G()}/schedule`)).status()).toBe(401)
  expect((await sara.get(`${G()}/schedule`)).status()).toBe(403)
  expect((await s1.api.get(`${G()}/schedule`)).status()).toBe(403)
  expect((await sara.get(G())).status()).toBe(404)
  expect((await sara.patch(G(), { data: { monthlyFee: 1 } })).status()).toBe(404)
  expect((await sara.get(`${G()}/fees`)).status()).toBe(403)
  expect((await sara.post(`${G()}/fees/generate`, { data: { period: "2026-01" } })).status()).toBe(403)

  // Before the group joins the organization, its manager has no access.
  expect((await manager.api.get(`${G()}/schedule`)).status()).toBe(403)
  await db().classGroup.update({ where: { id: groupId }, data: { organizationId: orgId } })
  expect((await manager.api.get(`${G()}/schedule`)).status()).toBe(200)
  expect((await manager.api.get(G())).status()).toBe(200)
  // A plain teacher of the organization is not a manager.
  expect((await orgTeacher.api.get(`${G()}/schedule`)).status()).toBe(403)
  expect((await admin.get(`${G()}/schedule`)).status()).toBe(200)
  expect((await ahmed.get("/api/instructor/groups/does-not-exist/schedule")).status()).toBe(404)
})

test("AF-03 group settings: mode, location, monthly fee and capacity", async () => {
  const res = await manager.api.patch(G(), {
    data: { mode: "OFFLINE", location: "QA Center, Room 3", monthlyFee: 200, capacity: 30 },
  })
  expect(res.status(), await res.text()).toBe(200)
  expect(await res.json()).toMatchObject({ mode: "OFFLINE", location: "QA Center, Room 3", monthlyFee: 200, capacity: 30 })
  expect((await ahmed.patch(G(), { data: { mode: "SPACE" } })).status()).toBe(400)
  expect((await ahmed.patch(G(), { data: { monthlyFee: -5 } })).status()).toBe(400)
  expect((await ahmed.patch(G(), { data: { capacity: 1.5 } })).status()).toBe(400)
  // Existing fields keep working.
  const renamed = await ahmed.patch(G(), { data: { description: "QA group" } })
  expect((await renamed.json()).name).toContain("QA Attendance")
})

test("AF-04 weekly slots generate sessions in Cairo time without duplicates", async () => {
  const tomorrow = cairoParts(new Date(Date.now() + 24 * 60 * MIN)).dow
  const after = (tomorrow + 1) % 7
  expect((await ahmed.post(`${G()}/schedule`, { data: { dayOfWeek: 7, startTime: "17:00" } })).status()).toBe(400)
  expect((await ahmed.post(`${G()}/schedule`, { data: { dayOfWeek: 1, startTime: "5pm" } })).status()).toBe(400)
  const a = await ahmed.post(`${G()}/schedule`, { data: { dayOfWeek: tomorrow, startTime: "17:00", durationMin: 90 } })
  expect(a.status(), await a.text()).toBe(201)
  const b = await ahmed.post(`${G()}/schedule`, { data: { dayOfWeek: after, startTime: "09:30", location: "Hall B" } })
  expect(b.status()).toBe(201)
  expect((await ahmed.post(`${G()}/schedule`, { data: { dayOfWeek: tomorrow, startTime: "17:00" } })).status()).toBe(409)
  const slotB = (await b.json()).id
  expect((await ahmed.patch(`${G()}/schedule/${slotB}`, { data: { durationMin: 120 } })).status()).toBe(200)
  expect((await sara.patch(`${G()}/schedule/${slotB}`, { data: { durationMin: 30 } })).status()).toBe(403)

  expect((await ahmed.post(`${G()}/schedule/generate`, { data: { weeks: 0 } })).status()).toBe(400)
  const gen = await ahmed.post(`${G()}/schedule/generate`, { data: { weeks: 2 } })
  expect(gen.status(), await gen.text()).toBe(200)
  expect((await gen.json()).created).toBe(4)
  const again = await (await ahmed.post(`${G()}/schedule/generate`, { data: { weeks: 2 } })).json()
  expect(again).toMatchObject({ created: 0, skipped: 4 })

  const sessions = await db().groupSession.findMany({ where: { groupId }, orderBy: { startsAt: "asc" } })
  expect(sessions).toHaveLength(4)
  for (const s of sessions) {
    const p = cairoParts(s.startsAt)
    expect([tomorrow, after]).toContain(p.dow)
    expect(p.time).toBe(p.dow === tomorrow ? "17:00" : "09:30")
    const minutes = (s.endsAt!.getTime() - s.startsAt.getTime()) / MIN
    expect(minutes).toBe(p.dow === tomorrow ? 90 : 120)
    expect(s.mode).toBe("OFFLINE")
  }
  expect(sessions.find((s) => cairoParts(s.startsAt).dow === after)?.location).toBe("Hall B")

  // Cancelling keeps the row so generating again does not bring it back.
  const del = await ahmed.delete(`${G()}/sessions/${sessions[0].id}`)
  expect(del.status()).toBe(200)
  expect((await db().groupSession.findUniqueOrThrow({ where: { id: sessions[0].id } })).mode).toBe("CANCELLED")
  expect((await (await ahmed.post(`${G()}/schedule/generate`, { data: { weeks: 2 } })).json()).created).toBe(0)
  const upcoming = await (await ahmed.get(`${G()}/sessions?scope=upcoming`)).json()
  expect(upcoming.sessions.find((s: any) => s.id === sessions[0].id).cancelled).toBe(true)
})

test("AF-05 one-off sessions can be created and edited", async () => {
  const create = (startsAt: Date, title: string) =>
    ahmed.post(`${G()}/sessions`, { data: { startsAt: startsAt.toISOString(), title, durationMin: 60 } })
  const a = await create(new Date(Date.now() - 5 * MIN), "QA session A")
  expect(a.status(), await a.text()).toBe(201)
  sessionA = (await a.json()).id
  sessionB = (await (await create(new Date(Date.now() - 30 * MIN), "QA session B")).json()).id
  sessionC = (await (await create(new Date(Date.now() - 2 * 24 * 60 * MIN), "QA session C")).json()).id
  expect((await ahmed.post(`${G()}/sessions`, { data: { date: "2026-02-30", time: "10:00" } })).status()).toBe(400)
  expect((await ahmed.post(`${G()}/sessions`, { data: {} })).status()).toBe(400)

  const edit = await ahmed.patch(`${G()}/sessions/${sessionC}`, { data: { title: "QA session C (edited)", location: "Room 9" } })
  expect(edit.status()).toBe(200)
  expect(await edit.json()).toMatchObject({ title: "QA session C (edited)", location: "Room 9" })
  // Cairo wall-clock input is stored as UTC.
  const wall = await ahmed.post(`${G()}/sessions`, { data: { date: "2026-01-15", time: "18:00", title: "QA winter" } })
  expect(wall.status()).toBe(201)
  expect(new Date((await wall.json()).startsAt).toISOString()).toBe("2026-01-15T16:00:00.000Z")
  expect((await sara.get(`${G()}/sessions/${sessionC}`)).status()).toBe(403)
})

test("AF-06 manual marking: one-tap statuses and mark-all, members only", async () => {
  const url = `${G()}/sessions/${sessionC}/attendance`
  expect((await ahmed.put(url, { data: { records: [{ studentId: s1.id, status: "SLEEPING" }] } })).status()).toBe(400)
  const notMember = await ahmed.put(url, { data: { records: [{ studentId: outsider.id, status: "PRESENT" }] } })
  expect(notMember.status()).toBe(400)
  expect((await notMember.json()).code).toBe("not_member")
  expect((await sara.put(url, { data: { all: "PRESENT" } })).status()).toBe(403)

  const all = await ahmed.put(url, { data: { all: "PRESENT" } })
  expect(all.status(), await all.text()).toBe(200)
  expect((await all.json()).updated).toBe(2)
  const one = await manager.api.put(url, { data: { records: [{ studentId: s2.id, status: "EXCUSED" }] } })
  expect(one.status()).toBe(200)
  const detail = await (await ahmed.get(`${G()}/sessions/${sessionC}`)).json()
  const status = Object.fromEntries(detail.roster.map((r: any) => [r.student.id, r.status]))
  expect(status).toEqual({ [s1.id]: "PRESENT", [s2.id]: "EXCUSED" })
  const log = await db().activityLog.findFirst({ where: { action: "attendance.marked", entityId: sessionC } })
  expect(log).toBeTruthy()
})

test("AF-07 QR check-in: members only, idempotent, expiry and late detection", async () => {
  const start = await ahmed.post(`${G()}/sessions/${sessionA}/checkin`)
  expect(start.status(), await start.text()).toBe(200)
  const state = await start.json()
  expect(state.active).toBe(true)
  expect(state.svg).toContain("<svg")
  expect(state.url).toContain(`/checkin?t=`)
  const token = state.token as string

  expect((await (await anon()).post("/api/attendance/checkin", { data: { token } })).status()).toBe(401)
  const refused = await outsider.api.post("/api/attendance/checkin", { data: { token } })
  expect(refused.status()).toBe(403)
  expect((await refused.json()).code).toBe("not_member")

  const ok = await s1.api.post("/api/attendance/checkin", { data: { token } })
  expect(ok.status(), await ok.text()).toBe(200)
  expect(await ok.json()).toMatchObject({ status: "PRESENT", already: false })
  const twice = await s1.api.post("/api/attendance/checkin", { data: { token } })
  expect(await twice.json()).toMatchObject({ status: "PRESENT", already: true })
  expect(await db().attendanceRecord.count({ where: { sessionId: sessionA, studentId: s1.id } })).toBe(1)

  const live = await (await ahmed.get(`${G()}/sessions/${sessionA}/checkin`)).json()
  expect(live.checkedIn).toBe(1)
  expect(live.members).toBe(2)

  // The token rotates once it is ~30s old, and the old one stops working.
  await db().groupSession.update({ where: { id: sessionA }, data: { qrExpiresAt: new Date(Date.now() + 10_000) } })
  const rotated = await (await ahmed.get(`${G()}/sessions/${sessionA}/checkin`)).json()
  expect(rotated.token).not.toBe(token)
  const old = await s2.api.post("/api/attendance/checkin", { data: { token } })
  expect(old.status()).toBe(410)
  expect((await old.json()).code).toBe("expired_token")

  // Expired token
  await db().groupSession.update({ where: { id: sessionA }, data: { qrExpiresAt: new Date(Date.now() - 1000) } })
  const expired = await s2.api.post("/api/attendance/checkin", { data: { token: rotated.token } })
  expect(expired.status()).toBe(410)
  expect((await expired.json()).code).toBe("expired_token")
  expect((await s2.api.post("/api/attendance/checkin", { data: { token: 1 } })).status()).toBe(400)

  // More than 15 minutes after the start -> LATE
  const b = await (await ahmed.post(`${G()}/sessions/${sessionB}/checkin`)).json()
  const late = await s2.api.post("/api/attendance/checkin", { data: { token: b.token } })
  expect(await late.json()).toMatchObject({ status: "LATE" })
  const rec = await db().attendanceRecord.findFirstOrThrow({ where: { sessionId: sessionB, studentId: s2.id } })
  expect(rec.method).toBe("QR")

  // Stopping check-in kills the code.
  expect((await ahmed.delete(`${G()}/sessions/${sessionB}/checkin`)).status()).toBe(200)
  expect((await s1.api.post("/api/attendance/checkin", { data: { token: b.token } })).status()).toBe(410)
})

test("AF-08 closing a session marks absentees and messages parents once", async () => {
  const before = new Date()
  const close = await ahmed.post(`${G()}/sessions/${sessionA}/close`)
  expect(close.status(), await close.text()).toBe(200)
  expect(await close.json()).toMatchObject({ markedAbsent: 1, notified: 1 })
  const rec = await db().attendanceRecord.findFirstOrThrow({ where: { sessionId: sessionA, studentId: s2.id } })
  expect(rec.status).toBe("ABSENT")
  expect(rec.parentNotified).toBe(true)
  expect((await db().attendanceRecord.findFirstOrThrow({ where: { sessionId: sessionA, studentId: s1.id } })).status).toBe("PRESENT")

  const deliveries = await db().messageDelivery.findMany({
    where: { channel: "WHATSAPP", template: "absence", createdAt: { gte: before }, to: { in: ["201001112233", "201204445566"] } },
  })
  expect(deliveries.map((d) => d.to).sort()).toEqual(["201001112233", "201204445566"])
  expect(await db().notification.count({ where: { userId: s2.id, link: "/student/attendance", createdAt: { gte: before } } })).toBe(1)
  expect(await db().activityLog.count({ where: { action: "attendance.session_closed", entityId: sessionA } })).toBe(1)

  const again = await (await ahmed.post(`${G()}/sessions/${sessionA}/close`)).json()
  expect(again).toMatchObject({ markedAbsent: 0, notified: 0 })
  expect(
    await db().messageDelivery.count({ where: { template: "absence", createdAt: { gte: before }, to: { in: ["201001112233", "201204445566"] } } })
  ).toBe(2)
  const list = await (await ahmed.get(`${G()}/sessions?scope=past`)).json()
  expect(list.sessions.find((s: any) => s.id === sessionA).counts).toMatchObject({ PRESENT: 1, ABSENT: 1 })
})

const PERIOD = "2026-03"
let feeS1: string
let feeS2: string

test("AF-09 generating dues is idempotent and uses the monthly fee", async () => {
  expect((await ahmed.post(`${G()}/fees/generate`, { data: { period: "2026-13" } })).status()).toBe(400)
  const gen = await ahmed.post(`${G()}/fees/generate`, { data: { period: PERIOD } })
  expect(gen.status(), await gen.text()).toBe(200)
  expect(await gen.json()).toMatchObject({ created: 2, amount: 200 })
  expect((await (await ahmed.post(`${G()}/fees/generate`, { data: { period: PERIOD } })).json()).created).toBe(0)
  const list = await (await ahmed.get(`${G()}/fees?period=${PERIOD}`)).json()
  expect(list.fees).toHaveLength(2)
  expect(list.summary).toMatchObject({ due: 400, collected: 0, outstanding: 400 })
  feeS1 = list.fees.find((f: any) => f.studentId === s1.id).id
  feeS2 = list.fees.find((f: any) => f.studentId === s2.id).id
  expect(await db().activityLog.count({ where: { action: "fee.generated", entityId: groupId } })).toBe(1)
})

let receipt1: string
test("AF-10 cash payment gets a unique receipt; waive needs a note", async () => {
  expect((await sara.post(`${G()}/fees/${feeS1}/pay`)).status()).toBe(403)
  const pay = await manager.api.post(`${G()}/fees/${feeS1}/pay`, { data: {} })
  expect(pay.status(), await pay.text()).toBe(200)
  const paid = await pay.json()
  expect(paid).toMatchObject({ status: "PAID", method: "CASH" })
  expect(paid.receiptNo).toMatch(/^RC-\d{6}-[A-Z0-9]{5}$/)
  receipt1 = paid.receiptNo
  expect((await ahmed.post(`${G()}/fees/${feeS1}/pay`)).status()).toBe(409)
  expect((await ahmed.post(`${G()}/fees/${feeS1}/waive`, { data: { note: "x" } })).status()).toBe(409)
  expect((await ahmed.post(`${G()}/fees/${feeS2}/waive`, { data: {} })).status()).toBe(400)

  // Receipt is visible to the student and the managers, nobody else.
  expect((await s1.api.get(`/api/fees/${feeS1}`)).status()).toBe(200)
  expect((await s2.api.get(`/api/fees/${feeS1}`)).status()).toBe(404)
  expect((await sara.get(`/api/fees/${feeS1}`)).status()).toBe(404)
  expect(await db().activityLog.count({ where: { action: "fee.paid", entityId: feeS1 } })).toBe(1)
})

test("AF-11 wallet payment: insufficient balance, then paid atomically", async () => {
  await db().user.update({ where: { id: s2.id }, data: { walletBalance: 50 } })
  expect((await s1.api.post(`/api/fees/${feeS2}/pay-wallet`)).status()).toBe(404)
  const poor = await s2.api.post(`/api/fees/${feeS2}/pay-wallet`)
  expect(poor.status()).toBe(402)
  expect((await poor.json()).code).toBe("insufficient_balance")
  const still = await db().groupFee.findUniqueOrThrow({ where: { id: feeS2 } })
  expect(still.status).toBe("DUE")
  expect(still.receiptNo).toBeNull()
  expect((await db().user.findUniqueOrThrow({ where: { id: s2.id } })).walletBalance).toBe(50)

  await db().user.update({ where: { id: s2.id }, data: { walletBalance: 500 } })
  const before = new Date()
  const ok = await s2.api.post(`/api/fees/${feeS2}/pay-wallet`)
  expect(ok.status(), await ok.text()).toBe(200)
  const fee = await ok.json()
  expect(fee).toMatchObject({ status: "PAID", method: "WALLET" })
  expect(fee.receiptNo).not.toBe(receipt1)
  expect((await db().user.findUniqueOrThrow({ where: { id: s2.id } })).walletBalance).toBe(300)
  expect(await db().walletTransaction.count({ where: { userId: s2.id, reference: feeS2, type: "DEBIT" } })).toBe(1)
  expect((await s2.api.post(`/api/fees/${feeS2}/pay-wallet`)).status()).toBe(409)
  const ahmedId = (await db().user.findUniqueOrThrow({ where: { email: "ahmed@elearning.com" } })).id
  expect(await db().notification.count({ where: { userId: ahmedId, type: "PAYMENT_RECEIVED", createdAt: { gte: before } } })).toBeGreaterThan(0)

  const list = await (await ahmed.get(`${G()}/fees?period=${PERIOD}`)).json()
  expect(list.summary).toMatchObject({ collected: 400, outstanding: 0 })
})

test("AF-12 only the owner or an admin can undo; a wallet payment is refunded", async () => {
  // The group belongs to an organization owned by ahmed in this test, so the
  // manager may not undo but ahmed (owner) and admins may.
  const denied = await manager.api.post(`${G()}/fees/${feeS2}/undo`)
  expect(denied.status()).toBe(403)
  const undo = await admin.post(`${G()}/fees/${feeS2}/undo`)
  expect(undo.status(), await undo.text()).toBe(200)
  expect(await undo.json()).toMatchObject({ status: "DUE", receiptNo: null, method: null })
  expect((await db().user.findUniqueOrThrow({ where: { id: s2.id } })).walletBalance).toBe(500)
  expect((await ahmed.post(`${G()}/fees/${feeS2}/waive`, { data: { note: "QA scholarship" } })).status()).toBe(200)
  expect(await db().activityLog.count({ where: { action: "fee.waived", entityId: feeS2 } })).toBe(1)
  expect((await ahmed.post(`${G()}/fees/${feeS2}/undo`)).status()).toBe(200)
})

test("AF-13 reminders go to students and parents with dues, once a day", async () => {
  await db().user.update({ where: { id: s1.id }, data: { phone: "01113334455" } })
  const before = new Date()
  expect((await sara.post(`${G()}/fees/remind`)).status()).toBe(403)
  const res = await ahmed.post(`${G()}/fees/remind`)
  expect(res.status(), await res.text()).toBe(200)
  // Only s2 still has a due fee (s1 paid): parent + guardian.
  expect(await res.json()).toMatchObject({ students: 1, messages: 2 })
  const sent = await db().messageDelivery.findMany({ where: { template: "fee_due", createdAt: { gte: before } } })
  expect(sent.map((d) => d.to)).toEqual(expect.arrayContaining(["201001112233", "201204445566"]))
  expect(sent.map((d) => d.to)).not.toContain("201113334455")
  const again = await manager.api.post(`${G()}/fees/remind`)
  expect(again.status()).toBe(429)
  expect((await again.json()).code).toBe("rate_limited")
})

test("AF-14 student and teacher overviews", async () => {
  const me = await (await s2.api.get("/api/attendance/me")).json()
  const g = me.groups.find((x: any) => x.group.id === groupId)
  expect(g).toBeTruthy()
  // s2: EXCUSED (C, not counted), ABSENT (A), LATE (B) -> 50%
  expect(g.rate).toBe(50)
  expect(g.upcoming.length).toBeGreaterThan(0)
  expect(me.fees.find((f: any) => f.id === feeS2).status).toBe("DUE")
  expect(me.outstanding).toBe(200)

  const ov = await (await manager.api.get("/api/attendance/overview")).json()
  expect(ov.groups.map((x: any) => x.id)).toContain(groupId)
  expect(ov.groups.find((x: any) => x.id === groupId).outstanding).toBe(200)
  const saraOv = await (await sara.get("/api/attendance/overview")).json()
  expect(saraOv.groups.map((x: any) => x.id)).not.toContain(groupId)
  expect((await (await anon()).get("/api/attendance/me")).status()).toBe(401)
})

async function smoke(page: Page, api: APIRequestContext, paths: string[]) {
  await page.context().addCookies((await api.storageState()).cookies)
  for (const path of paths) {
    const errors: string[] = []
    const onError = (e: Error) => errors.push(e.message)
    page.on("pageerror", onError)
    const res = await page.goto(path, { waitUntil: "load" })
    await page.waitForTimeout(1200)
    expect(res?.status(), `${path} status`).toBeLessThan(400)
    expect(errors, `${path} JS errors`).toEqual([])
    page.off("pageerror", onError)
  }
}

test("AF-15 pages load for the teacher", async ({ page }) => {
  await smoke(page, ahmed, [
    "/instructor/attendance",
    `/instructor/groups/${groupId}`,
    `/instructor/groups/${groupId}/schedule`,
    `/instructor/groups/${groupId}/attendance`,
    `/instructor/groups/${groupId}/attendance?session=${sessionA}`,
    `/instructor/groups/${groupId}/fees?period=${PERIOD}`,
    `/instructor/groups/${groupId}/fees/${feeS1}/receipt`,
  ])
})

test("AF-16 pages load for the student, check-in page reports a bad code", async ({ page }) => {
  await smoke(page, s1.api, ["/student/attendance", `/student/attendance/receipt/${feeS1}`])
  await page.goto("/checkin?t=not-a-real-token-123")
  await expect(page.getByTestId("checkin-result")).toHaveAttribute("data-state", "error", { timeout: 60_000 })
})

test("AF-17 the check-in page asks anonymous visitors to log in", async ({ browser }) => {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto("/checkin?t=abcdefghijklmnop")
  expect(new URL(page.url()).pathname).toBe("/login")
  expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe("/checkin?t=abcdefghijklmnop")
  await ctx.close()
})
