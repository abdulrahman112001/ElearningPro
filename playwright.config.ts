import { defineConfig, devices } from "@playwright/test"

/**
 * Page smoke suite (tests/e2e): visits every page per role and fails on
 * server errors or uncaught JS exceptions.
 *
 * Runs against a local, seeded database (same one as the QA suite); ids are
 * resolved by tests/e2e/global-setup.ts. Third-party keys are dummies so
 * nothing leaves the machine.
 */
const DB =
  process.env.QA_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:54329/elearning_test"

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DB)) {
  throw new Error(`E2E suite only runs against a local DB, got: ${DB.replace(/\/\/[^@]*@/, "//***@")}`)
}
process.env.DATABASE_URL = DB
process.env.DIRECT_URL = DB

const PORT = 3010

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 60_000,
  reporter: [["list"], ["json", { outputFile: "tests/e2e/results.json" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      DATABASE_URL: DB,
      DIRECT_URL: DB,
      NEXTAUTH_URL: `http://localhost:${PORT}`,
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
      RESEND_API_KEY: "re_dummy_qa",
      STRIPE_SECRET_KEY: "sk_test_dummy_qa",
      STRIPE_WEBHOOK_SECRET: "whsec_dummy_qa",
      PAYPAL_CLIENT_SECRET: "dummy",
      PAYMOB_API_KEY: "dummy",
      TAP_SECRET_KEY: "dummy",
      LIVEKIT_API_SECRET: "dummy_qa_secret_dummy_qa_secret",
      TRUST_PROXY: "true",
    },
  },
})
