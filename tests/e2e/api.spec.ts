import { test, expect } from "@playwright/test"
import { loginAs } from "./helpers"

const COURSE_ID = "cmr5esqvu0009qw5fyo302cbb"
const LESSON_ID = "cmr5esyyr000kqw5f0k4unw8e"
const CERTIFICATE_NO = "CERT-TEST-1783157638838"

test.describe("API smoke checks", () => {
  test("GET /api/courses is public and returns 200", async ({ page }) => {
    const res = await page.request.get("/api/courses")
    expect(res.status(), await res.text()).toBe(200)
  })

  test("GET /api/certificates/verify/:no is public", async ({ page }) => {
    const res = await page.request.get(
      `/api/certificates/verify/${CERTIFICATE_NO}`
    )
    expect(res.status(), await res.text()).toBe(200)
  })

  test("GET /api/certificates/verify/:no (unknown) returns 404, not 500", async ({
    page,
  }) => {
    const res = await page.request.get("/api/certificates/verify/nope")
    expect(res.status(), await res.text()).toBe(404)
  })

  test("unauthenticated GET /api/instructor/courses is 401", async ({ page }) => {
    const res = await page.request.get("/api/instructor/courses")
    expect(res.status(), await res.text()).toBe(401)
  })

  test("unauthenticated GET /api/admin/users is 401", async ({ page }) => {
    const res = await page.request.get("/api/admin/users")
    expect(res.status(), await res.text()).toBe(401)
  })

  test("student cannot read /api/admin/users (403)", async ({ page }) => {
    await loginAs(page, "student")
    const res = await page.request.get("/api/admin/users")
    expect([401, 403], `got ${res.status()}: ${await res.text()}`).toContain(
      res.status()
    )
  })

  test("student GET /api/progress/course/:id returns 200", async ({ page }) => {
    await loginAs(page, "student")
    const res = await page.request.get(`/api/progress/course/${COURSE_ID}`)
    expect(res.status(), await res.text()).toBe(200)
  })

  test("student GET /api/user/notifications returns 200", async ({ page }) => {
    await loginAs(page, "student")
    const res = await page.request.get("/api/user/notifications")
    expect(res.status(), await res.text()).toBe(200)
  })

  test("student GET /api/quizzes/:lessonId does not 500", async ({ page }) => {
    await loginAs(page, "student")
    const res = await page.request.get(`/api/quizzes/${LESSON_ID}`)
    expect(res.status(), await res.text()).toBeLessThan(500)
  })

  test("orphaned quiz attempt route is gone (404)", async ({ page }) => {
    await loginAs(page, "student")
    const res = await page.request.post(`/api/quizzes/${LESSON_ID}/attempt`, {
      data: { answers: {} },
    })
    expect(res.status()).toBe(404)
  })

  test("orphaned progress[lessonId] route is gone (404)", async ({ page }) => {
    await loginAs(page, "student")
    const res = await page.request.patch(`/api/progress/${LESSON_ID}`, {
      data: { enrollmentId: "x" },
    })
    expect(res.status()).toBe(404)
  })

  test("instructor GET /api/instructor/courses returns 200", async ({ page }) => {
    await loginAs(page, "instructor")
    const res = await page.request.get("/api/instructor/courses")
    expect(res.status(), await res.text()).toBe(200)
  })

  test("admin GET /api/admin/analytics returns 200", async ({ page }) => {
    await loginAs(page, "admin")
    const res = await page.request.get("/api/admin/analytics")
    expect(res.status(), await res.text()).toBe(200)
  })

  test("21st quiz/start call in a minute is rate-limited (429)", async ({
    page,
  }) => {
    await loginAs(page, "student")
    let lastStatus = 0
    for (let i = 0; i < 21; i++) {
      const res = await page.request.post("/api/quiz/start", {
        data: { quizId: "nonexistent-quiz-id" },
      })
      lastStatus = res.status()
    }
    expect(lastStatus).toBe(429)
  })
})
