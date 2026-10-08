import { test, expect, APIRequestContext } from "@playwright/test"
import { apiAs, db, fixtures, registerUser } from "./support"

/**
 * Cross-tenant checks: Sara (instructor) owns "ui-ux-design"; Ahmed owns
 * "react-zero-to-hero". Neither may touch the other's content.
 */
let ahmed: APIRequestContext
let sara: APIRequestContext

test.beforeAll(async () => {
  ahmed = await apiAs("ahmed")
  sara = await apiAs("sara")
})

test.describe("Course content ownership", () => {
  test("OWN-01 instructor cannot PATCH another instructor's course", async () => {
    const f = fixtures()
    const before = await db().course.findUniqueOrThrow({ where: { id: f.courses.react.id } })
    const res = await sara.patch(`/api/instructor/courses/${f.courses.react.id}`, { data: { titleEn: "HACKED", price: 1 } })
    expect([403, 404]).toContain(res.status())
    const after = await db().course.findUniqueOrThrow({ where: { id: f.courses.react.id } })
    expect(after.titleEn).toBe(before.titleEn)
    expect(after.price).toBe(before.price)
  })

  test("OWN-02 instructor cannot DELETE another instructor's course", async () => {
    const f = fixtures()
    const res = await sara.delete(`/api/instructor/courses/${f.courses.react.id}`)
    expect([403, 404]).toContain(res.status())
  })

  test("OWN-03 instructor cannot add a chapter to another instructor's course", async () => {
    const f = fixtures()
    const res = await sara.post(`/api/instructor/courses/${f.courses.react.id}/chapters`, { data: { title: "intruder" } })
    expect([403, 404]).toContain(res.status())
  })

  test("OWN-04 instructor cannot publish another instructor's course", async () => {
    const f = fixtures()
    const res = await sara.post(`/api/instructor/courses/${f.courses.react.id}/publish`)
    expect([403, 404]).toContain(res.status())
  })

  test("OWN-05 instructor cannot edit a lesson in another instructor's chapter", async () => {
    const f = fixtures()
    const c = f.courses.react
    const res = await sara.patch(`/api/instructor/courses/${c.id}/chapters/${c.chapterIds[0]}/lessons/${c.lessonIds[0]}`, { data: { titleEn: "HACKED" } })
    expect([403, 404]).toContain(res.status())
  })

  test("OWN-06 reorder (PUT chapters) ignores chapter ids from another course", async () => {
    const f = fixtures()
    const target = f.courses.uiux.chapterIds[0]
    const before = await db().chapter.findUniqueOrThrow({ where: { id: target } })
    await ahmed.put(`/api/instructor/courses/${f.courses.react.id}/chapters`, { data: { chapters: [{ id: target, position: 99 }] } })
    const after = await db().chapter.findUniqueOrThrow({ where: { id: target } })
    await db().chapter.update({ where: { id: target }, data: { position: before.position } })
    expect(after.position, "Ahmed moved one of Sara's chapters").toBe(before.position)
  })

  test("OWN-07 instructor cannot overwrite another instructor's quiz via own course URL", async () => {
    const f = fixtures()
    const before = await db().quizQuestion.count({ where: { quizId: f.quizzes.sara.id } })
    const res = await ahmed.patch(`/api/instructor/courses/${f.courses.react.id}/lessons/${f.quizzes.sara.lessonId}/quiz`, {
      data: {
        title: "pwned",
        passingScore: 0,
        questions: [{ question: "pwned?", type: "TRUE_FALSE", position: 0, points: 1, options: [{ id: "t", text: "yes", isCorrect: true }] }],
      },
    })
    const after = await db().quiz.findUnique({ where: { id: f.quizzes.sara.id } })
    expect([403, 404], `status ${res.status()}, Sara's quiz title is now "${after?.title}"`).toContain(res.status())
    expect(await db().quizQuestion.count({ where: { quizId: f.quizzes.sara.id } })).toBe(before)
  })

  test("OWN-08 student cannot create a course", async () => {
    const res = await (await apiAs("student")).post("/api/instructor/courses", { data: { title: "x", description: "d", categoryId: fixtures().categoryId, level: "BEGINNER", language: "ar" } })
    expect([401, 403]).toContain(res.status())
  })
})

test.describe("Course data validation", () => {
  test("OWN-09 instructor cannot set a negative price", async () => {
    const f = fixtures()
    const before = await db().course.findUniqueOrThrow({ where: { id: f.courses.nextjs.id } })
    const res = await ahmed.patch(`/api/instructor/courses/${f.courses.nextjs.id}`, { data: { price: -50 } })
    const after = await db().course.findUniqueOrThrow({ where: { id: f.courses.nextjs.id } })
    await db().course.update({
      where: { id: before.id },
      data: { price: before.price, discountPrice: before.discountPrice, requirements: before.requirements, whatYouLearn: before.whatYouLearn },
    })
    expect(res.status()).toBe(400)
    expect(after.price).toBeGreaterThanOrEqual(0)
  })

  test("OWN-10 partial PATCH keeps fields that were not sent", async () => {
    const f = fixtures()
    const before = await db().course.findUniqueOrThrow({ where: { id: f.courses.nextjs.id } })
    await ahmed.patch(`/api/instructor/courses/${f.courses.nextjs.id}`, { data: { titleEn: before.titleEn } })
    const after = await db().course.findUniqueOrThrow({ where: { id: f.courses.nextjs.id } })
    await db().course.update({ where: { id: before.id }, data: { requirements: before.requirements, whatYouLearn: before.whatYouLearn } })
    expect(after.requirements).toEqual(before.requirements)
    expect(after.whatYouLearn).toEqual(before.whatYouLearn)
  })
})

test.describe("Instructor onboarding", () => {
  test("OWN-11 unapproved instructor cannot publish straight to the catalogue", async () => {
    const u = await registerUser("INSTRUCTOR")
    const api = u.api
    const course = await api.post("/api/instructor/courses", { data: { title: "QA self-published " + Date.now(), titleAr: "QA", description: "d", categoryId: fixtures().categoryId, level: "BEGINNER", language: "ar" } })
    expect(course.status(), await course.text()).toBe(201)
    const { id } = await course.json()
    const ch = await (await api.post(`/api/instructor/courses/${id}/chapters`, { data: { title: "c1" } })).json()
    const ls = await (await api.post(`/api/instructor/courses/${id}/chapters/${ch.id}/lessons`, { data: { title: "l1" } })).json()
    await api.patch(`/api/instructor/courses/${id}/chapters/${ch.id}/lessons/${ls.id}`, { data: { isPublished: true } })
    await api.post(`/api/instructor/courses/${id}/publish`)
    const after = await db().course.findUniqueOrThrow({ where: { id } })
    expect(after.status, "brand-new unapproved instructor published without admin review").not.toBe("PUBLISHED")
  })

  test("OWN-12 publish is refused for a course with no content", async () => {
    const u = await registerUser("INSTRUCTOR")
    const course = await (await u.api.post("/api/instructor/courses", { data: { title: "QA empty " + Date.now(), titleAr: "QA", description: "d", categoryId: fixtures().categoryId, level: "BEGINNER", language: "ar" } })).json()
    const res = await u.api.post(`/api/instructor/courses/${course.id}/publish`)
    expect(res.status()).toBe(400)
  })
})
