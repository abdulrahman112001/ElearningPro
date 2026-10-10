import { test, expect, APIRequestContext } from "@playwright/test"
import { anon, apiAs, approveInstructor, db, fixtures, registerUser } from "./support"

/**
 * Organizations (tutoring centers, schools, academies): approved teachers
 * create them, admins approve them before the public page goes live, and
 * members get role-based access. Invites are email-bound, expiring and
 * single-use; classes need an org teacher and respect capacity; a course can
 * only be attached by its own teacher.
 */
test.describe.configure({ mode: "serial" })

type Acct = { email: string; api: APIRequestContext; id: string }

const NAME = `QA Center ${Date.now().toString(36)}`
let owner: Acct
let teacher: Acct
let manager: Acct
let student: Acct
let student2: Acct
let outsider: Acct
let admin: APIRequestContext
let sara: APIRequestContext
let orgId: string
let slug: string
let classId: string
const createdOrgIds: string[] = []
const createdCourseIds: string[] = []

async function account(role: "STUDENT" | "INSTRUCTOR", approve = role === "INSTRUCTOR"): Promise<Acct> {
  const u = await registerUser(role)
  const id = approve ? await approveInstructor(u.email) : (await db().user.findUniqueOrThrow({ where: { email: u.email } })).id
  return { email: u.email, api: u.api, id }
}

/** Invites `email` as `role` (as the owner) and returns the token. */
async function invite(email: string, role: string, as: APIRequestContext = owner.api) {
  const res = await as.post(`/api/organizations/${orgId}/invites`, { data: { email, role } })
  expect(res.status(), await res.text()).toBe(201)
  return (await res.json()).token as string
}

test.afterAll(async () => {
  if (createdOrgIds.length) {
    await db().classGroup.deleteMany({ where: { organizationId: { in: createdOrgIds } } })
    await db().course.deleteMany({ where: { id: { in: createdCourseIds } } })
    await db().organization.deleteMany({ where: { id: { in: createdOrgIds } } })
  }
})

test("ORG-01 only approved instructors (or admins) can create an organization", async () => {
  admin = await apiAs("admin")
  sara = await apiAs("sara")
  owner = await account("INSTRUCTOR")
  const pending = await registerUser("INSTRUCTOR")
  const stu = await apiAs("student")

  expect((await (await anon()).post("/api/organizations", { data: { name: NAME } })).status()).toBe(401)
  const p = await pending.api.post("/api/organizations", { data: { name: NAME } })
  expect(p.status()).toBe(403)
  expect((await p.json()).code).toBe("instructor_not_approved")
  expect((await stu.post("/api/organizations", { data: { name: NAME } })).status()).toBe(403)

  // Validation
  expect((await owner.api.post("/api/organizations", { data: { name: "x" } })).status()).toBe(400)
  expect((await owner.api.post("/api/organizations", { data: { name: NAME, type: "BANK" } })).status()).toBe(400)
  expect((await owner.api.post("/api/organizations", { data: { name: NAME, primaryColor: "red" } })).status()).toBe(400)
  expect((await owner.api.post("/api/organizations", { data: { name: NAME, logoUrl: "javascript:alert(1)" } })).status()).toBe(400)
})

