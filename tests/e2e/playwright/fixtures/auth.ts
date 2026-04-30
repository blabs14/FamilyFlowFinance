// tests/e2e/playwright/fixtures/auth.ts
import { test as base, Page, BrowserContext } from '@playwright/test';
import path from 'path';

export const STORAGE_STATE = path.join(
  __dirname,
  '../.auth/user.json'
);

export const TEST_EMAIL =
  process.env.PW_TEST_EMAIL ||
  process.env.VITE_TEST_EMAIL ||
  'testetotal@exemplo.com';

export const TEST_PASSWORD =
  process.env.PW_TEST_PASSWORD ||
  process.env.VITE_TEST_PASSWORD ||
  'teste14';

/**
 * Executa o fluxo de login pela UI e aguarda redirect para fora de /login.
 * Usado no globalSetup e quando precisamos de login fresh.
 */
export async function performLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email-input').fill(TEST_EMAIL);
  await page.getByTestId('password-input').fill(TEST_PASSWORD);
  await page.getByTestId('login-btn').click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 30_000,
  });
}

type AuthFixtures = {
  loggedInPage: Page;
  loggedInContext: BrowserContext;
};

/**
 * Fixture que restaura sessão guardada.
 * Requer que o ficheiro .auth/user.json exista (gerado pelo globalSetup).
 */
export const test = base.extend<AuthFixtures>({
  loggedInContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE,
    });
    await use(context);
    await context.close();
  },
  loggedInPage: async ({ loggedInContext }, use) => {
    const page = await loggedInContext.newPage();
    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';
