import { test, expect, APIRequestContext } from "@playwright/test"
import { apiAs, approveInstructor, BASE_URL, db, fixtures, loginApi, registerUser } from "./support"

/**
 * Homework, gradebook and school mode: terms, class subjects, timetable,
 * announcements and report cards, with their permission rules.
 */
test.describe.configure({ mode: "serial" })

type User = { email: string; api: APIRequestContext; id: string }

async function teacher(): Promise<User> {
  const u = await registerUser("INSTRUCTOR")
  const id = await approveInstructor(u.email)
  // Approval is read into the JWT at login, so log in again.
  return { email: u.email, api: await loginApi(u.email, u.password), id }
}
async function student(): Promise<User> {
  const u = await registerUser("STUDENT")
  const id = (await db().user.findUniqueOrThrow({ where: { email: u.email } })).id
  return { ...u, id }
}

let owner: User // school owner + homeroom teacher of G1
let subjectTeacher: User // TEACHER member, teaches math in G1
let outsiderTeacher: User // teacher of an unrelated group
let s1: User
let s2: User
let s3: User // not in the school
let orgId: string
let g1: string
let g3: string
let gOut: string
let ahmed: APIRequestContext
let sara: APIRequestContext
const iso = (d: Date) => d.toISOString()
const DAY = 86_400_000

test("SC-00 setup: a school with classes, staff and students", async () => {
  test.setTimeout(240_000)
  // Sequential: parallel logins can hit the dev server while it compiles.
  owner = await teacher()
  subjectTeacher = await teacher()
  outsiderTeacher = await teacher()
  s1 = await student()
  s2 = await student()
  s3 = await student()
  ahmed = await apiAs("ahmed")
  sara = await apiAs("sara")
  const org = await db().organization.create({
    data: {
      name: "QA School",
      slug: `qa-school-${Date.now()}`,
      type: "SCHOOL",
      ownerId: owner.id,
      isApproved: true,
      members: {
        create: [
          { userId: owner.id, role: "OWNER" },
          { userId: subjectTeacher.id, role: "TEACHER" },
          { userId: s1.id, role: "STUDENT" },
        ],
      },
    },
  })
  orgId = org.id
  g1 = (
    await db().classGroup.create({
      data: {
        name: "QA Grade 3 - A",
        instructorId: owner.id,
        organizationId: orgId,
        members: { create: [{ studentId: s1.id }, { studentId: s2.id }] },
      },
    })
  ).id
  g3 = (await db().classGroup.create({ data: { name: "QA Grade 3 - B", instructorId: owner.id, organizationId: orgId } })).id
  gOut = (
    await db().classGroup.create({
      data: { name: "QA outside group", instructorId: outsiderTeacher.id, members: { create: [{ studentId: s3.id }] } },
    })
  ).id
})

// ---------------------------------------------------------------------------
// Homework
// ---------------------------------------------------------------------------

let hwId: string

test("SC-01 homework: only teachers who manage the group can create it; targets are notified", async () => {
  const due = new Date(Date.now() + 3 * DAY)
  const body = { groupId: g1, title: "QA Homework 1", subject: "Math", dueAt: iso(due), maxScore: 10 }
  expect((await outsiderTeacher.api.post("/api/assignments", { data: body })).status()).toBe(403)
  expect((await s1.api.post("/api/assignments", { data: body })).status()).toBe(403)
  expect((await owner.api.post("/api/assignments", { data: { ...body, title: " " } })).status()).toBe(400)
  expect((await owner.api.post("/api/assignments", { data: { title: "QA no target" } })).status()).toBe(400)
  expect((await owner.api.post("/api/assignments", { data: { ...body, maxScore: -1 } })).status()).toBe(400)
  expect((await owner.api.post("/api/assignments", { data: { ...body, attachmentUrl: "javascript:alert(1)" } })).status()).toBe(400)

  const res = await owner.api.post("/api/assignments", { data: { ...body, attachmentUrl: "https://example.com/sheet.pdf" } })
  expect(res.status(), await res.text()).toBe(201)
  const hw = await res.json()
  hwId = hw.id
  expect(hw.notified).toBe(2)
  for (const s of [s1, s2]) {
    expect(await db().notification.count({ where: { userId: s.id, link: "/student/homework", title: { contains: "QA Homework 1" } } })).toBe(1)
  }
  expect(await db().notification.count({ where: { userId: s3.id, title: { contains: "QA Homework 1" } } })).toBe(0)
  expect(await db().activityLog.count({ where: { action: "homework.created", entityId: hwId } })).toBe(1)

  // The subject teacher of the class may also give homework.
  await db().classSubject.create({ data: { groupId: g1, subject: "Math", teacherId: subjectTeacher.id } })
  const bySubjectTeacher = await subjectTeacher.api.post("/api/assignments", { data: { ...body, title: "QA HW by subject teacher" } })
  expect(bySubjectTeacher.status()).toBe(201)
})