test("ORG-02 creating makes the creator OWNER, pending approval, with a unique slug", async () => {
  const res = await owner.api.post("/api/organizations", {
    data: {
      name: NAME,
      type: "CENTER",
      description: "QA tutoring center for organizations tests",
      phone: "01001234567",
      email: "Center@QA.test",
      governorate: "Cairo",
      primaryColor: "#0EA5E9",
      logoUrl: "https://example.com/logo.png",
    },
  })
  expect(res.status(), await res.text()).toBe(201)
  const org = await res.json()
  orgId = org.id
  slug = org.slug
  createdOrgIds.push(orgId)
  expect(org.isApproved).toBe(false)
  expect(org.primaryColor).toBe("#0ea5e9")
  expect(slug).toMatch(/^qa-center-/)
  const m = await db().organizationMember.findFirstOrThrow({ where: { organizationId: orgId, userId: owner.id } })
  expect(m.role).toBe("OWNER")
  expect(await db().activityLog.count({ where: { action: "organization.created", entityId: orgId } })).toBe(1)

  // Same name -> a different, free slug
  const second = await owner.api.post("/api/organizations", { data: { name: NAME } })
  expect(second.status()).toBe(201)
  const s2 = await second.json()
  createdOrgIds.push(s2.id)
  expect(s2.slug).not.toBe(slug)
  expect(s2.slug.startsWith(slug)).toBe(true)

  // A manually chosen taken slug is refused; invalid / reserved ones too
  const taken = await owner.api.post("/api/organizations", { data: { name: "QA other", slug } })
  expect(taken.status()).toBe(409)
  expect((await taken.json()).code).toBe("slug_taken")
  expect((await owner.api.post("/api/organizations", { data: { name: "QA other", slug: "Bad Slug!" } })).status()).toBe(400)
  expect((await owner.api.post("/api/organizations", { data: { name: "QA other", slug: "admin" } })).status()).toBe(400)

  const check = await (await owner.api.get(`/api/organizations/slug?slug=${slug}`)).json()
  expect(check.available).toBe(false)
  expect(check.suggestion).not.toBe(slug)

  // Renaming the second org's slug onto the first one is refused
  const clash = await owner.api.patch(`/api/organizations/${s2.id}`, { data: { slug } })
  expect(clash.status()).toBe(409)

  const mine = await (await owner.api.get("/api/organizations")).json()
  expect(mine.map((x: any) => x.organization.id)).toEqual(expect.arrayContaining([orgId, s2.id]))
})

test("ORG-03 the public page is 404 until an admin approves, and again when suspended", async () => {
  const guest = await anon()
  expect((await guest.get(`/o/${slug}`)).status()).toBe(404)

  expect((await owner.api.patch(`/api/admin/organizations/${orgId}`, { data: { isApproved: true } })).status()).toBe(403)
  const list = await (await admin.get("/api/admin/organizations?status=pending")).json()
  expect(list.some((o: any) => o.id === orgId)).toBe(true)

  const ok = await admin.patch(`/api/admin/organizations/${orgId}`, { data: { isApproved: true } })
  expect(ok.status()).toBe(200)
  expect(await db().notification.count({ where: { userId: owner.id, link: `/org/${orgId}`, title: { contains: "approved" } } })).toBe(1)
  expect(await db().activityLog.count({ where: { action: "organization.approved", entityId: orgId } })).toBe(1)

  const page = await guest.get(`/o/${slug}`)
  expect(page.status()).toBe(200)
  expect(await page.text()).toContain(NAME)

  await admin.patch(`/api/admin/organizations/${orgId}`, { data: { isActive: false } })
  expect(await db().activityLog.count({ where: { action: "organization.suspended", entityId: orgId } })).toBe(1)
  expect((await guest.get(`/o/${slug}`)).status()).toBe(404)
  // Suspended: management is read-only for members
  const blocked = await owner.api.patch(`/api/organizations/${orgId}`, { data: { description: "x" } })
  expect(blocked.status()).toBe(403)
  expect((await blocked.json()).code).toBe("organization_suspended")

  await admin.patch(`/api/admin/organizations/${orgId}`, { data: { isActive: true } })
  expect((await guest.get(`/o/${slug}`)).status()).toBe(200)
})

test("ORG-04 non-members are refused", async () => {
  outsider = await account("STUDENT")
  for (const api of [sara, outsider.api]) {
    expect((await api.get(`/api/organizations/${orgId}`)).status()).toBe(403)
    expect((await api.get(`/api/organizations/${orgId}/members`)).status()).toBe(403)
    expect((await api.post(`/api/organizations/${orgId}/invites`, { data: { email: "x@qa.test", role: "STUDENT" } })).status()).toBe(403)
    expect((await api.get(`/api/organizations/${orgId}/classes`)).status()).toBe(403)
    expect((await api.patch(`/api/organizations/${orgId}`, { data: { name: "hijack" } })).status()).toBe(403)
  }
  expect((await (await anon()).get(`/api/organizations/${orgId}`)).status()).toBe(401)
  // Dashboard page: non-members get a 404
  expect((await sara.get(`/org/${orgId}`)).status()).toBe(404)
})

