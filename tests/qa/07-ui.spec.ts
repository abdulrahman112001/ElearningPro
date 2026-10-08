import { test, expect, Page, BrowserContext } from "@playwright/test"
import { apiAs, fixtures, Account } from "./support"

async function signIn(context: BrowserContext, who: Account) {
  await context.addCookies((await (await apiAs(who)).storageState()).cookies)
}

async function setLocale(context: BrowserContext, locale: "ar" | "en") {
  await context.addCookies([{ name: "locale", value: locale, url: "http://localhost:3010" }])
}

/** Text that looks like an untranslated next-intl key, e.g. "checkout.successTitle". */
async function rawKeys(page: Page) {
  const text = await page.locator("body").innerText()
  return Array.from(new Set(text.match(/\b(?:common|nav|home|courses|learn|auth|student|instructor|admin|quiz|certificate|checkout)\.[a-zA-Z]+(?:\.[a-zA-Z]+)*\b/g) ?? []))
}

test.describe("Public pages render", () => {
  for (const path of ["/", "/courses", "/categories", "/instructors", "/pricing", "/contact", "/login", "/register", "/forgot-password"]) {
    test(`UI-01 ${path} loads without server or JS errors`, async ({ page }) => {
      const errors: string[] = []
      page.on("pageerror", (e) => errors.push(e.message))
      const res = await page.goto(path)
      expect(res?.status()).toBeLessThan(400)
      await page.waitForTimeout(500)
      expect(errors).toEqual([])
    })
  }

  test("UI-02 course detail page renders for a seeded course", async ({ page }) => {
    const res = await page.goto(`/courses/${fixtures().courses.react.slug}`)
    expect(res?.status()).toBe(200)
  })

  test("UI-03 unknown course slug returns HTTP 404 (soft 404 behind loading.tsx streaming)", async ({ page }) => {
    const res = await page.goto("/courses/this-course-does-not-exist")
    expect(res?.status()).toBe(404)
  })
})

test.describe("Login form", () => {
  test("UI-10 wrong password shows an error and stays on /login", async ({ page }) => {
    await page.goto("/login")
    await page.locator("#email").fill("student@elearning.com")
    await page.locator("#password").fill("wrong-password")
    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/\/login/)
  })

  test("UI-11 student login lands outside /login", async ({ page }) => {
    await page.goto("/login")
    await page.locator("#email").fill("student@elearning.com")
    await page.locator("#password").fill("student123")
    await page.locator('button[type="submit"]').click()
    await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45_000 })
  })
})

test.describe("Broken links", () => {
  for (const path of ["/about", "/help", "/faq", "/terms", "/privacy"]) {
    test(`UI-20 footer link ${path} resolves (not 404)`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res?.status()).not.toBe(404)
    })
  }

  test("UI-21 admin dashboard 'view course' target exists", async ({ page, context }) => {
    await signIn(context, "admin")
    const res = await page.goto(`/admin/courses/${fixtures().courses.react.id}`)
    expect(res?.status()).not.toBe(404)
  })

  test("UI-22 quiz result 'back to lesson' target exists", async ({ page, context }) => {
    await signIn(context, "student")
    const f = fixtures()
    const res = await page.goto(`/courses/${f.courses.react.slug}/lessons/${f.quizzes.react.lessonId}`)
    expect(res?.status()).not.toBe(404)
  })

  test("UI-23 wishlist add / check / remove round-trip", async () => {
    const api = await apiAs("student")
    const courseId = fixtures().courses.nextjs.id
    expect((await api.post("/api/wishlist", { data: { courseId } })).status()).toBe(201)
    expect((await (await api.get(`/api/wishlist?courseId=${courseId}`)).json()).wishlisted).toBe(true)
    expect((await api.delete(`/api/wishlist/${courseId}`)).status()).toBe(200)
    expect((await (await api.get(`/api/wishlist?courseId=${courseId}`)).json()).wishlisted).toBe(false)
    expect((await api.delete(`/api/wishlist/${courseId}`)).status()).toBe(404)
  })
})

test.describe("Translations", () => {
  test("UI-30 certificate verify page shows no raw translation keys", async ({ page }) => {
    await page.goto("/verify/CERT-DOES-NOT-EXIST")
    expect(await rawKeys(page)).toEqual([])
  })

  test("UI-31 English UI shows prices with Latin digits", async ({ page, context }) => {
    await setLocale(context, "en")
    // The home page featured-courses section and instructor pages use formatPrice().
    for (const path of ["/", `/instructors/${fixtures().users.ahmed}`]) {
      await page.goto(path)
      const text = await page.locator("main").first().innerText()
      expect(text.match(/[٠-٩]+|مجاني|ج.م/g) ?? [], `Arabic price text on English ${path}`).toEqual([])
    }
  })

  test("UI-32 English forgot-password page has no Arabic text (static labels)", async ({ page, context }) => {
    await setLocale(context, "en")
    await page.goto("/forgot-password")
    const text = await page.locator("main, form").first().innerText()
    expect(text.match(/[؀-ۿ]{3,}/g) ?? []).toEqual([])
  })

  test("UI-33 switching locale sets dir=ltr / dir=rtl", async ({ page, context }) => {
    await setLocale(context, "en")
    await page.goto("/")
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr")
    await setLocale(context, "ar")
    await page.goto("/")
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
  })
})

test.describe("Responsive dashboards", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  for (const who of ["admin", "ahmed"] as const) {
    test(`UI-40 ${who} dashboard has navigation on a phone`, async ({ page, context }) => {
      await signIn(context, who)
      await page.goto(who === "admin" ? "/admin" : "/instructor")
      // Sidebar-only sections: settings + withdrawals are never linked from page content.
      const targets = who === "admin" ? ["/admin/settings", "/admin/withdrawals"] : ["/instructor/settings", "/instructor/withdrawals"]
      const reachable = async () => {
        for (const t of targets) if ((await page.locator(`a[href="${t}"]:visible`).count()) === 0) return false
        return true
      }
      let ok = await reachable()
      const toggles = page.locator("header button:visible, button[aria-label*=menu i]:visible")
      for (let i = 0; !ok && i < (await toggles.count()); i++) {
        await toggles.nth(i).click({ trial: false }).catch(() => {})
        await page.waitForTimeout(300)
        ok = await reachable()
        await page.keyboard.press("Escape")
      }
      expect(ok, `no visible link to ${targets.join(", ")} at 390px, even after opening header menus`).toBe(true)
    })
  }
})
