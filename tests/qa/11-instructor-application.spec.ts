import { test, expect, APIRequestContext } from "@playwright/test"
import { apiAs, db, fixtures, registerUser } from "./support"

/**
 * A new teacher fills in the application form and stays pending until an
 * admin approves it; until then the instructor dashboard and its APIs are
 * closed. The admin can reject with a reason, the teacher resubmits, and
 * every step is notified and logged.
 */
test.describe.configure({ mode: "serial" })

const VALID = {
  name: "معلم تجريبي",
  headline: "مدرس رياضيات للمرحلة الإعدادية",
  bio: "أدرّس الرياضيات منذ ثماني سنوات وأركز على الفهم وحل المسائل خطوة بخطوة مع متابعة مستمرة.",
  phone: "+20 100 555 1234",
  whatsapp: "+201005551234",
  gender: "female",
  governorate: "Giza",
  city: "الدقي",
  specialization: "رياضيات",
  subjects: ["رياضيات", "جبر", "رياضيات"],
  qualification: "education_diploma",
  university: "جامعة عين شمس",
  graduationYear: 2016,
  yearsOfExperience: 8,
  currentWorkplace: "مدرسة النصر",
  cvUrl: "https://drive.google.com/file/d/example",
  introVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  agreeTerms: true,
}

let teacher: { email: string; api: APIRequestContext }
let teacherId: string
let admin: APIRequestContext

test("IA-01 a new teacher starts with a draft application and is sent to the form", async () => {
  teacher = await registerUser("INSTRUCTOR")
  teacherId = (await db().user.findUniqueOrThrow({ where: { email: teacher.email } })).id
  admin = await apiAs("admin")

  const app = await (await teacher.api.get("/api/instructor/application")).json()
  expect(app.status).toBe("DRAFT")

  const page = await teacher.api.get("/instructor")
  expect(new URL(page.url()).pathname, "pending teachers land on the application page").toBe("/instructor-application")
  expect(page.status()).toBe(200)
})

test("IA-02 a pending teacher cannot use instructor APIs", async () => {
  const course = await teacher.api.post("/api/instructor/courses", {
    data: { title: "blocked", description: "d", categoryId: fixtures().categoryId, level: "BEGINNER", language: "ar" },
  })
  expect(course.status()).toBe(403)
  expect((await course.json()).code).toBe("instructor_not_approved")
  expect((await teacher.api.get("/api/instructor/groups")).status()).toBe(403)
  expect((await teacher.api.patch("/api/instructor/subscription", { data: { enabled: true, monthlyPrice: 50 } })).status()).toBe(403)
  expect((await teacher.api.post("/api/alerts", { data: { studentId: "x", title: "t", message: "m" } })).status()).toBe(403)
})

test("IA-03 the application is validated field by field", async () => {
  const empty = await teacher.api.put("/api/instructor/application", { data: {} })
  expect(empty.status()).toBe(400)
  const fields = (await empty.json()).fields.map((f: any) => f.field)
  for (const f of ["name", "headline", "bio", "phone", "gender", "governorate", "specialization", "qualification", "university", "yearsOfExperience", "agreeTerms"]) {
    expect(fields, `missing ${f} must be reported`).toContain(f)
  }

  const bad = await teacher.api.put("/api/instructor/application", {
    data: { ...VALID, phone: "abc", bio: "short", cvUrl: "javascript:alert(1)", qualification: "wizard", yearsOfExperience: -1 },
  })
  expect(bad.status()).toBe(400)
  const errs = Object.fromEntries((await bad.json()).fields.map((f: any) => [f.field, f.code]))
  expect(errs).toMatchObject({ phone: "invalid", bio: "too_short", cvUrl: "invalid_url", qualification: "invalid", yearsOfExperience: "invalid" })
  expect((await db().instructorProfile.findUniqueOrThrow({ where: { userId: teacherId } })).applicationStatus).toBe("DRAFT")
})

