import { test, expect, APIRequestContext } from "@playwright/test"
import { anon, apiAs, db, fixtures, registerUser } from "./support"

/**
 * Gamification (points, levels, streaks, badges, leaderboards) and the
 * installable app (manifest, service worker, icons, offline page).
 */
test.describe.configure({ mode: "serial" })

type Student = { email: string; api: APIRequestContext; id: string }

let a: Student
let b: Student
let outsider: Student
let courseId: string
let lessonIds: string[]
let groupId: string

const DAY = 86_400_000

async function student(): Promise<Student> {
  const s = await registerUser("STUDENT")
  const id = (await db().user.findUniqueOrThrow({ where: { email: s.email } })).id
  return { ...s, id }
}

async function user(id: string) {
  return db().user.findUniqueOrThrow({
    where: { id },
    select: { points: true, currentStreak: true, longestStreak: true, lastActiveDate: true },
  })
}

async function badgeKeys(userId: string) {
  const rows = await db().userBadge.findMany({ where: { userId }, select: { badge: { select: { key: true } } } })
  return rows.map((r) => r.badge.key)
}

function progress(api: APIRequestContext, lessonId: string, completed?: boolean) {
  return api.post("/api/progress/lesson", { data: { lessonId, watchedDuration: 30, ...(completed ? { completed: true } : {}) } })
}

test.beforeAll(async () => {
  const f = fixtures()
  const stamp = Date.now()
  const course = await db().course.create({
    data: {
      titleEn: `QA Gamification ${stamp}`,
      titleAr: `QA تحفيز ${stamp}`,
      slug: `qa-gamification-${stamp}`,
      status: "PUBLISHED",
      publishedAt: new Date(),
      price: 0,
      instructorId: f.users.ahmed,
      categoryId: f.categoryId,
      requirements: [],
      whatYouLearn: [],
      tags: [],
      subtitles: [],
      chapters: {
        create: {
          titleEn: "QA chapter",
          titleAr: "QA فصل",
          position: 1,
          isPublished: true,
          lessons: {
            create: [
              { titleEn: "QA lesson 1", titleAr: "QA درس 1", position: 1, isPublished: true },
              { titleEn: "QA lesson 2", titleAr: "QA درس 2", position: 2, isPublished: true },
            ],
          },
        },
      },
    },
    include: { chapters: { include: { lessons: { orderBy: { position: "asc" } } } } },
  })
  courseId = course.id
  lessonIds = course.chapters[0].lessons.map((l) => l.id)

  a = await student()
  b = await student()
  outsider = await student()
  // Distinct names so ordering is visible
  await db().user.update({ where: { id: a.id }, data: { name: "QA Gamer A" } })
  await db().user.update({ where: { id: b.id }, data: { name: "QA Gamer B" } })

  await db().enrollment.createMany({ data: [a, b].map((s) => ({ userId: s.id, courseId })) })
  const group = await db().classGroup.create({
    data: {
      name: `QA Gamification group ${stamp}`,
      instructorId: f.users.ahmed,
      members: { create: [{ studentId: a.id }, { studentId: b.id }] },
    },
  })
  groupId = group.id
})

test.afterAll(async () => {
  if (groupId) await db().classGroup.delete({ where: { id: groupId } }).catch(() => {})
  if (courseId) await db().course.delete({ where: { id: courseId } }).catch(() => {})
})

test("GM-01 completing a lesson pays points once (idempotent)", async () => {
  const first = await progress(a.api, lessonIds[0], true)
  expect(first.status(), await first.text()).toBe(200)
  expect((await first.json()).gamification.points).toBe(10)

  const again = await progress(a.api, lessonIds[0], true)
  expect(again.status()).toBe(200)
  expect((await again.json()).gamification.points).toBe(0)

  expect((await user(a.id)).points).toBe(10)
  const tx = await db().pointTransaction.findMany({ where: { userId: a.id, reason: "lesson_completed" } })
  expect(tx).toHaveLength(1)
  expect(tx[0].referenceId).toBe(lessonIds[0])
})