test("SC-02 homework on a course targets enrolled students; only the course owner may create it", async () => {
  const course = fixtures().courses.react
  await db().enrollment.upsert({
    where: { userId_courseId: { userId: s2.id, courseId: course.id } },
    create: { userId: s2.id, courseId: course.id },
    update: {},
  })
  const data = { courseId: course.id, lessonId: course.lessonIds[0], title: "QA Course homework", maxScore: 5 }
  expect((await sara.post("/api/assignments", { data })).status()).toBe(403)
  expect((await ahmed.post("/api/assignments", { data: { ...data, lessonId: "nope" } })).status()).toBe(400)
  const res = await ahmed.post("/api/assignments", { data })
  expect(res.status(), await res.text()).toBe(201)
  const hw = await res.json()
  const mine2 = await (await s2.api.get("/api/assignments/mine")).json()
  expect(mine2.assignments.map((a: any) => a.id)).toContain(hw.id)
  const mine3 = await (await s3.api.get("/api/assignments/mine")).json()
  expect(mine3.assignments.map((a: any) => a.id)).not.toContain(hw.id)
  // Sara cannot open or grade it either.
  expect((await sara.get(`/api/assignments/${hw.id}`)).status()).toBe(404)
  await db().assignment.delete({ where: { id: hw.id } })
  await db().enrollment.deleteMany({ where: { userId: s2.id, courseId: course.id } })
})

test("SC-03 students outside the group cannot see or submit; teachers see the submission table", async () => {
  expect((await s3.api.get(`/api/assignments/${hwId}`)).status()).toBe(404)
  expect((await s3.api.put(`/api/assignments/${hwId}/submission`, { data: { content: "hi" } })).status()).toBe(403)
  expect((await outsiderTeacher.api.get(`/api/assignments/${hwId}`)).status()).toBe(404)
  expect((await outsiderTeacher.api.patch(`/api/assignments/${hwId}`, { data: { title: "x" } })).status()).toBe(403)

  const view = await (await s1.api.get(`/api/assignments/${hwId}`)).json()
  expect(view.role).toBe("student")
  expect(view.submission).toBeNull()

  const t = await (await owner.api.get(`/api/assignments/${hwId}`)).json()
  expect(t.role).toBe("teacher")
  expect(t.rows).toHaveLength(2)
  expect(t.summary).toMatchObject({ targets: 2, submitted: 0 })
})

