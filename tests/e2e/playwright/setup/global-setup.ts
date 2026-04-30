// tests/e2e/playwright/setup/global-setup.ts
// Corre uma vez antes de todos os testes para guardar sessão Supabase.
import { chromium, FullConfig } from '@playwright/test';
import { performLogin, STORAGE_STATE } from '../fixtures/auth';
import path from 'path';
import fs from 'fs';

async function globalSetup(_config: FullConfig) {
  const authDir = path.dirname(STORAGE_STATE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await performLogin(page);

  await page.context().storageState({ path: STORAGE_STATE });
  await browser.close();
}

export default globalSetup;