test("GM-02 first lesson badge, streak started and /me summary", async () => {
  expect(await badgeKeys(a.id)).toContain("first_lesson")
  const u = await user(a.id)
  expect(u.currentStreak).toBe(1)
  expect(u.longestStreak).toBe(1)

  const me = await (await a.api.get("/api/gamification/me")).json()
  expect(me.points).toBe(10)
  expect(me.weeklyPoints).toBe(10)
  expect(me.level).toMatchObject({ level: 1, levelStart: 0, nextLevelAt: 50, toNext: 40, progress: 20 })
  expect(me.badges).toHaveLength(11)
  expect(me.badges.find((x: any) => x.key === "first_lesson").earned).toBe(true)
  expect(me.badges.find((x: any) => x.key === "quiz_master").earned).toBe(false)
  expect(me.history[0]).toMatchObject({ points: 10, reason: "lesson_completed" })

  expect((await (await anon()).get("/api/gamification/me")).status()).toBe(401)
})

test("GM-03 finishing the course pays the course bonus and badge once", async () => {
  const res = await progress(a.api, lessonIds[1], true)
  expect(res.status()).toBe(200)
  const g = (await res.json()).gamification
  expect(g.points).toBe(110)
  expect(g.badges).toContain("first_course")
  expect((await user(a.id)).points).toBe(120)

  // Replays don't pay again
  await progress(a.api, lessonIds[1], true)
  expect((await user(a.id)).points).toBe(120)
  expect(await db().pointTransaction.count({ where: { userId: a.id, reason: "course_completed" } })).toBe(1)
  const me = await (await a.api.get("/api/gamification/me")).json()
  expect(me.level.level).toBe(2) // 120 points → level 2 (50..199)
})

test("GM-04 streak: next day +1, same day no-op, gap resets, 7 days pays a bonus", async () => {
  // Yesterday with a 3-day streak → today makes 4
  await db().user.update({ where: { id: a.id }, data: { currentStreak: 3, longestStreak: 3, lastActiveDate: new Date(Date.now() - DAY) } })
  await progress(a.api, lessonIds[0])
  expect(await user(a.id)).toMatchObject({ currentStreak: 4, longestStreak: 4 })

  // Same day again → unchanged
  await progress(a.api, lessonIds[0])
  expect(await user(a.id)).toMatchObject({ currentStreak: 4, longestStreak: 4 })

  // Three days of silence → restarts at 1, longest kept
  await db().user.update({ where: { id: a.id }, data: { currentStreak: 5, longestStreak: 5, lastActiveDate: new Date(Date.now() - 3 * DAY) } })
  await progress(a.api, lessonIds[0])
  expect(await user(a.id)).toMatchObject({ currentStreak: 1, longestStreak: 5 })

  // Day 7 → +50 bonus and the 7-day badge
  const before = (await user(a.id)).points
  await db().user.update({ where: { id: a.id }, data: { currentStreak: 6, lastActiveDate: new Date(Date.now() - DAY) } })
  const res = await progress(a.api, lessonIds[0])
  const g = (await res.json()).gamification
  expect(g.streak).toBe(7)
  expect(g.points).toBe(50)
  expect(g.badges).toContain("streak_7")
  const after = await user(a.id)
  expect(after).toMatchObject({ currentStreak: 7, longestStreak: 7, points: before + 50 })
  expect(await db().pointTransaction.count({ where: { userId: a.id, reason: "streak_bonus" } })).toBe(1)

  // Same day replay doesn't pay the bonus again
  await progress(a.api, lessonIds[0])
  expect((await user(a.id)).points).toBe(before + 50)
})

