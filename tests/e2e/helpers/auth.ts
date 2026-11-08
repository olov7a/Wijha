import { chromium, type Page } from "@playwright/test";

/**
 * Logs in and saves the browser session per role (storageState).
 * Never prints or commits credentials; they come from process.env only.
 */
export type Role = "student" | "owner" | "admin";

export async function loginRole(page: Page, role: Role, baseURL = "http://localhost:3000") {
  const email = process.env[`E2E_${role.toUpperCase()}_EMAIL`];
  const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`];
  if (!email || !password) {
    throw new Error(`E2E_${role.toUpperCase()}_EMAIL / PASSWORD not set in .env.test.local`);
  }

  await page.goto(`${baseURL}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // After login the app redirects to /dashboard (which redirects to the role page).
  await page.waitForURL(/dashboard|student|owner|admin/, { timeout: 10_000 });
}

export async function saveStorageState(role: Role) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: "http://localhost:3000" } as never as unknown as Parameters<typeof browser.newContext>[0]);
  const page = await context.newPage();
  await loginRole(page, role);
  await context.storageState({ path: `test-results/.auth/${role}.json` });
  await browser.close();
}

// Used by global setup when the outputDir is writable.
export async function loginAndSave(page: Page, role: Role) {
  await loginRole(page, role);
  const context = page.context();
  await context.storageState({ path: `test-results/.auth/${role}.json` });
}