test("SC-04 submission rules: empty refused, edit until graded, late flag, closed when late not allowed", async () => {
  expect((await s1.api.put(`/api/assignments/${hwId}/submission`, { data: {} })).status()).toBe(400)
  expect((await s1.api.put(`/api/assignments/${hwId}/submission`, { data: { linkUrl: "ftp://x" } })).status()).toBe(400)
  const first = await s1.api.put(`/api/assignments/${hwId}/submission`, { data: { content: "My answer" } })
  expect(first.status()).toBe(201)
  expect((await first.json()).isLate).toBe(false)
  const edit = await s1.api.put(`/api/assignments/${hwId}/submission`, {
    data: { content: "My better answer", linkUrl: "https://docs.example.com/a" },
  })
  expect(edit.status()).toBe(200)
  expect((await edit.json()).content).toBe("My better answer")

  // Past due, late allowed -> flagged late.
  const past = await owner.api.post("/api/assignments", {
    data: { groupId: g1, title: "QA Past due", dueAt: iso(new Date(Date.now() - DAY)), allowLate: true },
  })
  const pastId = (await past.json()).id
  const late = await s2.api.put(`/api/assignments/${pastId}/submission`, { data: { content: "sorry" } })
  expect(late.status()).toBe(201)
  expect((await late.json()).isLate).toBe(true)

  // Late not allowed -> refused.
  const closed = await owner.api.post("/api/assignments", {
    data: { groupId: g1, title: "QA Closed", dueAt: iso(new Date(Date.now() - DAY)), allowLate: false },
  })
  const closedId = (await closed.json()).id
  const refused = await s2.api.put(`/api/assignments/${closedId}/submission`, { data: { content: "too late" } })
  expect(refused.status()).toBe(409)
  expect((await refused.json()).code).toBe("past_due")
  const mine = await (await s2.api.get("/api/assignments/mine")).json()
  const byId = Object.fromEntries(mine.assignments.map((a: any) => [a.id, a]))
  expect(byId[closedId]).toMatchObject({ status: "pending", closed: true })
  expect(byId[pastId]).toMatchObject({ status: "submitted" })
  expect(byId[hwId]).toMatchObject({ status: "pending", closed: false })

  // The list shows what needs grading.
  const list = await (await owner.api.get(`/api/assignments?groupId=${g1}`)).json()
  const row = list.assignments.find((a: any) => a.id === hwId)
  expect(row).toMatchObject({ targets: 2, submissions: 1, needsGrading: 1 })
  expect(list.summary.needsGrading).toBeGreaterThanOrEqual(2)
  const dueSoon = await (await owner.api.get(`/api/assignments?dueSoon=1`)).json()
  expect(dueSoon.assignments.map((a: any) => a.id)).toContain(hwId)
  expect(dueSoon.assignments.map((a: any) => a.id)).not.toContain(pastId)
})

test("SC-05 grading validates the score, notifies the student and locks the submission", async () => {
  const sub = await db().assignmentSubmission.findUniqueOrThrow({
    where: { assignmentId_studentId: { assignmentId: hwId, studentId: s1.id } },
  })
  const url = `/api/assignments/${hwId}/submissions/${sub.id}`
  expect((await outsiderTeacher.api.patch(url, { data: { score: 5 } })).status()).toBe(403)
  expect((await s1.api.patch(url, { data: { score: 10 } })).status()).toBe(403)
  expect((await owner.api.patch(url, { data: { score: 11 } })).status()).toBe(400)
  expect((await owner.api.patch(url, { data: { score: -1 } })).status()).toBe(400)
  expect((await owner.api.patch(url, { data: { score: "8" } })).status()).toBe(400)
  const ok = await owner.api.patch(url, { data: { score: 8, feedback: "Well done" } })
  expect(ok.status(), await ok.text()).toBe(200)
  expect(await db().notification.count({ where: { userId: s1.id, title: { contains: "QA Homework 1" }, link: { contains: "graded" } } })).toBe(1)
  expect(await db().activityLog.count({ where: { action: "homework.graded", entityId: hwId } })).toBe(1)

  const locked = await s1.api.put(`/api/assignments/${hwId}/submission`, { data: { content: "change" } })
  expect(locked.status()).toBe(409)
  expect((await locked.json()).code).toBe("already_graded")
  // Lowering the max below a given grade is refused.
  expect((await owner.api.patch(`/api/assignments/${hwId}`, { data: { maxScore: 5 } })).status()).toBe(409)
  const mine = await (await s1.api.get("/api/assignments/mine")).json()
  expect(mine.assignments.find((a: any) => a.id === hwId)).toMatchObject({ status: "graded" })
})

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

let termA: string
let termB: string

test("SC-06 terms: managers only, exactly one current term", async () => {
  const base = `/api/school/${orgId}/terms`
  const now = Date.now()
  const body = { name: "QA Term A", startsAt: iso(new Date(now - 30 * DAY)), endsAt: iso(new Date(now + 60 * DAY)) }
  expect((await subjectTeacher.api.post(base, { data: body })).status()).toBe(403)
  expect((await s1.api.get(base)).status()).toBe(404)
  expect((await s3.api.get(base)).status()).toBe(404)
  expect((await outsiderTeacher.api.get(base)).status()).toBe(404)
  expect((await owner.api.post(base, { data: { ...body, endsAt: iso(new Date(now - 60 * DAY)) } })).status()).toBe(400)

  const a = await (await owner.api.post(base, { data: body })).json()
  expect(a.isCurrent, "the first term is current").toBe(true)
  termA = a.id
  const b = await owner.api.post(base, {
    data: { name: "QA Term B", startsAt: iso(new Date(now + 61 * DAY)), endsAt: iso(new Date(now + 150 * DAY)), isCurrent: true },
  })
  expect(b.status()).toBe(201)
  termB = (await b.json()).id
  let terms = await (await subjectTeacher.api.get(base)).json()
  expect(terms.filter((t: any) => t.isCurrent).map((t: any) => t.id)).toEqual([termB])

  expect((await owner.api.patch(`${base}/${termA}`, { data: { isCurrent: true } })).status()).toBe(200)
  terms = await db().academicTerm.findMany({ where: { organizationId: orgId, isCurrent: true } })
  expect(terms.map((t: any) => t.id)).toEqual([termA])
  expect((await subjectTeacher.api.patch(`${base}/${termB}`, { data: { name: "x" } })).status()).toBe(403)
})

