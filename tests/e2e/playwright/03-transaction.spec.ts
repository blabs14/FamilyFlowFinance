// tests/e2e/playwright/03-transaction.spec.ts
import { test, expect } from './fixtures';

const TS = Date.now();
const TX_DESC = `E2E Transação ${TS}`;
const TX_DESC_FILTER = `${TX_DESC}-filter`;
const ACCOUNT_NAME = `E2E TX Account ${TS}`;

async function ensureFundingAccount(page: import('@playwright/test').Page) {
  await page.goto('/personal/accounts');
  const accountItem = page.locator('[data-testid="account-item"]').filter({ hasText: ACCOUNT_NAME });
  if (!(await accountItem.isVisible({ timeout: 3_000 }).catch(() => false))) {
    await page.getByTestId('create-account-btn').click();
    await page.getByTestId('account-name-input').fill(ACCOUNT_NAME);
    await page.getByTestId('account-type-select').click();
    await page.getByRole('option', { name: /corrente/i }).click();
    await page.getByTestId('account-submit-btn').click();
    await expect(
      page.locator('[data-testid="account-item"]').filter({ hasText: ACCOUNT_NAME })
    ).toBeVisible();
  }
}

async function createExpenseTransaction(
  page: import('@playwright/test').Page,
  description: string
) {
  await page.goto('/personal/transactions');
  await page.getByTestId('create-transaction-btn').click();
  await page.getByTestId('transaction-description-input').fill(description);
  await page.getByTestId('transaction-amount-input').clear();
  await page.getByTestId('transaction-amount-input').fill('42.50');
  await page.getByTestId('transaction-account-select').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).click();

  const catSelect = page.getByTestId('transaction-category-select');
  if (await catSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await catSelect.click();
    await page.getByRole('option').first().click();
  } else {
    await page.getByTestId('create-category-inline-btn').click();
    await page.getByTestId('new-category-name-input').fill(`Categoria ${description}`);
    await page.getByTestId('create-category-confirm-btn').click();
  }

  await page.getByTestId('transaction-submit-btn').click();
}

test.describe('Transactions', () => {
  test.beforeEach(async ({ loggedInPage }) => {
    await ensureFundingAccount(loggedInPage);
  });

  test('cria transação de despesa e mostra na lista', async ({ loggedInPage }) => {
    const page = loggedInPage;
    await createExpenseTransaction(page, TX_DESC);
    await expect(
      page.locator('[data-testid="transaction-item"]').filter({ hasText: TX_DESC })
    ).toBeVisible();
  });

  test('filtra transações por tipo', async ({ loggedInPage }) => {
    const page = loggedInPage;
    await createExpenseTransaction(page, TX_DESC_FILTER);
    await page.getByTestId('transaction-type-filter').click();
    await page.getByRole('option', { name: /despesas/i }).click();
    await expect(
      page.locator('[data-testid="transaction-item"]').filter({ hasText: TX_DESC_FILTER })
    ).toBeVisible();
    const items = page.locator('[data-testid="transaction-item"]');
    const count = await items.count();
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i)).not.toContainText('+');
    }
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/e2e/playwright/.auth/user.json',
    });
    const page = await context.newPage();
    await page.goto('/personal/transactions');
    for (const desc of [TX_DESC, TX_DESC_FILTER]) {
      const item = page.locator('[data-testid="transaction-item"]').filter({ hasText: desc });
      if (await item.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await item.getByRole('button', { name: /eliminar transação/i }).click();
        await page.getByTestId('confirm-dialog-confirm').click();
      }
    }
    await page.goto('/personal/accounts');
    const accItem = page.locator('[data-testid="account-item"]').filter({ hasText: ACCOUNT_NAME });
    if (await accItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await accItem.getByTestId('delete-account-btn').click();
      await page.getByTestId('confirm-dialog-confirm').click();
    }
    await context.close();
  });
});
