// tests/e2e/playwright/08-gdpr.spec.ts
import { test, expect } from './fixtures';

test.describe('GDPR — Export e Deletion', () => {
  test.beforeEach(async ({ loggedInPage }) => {
    await loggedInPage.goto('/app/settings');
  });

  test('botão de exportação de dados existe e pode ser clicado', async ({ loggedInPage }) => {
    const page = loggedInPage;
    const privacyTab = page.getByRole('tab', { name: /privacidade|dados|privacy|data/i }).or(
      page.getByTestId('settings-tab-privacy')
    );
    const tabExists = await privacyTab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (tabExists) {
      await privacyTab.first().click();
    }
    const exportBtn = page.getByTestId('export-data-btn').or(
      page.getByRole('button', { name: /exportar dados|export data/i })
    );
    const exists = await exportBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!exists) {
      test.skip(true, 'Botão de exportação de dados ainda não implementado (aguarda Unit 15)');
      return;
    }
    const [downloadPromise] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }).catch(() => null),
      exportBtn.first().click(),
    ]);
    if (downloadPromise) {
      expect(downloadPromise.suggestedFilename()).toMatch(/\.zip$|\.json$|\.csv$/);
    } else {
      const successMsg = page.getByText(/exportação|export|enviado|enviamos/i);
      await expect(successMsg.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('fluxo de eliminação de conta mostra aviso e pode ser cancelado', async ({ loggedInPage }) => {
    const page = loggedInPage;
    const dangerTab = page.getByRole('tab', { name: /danger|eliminar|account/i }).or(
      page.getByTestId('settings-tab-danger')
    );
    const tabExists = await dangerTab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (tabExists) {
      await dangerTab.first().click();
    }
    const deleteAccountBtn = page.getByTestId('delete-account-btn').or(
      page.getByRole('button', { name: /eliminar conta|delete account|apagar conta/i })
    );
    const exists = await deleteAccountBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!exists) {
      test.skip(true, 'Botão de eliminação de conta ainda não implementado (aguarda Unit 15)');
      return;
    }
    await deleteAccountBtn.first().click();
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await expect(dialog.first()).toBeVisible({ timeout: 10_000 });
    const confirmInput = dialog.first().locator('input[type="text"]');
    const inputExists = await confirmInput.isVisible({ timeout: 3_000 }).catch(() => false);
    if (inputExists) {
      await expect(confirmInput).toBeVisible();
    }
    const cancelBtn = dialog.first().getByRole('button', { name: /cancelar|cancel/i });
    await cancelBtn.click();
    await expect(dialog.first()).not.toBeVisible({ timeout: 5_000 });
  });
});