// ---------------------------------------------------------------------------
// Gradebook
// ---------------------------------------------------------------------------

test("SC-07 gradebook: access, validation, weighted averages, one log entry per save", async () => {
  const url = `/api/gradebook/${g1}`
  expect((await outsiderTeacher.api.get(url)).status()).toBe(403)
  expect((await s1.api.get(url)).status()).toBe(403)

  const empty = await (await owner.api.get(url)).json()
  expect(empty.term.id, "defaults to the current term").toBe(termA)
  expect(empty.students).toHaveLength(2)

  const quiz = { subject: "Math", title: "QA Quiz 1", maxScore: 10, weight: 1 }
  const mid = { subject: "Math", title: "QA Midterm", maxScore: 20, weight: 2 }
  const bad = await owner.api.post(url, {
    data: {
      entries: [
        { ...quiz, studentId: s1.id, score: 11 },
        { ...quiz, studentId: s3.id, score: 5 },
        { ...quiz, studentId: s2.id, score: -1 },
      ],
    },
  })
  expect(bad.status()).toBe(400)
  const errs = (await bad.json()).errors
  expect(errs.map((e: any) => e.code).sort()).toEqual(["not_member", "out_of_range", "out_of_range"])
  expect(await db().gradeEntry.count({ where: { groupId: g1 } })).toBe(0)

  const before = await db().activityLog.count({ where: { action: "gradebook.updated", entityId: g1 } })
  const save = await owner.api.post(url, {
    data: {
      entries: [
        { ...quiz, studentId: s1.id, score: 8 },
        { ...mid, studentId: s1.id, score: 15 },
        { ...quiz, studentId: s2.id, score: 10 },
        { ...mid, studentId: s2.id, score: null },
      ],
    },
  })
  expect(save.status(), await save.text()).toBe(200)
  const grid = await save.json()
  expect(grid.saved).toBe(3)
  const avg = Object.fromEntries(grid.students.map((s: any) => [s.id, s.average]))
  // s1: (1*0.8 + 2*0.75) / 3 = 76.7 ; s2: 100
  expect(avg[s1.id]).toBe(76.7)
  expect(avg[s2.id]).toBe(100)
  expect(await db().activityLog.count({ where: { action: "gradebook.updated", entityId: g1 } })).toBe(before + 1)
  const entry = await db().gradeEntry.findFirstOrThrow({ where: { groupId: g1, studentId: s1.id, title: "QA Quiz 1" } })
  expect(entry).toMatchObject({ termId: termA, organizationId: orgId })

  // Updating a cell does not duplicate it; null clears it.
  await owner.api.post(url, { data: { entries: [{ ...quiz, studentId: s1.id, score: 9 }, { ...quiz, studentId: s2.id, score: null }] } })
  expect(await db().gradeEntry.count({ where: { groupId: g1, title: "QA Quiz 1" } })).toBe(1)

  // The subject teacher may only enter their subject.
  const other = await subjectTeacher.api.post(url, { data: { entries: [{ subject: "Science", title: "QA Lab", maxScore: 10, studentId: s1.id, score: 5 }] } })
  expect(other.status()).toBe(400)
  expect((await other.json()).errors[0].code).toBe("not_your_subject")

  // Homework columns (read-only) and CSV export.
  const withHw = await (await owner.api.get(`${url}?includeHomework=1`)).json()
  const hwCol = withHw.columns.find((c: any) => c.kind === "homework" && c.assignmentId === hwId)
  expect(hwCol).toBeTruthy()
  expect(withHw.cells[s1.id][hwCol.key]).toBe(8)
  const csv = await owner.api.get(`${url}?format=csv`)
  expect(csv.headers()["content-type"]).toContain("text/csv")
  const text = await csv.text()
  expect(text).toContain("QA Quiz 1")
  expect(text).toContain(s1.email)

  // Other term: empty.
  const tb = await (await owner.api.get(`${url}?termId=${termB}`)).json()
  expect(tb.columns).toHaveLength(0)
  expect((await owner.api.get(`${url}?termId=bogus`)).status()).toBe(400)
})

