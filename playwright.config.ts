// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

export default defineConfig({
  testDir: 'tests/e2e/playwright',
  globalSetup: './tests/e2e/playwright/setup/global-setup.ts',
  fullyParallel: false,           // flows partilham estado em staging → serializar
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,                     // 1 worker: flows com side-effects (criação de dados)
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:8081',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
  },
  timeout: 60_000,
  expect: { timeout: 10_000 },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.CI
    ? {
        command: 'npm run dev',
        url: 'http://localhost:8081',
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
});
