import { test, expect, APIRequestContext } from "@playwright/test"
import { anon, apiAs, fixtures } from "./support"

type Call = [method: "get" | "post" | "patch" | "put" | "delete", url: string]

const ADMIN_ONLY: Call[] = [
  ["get", "/api/admin/analytics"],
  ["get", "/api/admin/users"],
  ["get", "/api/admin/categories"],
  ["post", "/api/admin/categories"],
  ["post", "/api/admin/coupons"],
  ["patch", "/api/admin/coupons/x"],
  ["patch", "/api/admin/courses/x"],
  ["patch", "/api/admin/instructors/x"],
  ["post", "/api/admin/notifications"],
  ["delete", "/api/admin/reviews/x"],
  ["get", "/api/admin/settings"],
  ["get", "/api/admin/users/x"],
  ["patch", "/api/admin/withdrawals/x"],
  ["get", "/api/admin/reconcile-counters"],
]

const INSTRUCTOR_ONLY: Call[] = [
  ["get", "/api/instructor/courses"],
  ["post", "/api/instructor/courses"],
  ["get", "/api/instructor/earnings"],
  ["patch", "/api/instructor/payment-methods"],
  ["post", "/api/instructor/withdrawals"],
  ["post", "/api/live"],
]

const ANY_USER: Call[] = [
  ["get", "/api/user/profile"],
  ["get", "/api/user/notifications"],
  ["post", "/api/user/password"],
  ["get", "/api/student/purchases"],
  ["get", "/api/student/live-classes"],
  ["post", "/api/coupons/validate"],
  ["post", "/api/payments/create"],
  ["post", "/api/progress/lesson"],
  ["post", "/api/quiz/start"],
  ["post", "/api/quiz/submit"],
  ["get", "/api/messages/students"],
  ["post", "/api/upload"],
  ["get", "/api/live"],
]

async function call(ctx: APIRequestContext, [m, url]: Call) {
  const res = await ctx[m](url, m === "get" || m === "delete" ? undefined : { data: {} })
  return res.status()
}

test.describe("Unauthenticated access", () => {
  for (const c of [...ADMIN_ONLY, ...INSTRUCTOR_ONLY, ...ANY_USER]) {
    test(`AUTHZ-01 anon ${c[0].toUpperCase()} ${c[1]} -> 401`, async () => {
      expect(await call(await anon(), c)).toBe(401)
    })
  }
})

test.describe("Student hitting admin/instructor APIs", () => {
  let student: APIRequestContext
  test.beforeAll(async () => {
    student = await apiAs("student")
  })
  for (const c of [...ADMIN_ONLY, ...INSTRUCTOR_ONLY]) {
    test(`AUTHZ-02 student ${c[0].toUpperCase()} ${c[1]} -> 403`, async () => {
      // 401 is tolerated for routes that answer "Unauthorized" to wrong roles.
      expect([401, 403]).toContain(await call(student, c))
    })
  }
})

test.describe("Instructor hitting admin APIs", () => {
  let instructor: APIRequestContext
  test.beforeAll(async () => {
    instructor = await apiAs("ahmed")
  })
  for (const c of ADMIN_ONLY) {
    test(`AUTHZ-03 instructor ${c[0].toUpperCase()} ${c[1]} -> 403`, async () => {
      expect([401, 403]).toContain(await call(instructor, c))
    })
  }
})

test.describe("Data exposure", () => {
  test("AUTHZ-04 @known-bug student cannot list instructor withdrawals (payout details)", async () => {
    const student = await apiAs("student")
    const res = await student.get("/api/instructor/withdrawals")
    const body = res.status() === 200 ? await res.json() : null
    const leaked = body?.withdrawals?.length ?? 0
    expect(res.status() === 403 || leaked === 0, `student received ${leaked} withdrawals incl. payout notes`).toBe(true)
  })

  test("AUTHZ-05 @known-bug student only sees live classes of their own courses", async () => {
    const f = fixtures()
    const sara = await apiAs("sara")
    const created = await sara.post("/api/live", {
      data: { title: "QA private class", courseId: f.courses.uiux.id, scheduledAt: new Date(Date.now() + 86_400_000).toISOString(), duration: 30 },
    })
    expect(created.status(), await created.text()).toBe(201)
    const cls = await created.json()
    const student = await apiAs("student") // not enrolled in ui-ux
    const list = await (await student.get("/api/live")).json()
    const ids = (Array.isArray(list) ? list : list.liveClasses ?? []).map((c: any) => c.id)
    expect(ids, "class of a course the student is not enrolled in is listed").not.toContain(cls.id)
  })

  test("AUTHZ-06 instructor course list only contains own courses", async () => {
    const f = fixtures()
    const res = await (await apiAs("ahmed")).get("/api/instructor/courses")
    expect(res.status()).toBe(200)
    const ids = (await res.json()).map((c: any) => c.id)
    expect(ids).toContain(f.courses.react.id)
    expect(ids).not.toContain(f.courses.uiux.id)
  })

  test("AUTHZ-07 public course list hides drafts and is paginated", async () => {
    const res = await (await anon()).get("/api/courses")
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.courses)).toBe(true)
    expect(body.courses.every((c: any) => !c.status || c.status === "PUBLISHED")).toBe(true)
  })

  test("AUTHZ-08 @known-bug bad query params on /api/courses give 400 not 500", async () => {
    const ctx = await anon()
    expect((await ctx.get("/api/courses?page=0")).status()).toBeLessThan(500)
    expect((await ctx.get("/api/courses?level=NOT_A_LEVEL")).status()).toBeLessThan(500)
  })
})

test.describe("Dashboard page guards", () => {
  for (const path of ["/admin", "/instructor", "/student"]) {
    test(`AUTHZ-09 anon visiting ${path} is sent to /login`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login/)
    })
  }

  test("AUTHZ-10 student cannot open /admin or /instructor", async ({ page, context }) => {
    const api = await apiAs("student")
    await context.addCookies((await api.storageState()).cookies)
    for (const path of ["/admin", "/instructor"]) {
      await page.goto(path)
      expect(new URL(page.url()).pathname.startsWith(path), `student stayed on ${path}`).toBe(false)
    }
  })

  test("AUTHZ-11 instructor cannot open /admin", async ({ page, context }) => {
    const api = await apiAs("ahmed")
    await context.addCookies((await api.storageState()).cookies)
    await page.goto("/admin")
    expect(new URL(page.url()).pathname.startsWith("/admin")).toBe(false)
  })
})
