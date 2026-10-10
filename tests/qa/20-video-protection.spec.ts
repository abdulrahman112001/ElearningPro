import { test, expect, APIRequestContext } from "@playwright/test"
import { anon,apiAs, db, fixtures, loginApi, registerUser } from "./support"

/**
 * Video protection: the learn page never embeds video URLs; the play API
 * hands them out only to viewers with access, counts views (once per 2-hour
 * window) against the lesson's limit, enforces the per-account device limit
 * (httpOnly "did" cookie) and returns the watermark text. Teachers grant
 * extra views on their own lessons; admins reset devices and tune settings.
 */
test.describe.configure({ mode: "serial" })

const RUN = Date.now().toString(36)
const VIDEO_URL = `https://cdn.qa.test/protected-${RUN}.mp4`
const FREE_VIDEO_URL = `https://www.youtube.com/watch?v=qaFree${RUN}`
const HOURS_3 = 3 * 60 * 60 * 1000

let ahmed: APIRequestContext
let sara: APIRequestContext
let admin: APIRequestContext
let enrolled: { email: string; password: string; api: APIRequestContext; id: string }
let outsider: { email: string; password: string; api: APIRequestContext; id: string }
let courseId: string
let courseSlug: string
let chapterId: string
let lessonId: string // protected, HTML5 video
let freeLessonId: string // free preview, YouTube
let savedSettings: { key: string; value: string }[] = []

const play = (ctx: APIRequestContext, id = lessonId) => ctx.post(`/api/lessons/${id}/play`)

/** Moves the student's last view out of the 2-hour window. */
async function ageView(userId: string, id = lessonId) {
  await db().lessonView.update({
    where: { lessonId_userId: { lessonId: id, userId } },
    data: { lastViewedAt: new Date(Date.now() - HOURS_3) },
  })
}

async function student() {
  const s = await registerUser("STUDENT")
  const id = (await db().user.findUniqueOrThrow({ where: { email: s.email } })).id
  return { ...s, id }
}

async function enroll(userId: string) {
  await db().enrollment.create({ data: { userId, courseId } })
}

test.beforeAll(async () => {
  savedSettings = await db().setting.findMany({
    where: { key: { in: ["security.maxDevices", "security.defaultMaxViews"] } },
    select: { key: true, value: true },
  })
  // Start from the defaults (2 devices, unlimited views).
  await db().setting.deleteMany({ where: { key: { in: ["security.maxDevices", "security.defaultMaxViews"] } } })
})

test.afterAll(async () => {
  await db().setting.deleteMany({ where: { key: { in: ["security.maxDevices", "security.defaultMaxViews"] } } })
  for (const s of savedSettings) await db().setting.create({ data: s })
  if (courseId) {
    await db().enrollment.deleteMany({ where: { courseId } })
    await db().course.delete({ where: { id: courseId } }).catch(() => {})
  }
})

test("VP-01 setup: a published course of ahmed's with a protected and a free lesson", async () => {
  ahmed = await apiAs("ahmed")
  sara = await apiAs("sara")
  admin = await apiAs("admin")
  const f = fixtures()
  courseSlug = `qa-video-protection-${RUN}`
  const course = await db().course.create({
    data: {
      titleEn: `QA Video protection ${RUN}`,
      titleAr: `QA حماية الفيديو ${RUN}`,
      slug: courseSlug,
      price: 100,
      status: "PUBLISHED",
      publishedAt: new Date(),
      instructor: { connect: { id: f.users.ahmed } },
      category: { connect: { id: f.categoryId } },
      chapters: {
        create: {
          titleEn: "QA chapter",
          titleAr: "QA فصل",
          position: 0,
          isPublished: true,
          lessons: {
            create: [
              { titleEn: "QA protected", titleAr: "QA محمي", position: 0, isPublished: true, videoUrl: VIDEO_URL, videoProvider: "CUSTOM" },
              { titleEn: "QA free", titleAr: "QA مجاني", position: 1, isPublished: true, isFree: true, videoUrl: FREE_VIDEO_URL, videoProvider: "YOUTUBE" },
            ],
          },
        },
      },
    },
    include: { chapters: { include: { lessons: { orderBy: { position: "asc" } } } } },
  })
  courseId = course.id
  chapterId = course.chapters[0].id
  lessonId = course.chapters[0].lessons[0].id
  freeLessonId = course.chapters[0].lessons[1].id
  expect(course.watermarkEnabled).toBe(true)

  enrolled = await student()
  outsider = await student()
  await enroll(enrolled.id)
})

