import { test } from "@playwright/test"
import { loginAs, visitAndInspect, expectNoCrash, resolveIds } from "./helpers"

const COURSE_SLUG = "react-zero-to-hero"

const STUDENT_PAGES: Array<[string, string]> = [
  ["Student dashboard", "/student"],
  ["Student courses", "/student/courses"],
  ["Student certificates", "/student/certificates"],
  ["Student purchases", "/student/purchases"],
  ["Student wishlist", "/student/wishlist"],
  ["Student live", "/student/live"],
  ["Student profile", "/student/profile"],
  ["Student settings", "/student/settings"],
  ["Learn (course root)", `/courses/${COURSE_SLUG}/learn`],
  ["Learn (specific lesson)", `/courses/${COURSE_SLUG}/learn/{LESSON_ID}`],
  ["Certificate view", `/certificates/{CERTIFICATE_ID}`],
  ["Admin blocked for student", "/admin"],
  ["Instructor blocked for student", "/instructor"],
]

test.describe("student role", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "student")
  })

  for (const [name, url] of STUDENT_PAGES) {
    test(`student: ${name} (${url})`, async ({ page }) => {
      const result = await visitAndInspect(page, resolveIds(url))
      console.log(
        `[student] ${url} -> status=${result.status} finalUrl=${result.finalUrl} pageErrors=${result.pageErrors.length} consoleErrors=${result.consoleErrors.length}`
      )
      if (result.pageErrors.length) console.log("  pageErrors:", result.pageErrors)
      if (result.consoleErrors.length)
        console.log("  consoleErrors:", result.consoleErrors.slice(0, 5))
      expectNoCrash(result, url)
    })
  }
})
