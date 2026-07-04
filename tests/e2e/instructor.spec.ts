import { test } from "@playwright/test"
import { loginAs, visitAndInspect, expectNoCrash } from "./helpers"

const COURSE_ID = "cmr5esqvu0009qw5fyo302cbb"
const LIVE_CLASS_ID = "cmr61jk5u0003da579jh6lkyu"

const INSTRUCTOR_PAGES: Array<[string, string]> = [
  ["Instructor dashboard", "/instructor"],
  ["Instructor courses", "/instructor/courses"],
  ["Instructor course create", "/instructor/courses/create"],
  ["Instructor course edit", `/instructor/courses/${COURSE_ID}/edit`],
  ["Instructor analytics", "/instructor/analytics"],
  ["Instructor earnings", "/instructor/earnings"],
  ["Instructor withdrawals", "/instructor/withdrawals"],
  ["Instructor live", "/instructor/live"],
  ["Instructor live class detail", `/live/${LIVE_CLASS_ID}`],
  ["Instructor messages", "/instructor/messages"],
  ["Instructor reviews", "/instructor/reviews"],
  ["Instructor students", "/instructor/students"],
  ["Instructor settings", "/instructor/settings"],
  ["Admin blocked for instructor", "/admin"],
]

test.describe("instructor role", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "instructor")
  })

  for (const [name, url] of INSTRUCTOR_PAGES) {
    test(`instructor: ${name} (${url})`, async ({ page }) => {
      const result = await visitAndInspect(page, url)
      console.log(
        `[instructor] ${url} -> status=${result.status} finalUrl=${result.finalUrl} pageErrors=${result.pageErrors.length} consoleErrors=${result.consoleErrors.length}`
      )
      if (result.pageErrors.length) console.log("  pageErrors:", result.pageErrors)
      if (result.consoleErrors.length)
        console.log("  consoleErrors:", result.consoleErrors.slice(0, 5))
      expectNoCrash(result, url)
    })
  }
})