test("VP-02 the play API hands out the URL only to viewers with access", async () => {
  const guest = await anon()
  expect((await play(guest)).status()).toBe(401)

  const refused = await play(outsider.api)
  expect(refused.status()).toBe(403)
  const body = await refused.json()
  expect(body.code).toBe("not_enrolled")
  expect(JSON.stringify(body)).not.toContain(VIDEO_URL)

  // A free lesson plays for any signed-in user.
  const free = await play(outsider.api, freeLessonId)
  expect(free.status(), await free.text()).toBe(200)
  expect((await free.json()).videoUrl).toBe(FREE_VIDEO_URL)

  expect((await play(enrolled.api, "does-not-exist")).status()).toBe(404)

  const ok = await play(enrolled.api)
  expect(ok.status(), await ok.text()).toBe(200)
  const data = await ok.json()
  expect(data).toMatchObject({ videoUrl: VIDEO_URL, videoProvider: "CUSTOM", viewsUsed: 1, viewsAllowed: null })
  expect(data.watermark.enabled).toBe(true)
  expect(data.watermark.text).toContain("QA User")
  expect(data.watermark.text, "email is masked").not.toContain(enrolled.email)
  expect(data.watermark.text).toMatch(/\*\*\*@qa\.test/)

  const setCookie = ok.headers()["set-cookie"] || ""
  expect(setCookie).toMatch(/did=[a-f0-9]{32}/)
  expect(setCookie.toLowerCase()).toContain("httponly")
  expect(await db().userDevice.count({ where: { userId: enrolled.id, revokedAt: null } })).toBe(1)
})

test("VP-03 the learn page no longer contains the raw video URL", async () => {
  const res = await enrolled.api.get(`/courses/${courseSlug}/learn/${lessonId}`)
  expect(res.status()).toBe(200)
  const html = await res.text()
  expect(html).toContain("QA protected")
  expect(html).not.toContain(VIDEO_URL)
  expect(html).not.toContain(`protected-${RUN}`)
  expect(html, "other lessons' URLs are not in the sidebar payload either").not.toContain(`qaFree${RUN}`)
})

test("VP-04 max views per lesson is validated and owner-only", async () => {
  const url = `/api/instructor/courses/${courseId}/chapters/${chapterId}/lessons/${lessonId}`
  for (const bad of [0, 101, 2.5, "abc", -1, true]) {
    const res = await ahmed.patch(url, { data: { maxViews: bad } })
    expect(res.status(), `maxViews=${JSON.stringify(bad)}`).toBe(400)
  }
  expect((await sara.patch(url, { data: { maxViews: 5 } })).status()).toBe(404)
  expect((await enrolled.api.patch(url, { data: { maxViews: 5 } })).status()).toBe(404)

  const ok = await ahmed.patch(url, { data: { maxViews: 2 } })
  expect(ok.status(), await ok.text()).toBe(200)
  expect((await ok.json()).maxViews).toBe(2)
  // Other fields untouched when not sent.
  const lesson = await db().lesson.findUniqueOrThrow({ where: { id: lessonId } })
  expect(lesson.videoUrl).toBe(VIDEO_URL)
  expect(await db().activityLog.count({ where: { action: "video.max_views_changed", entityId: lessonId } })).toBeGreaterThan(0)

  const cleared = await ahmed.patch(url, { data: { maxViews: null } })
  expect((await cleared.json()).maxViews).toBeNull()
  await ahmed.patch(url, { data: { maxViews: 2 } })
})

