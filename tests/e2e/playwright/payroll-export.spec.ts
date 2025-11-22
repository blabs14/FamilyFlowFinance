import { test, expect, Page, APIRequestContext } from '@playwright/test';

async function mockSupabaseAuth(page: Page) {
  // Login com password
  await page.route('**/auth/v1/token?grant_type=password', async (route) => {
    const req = route.request();
    const body = req.postDataJSON?.() || {};
    const email = body?.email || 'test@example.com';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'test-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        user: { id: 'uid-test-123', email }
      })
    });
  });

  // Sessão
  await page.route('**/auth/v1/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'test-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: { id: 'uid-test-123', email: 'testetotal@exemplo.com' }
      })
    });
  });

  // Utilizador
  await page.route('**/auth/v1/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'uid-test-123', aud: 'authenticated', role: 'authenticated', email: 'testetotal@exemplo.com' })
    });
  });
}

async function mockExportEdgeFunction(page: Page) {
  await page.route('**/functions/v1/export-payslips', async (route) => {
    const body = route.request().postDataJSON?.() || {};
    // Valida payload mínimo
    if (!Array.isArray(body?.ids) || body.ids.length === 0) {
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'ids em falta' }) });
      return;
    }
    // Resposta simulada com URL assinada
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        format: body?.format || 'csv',
        count: body?.ids?.length || 1,
        signedUrl: 'http://localhost:8081/fake-download.csv',
        requestId: 'e2e-test',
        duration_ms: 5,
        size_bytes: 123
      })
    });
  });
}

// Teste E2E do fluxo: login -> calculadora -> exportar no histórico
// Usa rotas DEV-only: /app/payroll/calculator e /app/payroll/history

test('Fluxo de exportação de payslips (CSV) com URL assinada', async ({ page }) => {
  await mockSupabaseAuth(page);
  await mockExportEdgeFunction(page);

  // Ir para login e autenticar via componente de teste direto
  await page.goto('/login');
  await page.getByRole('button', { name: /Teste Direto de Login/i }).click();
  // Confirmar sessão ativa pelo header (evita flakiness do texto de resultado)
  await expect(page.getByRole('link', { name: /Área Pessoal/i })).toBeVisible();

  // Navegar para a calculadora (DEV-only) e confirmar URL
  await page.goto('/app/payroll/calculator');
  await expect(page).toHaveURL(/\/app\/payroll\/calculator/);
  await page.waitForSelector('#baseSalary');

  await page.fill('#baseSalary', '1000');
  await page.fill('#hoursWorked', '160');
  await page.getByRole('button', { name: 'Calcular' }).click();
  await expect(page.getByRole('heading', { name: 'Resultado do Cálculo' })).toBeVisible();

  // Ver histórico
  await page.getByRole('button', { name: 'Ver histórico' }).click();
  await expect(page.getByRole('heading', { name: 'Histórico de Payroll' })).toBeVisible();

  // Selecionar primeiro payslip
  const firstCheckbox = page.getByRole('checkbox').first();
  await expect(firstCheckbox).toBeVisible();
  await firstCheckbox.check();

  // Garantir formato CSV
  await page.selectOption('#exportFormat', 'csv');

  // Aguardar popup da nova aba com a URL assinada
  const [downloadTab] = await Promise.all([
    page.context().waitForEvent('page'),
    page.getByRole('button', { name: 'Exportar' }).click()
  ]);

  await downloadTab.waitForLoadState('domcontentloaded');
  expect(downloadTab.url()).toContain('fake-download.csv');

  // Mensagem de sucesso visível
  await expect(page.getByText('Payslips exportados com sucesso')).toBeVisible();
});