test("IA-04 submitting puts it in review, notifies admins and is logged", async () => {
  const grade = await db().gradeLevel.findFirst({ where: { isActive: true } })
  const res = await teacher.api.put("/api/instructor/application", {
    data: { ...VALID, gradeLevelIds: grade ? [grade.id, "not-a-grade"] : [] },
  })
  expect(res.status(), await res.text()).toBe(200)
  expect((await res.json()).status).toBe("PENDING")

  const profile = await db().instructorProfile.findUniqueOrThrow({ where: { userId: teacherId } })
  expect(profile).toMatchObject({ applicationStatus: "PENDING", isApproved: false, governorate: "Giza", yearsOfExperience: 8 })
  expect(profile.subjects, "duplicate subjects are removed").toEqual(["رياضيات", "جبر"])
  expect(profile.gradeLevelIds, "unknown grade ids are dropped").toEqual(grade ? [grade.id] : [])
  expect(profile.submittedAt).not.toBeNull()

  const adminUser = await db().user.findFirstOrThrow({ where: { email: "admin@elearning.com" } })
  const note = await db().notification.findFirst({
    where: { userId: adminUser.id, link: "/admin/instructors?status=pending", message: { contains: VALID.name } },
  })
  expect(note, "admins are notified of the new application").not.toBeNull()
  const log = await db().activityLog.findFirst({ where: { action: "instructor.application_submitted", actorId: teacherId } })
  expect(log).not.toBeNull()

  // Still pending: the dashboard stays closed.
  expect((await teacher.api.get("/api/instructor/groups")).status()).toBe(403)
})

test("IA-05 only an admin can read the full application", async () => {
  const res = await admin.get(`/api/admin/instructors/${teacherId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.status).toBe("PENDING")
  expect(body.application).toMatchObject({ phone: VALID.phone, university: VALID.university, cvUrl: VALID.cvUrl })
  expect((await teacher.api.get(`/api/admin/instructors/${teacherId}`)).status()).toBe(403)
})

test("IA-06 the admin rejects with a reason and the teacher sees it", async () => {
  const noReason = await admin.patch(`/api/admin/instructors/${teacherId}`, { data: { action: "reject" } })
  expect(noReason.status()).toBe(400)
  expect((await noReason.json()).code).toBe("reason_required")

  const reason = "أرجو إضافة رابط السيرة الذاتية الصحيح"
  expect((await admin.patch(`/api/admin/instructors/${teacherId}`, { data: { action: "reject", reason } })).status()).toBe(200)

  const app = await (await teacher.api.get("/api/instructor/application")).json()
  expect(app.status).toBe("REJECTED")
  expect(app.application.rejectionReason).toBe(reason)
  const note = await db().notification.findFirst({ where: { userId: teacherId, message: { contains: reason } } })
  expect(note, "the teacher is notified with the reason").not.toBeNull()
  expect(await db().activityLog.findFirst({ where: { action: "instructor.rejected", entityId: teacherId } })).not.toBeNull()
  expect((await teacher.api.get("/api/instructor/groups")).status()).toBe(403)
})

test("IA-07 the teacher fixes and resubmits", async () => {
  const res = await teacher.api.put("/api/instructor/application", { data: { ...VALID, cvUrl: "https://drive.google.com/file/d/fixed" } })
  expect(res.status()).toBe(200)
  const profile = await db().instructorProfile.findUniqueOrThrow({ where: { userId: teacherId } })
  expect(profile).toMatchObject({ applicationStatus: "PENDING", rejectionReason: null, cvUrl: "https://drive.google.com/file/d/fixed" })
})

test("IA-08 after approval the dashboard opens and the form is closed", async () => {
  expect((await admin.patch(`/api/admin/instructors/${teacherId}`, { data: { action: "approve" } })).status()).toBe(200)

  const app = await (await teacher.api.get("/api/instructor/application")).json()
  expect(app.status).toBe("APPROVED")
  const again = await teacher.api.put("/api/instructor/application", { data: VALID })
  expect(again.status()).toBe(409)

  const page = await teacher.api.get("/instructor")
  expect(new URL(page.url()).pathname, "approved teachers reach the dashboard").toBe("/instructor")
  const course = await teacher.api.post("/api/instructor/courses", {
    data: { title: `Approved ${Date.now()}`, description: "d", categoryId: fixtures().categoryId, level: "BEGINNER", language: "ar" },
  })
  expect(course.status(), await course.text()).toBe(201)
  expect(await db().activityLog.findFirst({ where: { action: "instructor.approved", entityId: teacherId } })).not.toBeNull()
})

test("IA-09 revoking approval closes the dashboard again", async () => {
  expect((await admin.patch(`/api/admin/instructors/${teacherId}`, { data: { action: "revoke", reason: "مخالفة" } })).status()).toBe(200)
  expect((await teacher.api.get("/api/instructor/groups")).status()).toBe(403)
  const page = await teacher.api.get("/instructor")
  expect(new URL(page.url()).pathname).toBe("/instructor-application")
})

test("IA-10 students and admins cannot submit an instructor application", async () => {
  const student = await apiAs("student")
  expect((await student.put("/api/instructor/application", { data: VALID })).status()).toBe(403)
  expect((await admin.put("/api/instructor/application", { data: VALID })).status()).toBe(403)
})
