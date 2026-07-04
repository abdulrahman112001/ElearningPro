import { Page, TestInfo, expect } from "@playwright/test"

export const CREDENTIALS = {
  admin: { email: "admin@elearning.com", password: "admin123" },
  instructor: { email: "ahmed@elearning.com", password: "instructor123" },
  student: { email: "student@elearning.com", password: "student123" },
} as const

export async function loginAs(
  page: Page,
  role: keyof typeof CREDENTIALS
): Promise<void> {
  const { email, password } = CREDENTIALS[role]
  await page.goto("/login")
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15_000,
  })
}

/**
 * Visits a page and records: HTTP status, any uncaught JS exceptions
 * (pageerror), and any console.error output. Does not throw by itself —
 * callers decide what counts as a failure so a single spec can report a
 * full page inventory instead of stopping at the first problem.
 */
export async function visitAndInspect(
  page: Page,
  url: string
): Promise<{
  status: number | null
  pageErrors: string[]
  consoleErrors: string[]
  finalUrl: string
}> {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []

  const onPageError = (err: Error) => pageErrors.push(err.message)
  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === "error") consoleErrors.push(msg.text())
  }

  page.on("pageerror", onPageError)
  page.on("console", onConsole)

  let status: number | null = null
  try {
    // "networkidle" is unreliable here: pages with recurring background
    // activity (video-progress autosave polling, Socket.IO reconnect
    // attempts) never go idle and time out. "load" + a short settle delay
    // is what Playwright itself recommends for exactly this case.
    const response = await page.goto(url, {
      waitUntil: "load",
      timeout: 20_000,
    })
    status = response?.status() ?? null
    // Give client components a moment to throw/log after hydration.
    await page.waitForTimeout(1000)
  } finally {
    page.off("pageerror", onPageError)
    page.off("console", onConsole)
  }

  return { status, pageErrors, consoleErrors, finalUrl: page.url() }
}

/** Attaches a per-page result row to the test report for later aggregation. */
export function attachResult(
  testInfo: TestInfo,
  row: {
    url: string
    status: number | null
    pageErrors: string[]
    consoleErrors: string[]
  }
) {
  testInfo.annotations.push({
    type: "page-result",
    description: JSON.stringify(row),
  })
}

export function expectNoCrash(
  result: { status: number | null; pageErrors: string[] },
  url: string
) {
  expect(result.pageErrors, `Uncaught JS error on ${url}`).toEqual([])
  expect(
    result.status === null || result.status < 500,
    `HTTP ${result.status} on ${url}`
  ).toBeTruthy()
}
