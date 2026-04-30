// tests/e2e/playwright/04-goal-allocation.spec.ts
import { test, expect } from './fixtures';

const TS = Date.now();
const ACCOUNT_NAME = `E2E Goal Account ${TS}`;
const GOAL_NAME = `E2E Goal ${TS}`;

async function createFundingAccount(page: import('@playwright/test').Page) {
  await page.goto('/personal/accounts');
  const item = page.locator('[data-testid="account-item"]').filter({ hasText: ACCOUNT_NAME });
  if (!(await item.isVisible({ timeout: 3_000 }).catch(() => false))) {
    await page.getByTestId('create-account-btn').click();
    await page.getByTestId('account-name-input').fill(ACCOUNT_NAME);
    await page.getByTestId('account-type-select').click();
    await page.getByRole('option', { name: /corrente/i }).click();
    await page.getByTestId('account-balance-input').fill('300');
    await page.getByTestId('account-submit-btn').click();
    const confirmBtn = page.getByTestId('confirm-dialog-confirm');
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    await expect(
      page.locator('[data-testid="account-item"]').filter({ hasText: ACCOUNT_NAME })
    ).toBeVisible();
  }
}

test.describe('Goals', () => {
  test('cria objetivo novo', async ({ loggedInPage }) => {
    const page = loggedInPage;
    await page.goto('/personal/goals');
    await page.getByTestId('create-goal-btn').click();
    await page.getByTestId('goal-name-input').fill(GOAL_NAME);
    await page.getByTestId('goal-target-input').clear();
    await page.getByTestId('goal-target-input').fill('200');
    await page.getByTestId('goal-submit-btn').click();
    await expect(
      page.locator('[data-testid="goal-card"]').filter({ hasText: GOAL_NAME })
    ).toBeVisible();
  });

  test('aloca e desaloca fundos de um objetivo', async ({ loggedInPage }) => {
    const page = loggedInPage;
    await createFundingAccount(page);

    const flowGoalName = `${GOAL_NAME}-flow`;

    await page.goto('/personal/goals');
    await page.getByTestId('create-goal-btn').click();
    await page.getByTestId('goal-name-input').fill(flowGoalName);
    await page.getByTestId('goal-target-input').clear();
    await page.getByTestId('goal-target-input').fill('200');
    await page.getByTestId('goal-submit-btn').click();

    const goalCard = page.locator('[data-testid="goal-card"]').filter({ hasText: flowGoalName });

    await goalCard.getByTestId('allocate-goal-btn').click();
    await page.getByTestId('allocate-account-select').click();
    await page.getByRole('option', { name: ACCOUNT_NAME }).click();
    await page.getByTestId('allocate-amount-input').fill('50');
    await page.getByTestId('allocate-submit-btn').click();

    await expect(
      page.locator('[data-testid="goal-card"]').filter({ hasText: flowGoalName })
    ).toContainText('50');

    await page.locator('[data-testid="goal-card"]').filter({ hasText: flowGoalName })
      .getByTestId('deallocate-goal-btn').click();
    await page.getByTestId('deallocate-account-select').click();
    await page.getByRole('option', { name: ACCOUNT_NAME }).click();
    await page.getByTestId('deallocate-amount-input').fill('20');
    await page.getByTestId('deallocate-submit-btn').click();

    await page.goto('/personal/goals');
    await expect(
      page.locator('[data-testid="goal-card"]').filter({ hasText: flowGoalName })
    ).toContainText('30');
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'tests/e2e/playwright/.auth/user.json',
    });
    const page = await context.newPage();
    await page.goto('/personal/goals');
    for (const name of [GOAL_NAME, `${GOAL_NAME}-flow`]) {
      const card = page.locator('[data-testid="goal-card"]').filter({ hasText: name });
      if (await card.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await card.getByTestId('delete-goal-btn').click();
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