test("VP-05 the course watermark toggle is validated and reflected by the play API", async () => {
  const url = `/api/instructor/courses/${courseId}`
  expect((await ahmed.patch(url, { data: { watermarkEnabled: "no" } })).status()).toBe(400)
  expect((await sara.patch(url, { data: { watermarkEnabled: false } })).status()).toBe(404)

  const off = await ahmed.patch(url, { data: { watermarkEnabled: false } })
  expect(off.status(), await off.text()).toBe(200)
  expect((await play(enrolled.api)).ok()).toBe(true)
  expect((await (await play(enrolled.api)).json()).watermark.enabled).toBe(false)

  await ahmed.patch(url, { data: { watermarkEnabled: true } })
  expect((await db().course.findUniqueOrThrow({ where: { id: courseId } })).watermarkEnabled).toBe(true)
  expect(await db().activityLog.count({ where: { action: "video.watermark_changed", entityId: courseId } })).toBe(2)
})

test("VP-06 a view counts once per 2-hour window and the limit blocks playback", async () => {
  // Still the first view: re-opening within the window does not count.
  const again = await (await play(enrolled.api)).json()
  expect(again).toMatchObject({ viewsUsed: 1, viewsAllowed: 2 })

  await ageView(enrolled.id)
  const second = await play(enrolled.api)
  expect(second.status()).toBe(200)
  expect(await second.json()).toMatchObject({ viewsUsed: 2, viewsAllowed: 2 })

  // Same window: the last allowed view keeps playing.
  expect((await play(enrolled.api)).status()).toBe(200)

  await ageView(enrolled.id)
  const blocked = await play(enrolled.api)
  expect(blocked.status()).toBe(403)
  const body = await blocked.json()
  expect(body).toMatchObject({ code: "view_limit_reached", viewsUsed: 2, viewsAllowed: 2 })
  expect(body.videoUrl).toBeUndefined()
  expect(
    await db().activityLog.count({ where: { action: "video.view_limit_reached", entityId: lessonId, actorId: enrolled.id } })
  ).toBeGreaterThan(0)
  const view = await db().lessonView.findUniqueOrThrow({ where: { lessonId_userId: { lessonId, userId: enrolled.id } } })
  expect(view.count).toBe(2)
})

test("VP-07 the course owner and admins bypass every limit", async () => {
  const owner = await play(ahmed)
  expect(owner.status()).toBe(200)
  expect(await owner.json()).toMatchObject({ videoUrl: VIDEO_URL, viewsAllowed: null })
  expect((await play(admin)).status()).toBe(200)
  // Another teacher is just a non-enrolled user.
  expect((await play(sara)).status()).toBe(403)
  expect(await db().lessonView.count({ where: { lessonId, userId: fixtures().users.ahmed } })).toBe(0)
})

test("VP-08 the teacher sees blocked students and grants extra views (own lessons only)", async () => {
  const list = await ahmed.get("/api/instructor/lesson-views")
  expect(list.status()).toBe(200)
  const rows = (await list.json()).rows
  const row = rows.find((r: any) => r.student.id === enrolled.id && r.lesson.id === lessonId)
  expect(row).toMatchObject({ viewsUsed: 2, viewsAllowed: 2 })

  const saraRows = (await (await sara.get("/api/instructor/lesson-views")).json()).rows
  expect(saraRows.some((r: any) => r.lesson.id === lessonId)).toBe(false)
  expect((await enrolled.api.get("/api/instructor/lesson-views")).status()).toBe(403)

  const grant = (ctx: APIRequestContext, data: any) => ctx.post("/api/instructor/lesson-views/grant", { data })
  expect((await grant(sara, { lessonId, studentId: enrolled.id, extra: 1 })).status()).toBe(404)
  expect((await grant(enrolled.api, { lessonId, studentId: enrolled.id, extra: 1 })).status()).toBe(403)
  for (const extra of [0, 51, 1.5, "2", null]) {
    expect((await grant(ahmed, { lessonId, studentId: enrolled.id, extra })).status(), `extra=${extra}`).toBe(400)
  }
  expect((await grant(ahmed, { lessonId, studentId: "nobody", extra: 1 })).status()).toBe(404)
  expect((await grant(ahmed, { studentId: enrolled.id, extra: 1 })).status()).toBe(400)

  const ok = await grant(ahmed, { lessonId, studentId: enrolled.id, extra: 1 })
  expect(ok.status(), await ok.text()).toBe(200)
  expect(await ok.json()).toMatchObject({ extraViews: 1, viewsUsed: 2, viewsAllowed: 3 })
  expect(
    await db().notification.count({ where: { userId: enrolled.id, link: { contains: lessonId } } })
  ).toBe(1)
  expect(await db().activityLog.count({ where: { action: "video.views_granted", entityId: lessonId } })).toBe(1)

  const after = await play(enrolled.api)
  expect(after.status()).toBe(200)
  expect(await after.json()).toMatchObject({ viewsUsed: 3, viewsAllowed: 3 })

  const listAfter = (await (await ahmed.get("/api/instructor/lesson-views")).json()).rows
  expect(listAfter.find((r: any) => r.student.id === enrolled.id && r.lesson.id === lessonId)).toMatchObject({
    viewsUsed: 3,
    viewsAllowed: 3,
  })
})

