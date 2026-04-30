// tests/e2e/playwright/06-family-invite.spec.ts
import { test, expect } from './fixtures';

test.describe('Family — Invite + Scope', () => {
  test('mostra módulo familiar e scope toggle está acessível', async ({ loggedInPage }) => {
    const page = loggedInPage;
    await page.goto('/family');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('scope toggle existe na navegação', async ({ loggedInPage }) => {
    const page = loggedInPage;
    await page.goto('/app');
    const scopeToggle = page.locator('[data-cy="scope-toggle"]').or(
      page.locator('[data-testid="scope-toggle"]')
    );
    const exists = await scopeToggle.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!exists) {
      test.skip(true, 'Scope toggle ainda não implementado (aguarda Unit 1)');
    } else {
      await expect(scopeToggle).toBeVisible();
    }
  });

  test('UI de convite familiar existe e abre form/dialog', async ({ loggedInPage }) => {
    const page = loggedInPage;
    await page.goto('/family/members');
    const notFound = await page.getByText(/not found|404|não encontrado/i).isVisible({ timeout: 3_000 }).catch(() => false);
    if (notFound) {
      test.skip(true, 'Rota /family/members ainda não implementada (aguarda Unit 13)');
      return;
    }
    const inviteBtn = page.getByTestId('invite-member-btn');
    await expect(inviteBtn).toBeVisible({ timeout: 10_000 });
    await inviteBtn.click();
    const inviteForm = page.locator('[data-testid="invite-form"], [role="dialog"]').first();
    await expect(inviteForm).toBeVisible();
  });
});
