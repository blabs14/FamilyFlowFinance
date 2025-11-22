import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e/playwright',
  use: {
    baseURL: 'http://localhost:8081',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  timeout: 60_000,
  retries: 1,
  reporter: [['list']],
});