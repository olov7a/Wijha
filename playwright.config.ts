import { defineConfig, devices } from "@playwright/test";

/**
 * Safety guard: the test run refuses to start unless the app's Supabase URL
 * equals the whitelisted dev URL from .env.test.local. This prevents ever
 * running E2E tests against production by accident.
 */
const allowed = process.env.E2E_ALLOWED_SUPABASE_URL ?? "";
const actual = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

if (!allowed || !actual) {
  throw new Error(
    "E2E guard: NEXT_PUBLIC_SUPABASE_URL and E2E_ALLOWED_SUPABASE_URL must both be set in .env.test.local. " +
      "Copy .env.test.local.example to .env.test.local and point both to your DEV Supabase project.",
  );
}
if (actual !== allowed) {
  throw new Error(
    `E2E guard: NEXT_PUBLIC_SUPABASE_URL (${actual}) does not match E2E_ALLOWED_SUPABASE_URL (${allowed}). Refusing to run against a non-dev project.`,
  );
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  reporter: "html",
  outputDir: "./test-results",
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: "npm run build && npm start",
    url: "http://localhost:3000",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: actual,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    },
  },
});
