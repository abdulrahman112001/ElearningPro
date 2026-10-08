import { test } from "@playwright/test"
import { visitAndInspect, expectNoCrash, resolveIds } from "./helpers"

const COURSE_SLUG = "react-zero-to-hero"

const PUBLIC_PAGES: Array<[string, string]> = [
  ["Home", "/"],
  ["Login", "/login"],
  ["Register", "/register"],
  ["Forgot password", "/forgot-password"],
  ["Courses list", "/courses"],
  ["Course detail", `/courses/${COURSE_SLUG}`],
  ["Legacy course redirect", `/course/${COURSE_SLUG}`],
  ["Categories", "/categories"],
  ["Instructors list", "/instructors"],
  ["Instructor profile", `/instructors/{INSTRUCTOR_ID}`],
  ["Pricing", "/pricing"],
  ["Contact", "/contact"],
  ["Certificate verify (valid)", `/verify/{CERTIFICATE_NO}`],
  ["Certificate verify (invalid)", "/verify/does-not-exist"],
  ["Checkout without auth (should redirect)", `/checkout/${COURSE_SLUG}`],
  ["Unknown route (404)", "/this-page-does-not-exist-xyz"],
]

for (const [name, url] of PUBLIC_PAGES) {
  test(`public: ${name} (${url})`, async ({ page }) => {
    const result = await visitAndInspect(page, resolveIds(url))
    console.log(
      `[public] ${url} -> status=${result.status} finalUrl=${result.finalUrl} pageErrors=${result.pageErrors.length} consoleErrors=${result.consoleErrors.length}`
    )
    if (result.pageErrors.length) console.log("  pageErrors:", result.pageErrors)
    if (result.consoleErrors.length)
      console.log("  consoleErrors:", result.consoleErrors.slice(0, 5))
    expectNoCrash(result, url)
  })
}
