import { defineConfig, devices } from "@playwright/test"

/**
 * QA regression suite (tests/qa).
 * AGENT VARIANT: no globalSetup (it deletes QA users, which would break
 * tests running in parallel) and reuses the dev server on port 3010.
 *
 * It WRITES fixture data (coupons, quizzes, withdrawals, throwaway users), so
 * it refuses to run against anything but a local database. Point it at a
 * disposable Postgres:
 *
 *   QA_DATABASE_URL=postgresql://postgres:postgres@localhost:54329/elearning_test
 *
 * The dev server is started with dummy third-party keys so no real email,
 * payment or LiveKit call can leave the machine.
 */
const QA_DB =
  process.env.QA_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:54329/elearning_test"

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(QA_DB)) {
  throw new Error(`QA suite only runs against a local DB, got: ${QA_DB.replace(/\/\/[^@]*@/, "//***@")}`)
}
process.env.DATABASE_URL = QA_DB
process.env.DIRECT_URL = QA_DB

const PORT = 3010

export default defineConfig({
  testDir: "./tests/qa",
    fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [["list"], ["json", { outputFile: "tests/qa/results.json" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      DATABASE_URL: QA_DB,
      DIRECT_URL: QA_DB,
      NEXTAUTH_URL: `http://localhost:${PORT}`,
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
      RESEND_API_KEY: "re_dummy_qa",
      STRIPE_SECRET_KEY: "sk_test_dummy_qa",
      STRIPE_WEBHOOK_SECRET: "whsec_dummy_qa",
      PAYPAL_CLIENT_SECRET: "dummy",
      PAYMOB_API_KEY: "dummy",
      TAP_SECRET_KEY: "dummy",
      LIVEKIT_API_SECRET: "dummy_qa_secret_dummy_qa_secret",
      // Simulate running behind a proxy so each test client can present its
      // own IP via X-Forwarded-For (see getClientIp in lib/rate-limit.ts).
      TRUST_PROXY: "true",
      // Emails are only logged, never sent, during tests.
      EMAIL_TRANSPORT: "log",
      WHATSAPP_TRANSPORT: "log",
    },
  },
})