// ---------------------------------------------------------------------------
// Subjects and timetable
// ---------------------------------------------------------------------------

test("SC-08 class subjects: teacher must belong to the school, no duplicates", async () => {
  const base = `/api/school/${orgId}/subjects`
  expect((await owner.api.post(base, { data: { groupId: g1, subject: "Science", teacherId: outsiderTeacher.id } })).status()).toBe(400)
  expect((await owner.api.post(base, { data: { groupId: gOut, subject: "Science", teacherId: subjectTeacher.id } })).status()).toBe(404)
  expect((await subjectTeacher.api.post(base, { data: { groupId: g1, subject: "Science", teacherId: subjectTeacher.id } })).status()).toBe(403)
  expect((await owner.api.post(base, { data: { groupId: g1, subject: "Math", teacherId: subjectTeacher.id } })).status()).toBe(409)
  const ok = await owner.api.post(base, { data: { groupId: g1, subject: "Science", teacherId: owner.id } })
  expect(ok.status(), await ok.text()).toBe(201)
  const classes = await (await subjectTeacher.api.get(`/api/school/${orgId}/classes`)).json()
  expect(classes.canManage).toBe(false)
  expect(classes.classes.find((c: any) => c.id === g1).subjects.map((s: any) => s.subject)).toEqual(["Math", "Science"])
})

test("SC-09 timetable: class overlap and teacher double-booking are refused with details", async () => {
  const base = `/api/school/${orgId}/timetable`
  const first = await owner.api.post(base, { data: { groupId: g1, subject: "Math", dayOfWeek: 0, startTime: "08:00", endTime: "08:45", room: "101" } })
  expect(first.status(), await first.text()).toBe(201)
  const firstEntry = await first.json()
  expect(firstEntry.teacherId, "defaults to the subject teacher").toBe(subjectTeacher.id)

  const classClash = await owner.api.post(base, { data: { groupId: g1, subject: "Science", teacherId: owner.id, dayOfWeek: 0, startTime: "08:30", endTime: "09:15" } })
  expect(classClash.status()).toBe(409)
  const cc = await classClash.json()
  expect(cc.code).toBe("timetable_conflict")
  expect(cc.conflicts[0]).toMatchObject({ type: "class", entryId: firstEntry.id })

  const teacherClash = await owner.api.post(base, { data: { groupId: g3, subject: "Math", teacherId: subjectTeacher.id, dayOfWeek: 0, startTime: "08:15", endTime: "09:00" } })
  expect(teacherClash.status()).toBe(409)
  expect((await teacherClash.json()).conflicts.map((c: any) => c.type)).toEqual(["teacher"])

  // Back-to-back periods and other days are fine.
  expect((await owner.api.post(base, { data: { groupId: g1, subject: "Science", teacherId: owner.id, dayOfWeek: 0, startTime: "08:45", endTime: "09:30" } })).status()).toBe(201)
  expect((await owner.api.post(base, { data: { groupId: g3, subject: "Math", teacherId: subjectTeacher.id, dayOfWeek: 1, startTime: "08:15", endTime: "09:00" } })).status()).toBe(201)

  // Validation and permissions.
  expect((await owner.api.post(base, { data: { groupId: g1, subject: "Art", dayOfWeek: 2, startTime: "10:00", endTime: "09:00" } })).status()).toBe(400)
  expect((await owner.api.post(base, { data: { groupId: g1, subject: "Art", dayOfWeek: 7, startTime: "10:00", endTime: "11:00" } })).status()).toBe(400)
  expect((await owner.api.post(base, { data: { groupId: g1, subject: "Art", dayOfWeek: 2, startTime: "25:00", endTime: "26:00" } })).status()).toBe(400)
  expect((await subjectTeacher.api.post(base, { data: { groupId: g1, subject: "Art", dayOfWeek: 2, startTime: "10:00", endTime: "11:00" } })).status()).toBe(403)

  // Moving an entry onto a clash is refused too.
  const moved = await owner.api.patch(`${base}/${firstEntry.id}`, { data: { dayOfWeek: 1 } })
  expect(moved.status()).toBe(409)
  expect((await owner.api.patch(`${base}/${firstEntry.id}`, { data: { room: "102" } })).status()).toBe(200)

  // Student and teacher views.
  const mine = await (await s1.api.get("/api/school/me/timetable")).json()
  expect(mine.map((e: any) => e.subject).sort()).toEqual(["Math", "Science"])
  const teaching = await (await subjectTeacher.api.get("/api/school/me/timetable?as=teacher")).json()
  expect(teaching).toHaveLength(2)
  expect((await s3.api.get("/api/school/me/timetable")).ok()).toBe(true)
  expect(await (await s3.api.get("/api/school/me/timetable")).json()).toEqual([])
})

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

