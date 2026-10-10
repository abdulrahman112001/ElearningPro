import { defineConfig, devices } from "@playwright/test"

const QA_DB =
  process.env.QA_DATABASE_URL ??
  "******localhost:54329/elearning_test"

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(QA_DB)) {
  throw new Error("Local QA run requires a localhost QA_DATABASE_URL")
}

process.env.DATABASE_URL = QA_DB
process.env.DIRECT_URL = QA_DB

const PORT = 3011

export default defineConfig({
  testDir: "./tests/qa",
  globalSetup: "./tests/qa/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
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
      TRUST_PROXY: "true",
      EMAIL_TRANSPORT: "log",
      WHATSAPP_TRANSPORT: "log",
    },
  },
})