test("ORG-05 invites: email-bound, role-checked, expiring and single-use", async () => {
  teacher = await account("INSTRUCTOR")
  student = await account("STUDENT")
  student2 = await account("STUDENT")

  // Bad input
  expect((await owner.api.post(`/api/organizations/${orgId}/invites`, { data: { email: "nope", role: "STUDENT" } })).status()).toBe(400)
  expect((await owner.api.post(`/api/organizations/${orgId}/invites`, { data: { email: student.email, role: "OWNER" } })).status()).toBe(400)

  const teacherToken = await invite(teacher.email, "TEACHER")
  const invInfo = await (await anon()).get(`/api/organizations/invites/${teacherToken}`)
  expect(invInfo.status()).toBe(200)
  expect((await invInfo.json()).state).toBe("pending")

  // Someone else signed in cannot accept it
  const wrong = await student.api.post(`/api/organizations/invites/${teacherToken}`)
  expect(wrong.status()).toBe(403)
  expect((await wrong.json()).code).toBe("email_mismatch")
  expect((await (await anon()).post(`/api/organizations/invites/${teacherToken}`)).status()).toBe(401)

  const acc = await teacher.api.post(`/api/organizations/invites/${teacherToken}`)
  expect(acc.status(), await acc.text()).toBe(200)
  expect((await db().organizationMember.findFirstOrThrow({ where: { organizationId: orgId, userId: teacher.id } })).role).toBe("TEACHER")
  // Single use
  const again = await teacher.api.post(`/api/organizations/invites/${teacherToken}`)
  expect(again.status()).toBe(410)
  expect((await again.json()).code).toBe("invite_used")

  // A TEACHER invite needs a teacher account
  const misToken = await invite(student2.email, "TEACHER")
  const mis = await student2.api.post(`/api/organizations/invites/${misToken}`)
  expect(mis.status()).toBe(403)
  expect((await mis.json()).code).toBe("account_role_mismatch")

  // Expired invite
  const expToken = await invite(student.email, "STUDENT")
  await db().organizationInvite.update({ where: { token: expToken }, data: { expiresAt: new Date(Date.now() - 1000) } })
  const exp = await student.api.post(`/api/organizations/invites/${expToken}`)
  expect(exp.status()).toBe(410)
  expect((await exp.json()).code).toBe("invite_expired")

  // Fresh student invites (re-inviting replaces the earlier pending one); email match is case-insensitive
  const stuToken = await invite(student.email.toUpperCase(), "STUDENT")
  expect(await db().organizationInvite.count({ where: { token: expToken } })).toBe(0)
  expect((await student.api.post(`/api/organizations/invites/${stuToken}`)).status()).toBe(200)
  const s2Token = await invite(student2.email, "STUDENT")
  expect((await student2.api.post(`/api/organizations/invites/${s2Token}`)).status()).toBe(200)

  // Inviting someone who is already a member
  const dup = await owner.api.post(`/api/organizations/${orgId}/invites`, { data: { email: student.email, role: "STUDENT" } })
  expect(dup.status()).toBe(409)

  // Revoke
  const revokeToken = await invite("qa-revoke@qa.test", "STUDENT")
  const row = await db().organizationInvite.findUniqueOrThrow({ where: { token: revokeToken } })
  expect((await owner.api.delete(`/api/organizations/${orgId}/invites/${row.id}`)).status()).toBe(200)
  expect((await (await anon()).get(`/api/organizations/invites/${revokeToken}`)).status()).toBe(404)
  expect(await db().activityLog.count({ where: { action: "organization.invite_accepted", entityId: orgId } })).toBe(3)
})

test("ORG-06 TEACHER and STUDENT members cannot manage the organization", async () => {
  for (const api of [teacher.api, student.api]) {
    expect((await api.get(`/api/organizations/${orgId}`)).status()).toBe(200)
    expect((await api.patch(`/api/organizations/${orgId}`, { data: { name: "QA hijack" } })).status()).toBe(403)
    expect((await api.get(`/api/organizations/${orgId}/members`)).status()).toBe(403)
    expect((await api.post(`/api/organizations/${orgId}/invites`, { data: { email: "x@qa.test", role: "STUDENT" } })).status()).toBe(403)
    expect((await api.post(`/api/organizations/${orgId}/classes`, { data: { name: "QA x", instructorId: teacher.id } })).status()).toBe(403)
  }
  expect((await student.api.get(`/api/organizations/${orgId}/classes`)).status()).toBe(403)
  const ownerMember = await db().organizationMember.findFirstOrThrow({ where: { organizationId: orgId, role: "OWNER" } })
  expect((await teacher.api.delete(`/api/organizations/${orgId}/members/${ownerMember.id}`)).status()).toBe(403)
})

