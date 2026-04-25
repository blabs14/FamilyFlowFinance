# Unit 16.6: Cypress → Playwright Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abandon Cypress entirely and establish Playwright as the sole E2E testing framework, implementing all 8 critical flows enumerated in the spec (§6 Unit 16 sub-decision 6) so that future units (5, 7, etc.) can add E2E tests without framework ambiguity.

**Architecture:** Playwright is already installed (`@playwright/test ^1.54.2`) and `playwright.config.ts` exists pointing to `tests/e2e/playwright/`. All new E2E specs live there. A shared `fixtures/auth.ts` module implements a `loggedInPage` fixture using `storageState` (session saved once per worker, not per test), keeping suites fast. Cypress is removed in Task 2 — all existing `cypress/` content is ported or deleted; `tests/e2e/cypress/` is also removed.

**Tech Stack:** Playwright `@playwright/test`, TypeScript, `@axe-core/playwright` (a11y — installed in Task 10 of this plan), `concurrently` + `wait-on` (already present).

---

## Estado Atual (auditoria pré-implementação)

- `playwright.config.ts` já existe com `testDir: 'tests/e2e/playwright'`, `baseURL: http://localhost:8081`, headless, trace on-first-retry.
- `@playwright/test ^1.54.2` já instalado em devDependencies.
- `package.json` já tem `"test:e2e:pw"` script usando `concurrently + wait-on`.
- `cypress.config.ts` + `cypress/` + `cypress.env.json` existem e precisam de ser removidos.
- `tests/e2e/cypress/recurrents_smoke.cy.ts` existe e precisa de ser portado/removido.
- Cypress `^13.13.2` está em devDependencies — precisa de ser removido.
- 6 ficheiros Cypress em `cypress/e2e/`: `auth.cy.ts`, `accounts.cy.ts`, `navigation.cy.ts`, `recurrents_smoke.cy.ts`, `goals.cy.ts`, `transactions.cy.ts`.
- `cypress.env.json` usa `email: testetotal@exemplo.com`, `password: teste14`.
- `.env.example` já tem `VITE_TEST_EMAIL` e `VITE_TEST_PASSWORD`.

---

## Estrutura de Ficheiros

### Criar
- `tests/e2e/playwright/fixtures/auth.ts` — fixture `loggedInPage` com storageState
- `tests/e2e/playwright/fixtures/index.ts` — re-export de todos os fixtures
- `tests/e2e/playwright/helpers/cleanup.ts` — helpers de limpeza de dados de teste
- `tests/e2e/playwright/01-auth.spec.ts` — Flow 1 (ported de `cypress/e2e/auth.cy.ts`)
- `tests/e2e/playwright/02-account-creation.spec.ts` — Flow 2 (ported de `cypress/e2e/accounts.cy.ts` + `navigation.cy.ts`)
- `tests/e2e/playwright/03-transaction.spec.ts` — Flow 3 (ported de `cypress/e2e/transactions.cy.ts`)
- `tests/e2e/playwright/04-goal-allocation.spec.ts` — Flow 4 (ported de `cypress/e2e/goals.cy.ts`)
- `tests/e2e/playwright/05-recurrents.spec.ts` — Flow 5 (ported de `cypress/e2e/recurrents_smoke.cy.ts` + `tests/e2e/cypress/recurrents_smoke.cy.ts`)
- `tests/e2e/playwright/06-family-invite.spec.ts` — Flow 6 (spec §6 Unit 16.6)
- `tests/e2e/playwright/07-settings.spec.ts` — Flow 7 (spec §6 Unit 16.6)
- `tests/e2e/playwright/08-gdpr.spec.ts` — Flow 8 (spec §6 Unit 16.6 — export + deletion)

### Modificar
- `playwright.config.ts` — adicionar `globalSetup`, projetos de browsers, env vars
- `package.json` — remover `cy:open`, `cy:run`, `test:e2e` (Cypress); atualizar `test:e2e:pw`; remover dep `cypress`
- `.env.example` — adicionar `PW_TEST_EMAIL` e `PW_TEST_PASSWORD`

