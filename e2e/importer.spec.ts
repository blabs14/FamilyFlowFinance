// e2e/importer.spec.ts
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Importer', () => {
  test.beforeEach(async ({ page }) => {
    // Assumes test user is pre-authenticated via storage state
    await page.goto('/app/import');
  });

  test('Upload Millennium BCP CSV → bank detected → auto-categories → post → transaction in /app/transacoes', async ({ page }) => {
    const filePath = path.join(__dirname, '../supabase/functions/ingest_csv/__tests__/fixtures/millennium_bcp.csv');
    await page.setInputFiles('#file-input', filePath);
    await expect(page.getByText('CSV')).toBeVisible();

    await page.getByRole('combobox', { name: /conta destino/i }).click();
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: /processar/i }).click();
    await expect(page.getByText(/a processar/i)).toBeVisible();
    await expect(page.getByText(/ok/i)).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('auto ⚡').first()).toBeVisible();

    await page.getByRole('button', { name: /importar/i }).click();
    await page.waitForURL('/app/transacoes');
    await expect(page.getByText('LIDL LISBOA')).toBeVisible();
  });

  test('Upload OFX → staging ready → post OK', async ({ page }) => {
    const filePath = path.join(__dirname, '../supabase/functions/ingest_csv/__tests__/fixtures/sample.ofx');
    await page.setInputFiles('#file-input', filePath);
    await expect(page.getByText('OFX')).toBeVisible();

    await page.getByRole('combobox', { name: /conta destino/i }).click();
    await page.getByRole('option').first().click();

    await page.getByRole('button', { name: /processar/i }).click();
    await expect(page.getByText(/ok/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /importar/i }).click();
    await page.waitForURL('/app/transacoes');
  });

  test('File with duplicates → duplicate rows deselected + counts correct', async ({ page }) => {
    const filePath = path.join(__dirname, '../supabase/functions/ingest_csv/__tests__/fixtures/millennium_bcp.csv');
    await page.setInputFiles('#file-input', filePath);
    await page.getByRole('combobox', { name: /conta destino/i }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: /processar/i }).click();
    await expect(page.getByText(/duplicados/i)).toBeVisible({ timeout: 15000 });

    const dupRows = page.locator('tr').filter({ hasText: 'duplicado' });
    await expect(dupRows.locator('input[type=checkbox]').first()).toBeDisabled();
  });

  test('File with recurring match → recurring instance confirmed (not duplicated)', async ({ page }) => {
    const filePath = path.join(__dirname, '../supabase/functions/ingest_csv/__tests__/fixtures/millennium_bcp.csv');
    await page.setInputFiles('#file-input', filePath);
    await page.getByRole('combobox', { name: /conta destino/i }).click();
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: /processar/i }).click();
    await expect(page.getByText(/recorrente/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /importar/i }).click();
    await page.waitForURL('/app/transacoes');
    const matches = await page.getByText('LIDL LISBOA').count();
    expect(matches).toBe(1);
  });
});