test("ORG-07 member roles: owner is locked, only the owner manages managers", async () => {
  manager = await account("INSTRUCTOR")
  const token = await invite(manager.email, "MANAGER")
  expect((await manager.api.post(`/api/organizations/invites/${token}`)).status()).toBe(200)

  const members = await (await manager.api.get(`/api/organizations/${orgId}/members`)).json()
  const ownerRow = members.find((m: any) => m.role === "OWNER")
  const teacherRow = members.find((m: any) => m.user.id === teacher.id)
  const studentRow = members.find((m: any) => m.user.id === student.id)

  // Managers cannot touch the owner, invite managers or promote to manager
  expect((await manager.api.patch(`/api/organizations/${orgId}/members/${ownerRow.id}`, { data: { role: "TEACHER" } })).status()).toBe(403)
  expect((await manager.api.delete(`/api/organizations/${orgId}/members/${ownerRow.id}`)).status()).toBe(403)
  expect((await manager.api.post(`/api/organizations/${orgId}/invites`, { data: { email: "m2@qa.test", role: "MANAGER" } })).status()).toBe(403)
  expect((await manager.api.patch(`/api/organizations/${orgId}/members/${teacherRow.id}`, { data: { role: "MANAGER" } })).status()).toBe(403)
  // The owner cannot be removed even by the owner
  const self = await owner.api.delete(`/api/organizations/${orgId}/members/${ownerRow.id}`)
  expect(self.status()).toBe(403)
  expect((await self.json()).code).toBe("owner_locked")
  // Role must fit the account; OWNER cannot be assigned
  const mis = await owner.api.patch(`/api/organizations/${orgId}/members/${studentRow.id}`, { data: { role: "TEACHER" } })
  expect(mis.status()).toBe(400)
  expect((await mis.json()).code).toBe("role_mismatch")
  expect((await owner.api.patch(`/api/organizations/${orgId}/members/${teacherRow.id}`, { data: { role: "OWNER" } })).status()).toBe(400)

  // Owner promotes and demotes; it is logged
  expect((await owner.api.patch(`/api/organizations/${orgId}/members/${teacherRow.id}`, { data: { role: "MANAGER" } })).status()).toBe(200)
  expect((await owner.api.patch(`/api/organizations/${orgId}/members/${teacherRow.id}`, { data: { role: "TEACHER" } })).status()).toBe(200)
  expect(await db().activityLog.count({ where: { action: "organization.member_role_changed", entityId: orgId } })).toBe(2)

  // Direct add: students only, existing accounts only
  expect((await manager.api.post(`/api/organizations/${orgId}/members`, { data: { email: outsider.email, role: "TEACHER" } })).status()).toBe(400)
  expect((await manager.api.post(`/api/organizations/${orgId}/members`, { data: { email: "ghost-404@qa.test" } })).status()).toBe(404)
  expect((await manager.api.post(`/api/organizations/${orgId}/members`, { data: { email: outsider.email } })).status()).toBe(201)
  expect((await manager.api.post(`/api/organizations/${orgId}/members`, { data: { email: outsider.email } })).status()).toBe(409)
})

