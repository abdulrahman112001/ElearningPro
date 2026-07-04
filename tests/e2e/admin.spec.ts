import { test } from "@playwright/test"
import { loginAs, visitAndInspect, expectNoCrash } from "./helpers"

const ADMIN_PAGES: Array<[string, string]> = [
  ["Admin dashboard", "/admin"],
  ["Admin analytics", "/admin/analytics"],
  ["Admin courses", "/admin/courses"],
  ["Admin categories", "/admin/categories"],
  ["Admin coupons", "/admin/coupons"],
  ["Admin instructors", "/admin/instructors"],
  ["Admin users", "/admin/users"],
  ["Admin payments", "/admin/payments"],
  ["Admin reviews", "/admin/reviews"],
  ["Admin withdrawals", "/admin/withdrawals"],
  ["Admin notifications", "/admin/notifications"],
  ["Admin settings", "/admin/settings"],
  ["Instructor accessible to admin", "/instructor"],
]

test.describe("admin role", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin")
  })

  for (const [name, url] of ADMIN_PAGES) {
    test(`admin: ${name} (${url})`, async ({ page }) => {
      const result = await visitAndInspect(page, url)
      console.log(
        `[admin] ${url} -> status=${result.status} finalUrl=${result.finalUrl} pageErrors=${result.pageErrors.length} consoleErrors=${result.consoleErrors.length}`
      )
      if (result.pageErrors.length) console.log("  pageErrors:", result.pageErrors)
      if (result.consoleErrors.length)
        console.log("  consoleErrors:", result.consoleErrors.slice(0, 5))
      expectNoCrash(result, url)
    })
  }
})
