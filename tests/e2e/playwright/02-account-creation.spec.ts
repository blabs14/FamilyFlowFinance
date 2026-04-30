// tests/e2e/playwright/02-account-creation.spec.ts
import { test, expect } from './fixtures';

const ACCOUNT_NAME = `E2E Conta ${Date.now()}`;
const ACCOUNT_NAME_BALANCE = `${ACCOUNT_NAME}-balance`;

test.describe('Accounts', () => {
  test.beforeEach(async ({ loggedInPage }) => {
    await loggedInPage.goto('/personal/accounts');
  });

  test('navega para contas a partir da tab de navegação', async ({ loggedInPage }) => {
    const page = loggedInPage;
    await page.goto('/personal');
    const tablist = page.locator('[role="tablist"]:visible').first();
    await tablist.getByText('Contas').click();
    await expect(page).toHaveURL(/\/personal\/accounts/);
  });

  test('cria conta nova e mostra na lista', async ({ loggedInPage }) => {
    const page = loggedInPage;
    await page.getByTestId('create-account-btn').click();
    await page.getByTestId('account-name-input').fill(ACCOUNT_NAME);
    await page.getByTestId('account-type-select').click();
    await page.getByRole('option', { name: /corrente/i }).click();
    await page.getByTestId('account-submit-btn').click();
    await expect(
      page.locator('[data-testid="account-item"]').filter({ hasText: ACCOUNT_NAME })
    ).toBeVisible();
  });

  test('mostra saldo da conta criada', async ({ loggedInPage }) => {
    const page = loggedInPage;
    await page.getByTestId('create-account-btn').click();
    await page.getByTestId('account-name-input').fill(ACCOUNT_NAME_BALANCE);
    await page.getByTestId('account-type-select').click();
    await page.getByRole('option', { name: /corrente/i }).click();
    await page.getByTestId('account-balance-input').fill('500');
    await page.getByTestId('account-submit-btn').click();
    const confirmBtn = page.getByTestId('confirm-dialog-confirm');
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    const accountItem = page.locator('[data-testid="account-item"]').filter({ hasText: ACCOUNT_NAME_BALANCE });
    await expect(accountItem).toContainText('500');
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/e2e/playwright/.auth/user.json',
    });
    const page = await context.newPage();
    await page.goto('/personal/accounts');
    for (const name of [ACCOUNT_NAME, ACCOUNT_NAME_BALANCE]) {
      const item = page.locator('[data-testid="account-item"]').filter({ hasText: name });
      if (await item.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await item.getByTestId('delete-account-btn').click();
        await page.getByTestId('confirm-dialog-confirm').click();
      }
    }
    await context.close();
  });
});