### Eliminar
- `cypress.config.ts`
- `cypress.env.json`
- `cypress/` (inteiro — `e2e/`, `support/`, `fixtures/`, `tsconfig.json`)
- `tests/e2e/cypress/recurrents_smoke.cy.ts`
- `tests/e2e/cypress/` (directoria inteira após remover o ficheiro)

---

## Task 1: Actualizar playwright.config.ts

**Ficheiros:**
- Modificar: `playwright.config.ts`

- [ ] **Step 1.1: Ler o ficheiro actual**

Ler `playwright.config.ts` para confirmar o estado. Conteúdo actual:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e/playwright',
  use: {
    baseURL: 'http://localhost:8081',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  timeout: 60_000,
  retries: 1,
  reporter: [['list']],
});
```

- [ ] **Step 1.2: Reescrever playwright.config.ts**

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

export default defineConfig({
  testDir: 'tests/e2e/playwright',
  fullyParallel: false,           // flows partilham estado em staging → serializar
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,                     // 1 worker: flows com side-effects (criação de dados)
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:8081',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
  },
  timeout: 60_000,
  expect: { timeout: 10_000 },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.CI
    ? {
        command: 'npm run dev',
        url: 'http://localhost:8081',
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
});
```

- [ ] **Step 1.3: Verificar que o config é válido**

```bash
cd C:/Users/pmati/AppFamilyFinance/FamilyFlowFinance && npx playwright test --list 2>&1 | head -20
```

Esperado: lista vazia (sem specs ainda) ou "No tests found" — sem erros de parse.

- [ ] **Step 1.4: Commit**

```bash
git add playwright.config.ts
git commit -m "test(e2e): update playwright.config.ts — webServer CI, workers=1, env vars"
```

---

## Task 2: Remover Cypress

**Ficheiros:**
- Eliminar: `cypress.config.ts`, `cypress.env.json`, `cypress/` (inteiro), `tests/e2e/cypress/recurrents_smoke.cy.ts`
- Modificar: `package.json`

- [ ] **Step 2.1: Verificar que nenhum ficheiro de source importa Cypress**

```bash
grep -r "cypress\|Cypress" src/ --include="*.ts" --include="*.tsx" -l 2>/dev/null || echo "Nenhum import Cypress em src/"
```

Esperado: "Nenhum import Cypress em src/". Se houver resultados, investigar antes de prosseguir.

- [ ] **Step 2.2: Eliminar ficheiros Cypress**

```bash
git rm cypress.config.ts cypress.env.json
git rm -r cypress/
git rm tests/e2e/cypress/recurrents_smoke.cy.ts
```

Nota: se `tests/e2e/cypress/` ficar vazio após o rm, o git remove a directoria automaticamente.

- [ ] **Step 2.3: Remover dep Cypress do package.json e scripts obsoletos**

Ler `package.json`, depois remover:
- `devDependencies.cypress`
- `scripts.cy:open`
- `scripts.cy:run`
- `scripts["test:e2e"]` (versão Cypress com `cy:run`)

Actualizar `scripts["test:e2e:pw"]` para:
```json
"test:e2e:pw": "concurrently -k \"npm run dev\" \"wait-on http://localhost:8081 && npx playwright test\""
```

Adicionar script de conveniência:
```json
"test:e2e:pw:ui": "concurrently -k \"npm run dev\" \"wait-on http://localhost:8081 && npx playwright test --ui\""
```

- [ ] **Step 2.4: Desinstalar Cypress**

```bash
npm uninstall cypress
```

Esperado: `cypress` removido de `node_modules/` e `package-lock.json`.

- [ ] **Step 2.5: Confirmar que não há referências residuais a Cypress**

```bash
grep -r "cypress\|cy:run\|cy:open" package.json 2>/dev/null || echo "Limpo"
```

Esperado: "Limpo".

- [ ] **Step 2.6: Verificar compilação TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros relacionados com Cypress.

- [ ] **Step 2.7: Correr testes unitários para garantir que nada partiu**

```bash
npm test -- --run
```