test("VP-09 a third device is refused; known devices keep working", async () => {
  const s = await student()
  await enroll(s.id)
  const second = await loginApi(s.email, s.password)
  const third = await loginApi(s.email, s.password)

  expect((await play(s.api)).status()).toBe(200)
  expect((await play(second)).status()).toBe(200)
  const refused = await play(third)
  expect(refused.status()).toBe(403)
  const body = await refused.json()
  expect(body.code).toBe("device_limit")
  expect(body.devices).toHaveLength(2)
  expect(body.videoUrl).toBeUndefined()
  expect(await db().activityLog.count({ where: { action: "video.device_limit_reached", actorId: s.id } })).toBe(1)

  // Known devices are unaffected.
  expect((await play(s.api)).status()).toBe(200)
  expect((await play(second)).status()).toBe(200)
  expect(await db().userDevice.count({ where: { userId: s.id, revokedAt: null } })).toBe(2)

  // The student sees their devices (current one marked) but cannot remove them.
  const page = await s.api.get("/student/devices")
  expect(page.status()).toBe(200)
  const html = await page.text()
  expect((html.match(/data-testid="device-row"/g) || []).length).toBe(2)
  expect(html).toContain('data-current="true"')

  // ---- Admin reset ----
  expect((await s.api.get(`/api/admin/users/${s.id}/devices`)).status()).toBe(403)
  expect((await ahmed.delete(`/api/admin/users/${s.id}/devices`)).status()).toBe(403)

  const devices = await (await admin.get(`/api/admin/users/${s.id}/devices`)).json()
  expect(devices.activeCount).toBe(2)
  expect(devices.maxDevices).toBe(2)

  expect((await admin.delete(`/api/admin/users/${s.id}/devices?deviceId=nope`)).status()).toBe(404)
  const one = await admin.delete(`/api/admin/users/${s.id}/devices?deviceId=${devices.devices[0].id}`)
  expect(await one.json()).toEqual({ revoked: 1 })
  expect((await play(third)).status(), "a slot was freed").toBe(200)
  expect((await play(second)).status() + (await play(s.api)).status()).toBe(200 + 403)

  const all = await admin.delete(`/api/admin/users/${s.id}/devices`)
  expect(await all.json()).toEqual({ revoked: 2 })
  expect(await db().activityLog.count({ where: { action: "video.devices_reset", entityId: s.id } })).toBe(2)
  expect(await db().notification.count({ where: { userId: s.id, link: "/student/devices" } })).toBe(2)
  expect((await play(s.api)).status()).toBe(200)

  const found = await (await admin.get(`/api/admin/security/users?q=${encodeURIComponent(s.email)}`)).json()
  expect(found.users).toHaveLength(1)
  expect(found.users[0]).toMatchObject({ id: s.id, activeDevices: 1 })
  expect((await s.api.get(`/api/admin/security/users?q=qa`)).status()).toBe(403)
})