test("GM-05 group leaderboard ranks members, highlights me and never exposes emails", async () => {
  await progress(b.api, lessonIds[0], true) // B: 10 points

  const res = await a.api.get(`/api/gamification/leaderboard?scope=group&id=${groupId}&period=all`)
  expect(res.status()).toBe(200)
  const text = await res.text()
  expect(text).not.toContain(a.email)
  expect(text).not.toContain(b.email)
  expect(text).not.toContain("email")
  const body = JSON.parse(text)
  expect(body.entries.map((e: any) => e.userId)).toEqual([a.id, b.id])
  expect(body.entries[0]).toMatchObject({ rank: 1, isMe: true, name: "QA Gamer A" })
  expect(body.entries[1]).toMatchObject({ rank: 2, isMe: false, points: 10 })
  expect(body.me.userId).toBe(a.id)
  expect(body.options.groups.map((g: any) => g.id)).toContain(groupId)

  const course = await (await b.api.get(`/api/gamification/leaderboard?scope=course&id=${courseId}&period=all`)).json()
  expect(course.entries.map((e: any) => e.userId)).toEqual([a.id, b.id])
  expect(course.me).toMatchObject({ userId: b.id, rank: 2 })

  const platform = await a.api.get("/api/gamification/leaderboard?scope=platform&period=all")
  expect(platform.status()).toBe(200)
  const ptext = await platform.text()
  expect(ptext).not.toContain("@")
  const p = JSON.parse(ptext)
  const pts = p.entries.map((e: any) => e.points)
  expect(pts).toEqual([...pts].sort((x: number, y: number) => y - x))
  expect(p.me.userId).toBe(a.id)
})

test("GM-06 weekly window starts Saturday 00:00 Cairo and ignores older points", async () => {
  // B earned 1000 points ten days ago: counts all-time, not this week
  await db().pointTransaction.create({
    data: { userId: b.id, points: 1000, reason: "lesson_completed", referenceId: "qa-old", createdAt: new Date(Date.now() - 10 * DAY) },
  })
  await db().user.update({ where: { id: b.id }, data: { points: { increment: 1000 } } })

  const all = await (await a.api.get(`/api/gamification/leaderboard?scope=group&id=${groupId}&period=all`)).json()
  expect(all.entries[0].userId).toBe(b.id)

  const week = await (await a.api.get(`/api/gamification/leaderboard?scope=group&id=${groupId}&period=week`)).json()
  expect(week.entries[0].userId).toBe(a.id)
  expect(week.entries.find((e: any) => e.userId === b.id).points).toBe(10)

  const start = new Date(week.weekStart)
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(start)
  const get = (t: string) => parts.find((x) => x.type === t)?.value
  expect(get("weekday")).toBe("Saturday")
  expect(`${get("hour")}:${get("minute")}`).toBe("00:00")
  expect(Date.now() - start.getTime()).toBeLessThan(7 * DAY + 3_600_000)
  expect(Date.now()).toBeGreaterThanOrEqual(start.getTime())

  expect((await a.api.get("/api/gamification/leaderboard?scope=platform&period=month")).status()).toBe(400)
  expect((await a.api.get("/api/gamification/leaderboard?scope=galaxy")).status()).toBe(400)
  expect((await a.api.get("/api/gamification/leaderboard?scope=group")).status()).toBe(400)
})