test("SC-10 announcements: audience filtering and who may post", async () => {
  const base = `/api/school/${orgId}/announcements`
  const post = (api: APIRequestContext, data: object) => api.post(base, { data })
  expect((await post(owner.api, { title: "QA x", body: "y", audience: "EVERYONE" })).status()).toBe(400)
  expect((await post(subjectTeacher.api, { title: "QA teacher org-wide", body: "no" })).status()).toBe(403)
  expect((await post(s1.api, { title: "QA student", body: "no" })).status()).toBe(404)
  expect((await post(owner.api, { title: "QA wrong class", body: "x", groupId: gOut })).status()).toBe(404)

  const all = await post(owner.api, { title: "QA Ann all", body: "Hello school", pinned: true })
  expect(all.status()).toBe(201)
  expect((await all.json()).notified).toBeGreaterThanOrEqual(3) // s1, s2, subject teacher
  await post(owner.api, { title: "QA Ann students", body: "Hi students", audience: "STUDENTS", groupId: g1 })
  await post(owner.api, { title: "QA Ann parents", body: "Hi parents", audience: "PARENTS" })
  await post(owner.api, { title: "QA Ann teachers", body: "Staff meeting", audience: "TEACHERS" })
  const byTeacher = await post(subjectTeacher.api, { title: "QA Ann from math teacher", body: "Quiz Sunday", groupId: g1, pinned: true })
  expect(byTeacher.status()).toBe(201)
  expect((await byTeacher.json()).pinned, "teachers cannot pin").toBe(false)

  const seen = (await (await s1.api.get("/api/school/me/announcements")).json()).map((a: any) => a.title)
  expect(seen).toEqual(expect.arrayContaining(["QA Ann all", "QA Ann students", "QA Ann from math teacher"]))
  expect(seen).not.toContain("QA Ann parents")
  expect(seen).not.toContain("QA Ann teachers")
  expect(seen[0], "pinned first").toBe("QA Ann all")
  expect(await (await s3.api.get("/api/school/me/announcements")).json()).toEqual([])
  expect(await db().notification.count({ where: { userId: subjectTeacher.id, title: { contains: "QA Ann teachers" } } })).toBe(1)
  expect(await db().notification.count({ where: { userId: s1.id, title: { contains: "QA Ann teachers" } } })).toBe(0)

  const id = (await all.json()).id
  expect((await subjectTeacher.api.delete(`${base}/${id}`)).status()).toBe(403)
  expect((await subjectTeacher.api.patch(`${base}/${id}`, { data: { pinned: false } })).status()).toBe(403)
  expect((await owner.api.patch(`${base}/${id}`, { data: { pinned: false } })).status()).toBe(200)
})

// ---------------------------------------------------------------------------
// Report cards
// ---------------------------------------------------------------------------