test("VP-10 admin security settings are validated and applied", async () => {
  expect((await enrolled.api.get("/api/admin/security")).status()).toBe(403)
  expect((await ahmed.put("/api/admin/security", { data: { maxDevices: 3 } })).status()).toBe(403)

  const current = await (await admin.get("/api/admin/security")).json()
  expect(current).toMatchObject({ maxDevices: 2, defaultMaxViews: null })

  for (const data of [
    { maxDevices: -1 },
    { maxDevices: 21 },
    { maxDevices: "2" },
    { maxDevices: 1.5 },
    { defaultMaxViews: 0 },
    { defaultMaxViews: 101 },
    { defaultMaxViews: "x" },
  ]) {
    expect((await admin.put("/api/admin/security", { data })).status(), JSON.stringify(data)).toBe(400)
  }

  try {
    const saved = await admin.put("/api/admin/security", { data: { maxDevices: 1, defaultMaxViews: 1 } })
    expect(saved.status(), await saved.text()).toBe(200)
    expect(await saved.json()).toEqual({ maxDevices: 1, defaultMaxViews: 1 })
    expect(await db().activityLog.count({ where: { action: "video.settings_updated", actorId: fixtures().users.admin, createdAt: { gte: new Date(Date.now() - 60_000) } } })).toBeGreaterThan(0)

    // The default applies to lessons without their own limit (the free lesson).
    await ageView(outsider.id, freeLessonId)
    const limited = await play(outsider.api, freeLessonId)
    expect(limited.status()).toBe(403)
    expect(await limited.json()).toMatchObject({ code: "view_limit_reached", viewsAllowed: 1 })

    // One device only now.
    const s = await student()
    await enroll(s.id)
    expect((await play(s.api)).status()).toBe(200)
    const other = await loginApi(s.email, s.password)
    expect((await (await play(other)).json()).code).toBe("device_limit")

    // Unlimited devices.
    await admin.put("/api/admin/security", { data: { maxDevices: 0 } })
    expect((await play(other)).status()).toBe(200)
  } finally {
    const reset = await admin.put("/api/admin/security", { data: { maxDevices: 2, defaultMaxViews: null } })
    expect(reset.status()).toBe(200)
  }
  expect(await (await admin.get("/api/admin/security")).json()).toMatchObject({ maxDevices: 2, defaultMaxViews: null })
})

test("VP-11 pages render without errors (player shows the watermark, no download)", async ({ browser }) => {
  const visit = async (ctx: APIRequestContext, path: string) => {
    const context = await browser.newContext({ storageState: await ctx.storageState() })
    const page = await context.newPage()
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    const res = await page.goto(path)
    expect(res?.status(), path).toBe(200)
    return { page, context, errors }
  }

  // Owner on the learn page: HTML5 player with nodownload and a watermark.
  const learn = await visit(ahmed, `/courses/${courseSlug}/learn/${lessonId}`)
  await expect(learn.page.locator("video")).toHaveAttribute("controlslist", /nodownload/, { timeout: 30_000 })
  await expect(learn.page.getByTestId("video-watermark")).toHaveCount(1)
  expect(learn.errors).toEqual([])
  await learn.context.close()

  // The blocked student sees the view-limit state instead of a player.
  await ageView(enrolled.id)
  const blocked = await visit(enrolled.api, `/courses/${courseSlug}/learn/${lessonId}`)
  await expect(blocked.page.getByTestId("playback-blocked")).toHaveAttribute("data-code", "view_limit_reached", { timeout: 30_000 })
  await expect(blocked.page.locator("video")).toHaveCount(0)
  await blocked.context.close()

  for (const [ctx, path] of [
    [ahmed, "/instructor/video-protection"],
    [admin, "/admin/security"],
    [enrolled.api, "/student/devices"],
  ] as const) {
    const v = await visit(ctx, path)
    await v.page.waitForLoadState("networkidle")
    expect(v.errors, path).toEqual([])
    await v.context.close()
  }
})