test("GM-07 boards are only for members; teacher board only for own groups/courses", async () => {
  expect((await outsider.api.get(`/api/gamification/leaderboard?scope=group&id=${groupId}`)).status()).toBe(403)
  expect((await outsider.api.get(`/api/gamification/leaderboard?scope=course&id=${courseId}`)).status()).toBe(403)
  expect((await (await anon()).get("/api/gamification/leaderboard")).status()).toBe(401)

  const ahmed = await apiAs("ahmed")
  const g = await ahmed.get(`/api/gamification/instructor/leaderboard?groupId=${groupId}&period=all`)
  expect(g.status(), await g.text()).toBe(200)
  const gtext = await g.text()
  expect(gtext).not.toContain("@")
  const gb = JSON.parse(gtext)
  expect(gb.entries.map((e: any) => e.userId)).toEqual([b.id, a.id])
  expect(gb.summary.students).toBe(2)
  const c = await ahmed.get(`/api/gamification/instructor/leaderboard?courseId=${courseId}&period=week`)
  expect(c.status()).toBe(200)
  expect((await c.json()).entries[0].userId).toBe(a.id)
  expect((await ahmed.get("/api/gamification/instructor/leaderboard")).status()).toBe(400)
  expect((await ahmed.get(`/api/gamification/instructor/leaderboard?groupId=${groupId}&courseId=${courseId}`)).status()).toBe(400)
  expect((await ahmed.get("/api/gamification/instructor/leaderboard?groupId=nope")).status()).toBe(404)

  const sara = await apiAs("sara")
  expect((await sara.get(`/api/gamification/instructor/leaderboard?groupId=${groupId}`)).status()).toBe(403)
  expect((await sara.get(`/api/gamification/instructor/leaderboard?courseId=${courseId}`)).status()).toBe(403)
  expect((await a.api.get(`/api/gamification/instructor/leaderboard?groupId=${groupId}`)).status()).toBe(403)
})

test("GM-08 manifest, service worker, icons and offline page are served", async () => {
  const ctx = await anon()
  const m = await ctx.get("/manifest.webmanifest")
  expect(m.status()).toBe(200)
  const manifest = await m.json()
  expect(manifest).toMatchObject({ name: "E-Learn", dir: "rtl", lang: "ar", start_url: "/", display: "standalone" })
  expect(manifest.short_name).toBeTruthy()
  expect(manifest.description).toMatch(/[؀-ۿ]/)
  expect(manifest.theme_color).toMatch(/^#/)
  const sizes = manifest.icons.map((i: any) => `${i.sizes}:${i.purpose}`)
  expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "192x192:maskable", "512x512:maskable"]))

  for (const icon of manifest.icons) {
    const r = await ctx.get(icon.src)
    expect(r.status(), icon.src).toBe(200)
    expect(r.headers()["content-type"]).toContain("image/png")
  }
  const apple = await ctx.get("/apple-touch-icon.png")
  expect(apple.status()).toBe(200)

  const sw = await ctx.get("/sw.js")
  expect(sw.status()).toBe(200)
  expect(sw.headers()["content-type"]).toContain("javascript")
  const swText = await sw.text()
  expect(swText).toContain("/offline")
  expect(swText).toContain("/api/")

  const offline = await ctx.get("/offline")
  expect(offline.status()).toBe(200)
  expect(await offline.text()).toContain("<html")

  const home = await (await ctx.get("/")).text()
  expect(home).toContain('rel="manifest"')
  expect(home).toContain("apple-touch-icon")
})

test("GM-09 pages render without errors", async ({ browser }) => {
  const errors: string[] = []
  const studentCtx = await browser.newContext({ storageState: await a.api.storageState() })
  const page = await studentCtx.newPage()
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto("/student/achievements")
  await expect(page.getByTestId("badge-first_lesson")).toHaveAttribute("data-earned", "true", { timeout: 30_000 })
  await page.goto("/student/leaderboard")
  await expect(page.getByTestId("leaderboard-me").first()).toBeVisible({ timeout: 30_000 })
  await page.goto("/offline")
  await expect(page.locator("h1")).toBeVisible()
  await studentCtx.close()

  const ahmed = await apiAs("ahmed")
  const tctx = await browser.newContext({ storageState: await ahmed.storageState() })
  const tpage = await tctx.newPage()
  tpage.on("pageerror", (e) => errors.push(e.message))
  await tpage.goto("/instructor/leaderboard")
  await expect(tpage.locator("h1").first()).toBeVisible({ timeout: 30_000 })
  await tctx.close()

  expect(errors).toEqual([])
})