test("ORG-08 classes need an org teacher and respect capacity", async () => {
  const base = { name: "QA Class A", mode: "OFFLINE", location: "Hall 1", monthlyFee: 250, capacity: 1 }
  // sara is an approved instructor but not a member
  const notMember = await owner.api.post(`/api/organizations/${orgId}/classes`, {
    data: { ...base, instructorId: (await db().user.findUniqueOrThrow({ where: { email: "sara@elearning.com" } })).id },
  })
  expect(notMember.status()).toBe(400)
  expect((await notMember.json()).code).toBe("invalid_teacher")
  // A student member cannot teach
  expect((await owner.api.post(`/api/organizations/${orgId}/classes`, { data: { ...base, instructorId: student.id } })).status()).toBe(400)
  expect((await owner.api.post(`/api/organizations/${orgId}/classes`, { data: { ...base } })).status()).toBe(400)
  expect((await owner.api.post(`/api/organizations/${orgId}/classes`, { data: { ...base, instructorId: teacher.id, mode: "SPACE" } })).status()).toBe(400)
  expect((await owner.api.post(`/api/organizations/${orgId}/classes`, { data: { ...base, instructorId: teacher.id, capacity: 0 } })).status()).toBe(400)

  const res = await manager.api.post(`/api/organizations/${orgId}/classes`, { data: { ...base, instructorId: teacher.id } })
  expect(res.status(), await res.text()).toBe(201)
  const group = await res.json()
  classId = group.id
  expect(group.organizationId).toBe(orgId)
  expect(group.instructorId).toBe(teacher.id)

  // The teacher sees it; the class teacher may add students (capacity 1)
  const mine = await (await teacher.api.get(`/api/organizations/${orgId}/classes`)).json()
  expect(mine.map((c: any) => c.id)).toContain(classId)
  expect((await teacher.api.post(`/api/organizations/${orgId}/classes/${classId}/students`, { data: { userId: student.id } })).status()).toBe(201)
  const full = await owner.api.post(`/api/organizations/${orgId}/classes/${classId}/students`, { data: { userId: student2.id } })
  expect(full.status()).toBe(409)
  expect((await full.json()).code).toBe("class_full")
  // Non-student members and outsiders cannot be added
  const nonStudent = await owner.api.post(`/api/organizations/${orgId}/classes/${classId}/students`, { data: { userId: teacher.id } })
  expect((await nonStudent.json()).code).toBe("not_org_student")
  const outsiderStudent = await account("STUDENT")
  expect((await owner.api.post(`/api/organizations/${orgId}/classes/${classId}/students`, { data: { userId: outsiderStudent.id } })).status()).toBe(400)

  // Capacity can't drop below the current count; raising it lets the next one in
  expect((await owner.api.patch(`/api/organizations/${orgId}/classes/${classId}`, { data: { capacity: 2 } })).status()).toBe(200)
  expect((await owner.api.post(`/api/organizations/${orgId}/classes/${classId}/students`, { data: { userId: student2.id } })).status()).toBe(201)
  const below = await owner.api.patch(`/api/organizations/${orgId}/classes/${classId}`, { data: { capacity: 1 } })
  expect((await below.json()).code).toBe("capacity_below_members")

  // Students cannot manage class rosters
  expect((await student.api.delete(`/api/organizations/${orgId}/classes/${classId}/students/${student2.id}`)).status()).toBe(403)
  // A teacher assigned to classes can't be removed or demoted until reassigned
  const tRow = await db().organizationMember.findFirstOrThrow({ where: { organizationId: orgId, userId: teacher.id } })
  expect((await owner.api.delete(`/api/organizations/${orgId}/members/${tRow.id}`)).status()).toBe(409)

  // A schedule slot shows up on the public page
  await db().groupScheduleSlot.create({ data: { groupId: classId, dayOfWeek: 6, startTime: "17:00" } })
})