test("SC-11 report cards: weighted subject averages, overall and attendance in the term", async () => {
  const term = await db().academicTerm.findUniqueOrThrow({ where: { id: termA } })
  await db().gradeEntry.deleteMany({ where: { groupId: g1 } })
  const mk = (subject: string, title: string, score: number, maxScore: number, weight = 1, termId: string | null = termA) => ({
    organizationId: orgId, termId, groupId: g1, studentId: s1.id, subject, title, score, maxScore, weight, recordedById: owner.id,
  })
  await db().gradeEntry.createMany({
    data: [
      mk("Math", "QA Q1", 8, 10), // 80%
      mk("Math", "QA Final", 16, 20, 3), // 80% x3 -> (0.8 + 2.4) / 4 = 80
      mk("Science", "QA Lab", 5, 10), // 50%
      mk("Science", "QA Other term", 10, 10, 1, termB), // not counted
    ],
  })
  const inTerm = new Date(term.startsAt.getTime() + DAY)
  const outTerm = new Date(term.startsAt.getTime() - 5 * DAY)
  const statuses = ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const
  for (let i = 0; i < statuses.length; i++) {
    await db().groupSession.create({
      data: {
        groupId: g1,
        startsAt: new Date(inTerm.getTime() + i * DAY),
        attendance: { create: [{ studentId: s1.id, status: statuses[i] }] },
      },
    })
  }
  await db().groupSession.create({
    data: { groupId: g1, startsAt: outTerm, attendance: { create: [{ studentId: s1.id, status: "ABSENT" }] } },
  })

  const url = `/api/school/${orgId}/report-cards?groupId=${g1}&termId=${termA}`
  expect((await subjectTeacher.api.get(url)).status(), "a subject teacher is not the homeroom teacher").toBe(403)
  expect((await s1.api.get(url)).status()).toBe(404)
  expect((await outsiderTeacher.api.get(url)).status()).toBe(404)
  expect((await owner.api.get(`/api/school/${orgId}/report-cards?groupId=${gOut}`)).status()).toBe(404)

  const res = await owner.api.get(url)
  expect(res.status(), await res.text()).toBe(200)
  const data = await res.json()
  expect(data.organization.name).toBe("QA School")
  const card = data.cards.find((c: any) => c.student.id === s1.id)
  const subj = Object.fromEntries(card.subjects.map((s: any) => [s.subject, s.percent]))
  expect(subj).toEqual({ Math: 80, Science: 50 })
  expect(card.overall).toBe(65) // (80 + 50) / 2
  expect(card.attendance).toMatchObject({ present: 1, late: 1, absent: 1, excused: 1, rate: 66.7 })
  const card2 = data.cards.find((c: any) => c.student.id === s2.id)
  expect(card2.overall).toBeNull()
  expect(card2.attendance.rate).toBeNull()

  // Student view of their own grades.
  const grades = await (await s1.api.get("/api/school/me/grades")).json()
  const tA = grades.terms.find((t: any) => t.term?.id === termA)
  expect(tA.subjects.find((s: any) => s.subject === "Math").average).toBe(80)
  expect(grades.homework.map((h: any) => h.assignment.id)).toContain(hwId)
})

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

test("SC-12 pages load without errors", async ({ browser }) => {
  test.setTimeout(480_000)
  const visit = async (who: User, paths: string[]) => {
    const context = await browser.newContext({ storageState: await who.api.storageState() })
    const page = await context.newPage()
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    for (const p of paths) {
      const res = await page.goto(`${BASE_URL}${p}`)
      expect(res?.status(), p).toBeLessThan(400)
      expect(new URL(page.url()).pathname, p).toBe(p.split("?")[0])
      await page.waitForLoadState("networkidle")
    }
    expect(errors).toEqual([])
    await context.close()
  }
  await visit(owner, [
    "/instructor/assignments",
    `/instructor/assignments/${hwId}`,
    "/instructor/gradebook",
    "/instructor/timetable",
    `/org/${orgId}/school`,
    `/org/${orgId}/school/terms`,
    `/org/${orgId}/school/subjects`,
    `/org/${orgId}/school/timetable`,
    `/org/${orgId}/school/announcements`,
    `/org/${orgId}/school/report-cards`,
    `/org/${orgId}/school/report-cards/print?groupId=${g1}&termId=${termA}`,
  ])
  await visit(s1, ["/student/homework", "/student/timetable", "/student/grades", "/student/announcements"])
})

test.afterAll(async () => {
  if (orgId) await db().organization.deleteMany({ where: { id: orgId } })
  const ids = [g1, g3, gOut].filter(Boolean)
  if (ids.length) await db().classGroup.deleteMany({ where: { id: { in: ids } } })
})
