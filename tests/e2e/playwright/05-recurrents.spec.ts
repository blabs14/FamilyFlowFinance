// tests/e2e/playwright/05-recurrents.spec.ts
import { test, expect } from './fixtures';

test.describe('Recorrentes — Smoke', () => {
  test('abre página e mostra lista de recorrentes', async ({ loggedInPage }) => {
    const page = loggedInPage;
    await page.goto('/personal/recorrentes');
    await expect(page.getByText('Recorrentes')).toBeVisible();
  });

  test('abre dialog de nova regra com previsualização dos próximos lançamentos', async ({ loggedInPage }) => {
    const page = loggedInPage;
    await page.goto('/personal/recorrentes');
    await page.getByTestId('create-rule-btn').click();

    await page.getByTestId('rule-description-input').fill('Teste Netflix');
    await page.getByTestId('rule-amount-input').clear();
    await page.getByTestId('rule-amount-input').fill('999');

    await expect(page.locator('input[type="date"]').first()).toBeVisible();
    await expect(page.getByTestId('rule-preview')).toContainText('Próximos 3 lançamentos');

    await page.getByTestId('cancel-rule-btn').click();
    await expect(page.getByTestId('create-rule-btn')).toBeVisible();
  });

  test('cria regra recorrente e aparece na lista', async ({ loggedInPage }) => {
    const page = loggedInPage;
    const ruleDesc = `E2E Recorrente ${Date.now()}`;

    await page.goto('/personal/recorrentes');
    await page.getByTestId('create-rule-btn').click();

    await page.getByTestId('rule-description-input').fill(ruleDesc);
    await page.getByTestId('rule-amount-input').clear();
    await page.getByTestId('rule-amount-input').fill('1299');

    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').first().fill(today);

    await page.getByTestId('rule-submit-btn').click();

    await expect(
      page.locator('[data-testid="rule-item"]').filter({ hasText: ruleDesc })
    ).toBeVisible({ timeout: 15_000 });

    await page.locator('[data-testid="rule-item"]').filter({ hasText: ruleDesc })
      .getByTestId('delete-rule-btn').click();
    const confirmBtn = page.getByTestId('confirm-dialog-confirm');
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmBtn.click();
    }
  });
});