test("ORG-09 a course can only be attached by its own teacher", async () => {
  const mk = (instructorId: string, title: string) =>
    db().course.create({
      data: {
        titleEn: title,
        titleAr: title,
        slug: `qa-org-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        instructorId,
        categoryId: fixtures().categoryId,
        status: "PUBLISHED",
        price: 100,
        currency: "EGP",
      },
    })
  const ownerCourse = await mk(owner.id, "QA Org Owner Course")
  const teacherCourse = await mk(teacher.id, "QA Org Teacher Course")
  createdCourseIds.push(ownerCourse.id, teacherCourse.id)

  // Not your course -> refused, even for the owner / manager
  const notMine = await owner.api.post(`/api/organizations/${orgId}/courses`, { data: { courseId: teacherCourse.id } })
  expect(notMine.status()).toBe(403)
  expect((await notMine.json()).code).toBe("not_course_owner")
  expect((await teacher.api.post(`/api/organizations/${orgId}/courses`, { data: { courseId: ownerCourse.id } })).status()).toBe(403)
  // Students can't attach anything; non-members can't either
  expect((await student.api.post(`/api/organizations/${orgId}/courses`, { data: { courseId: ownerCourse.id } })).status()).toBe(403)

  expect((await teacher.api.post(`/api/organizations/${orgId}/courses`, { data: { courseId: teacherCourse.id } })).status()).toBe(201)
  expect((await owner.api.post(`/api/organizations/${orgId}/courses`, { data: { courseId: ownerCourse.id } })).status()).toBe(201)
  const list = await (await teacher.api.get(`/api/organizations/${orgId}/courses`)).json()
  expect(list.courses.map((c: any) => c.id)).toEqual(expect.arrayContaining([ownerCourse.id, teacherCourse.id]))

  // Already in this org: can't attach to the second org
  const otherOrg = createdOrgIds[1]
  const moved = await owner.api.post(`/api/organizations/${otherOrg}/courses`, { data: { courseId: ownerCourse.id } })
  expect(moved.status()).toBe(409)

  // Teacher can't detach someone else's course; owner (manager) can detach any
  expect((await teacher.api.delete(`/api/organizations/${orgId}/courses/${ownerCourse.id}`)).status()).toBe(403)
  expect((await owner.api.delete(`/api/organizations/${orgId}/courses/${teacherCourse.id}`)).status()).toBe(200)
  expect((await teacher.api.post(`/api/organizations/${orgId}/courses`, { data: { courseId: teacherCourse.id } })).status()).toBe(201)
})

test("ORG-10 public page shows branding, classes, courses and teachers; students can ask to join", async () => {
  const html = await (await (await anon()).get(`/o/${slug}`)).text()
  expect(html).toContain(NAME)
  expect(html).toContain("--org-primary:#0ea5e9")
  expect(html).toContain("QA Class A")
  expect(html).toContain("QA Org Owner Course")
  expect(html).toContain("17:00")
  expect(html).toContain("wa.me/201001234567")
  expect(html).toContain('property="og:image" content="https://example.com/logo.png"')
  expect((await (await anon()).get("/o/qa-no-such-org-zz")).status()).toBe(404)

  // Join request -> notification to managers, rate-limited
  const joiner = await account("STUDENT")
  expect((await (await anon()).post(`/api/organizations/${orgId}/join-requests`, { data: {} })).status()).toBe(401)
  expect((await teacher.api.post(`/api/organizations/${orgId}/join-requests`, { data: {} })).status()).toBe(403)
  expect((await student.api.post(`/api/organizations/${orgId}/join-requests`, { data: {} })).status()).toBe(409)
  const req = await joiner.api.post(`/api/organizations/${orgId}/join-requests`, { data: { message: "QA please" } })
  expect(req.status(), await req.text()).toBe(201)
  const notes = await db().notification.findMany({ where: { userId: { in: [owner.id, manager.id] }, title: { startsWith: "Join request" } } })
  expect(notes.length).toBe(2)
  expect(notes[0].link).toContain(`/org/${orgId}/members?add=`)
  expect((await joiner.api.post(`/api/organizations/${orgId}/join-requests`, { data: {} })).status()).toBe(429)
  // Unapproved orgs take no join requests
  expect((await joiner.api.post(`/api/organizations/${createdOrgIds[1]}/join-requests`, { data: {} })).status()).toBe(404)
})

test("ORG-11 pages load for each role", async ({ page }) => {
  for (const path of ["/org", `/org/${orgId}`, `/org/${orgId}/members`, `/org/${orgId}/invites`, `/org/${orgId}/classes`, `/org/${orgId}/courses`, `/org/${orgId}/settings`, "/org/new"]) {
    const res = await owner.api.get(path)
    expect(res.status(), path).toBe(200)
  }
  expect((await teacher.api.get(`/org/${orgId}/classes`)).status()).toBe(200)
  expect((await teacher.api.get(`/org/${orgId}/members`)).status()).toBe(404)
  expect((await student.api.get(`/org/${orgId}`)).status()).toBe(200)
  expect((await student.api.get(`/org/${orgId}/settings`)).status()).toBe(404)
  const stuPage = await student.api.get("/student/organizations")
  expect(stuPage.status()).toBe(200)
  expect(await stuPage.text()).toContain("QA Class A")
  expect((await admin.get("/admin/organizations?status=all")).status()).toBe(200)
  const token = await invite("qa-page@qa.test", "STUDENT")
  expect((await student.api.get(`/org/invite/${token}`)).status()).toBe(200)

  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto(`/o/${slug}`)
  await expect(page.getByRole("heading", { level: 1 })).toContainText(NAME)
  expect(errors).toEqual([])
})
