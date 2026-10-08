import { test, expect, Page, BrowserContext } from "@playwright/test"
import { apiAs, Account } from "./support"

/**
 * Smoke test for the pages added with the scenario features: each must load
 * for its role without a server error, an uncaught JS error, an untranslated
 * message key, or horizontal scrolling on a phone.
 */
const PAGES: Record<Account, string[]> = {
  student: ["/student", "/student/subscriptions", "/student/profile", "/student/courses", "/courses"],
  ahmed: [
    "/instructor",
    "/instructor/groups",
    "/instructor/results",
    "/instructor/questions",
    "/instructor/subscribers",
    "/instructor/students",
    "/instructor/courses",
  ],
  admin: ["/admin", "/admin/activity", "/admin/conversations", "/admin/grade-levels"],
  sara: [],
}

const KEY_RE =
  /\b(?:studentDashboard|subscriptions|lessonQA|teacherDashboard|groups|results|alerts|qaInbox|teacherSubscription|courseAudience|adminActivity|adminConversations|adminGrades|adminDashboard|shared|nav)\.[a-zA-Z]+(?:\.[a-zA-Z]+)*\b/g

async function signIn(context: BrowserContext, who: Account) {
  await context.addCookies((await (await apiAs(who)).storageState()).cookies)
}

async function check(page: Page, path: string) {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  const res = await page.goto(path, { waitUntil: "load" })
  await page.waitForTimeout(800)
  expect(res?.status(), `${path} status`).toBeLessThan(400)
  expect(new URL(page.url()).pathname, `${path} redirected away`).toBe(path)
  expect(errors, `${path} JS errors`).toEqual([])
  const text = await page.locator("body").innerText()
  expect(Array.from(new Set(text.match(KEY_RE) ?? [])), `${path} raw translation keys`).toEqual([])
}

for (const who of ["student", "ahmed", "admin"] as const) {
  test.describe(`${who} pages`, () => {
    for (const path of PAGES[who]) {
      test(`NP desktop ${who} ${path}`, async ({ page, context }) => {
        await signIn(context, who)
        await check(page, path)
      })
    }
  })

  test.describe(`${who} pages on a phone`, () => {
    test.use({ viewport: { width: 390, height: 844 } })
    for (const path of PAGES[who]) {
      test(`NP mobile ${who} ${path}`, async ({ page, context }) => {
        await signIn(context, who)
        await check(page, path)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        expect(overflow, `${path} scrolls horizontally on a phone`).toBeLessThanOrEqual(1)
      })
    }
  })

  test(`NP english ${who} pages render in English`, async ({ page, context }) => {
    await signIn(context, who)
    await context.addCookies([{ name: "locale", value: "en", url: "http://localhost:3010" }])
    for (const path of PAGES[who]) {
      await check(page, path)
      await expect(page.locator("html")).toHaveAttribute("dir", "ltr")
    }
  })
}