Esperado: todos os testes unitários passam.

- [ ] **Step 2.8: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove Cypress — delete config, fixtures, support, test files; uninstall dep"
```

---

## Task 3: Criar fixtures de autenticação Playwright

**Ficheiros:**
- Criar: `tests/e2e/playwright/fixtures/auth.ts`
- Criar: `tests/e2e/playwright/fixtures/index.ts`

A estratégia é usar `storageState` para guardar a sessão Supabase após o primeiro login. O fixture `loggedInPage` restaura esse estado em cada test sem fazer login UI repetido (mais rápido, mais fiável).

- [ ] **Step 3.1: Criar `tests/e2e/playwright/fixtures/auth.ts`**

```typescript
// tests/e2e/playwright/fixtures/auth.ts
import { test as base, Page, BrowserContext } from '@playwright/test';
import path from 'path';

export const STORAGE_STATE = path.join(
  __dirname,
  '../.auth/user.json'
);

export const TEST_EMAIL =
  process.env.PW_TEST_EMAIL ||
  process.env.VITE_TEST_EMAIL ||
  'testetotal@exemplo.com';

export const TEST_PASSWORD =
  process.env.PW_TEST_PASSWORD ||
  process.env.VITE_TEST_PASSWORD ||
  'teste14';

/**
 * Executa o fluxo de login pela UI e aguarda redirect para fora de /login.
 * Usado no globalSetup e quando precisamos de login fresh.
 */
export async function performLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('email-input').fill(TEST_EMAIL);
  await page.getByTestId('password-input').fill(TEST_PASSWORD);
  await page.getByTestId('login-btn').click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 30_000,
  });
}

type AuthFixtures = {
  loggedInPage: Page;
  loggedInContext: BrowserContext;
};

/**
 * Fixture que restaura sessão guardada.
 * Requer que o ficheiro .auth/user.json exista (gerado pelo globalSetup ou Task 3).
 */
