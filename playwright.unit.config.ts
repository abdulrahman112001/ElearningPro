import { defineConfig } from "@playwright/test"

// Pure-logic unit tests. No browser, no dev server, no database.
export default defineConfig({
  testDir: "./tests/unit",
  fullyParallel: true,
  reporter: [["list"]],
})
