// tests/e2e/playwright/01-auth.spec.ts
import { test as base, expect } from '@playwright/test';
import { performLogin } from './fixtures/auth';

// Este spec NÃO usa loggedInPage — testa o próprio fluxo de auth.
const test = base;

test.describe('Auth flow', () => {
  test('redireciona utilizadores não autenticados de rotas protegidas para /login', async ({ page }) => {
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login com credenciais válidas e aterra em página protegida', async ({ page }) => {
    await performLogin(page);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByTestId('app-nav')).toBeVisible();
  });

  test('mostra mensagem de erro com credenciais incorrectas', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('email-input').fill('wrong@example.com');
    await page.getByTestId('password-input').fill('wrongpassword');
    await page.getByTestId('login-btn').click();
    await expect(page).toHaveURL(/\/login/);
    const errorLocator = page.locator('[data-testid="login-error"], [role="alert"]');
    await expect(errorLocator.first()).toBeVisible();
  });

  test('redireciona para /login após logout', async ({ page }) => {
    await performLogin(page);
    await page.getByTestId('logout-btn').click();
    await expect(page).toHaveURL(/\/login/);
  });
});