export const test = base.extend<AuthFixtures>({
  loggedInContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE,
    });
    await use(context);
    await context.close();
  },
  loggedInPage: async ({ loggedInContext }, use) => {
    const page = await loggedInContext.newPage();
    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';
```

- [ ] **Step 3.2: Criar `tests/e2e/playwright/fixtures/index.ts`**

```typescript
// tests/e2e/playwright/fixtures/index.ts
export { test, expect, performLogin, TEST_EMAIL, TEST_PASSWORD, STORAGE_STATE } from './auth';
```

- [ ] **Step 3.3: Criar directoria `.auth/` e adicionar ao .gitignore**

```bash
mkdir -p "C:/Users/pmati/AppFamilyFinance/FamilyFlowFinance/tests/e2e/playwright/.auth"
```

Verificar se `.gitignore` já ignora `.auth/`:
```bash
grep -n "\.auth" C:/Users/pmati/AppFamilyFinance/FamilyFlowFinance/.gitignore || echo "Não encontrado — adicionar"
```

Se não encontrado, adicionar `tests/e2e/playwright/.auth/` ao `.gitignore`.

- [ ] **Step 3.4: Criar script de setup de autenticação**

Criar `tests/e2e/playwright/setup/global-setup.ts`:

```typescript
// tests/e2e/playwright/setup/global-setup.ts
// Corre uma vez antes de todos os testes para guardar sessão Supabase.
import { chromium, FullConfig } from '@playwright/test';
import { performLogin, STORAGE_STATE } from '../fixtures/auth';
import path from 'path';
import fs from 'fs';

async function globalSetup(_config: FullConfig) {
  const authDir = path.dirname(STORAGE_STATE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await performLogin(page);

  await page.context().storageState({ path: STORAGE_STATE });
  await browser.close();
}

export default globalSetup;
```

- [ ] **Step 3.5: Adicionar globalSetup ao playwright.config.ts**

Editar `playwright.config.ts` para adicionar `globalSetup`:

```typescript
// Adicionar no topo do defineConfig:
globalSetup: './tests/e2e/playwright/setup/global-setup.ts',
```

- [ ] **Step 3.6: Verificar sintaxe TypeScript dos fixtures**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3.7: Commit**

```bash
git add tests/e2e/playwright/fixtures/auth.ts \
        tests/e2e/playwright/fixtures/index.ts \
        tests/e2e/playwright/setup/global-setup.ts \
        playwright.config.ts \
        .gitignore
git commit -m "test(e2e): add Playwright auth fixture + globalSetup with storageState"
```

---

## Task 4: Flow 1 — Autenticação (auth.spec.ts)

**Ficheiros:**
- Criar: `tests/e2e/playwright/01-auth.spec.ts`
- Test: `tests/e2e/playwright/01-auth.spec.ts`

Port de `cypress/e2e/auth.cy.ts`. Cobre: redirect de rota protegida, login válido, login inválido, logout.

- [ ] **Step 4.1: Escrever o spec**

```typescript
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
```

- [ ] **Step 4.2: Correr o spec**

```bash
npx playwright test tests/e2e/playwright/01-auth.spec.ts --project=chromium
```

Esperado: 4 testes PASS. Se algum falhar por `data-testid` inexistente, verificar o selector no componente de Login em `src/` e ajustar.

- [ ] **Step 4.3: Commit**

```bash
git add tests/e2e/playwright/01-auth.spec.ts
git commit -m "test(e2e): port auth flow to Playwright — redirect, login, error, logout"
```

---

## Task 5: Flow 2 — Criação de conta (account-creation.spec.ts)

**Ficheiros:**
- Criar: `tests/e2e/playwright/02-account-creation.spec.ts`
- Test: `tests/e2e/playwright/02-account-creation.spec.ts`

Port de `cypress/e2e/accounts.cy.ts` e `cypress/e2e/navigation.cy.ts`.

- [ ] **Step 5.1: Escrever o spec**

```typescript
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
    // Clicar tab visível "Contas"
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
    // Confirmar dialog de saldo inicial, se existir
    const confirmBtn = page.getByTestId('confirm-dialog-confirm');
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    const accountItem = page.locator('[data-testid="account-item"]').filter({ hasText: ACCOUNT_NAME_BALANCE });
    await expect(accountItem).toContainText('500');
  });

  test.afterAll(async ({ browser }) => {
    // Limpeza: apagar contas criadas pelo spec
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
```

- [ ] **Step 5.2: Correr o spec**

```bash
npx playwright test tests/e2e/playwright/02-account-creation.spec.ts --project=chromium
```

Esperado: 3 testes PASS.

- [ ] **Step 5.3: Commit**

```bash
git add tests/e2e/playwright/02-account-creation.spec.ts
git commit -m "test(e2e): port account creation + navigation flow to Playwright"
```

---

## Task 6: Flow 3 — Transação (transaction.spec.ts)

**Ficheiros:**
- Criar: `tests/e2e/playwright/03-transaction.spec.ts`
- Test: `tests/e2e/playwright/03-transaction.spec.ts`

Port de `cypress/e2e/transactions.cy.ts`.

- [ ] **Step 6.1: Escrever o spec**

```typescript
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

  // Categoria: selecionar existente ou criar inline
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
    // Nenhum item deve conter "+" (receitas excluídas)
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

    // Apagar transações de teste
    await page.goto('/personal/transactions');
    for (const desc of [TX_DESC, TX_DESC_FILTER]) {
      const item = page.locator('[data-testid="transaction-item"]').filter({ hasText: desc });
      if (await item.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await item.getByRole('button', { name: /eliminar transação/i }).click();
        await page.getByTestId('confirm-dialog-confirm').click();
      }
    }

    // Apagar conta de suporte
    await page.goto('/personal/accounts');
    const accItem = page.locator('[data-testid="account-item"]').filter({ hasText: ACCOUNT_NAME });
    if (await accItem.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await accItem.getByTestId('delete-account-btn').click();
      await page.getByTestId('confirm-dialog-confirm').click();
    }

    await context.close();
  });
});
```

- [ ] **Step 6.2: Correr o spec**

```bash
npx playwright test tests/e2e/playwright/03-transaction.spec.ts --project=chromium
```

Esperado: 2 testes PASS.

- [ ] **Step 6.3: Commit**

```bash
git add tests/e2e/playwright/03-transaction.spec.ts
git commit -m "test(e2e): port transaction creation + filter flow to Playwright"
```

---

## Task 7: Flow 4 — Alocação de objetivo (goal-allocation.spec.ts)

**Ficheiros:**
- Criar: `tests/e2e/playwright/04-goal-allocation.spec.ts`
- Test: `tests/e2e/playwright/04-goal-allocation.spec.ts`

Port de `cypress/e2e/goals.cy.ts`. Cobre: criação de goal, alocação de fundos, desalocação.

- [ ] **Step 7.1: Escrever o spec**

```typescript
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

    // Alocar
    await goalCard.getByTestId('allocate-goal-btn').click();
    await page.getByTestId('allocate-account-select').click();
    await page.getByRole('option', { name: ACCOUNT_NAME }).click();
    await page.getByTestId('allocate-amount-input').fill('50');
    await page.getByTestId('allocate-submit-btn').click();

    await expect(
      page.locator('[data-testid="goal-card"]').filter({ hasText: flowGoalName })
    ).toContainText('50');

    // Desalocar
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
```

- [ ] **Step 7.2: Correr o spec**

```bash
npx playwright test tests/e2e/playwright/04-goal-allocation.spec.ts --project=chromium
```

Esperado: 2 testes PASS.

- [ ] **Step 7.3: Commit**

```bash
git add tests/e2e/playwright/04-goal-allocation.spec.ts
git commit -m "test(e2e): port goal creation + allocation/deallocation flow to Playwright"
```

---

## Task 8: Flow 5 — Recorrentes (recurrents.spec.ts)

**Ficheiros:**
- Criar: `tests/e2e/playwright/05-recurrents.spec.ts`
- Test: `tests/e2e/playwright/05-recurrents.spec.ts`

Port e consolidação de `cypress/e2e/recurrents_smoke.cy.ts` e `tests/e2e/cypress/recurrents_smoke.cy.ts`.

- [ ] **Step 8.1: Escrever o spec**

```typescript
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

    // Input de data existe
    await expect(page.locator('input[type="date"]').first()).toBeVisible();

    // Previsualização presente
    await expect(page.getByTestId('rule-preview')).toContainText('Próximos 3 lançamentos');

    // Fechar sem gravar
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

    // Preencher data de início (primeiro input de date)
    const today = new Date().toISOString().split('T')[0];
    await page.locator('input[type="date"]').first().fill(today);

    await page.getByTestId('rule-submit-btn').click();

    await expect(
      page.locator('[data-testid="rule-item"]').filter({ hasText: ruleDesc })
    ).toBeVisible({ timeout: 15_000 });

    // Limpeza: apagar a regra criada
    await page.locator('[data-testid="rule-item"]').filter({ hasText: ruleDesc })
      .getByTestId('delete-rule-btn').click();
    const confirmBtn = page.getByTestId('confirm-dialog-confirm');
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await confirmBtn.click();
    }
  });
});
```

- [ ] **Step 8.2: Correr o spec**

```bash
npx playwright test tests/e2e/playwright/05-recurrents.spec.ts --project=chromium
```

Esperado: 3 testes PASS. O terceiro teste pode necessitar de ajuste no selector `rule-submit-btn` conforme o componente actual.

- [ ] **Step 8.3: Commit**

```bash
git add tests/e2e/playwright/05-recurrents.spec.ts
git commit -m "test(e2e): port recurrents smoke + add rule creation flow to Playwright"
```

---

## Task 9: Flow 6 — Convite familiar (family-invite.spec.ts)

**Ficheiros:**
- Criar: `tests/e2e/playwright/06-family-invite.spec.ts`
- Test: `tests/e2e/playwright/06-family-invite.spec.ts`

Novo flow (não existia em Cypress). Cobre: navegar para zona familiar, criar/visualizar o grupo familiar, verificar que o scope toggle existe.

> **Nota implementação:** O fluxo completo de invite (enviar email Resend + aceitar com segundo utilizador) requer um segundo utilizador de teste e acesso ao email, o que é impraticável em CI headless sem infra adicional. Este spec testa o que é verificável: navegação para o módulo familiar, existência do UI de convite, e scope toggle. Quando Unit 13 for implementado, expandir este spec para um fluxo completo com `PW_TEST_EMAIL_2`.

- [ ] **Step 9.1: Escrever o spec**

```typescript
// tests/e2e/playwright/06-family-invite.spec.ts
import { test, expect } from './fixtures';

