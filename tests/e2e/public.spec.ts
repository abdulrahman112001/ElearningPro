import { test } from "@playwright/test"
import { visitAndInspect, expectNoCrash } from "./helpers"

const COURSE_SLUG = "react-zero-to-hero"
const CATEGORY_ID = "cmr5esod90005qw5fnyzjwyz1"
const INSTRUCTOR_ID = "cmr5esjet0001qw5ffhjj89b4"
const CERTIFICATE_NO = "CERT-TEST-1783157638838"

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
  ["Instructor profile", `/instructors/${INSTRUCTOR_ID}`],
  ["Pricing", "/pricing"],
  ["Contact", "/contact"],
  ["Certificate verify (valid)", `/verify/${CERTIFICATE_NO}`],
  ["Certificate verify (invalid)", "/verify/does-not-exist"],
  ["Checkout without auth (should redirect)", `/checkout/${COURSE_SLUG}`],
  ["Unknown route (404)", "/this-page-does-not-exist-xyz"],
]

for (const [name, url] of PUBLIC_PAGES) {
  test(`public: ${name} (${url})`, async ({ page }) => {
    const result = await visitAndInspect(page, url)
    console.log(
      `[public] ${url} -> status=${result.status} finalUrl=${result.finalUrl} pageErrors=${result.pageErrors.length} consoleErrors=${result.consoleErrors.length}`
    )
    if (result.pageErrors.length) console.log("  pageErrors:", result.pageErrors)
    if (result.consoleErrors.length)
      console.log("  consoleErrors:", result.consoleErrors.slice(0, 5))
    expectNoCrash(result, url)
  })
}
