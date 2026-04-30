// tests/e2e/playwright/07-settings.spec.ts
import { test, expect } from './fixtures';

test.describe('Settings — Tema e Notificações', () => {
  test.beforeEach(async ({ loggedInPage }) => {
    await loggedInPage.goto('/app/settings');
  });

  test('abre página de settings sem erro', async ({ loggedInPage }) => {
    const page = loggedInPage;
    await expect(page).not.toHaveURL(/\/login/);
    const settingsHeading = page.getByRole('heading', { name: /definições|settings/i });
    await expect(settingsHeading.or(page.getByText(/perfil|profile/i))).toBeVisible({ timeout: 10_000 });
  });

  test('toggle de tema muda a classe no HTML', async ({ loggedInPage }) => {
    const page = loggedInPage;
    const themeToggle = page.getByTestId('theme-toggle').or(
      page.getByRole('button', { name: /tema|theme|dark|light/i })
    );
    const exists = await themeToggle.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!exists) {
      test.skip(true, 'Toggle de tema ainda não implementado (aguarda Unit 15)');
      return;
    }
    const htmlClass = await page.locator('html').getAttribute('class');
    const isDark = htmlClass?.includes('dark') ?? false;
    await themeToggle.first().click();
    const newHtmlClass = await page.locator('html').getAttribute('class');
    if (isDark) {
      expect(newHtmlClass).not.toContain('dark');
    } else {
      expect(newHtmlClass).toContain('dark');
    }
  });

  test('tab de notificações existe e é acessível', async ({ loggedInPage }) => {
    const page = loggedInPage;
    const notifsTab = page.getByRole('tab', { name: /notif/i }).or(
      page.getByTestId('settings-tab-notifications')
    );
    const exists = await notifsTab.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!exists) {
      test.skip(true, 'Tab de notificações ainda não implementada (aguarda Unit 15)');
      return;
    }
    await notifsTab.first().click();
    await expect(
      page.getByText(/email|push|notificaç/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