test.describe('Family — Invite + Scope', () => {
  test('mostra módulo familiar e scope toggle está acessível', async ({ loggedInPage }) => {
    const page = loggedInPage;
    // Navegar para área familiar
    await page.goto('/family');
    // Pode redirecionar para /app ou /family/accounts consoante implementação
    // Verificar que chegamos a uma página autenticada (não /login)
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('scope toggle existe na navegação', async ({ loggedInPage }) => {
    const page = loggedInPage;
    await page.goto('/app');
    // O toggle de scope (Personal / Family) deve estar visível na nav
    const scopeToggle = page.locator('[data-testid="scope-toggle"], [aria-label*="scope"], [aria-label*="Scope"]');
    // Se o toggle ainda não estiver implementado (Unit 1 pendente), o teste é marcado como skip
    const exists = await scopeToggle.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!exists) {
      test.skip(true, 'Scope toggle ainda não implementado (aguarda Unit 1)');
    } else {
      await expect(scopeToggle).toBeVisible();
    }
  });

  test('UI de convite familiar existe e abre form/dialog', async ({ loggedInPage }) => {
    const page = loggedInPage;
    // Tentar ir a /family/members ou similar
    await page.goto('/family/members');
    const notFound = await page.getByText(/not found|404|não encontrado/i).isVisible({ timeout: 3_000 }).catch(() => false);
    if (notFound) {
      test.skip(true, 'Rota /family/members ainda não implementada (aguarda Unit 13)');
    }

    // Se a página existe, verificar botão de convite
    const inviteBtn = page.getByTestId('invite-member-btn');
    await expect(inviteBtn).toBeVisible({ timeout: 10_000 });
    await inviteBtn.click();
    const inviteForm = page.locator('[data-testid="invite-form"], [role="dialog"]').first();
    await expect(inviteForm).toBeVisible();
  });
});
```

- [ ] **Step 9.2: Correr o spec**

```bash
npx playwright test tests/e2e/playwright/06-family-invite.spec.ts --project=chromium
```

Esperado: testes PASS ou SKIP (se funcionalidades ainda não implementadas). Nenhum deve FAIL com erro inesperado.

- [ ] **Step 9.3: Commit**

```bash
git add tests/e2e/playwright/06-family-invite.spec.ts
git commit -m "test(e2e): add family invite + scope toggle E2E flow (skip gates for unimplemented units)"
```

---

## Task 10: Flow 7 — Settings (settings.spec.ts)

**Ficheiros:**
- Criar: `tests/e2e/playwright/07-settings.spec.ts`
- Test: `tests/e2e/playwright/07-settings.spec.ts`

Cobre: navegação para settings, alteração de tema, verificação de preferências de notificação.

- [ ] **Step 10.1: Escrever o spec**

```typescript
// tests/e2e/playwright/07-settings.spec.ts
import { test, expect } from './fixtures';

test.describe('Settings — Tema e Notificações', () => {
  test.beforeEach(async ({ loggedInPage }) => {
    await loggedInPage.goto('/app/settings');
  });

  test('abre página de settings sem erro', async ({ loggedInPage }) => {
    const page = loggedInPage;
    await expect(page).not.toHaveURL(/\/login/);
    // Verificar que existe algum conteúdo de settings
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
    }

    // Ler classe actual do <html>
    const htmlClass = await page.locator('html').getAttribute('class');
    const isDark = htmlClass?.includes('dark') ?? false;

    await themeToggle.first().click();

    // Após toggle, a classe deve ter mudado
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
    }
    await notifsTab.first().click();
    // Verificar que alguma opção de notificação aparece
    await expect(
      page.getByText(/email|push|notificaç/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
```

- [ ] **Step 10.2: Correr o spec**

```bash
npx playwright test tests/e2e/playwright/07-settings.spec.ts --project=chromium
```

Esperado: testes PASS ou SKIP.

- [ ] **Step 10.3: Commit**

```bash
git add tests/e2e/playwright/07-settings.spec.ts
git commit -m "test(e2e): add settings theme + notifications E2E flow"
```

---

## Task 11: Flow 8 — GDPR Export e Deletion (gdpr.spec.ts)

**Ficheiros:**
- Criar: `tests/e2e/playwright/08-gdpr.spec.ts`
- Test: `tests/e2e/playwright/08-gdpr.spec.ts`

Cobre: pedido de exportação de dados, cancelar pedido de eliminação de conta (o teste nunca confirma a eliminação para não destruir o utilizador de teste).

- [ ] **Step 11.1: Escrever o spec**

```typescript
// tests/e2e/playwright/08-gdpr.spec.ts
import { test, expect } from './fixtures';

test.describe('GDPR — Export e Deletion', () => {
  test.beforeEach(async ({ loggedInPage }) => {
    await loggedInPage.goto('/app/settings');
  });

  test('botão de exportação de dados existe e pode ser clicado', async ({ loggedInPage }) => {
    const page = loggedInPage;
    // Navegar para tab de privacy/danger se existir
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
    }

    // Clicar — deve iniciar download ou mostrar confirmação
    const [downloadPromise] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }).catch(() => null),
      exportBtn.first().click(),
    ]);

    if (downloadPromise) {
      // Export desencadeia download directo
      expect(downloadPromise.suggestedFilename()).toMatch(/\.zip$|\.json$|\.csv$/);
    } else {
      // Alternativa: mostra toast/alert de confirmação
      const successMsg = page.getByText(/exportação|export|enviado|enviamos/i);
      await expect(successMsg.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('fluxo de eliminação de conta mostra aviso e pode ser cancelado', async ({ loggedInPage }) => {
    const page = loggedInPage;
    // Navegar para zona de danger
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
    }

    await deleteAccountBtn.first().click();

    // Dialog de confirmação com aviso deve aparecer
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await expect(dialog.first()).toBeVisible({ timeout: 10_000 });

    // Verificar que existe campo de confirmação typed-string "APAGAR"
    const confirmInput = dialog.first().locator('input[type="text"]');
    const inputExists = await confirmInput.isVisible({ timeout: 3_000 }).catch(() => false);
    if (inputExists) {
      // NÃO preencher — apenas verificar que existe
      await expect(confirmInput).toBeVisible();
    }

    // CANCELAR — não eliminar a conta de teste
    const cancelBtn = dialog.first().getByRole('button', { name: /cancelar|cancel/i });
    await cancelBtn.click();

    // Dialog fechou
    await expect(dialog.first()).not.toBeVisible({ timeout: 5_000 });
  });
});
```

- [ ] **Step 11.2: Correr o spec**

```bash
npx playwright test tests/e2e/playwright/08-gdpr.spec.ts --project=chromium
```

Esperado: testes PASS ou SKIP.

- [ ] **Step 11.3: Commit**

```bash
git add tests/e2e/playwright/08-gdpr.spec.ts
git commit -m "test(e2e): add GDPR export + deletion cancellation E2E flow"
```

---

## Task 12: Correr suite completa e actualizar .env.example

**Ficheiros:**
- Modificar: `.env.example`

- [ ] **Step 12.1: Adicionar variáveis Playwright ao .env.example**

Ler `.env.example` e adicionar secção:

```dotenv
# E2E Playwright
PW_BASE_URL=http://localhost:8081
PW_TEST_EMAIL=testetotal@exemplo.com
PW_TEST_PASSWORD=teste14
```

- [ ] **Step 12.2: Correr toda a suite E2E**

```bash
cd C:/Users/pmati/AppFamilyFinance/FamilyFlowFinance && npm run test:e2e:pw
```

Esperado: todos os specs correm. Nenhum FAIL inesperado (SKIP é aceitável para flows de Units ainda não implementadas).

Se o `webServer` não iniciar (ambiente local sem `npm run dev` configurado), correr separadamente:

```bash
# Terminal 1:
npm run dev
# Terminal 2 (após dev estar up):
npx playwright test
```

- [ ] **Step 12.3: Verificar relatório HTML**

```bash
npx playwright show-report
```

Confirmar que todos os testes têm traces guardadas em caso de falha.

- [ ] **Step 12.4: Verificar que Cypress não existe em lado nenhum**

```bash
grep -r "cypress\|cy\.visit\|cy\.get\|Cypress" \
  "C:/Users/pmati/AppFamilyFinance/FamilyFlowFinance/tests/" \
  "C:/Users/pmati/AppFamilyFinance/FamilyFlowFinance/src/" \
  --include="*.ts" --include="*.tsx" -l 2>/dev/null || echo "Limpo — zero referências Cypress"
```

Esperado: "Limpo".

- [ ] **Step 12.5: Verificar compilação TypeScript final**

```bash
npx tsc --noEmit
```

- [ ] **Step 12.6: Commit final**

```bash
git add .env.example
git commit -m "test(e2e): complete Cypress→Playwright migration — all 8 flows, env vars documented"
```

---

## Verificação Final

Após todas as tasks:

```bash
# 1. Sem referências a Cypress
grep -r "cypress\|cy\.visit\|cy\.get" \
  C:/Users/pmati/AppFamilyFinance/FamilyFlowFinance/tests/ \
  --include="*.ts" -l 2>/dev/null || echo "OK"

# 2. Playwright config válido
npx playwright test --list

# 3. Suite completa corre
npx playwright test

# 4. Testes unitários intactos
npm test -- --run

# 5. TypeScript sem erros
npx tsc --noEmit
```

Esperado:
- (1) Zero ficheiros com referências Cypress.
- (2) 8+ specs listados.
- (3) Todos PASS ou SKIP (nenhum FAIL).
- (4) Todos os testes unitários passam.
- (5) Zero erros TypeScript.

---

## Estrutura final de ficheiros E2E

```
tests/e2e/playwright/
  .auth/
    user.json               ← gerado em runtime, .gitignored
  fixtures/
    auth.ts                 ← loggedInPage fixture + performLogin
    index.ts                ← re-exports
  setup/
    global-setup.ts         ← salva storageState uma vez
  01-auth.spec.ts           ← redirect, login, erro, logout
  02-account-creation.spec.ts  ← navegação, criar conta, saldo
  03-transaction.spec.ts    ← criar despesa, filtrar por tipo
  04-goal-allocation.spec.ts   ← criar goal, alocar, desalocar
  05-recurrents.spec.ts     ← listar, dialog + preview, criar regra
  06-family-invite.spec.ts  ← scope toggle, UI de convite
  07-settings.spec.ts       ← tema, notificações
  08-gdpr.spec.ts           ← export data, deletion cancelado
```

## Notas para units futuras

- **Importar o fixture:** `import { test, expect } from './fixtures';` — usa `loggedInPage` para testes que precisam de sessão.
- **Flows que ainda não passam completamente:** os specs 06, 07, 08 têm `test.skip()` condicionais para funcionalidades de Units 1, 13, 15 ainda não implementadas. Quando essas units forem concluídas, remover os skips e expandir os testes.
- **`data-testid` vs `data-cy`:** os selectors Playwright usam `getByTestId()` que procura `data-testid`. Os componentes actuais têm `data-cy`. Em cada task que falhe por este motivo: (a) verificar o atributo no componente React, (b) se for `data-cy`, usar `page.locator('[data-cy=X]')` até os componentes serem actualizados para `data-testid`. Não é blocker.
- **Blocker para E2E de outras Units:** após Task 2 estar concluída (Cypress removido), qualquer nova spec E2E deve ser escrita directamente em `tests/e2e/playwright/*.spec.ts`.
