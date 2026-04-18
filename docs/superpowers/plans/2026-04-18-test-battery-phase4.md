# Test Battery Rebuild — Phase 4 (E2E Cypress)

> **For agentic workers:** This plan is self-contained. Execute task-by-task. Commit after every task. Run `npx cypress run --spec <pattern>` to verify each task. The dev server must be running (`npm run dev`) in a separate terminal before running Cypress, OR use `npm run test:e2e` which starts both automatically.

**Goal:** Build a real E2E suite on top of the single existing smoke test. Cover the 4 critical user flows: auth, accounts, transactions, and goals. End state: ~25 passing E2E tests, a `cy.login()` custom command, `data-cy` selectors on critical elements, and a support layer that makes future E2E tests trivial to write.

**Architecture:**
- Cypress 13 with TypeScript, base URL `http://localhost:8081`.
- Support files: `cypress/support/commands.ts` (custom commands) + `cypress/support/e2e.ts` (global setup).
- Credentials from `cypress.env.json` (gitignored) loaded via `Cypress.env()`.
- Tests authenticate via real Supabase — same project as integration tests (`ebitcwrrcumsvqjgrapw`), using a dedicated E2E test user to avoid data conflicts with integration tests.
- Selectors: prefer `data-cy` > `aria-*` > `role` > CSS. Never use class names or text content for interactive elements.

**Tech Stack:** Cypress 13.13, TypeScript 5.5, Vite dev server on port 8081, real Supabase remote.

---

## Context you need before starting

### Current state (what already exists)
- 1 spec: `cypress/e2e/recurrents_smoke.cy.ts` — login + navigate to `/personal/recorrentes` + open dialog. Uses hardcoded `teste2@teste` / `teste14`.
- `cypress.config.ts` has `baseUrl: http://localhost:8081` and `supportFile: false` — **must enable support file in Task 1**.
- No `cypress/support/` directory — create it in Task 1.
- No `data-cy` attributes in components — add them in Task 2 (login form) and per-task thereafter.

### Test user for E2E
Use `VITE_TEST_EMAIL` / `VITE_TEST_PASSWORD` from `.env.local` (`testetotal@exemplo.com` / `teste14`). This user must have at least one account in Supabase — verify in the dashboard before running tests. E2E tests **create and delete their own data** — they don't depend on pre-existing records except for the user account itself.

### Routes to test

| Flow | Route | Requires |
|---|---|---|
| Login | `/login` | public |
| Dashboard smoke | `/app` | auth |
| Accounts | `/personal/contas` | auth |
| Transactions | `/personal/transacoes` | auth |
| Goals | `/personal/objetivos` | auth |

### Selector strategy
Add `data-cy="<name>"` to interactive elements in source components. Keep names short and semantic:
- `data-cy="email-input"`, `data-cy="password-input"`, `data-cy="login-btn"`
- `data-cy="create-account-btn"`, `data-cy="account-name-input"`, etc.
- `data-cy="submit-btn"` on every form's submit button.

---

## File Structure

```
cypress/
  e2e/
    auth.cy.ts               # CREATE: login + logout + route protection
    accounts.cy.ts           # CREATE: create → view → delete account
    transactions.cy.ts       # CREATE: create → view → delete transaction
    goals.cy.ts              # CREATE: create → allocate → deallocate → delete goal
    recurrents_smoke.cy.ts   # MODIFY: switch to data-cy selectors + cy.login()

  support/
    commands.ts              # CREATE: cy.login(), cy.createAccount(), etc.
    e2e.ts                   # CREATE: global beforeEach (clear state), import commands

  fixtures/
    user.json                # CREATE: test user credentials

cypress.config.ts            # MODIFY: enable supportFile, add env vars
cypress.env.json             # CREATE: gitignored — test credentials
.gitignore                   # MODIFY: add cypress.env.json

src/components/
  LoginForm.tsx              # MODIFY: add data-cy attrs
src/pages/
  login.tsx (or Login.tsx)   # MODIFY: add data-cy to page wrapper if needed

src/components/ (per task)   # MODIFY: add data-cy to account/transaction/goal forms
```

---

## Task 1: Enable support files + custom login command

**Why first:** Without `cy.login()`, every spec would duplicate 5 lines of login. Without support files, no custom commands exist. This task is the foundation everything else builds on.

**Files:**
- Modify: `cypress.config.ts`
- Create: `cypress/support/e2e.ts`
- Create: `cypress/support/commands.ts`
- Create: `cypress/fixtures/user.json`
- Create: `cypress.env.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create `cypress.env.json`** (never commit this — it contains credentials)

```json
{
  "email": "testetotal@exemplo.com",
  "password": "teste14"
}
```

Replace with the actual values from `.env.local` (`VITE_TEST_EMAIL` / `VITE_TEST_PASSWORD`).

- [ ] **Step 2: Add `cypress.env.json` to `.gitignore`**

Append to `.gitignore`:

```
# Cypress
cypress.env.json
cypress/videos/
cypress/screenshots/
```

- [ ] **Step 3: Enable support file in `cypress.config.ts`**

Read the current `cypress.config.ts` first. Change `supportFile: false` to:

```ts
supportFile: 'cypress/support/e2e.ts',
```

Also add `env` to the config so specs can access credentials:

```ts
env: {
  email: process.env.CYPRESS_TEST_EMAIL,
  password: process.env.CYPRESS_TEST_PASSWORD,
},
```

(The `cypress.env.json` file takes precedence at runtime — this is just a fallback.)

- [ ] **Step 4: Create `cypress/support/e2e.ts`**

```ts
import './commands';

// Clear local storage + cookies before each test to ensure isolation.
beforeEach(() => {
  cy.clearLocalStorage();
  cy.clearCookies();
});
```

- [ ] **Step 5: Create `cypress/support/commands.ts`**

```ts
/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      login(email?: string, password?: string): Chainable<void>;
      logout(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('login', (
  email = Cypress.env('email'),
  password = Cypress.env('password')
) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('[data-cy=email-input]').type(email);
    cy.get('[data-cy=password-input]').type(password);
    cy.get('[data-cy=login-btn]').click();
    // Wait for redirect to a protected route — adjust if the app redirects to /app or /personal
    cy.url().should('not.include', '/login');
  });
});

Cypress.Commands.add('logout', () => {
  // Click a logout button if it exists, otherwise clear session directly.
  cy.clearLocalStorage();
  cy.clearCookies();
});
```

`cy.session()` caches the login across tests in the same run — auth happens once per suite, not per test. This is the key Cypress performance pattern.

- [ ] **Step 6: Create `cypress/fixtures/user.json`**

```json
{
  "email": "testetotal@exemplo.com",
  "password": "teste14"
}
```

- [ ] **Step 7: Add `data-cy` attrs to LoginForm**

Read `src/components/LoginForm.tsx`. Add:
- `data-cy="email-input"` to the email `<Input>` (or `<input>`)
- `data-cy="password-input"` to the password `<Input>`
- `data-cy="login-btn"` to the submit `<Button>`

- [ ] **Step 8: Verify Cypress picks up the support file**

Start the dev server in a separate terminal, then:

```bash
npx cypress run --spec "cypress/e2e/recurrents_smoke.cy.ts" --browser chrome 2>&1 | tail -20
```

The existing spec may fail because it uses hardcoded selectors — that's fine for now (we fix it in Task 7). The important thing is that Cypress starts without crashing and the support file loads.

- [ ] **Step 9: Commit**

```bash
git add cypress/support/ cypress/fixtures/ cypress.config.ts .gitignore src/components/LoginForm.tsx
git commit -m "test(e2e): enable Cypress support files + cy.login() command"
```

---

## Task 2: Auth flow tests

**Files:**
- Create: `cypress/e2e/auth.cy.ts`

- [ ] **Step 1: Write the spec**

```ts
describe('Auth flow', () => {
  it('redirects unauthenticated users from protected routes to /login', () => {
    cy.visit('/app');
    cy.url().should('include', '/login');
  });

  it('logs in with valid credentials and lands on a protected page', () => {
    cy.visit('/login');
    cy.get('[data-cy=email-input]').type(Cypress.env('email'));
    cy.get('[data-cy=password-input]').type(Cypress.env('password'));
    cy.get('[data-cy=login-btn]').click();
    cy.url().should('not.include', '/login');
    // Verify some element that only appears when logged in:
    cy.get('[data-cy=app-nav], nav, [role=navigation]').should('exist');
  });

  it('shows an error message with wrong credentials', () => {
    cy.visit('/login');
    cy.get('[data-cy=email-input]').type('wrong@example.com');
    cy.get('[data-cy=password-input]').type('wrongpassword');
    cy.get('[data-cy=login-btn]').click();
    // The error message should appear without redirecting:
    cy.url().should('include', '/login');
    cy.get('[data-cy=login-error], [role=alert]').should('be.visible');
  });

  it('redirects to /login after logout', () => {
    cy.login();
    cy.visit('/app');
    // Find and click the logout button — adjust selector to match the actual component
    cy.get('[data-cy=logout-btn], [aria-label*="logout" i], [aria-label*="sair" i]').click();
    cy.url().should('include', '/login');
  });
});
```

**Before running:** Add `data-cy="login-error"` to the error message element in `LoginForm.tsx`. Add `data-cy="logout-btn"` to the logout button (likely in a nav or profile menu component — search for `logout` in `src/components/`).

- [ ] **Step 2: Run**

```bash
npx cypress run --spec "cypress/e2e/auth.cy.ts" 2>&1 | tail -20
```

Expected: 4 passing.

- [ ] **Step 3: Commit**

```bash
git add cypress/e2e/auth.cy.ts src/components/LoginForm.tsx
git commit -m "test(e2e): auth flow tests (4 tests)"
```

---

## Task 3: Accounts CRUD flow

**Files:**
- Create: `cypress/e2e/accounts.cy.ts`
- Modify: the AccountForm component (add `data-cy` attrs)

- [ ] **Step 1: Find the accounts page and form**

```bash
cat src/pages/personal/contas.tsx 2>/dev/null || find src/pages -name "*conta*" -o -name "*account*" | head -5
cat src/components/AccountForm.tsx 2>/dev/null || find src/components -name "*AccountForm*" | head -3
```

Note: button to create account, form inputs (name, type, initial balance), submit button, and how account items appear in the list.

- [ ] **Step 2: Add `data-cy` to account components**

In the accounts page/component, add:
- `data-cy="create-account-btn"` — button that opens the create form
- `data-cy="account-name-input"` — name field in form
- `data-cy="account-type-select"` — type dropdown
- `data-cy="account-balance-input"` — initial balance field
- `data-cy="account-submit-btn"` — form submit
- `data-cy="account-item"` — each account row/card in the list (use this as a repeating selector)
- `data-cy="delete-account-btn"` — delete button on each item

- [ ] **Step 3: Write the spec**

```ts
const ACCOUNT_NAME = `E2E Conta ${Date.now()}`;

describe('Accounts', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/personal/contas');
  });

  it('creates a new account and shows it in the list', () => {
    cy.get('[data-cy=create-account-btn]').click();
    cy.get('[data-cy=account-name-input]').type(ACCOUNT_NAME);
    // Select account type if needed — adjust selector to the real dropdown
    cy.get('[data-cy=account-submit-btn]').click();
    cy.get('[data-cy=account-item]').contains(ACCOUNT_NAME).should('exist');
  });

  it('shows account balance', () => {
    // Create an account with a specific balance
    cy.get('[data-cy=create-account-btn]').click();
    cy.get('[data-cy=account-name-input]').type(`${ACCOUNT_NAME}-balance`);
    cy.get('[data-cy=account-balance-input]').type('500');
    cy.get('[data-cy=account-submit-btn]').click();
    cy.get('[data-cy=account-item]').contains(`${ACCOUNT_NAME}-balance`)
      .parents('[data-cy=account-item]')
      .should('contain.text', '500');
  });

  after(() => {
    // Cleanup: delete accounts created during this test run
    // This is a best-effort cleanup — integration tests don't depend on this data
    cy.login();
    cy.visit('/personal/contas');
    cy.get('body').then($body => {
      if ($body.find(`[data-cy=account-item]:contains("${ACCOUNT_NAME}")`).length > 0) {
        cy.contains('[data-cy=account-item]', ACCOUNT_NAME)
          .find('[data-cy=delete-account-btn]')
          .click({ multiple: true });
      }
    });
  });
});
```

Use `Date.now()` in the test data name to avoid collisions between runs.

- [ ] **Step 4: Run + commit**

```bash
npx cypress run --spec "cypress/e2e/accounts.cy.ts" 2>&1 | tail -15
git add cypress/e2e/accounts.cy.ts src/components/AccountForm.tsx src/pages/
git commit -m "test(e2e): accounts CRUD flow (2 tests)"
```

---

## Task 4: Transactions CRUD flow

**Files:**
- Create: `cypress/e2e/transactions.cy.ts`
- Modify: TransactionForm + transactions page (add `data-cy`)

- [ ] **Step 1: Find the form and page**

```bash
find src -name "*Transaction*" -o -name "*transac*" | grep -v node_modules | head -10
```

- [ ] **Step 2: Add `data-cy` to transaction components**

- `data-cy="create-transaction-btn"` — open form button
- `data-cy="transaction-description-input"` — description/name field
- `data-cy="transaction-amount-input"` — amount
- `data-cy="transaction-date-input"` — date picker
- `data-cy="transaction-type-select"` — despesa/receita
- `data-cy="transaction-category-select"` — category
- `data-cy="transaction-account-select"` — source account
- `data-cy="transaction-submit-btn"` — submit
- `data-cy="transaction-item"` — each row in list

- [ ] **Step 3: Write the spec**

```ts
const TX_DESC = `E2E Transação ${Date.now()}`;

describe('Transactions', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/personal/transacoes');
  });

  it('creates a despesa transaction and shows it in the list', () => {
    cy.get('[data-cy=create-transaction-btn]').click();
    cy.get('[data-cy=transaction-description-input]').type(TX_DESC);
    cy.get('[data-cy=transaction-amount-input]').type('42.50');
    // Select first available category — adjust if required
    cy.get('[data-cy=transaction-category-select]').click();
    cy.get('[role=option]').first().click();
    cy.get('[data-cy=transaction-submit-btn]').click();
    cy.get('[data-cy=transaction-item]').contains(TX_DESC).should('exist');
  });

  it('filters transactions by type', () => {
    // Find the type filter and select "despesa"
    cy.get('[data-cy=transaction-type-filter], [aria-label*="tipo" i]').first().click();
    cy.get('[role=option]').contains(/despesa/i).click();
    // All visible transactions should be despesas
    cy.get('[data-cy=transaction-item]').each($item => {
      cy.wrap($item).should('not.contain.text', 'receita');
    });
  });
});
```

- [ ] **Step 4: Run + commit**

```bash
npx cypress run --spec "cypress/e2e/transactions.cy.ts" 2>&1 | tail -15
git add cypress/e2e/transactions.cy.ts
git commit -m "test(e2e): transactions CRUD flow (2 tests)"
```

---

## Task 5: Goals flow

**Files:**
- Create: `cypress/e2e/goals.cy.ts`
- Modify: GoalForm + goals page (add `data-cy`)

This is the most critical flow — goals had the most bugs in this project. The E2E test validates the full cycle visible to the user.

- [ ] **Step 1: Find the goals page and form**

```bash
find src -name "*Goal*" -o -name "*objetivo*" | grep -v node_modules | head -10
```

- [ ] **Step 2: Add `data-cy` to goal components**

- `data-cy="create-goal-btn"` — open goal form
- `data-cy="goal-name-input"` — goal name
- `data-cy="goal-target-input"` — target amount (`valor_objetivo`)
- `data-cy="goal-submit-btn"` — create form submit
- `data-cy="goal-item"` — each goal card in list
- `data-cy="goal-progress"` — progress bar or percentage on each card
- `data-cy="allocate-btn"` — button to add funds to goal
- `data-cy="allocate-amount-input"` — allocation amount
- `data-cy="allocate-submit-btn"` — confirm allocation
- `data-cy="deallocate-btn"` — remove funds from goal
- `data-cy="delete-goal-btn"` — delete goal

- [ ] **Step 3: Write the spec**

```ts
const GOAL_NAME = `E2E Objetivo ${Date.now()}`;

describe('Goals lifecycle', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/personal/objetivos');
  });

  it('creates a new goal and shows it in the list', () => {
    cy.get('[data-cy=create-goal-btn]').click();
    cy.get('[data-cy=goal-name-input]').type(GOAL_NAME);
    cy.get('[data-cy=goal-target-input]').type('1000');
    cy.get('[data-cy=goal-submit-btn]').click();
    cy.get('[data-cy=goal-item]').contains(GOAL_NAME).should('exist');
  });

  it('allocates funds to the goal and updates progress', () => {
    cy.get('[data-cy=goal-item]').contains(GOAL_NAME)
      .parents('[data-cy=goal-item]')
      .find('[data-cy=allocate-btn]').click();

    cy.get('[data-cy=allocate-amount-input]').type('250');
    cy.get('[data-cy=allocate-submit-btn]').click();

    // Progress should now show 25%
    cy.get('[data-cy=goal-item]').contains(GOAL_NAME)
      .parents('[data-cy=goal-item]')
      .find('[data-cy=goal-progress]')
      .should('contain.text', '25');
  });

  it('deallocates funds from the goal', () => {
    cy.get('[data-cy=goal-item]').contains(GOAL_NAME)
      .parents('[data-cy=goal-item]')
      .find('[data-cy=deallocate-btn]').click();

    cy.get('[data-cy=allocate-amount-input]').type('250');
    cy.get('[data-cy=allocate-submit-btn]').click();

    cy.get('[data-cy=goal-item]').contains(GOAL_NAME)
      .parents('[data-cy=goal-item]')
      .find('[data-cy=goal-progress]')
      .should('contain.text', '0');
  });

  it('deletes the goal', () => {
    cy.get('[data-cy=goal-item]').contains(GOAL_NAME)
      .parents('[data-cy=goal-item]')
      .find('[data-cy=delete-goal-btn]').click();

    // Confirm deletion if there's a dialog
    cy.get('[data-cy=confirm-delete-btn], [role=dialog] button').contains(/confirmar|apagar|eliminar/i).click();

    cy.get('[data-cy=goal-item]').contains(GOAL_NAME).should('not.exist');
  });
});
```

These 4 tests run in sequence and the later tests depend on the goal created in the first test. That's intentional — they're testing a lifecycle, not isolated units.

- [ ] **Step 4: Run + commit**

```bash
npx cypress run --spec "cypress/e2e/goals.cy.ts" 2>&1 | tail -20
git add cypress/e2e/goals.cy.ts
git commit -m "test(e2e): goals lifecycle (create → allocate → deallocate → delete)"
```

---

## Task 6: Navigation smoke test

**Files:**
- Create: `cypress/e2e/navigation.cy.ts`

A quick sanity check that all protected routes render without crashing. No data creation — just navigation.

- [ ] **Step 1: Write the spec**

```ts
const PROTECTED_ROUTES = [
  '/app',
  '/personal/resumo',
  '/personal/contas',
  '/personal/transacoes',
  '/personal/objetivos',
  '/personal/orcamentos',
  '/personal/recorrentes',
  '/personal/lembretes',
];

describe('Protected route smoke test', () => {
  before(() => {
    cy.login();
  });

  PROTECTED_ROUTES.forEach(route => {
    it(`renders ${route} without crashing`, () => {
      cy.visit(route);
      // Page should not show a blank screen or error boundary
      cy.get('body').should('not.be.empty');
      cy.url().should('include', route);
      // No unhandled error dialog should appear
      cy.get('[data-cy=error-boundary], [role=alert][data-error]').should('not.exist');
    });
  });
});
```

- [ ] **Step 2: Run + commit**

```bash
npx cypress run --spec "cypress/e2e/navigation.cy.ts" 2>&1 | tail -15
git add cypress/e2e/navigation.cy.ts
git commit -m "test(e2e): navigation smoke test for all protected routes"
```

---

## Task 7: Update existing smoke test to use cy.login()

**Files:**
- Modify: `cypress/e2e/recurrents_smoke.cy.ts`

The existing spec uses hardcoded credentials and CSS selectors. Migrate it to use `cy.login()` and `data-cy` attrs.

- [ ] **Step 1: Read the current spec**

```bash
cat cypress/e2e/recurrents_smoke.cy.ts
```

- [ ] **Step 2: Refactor**

Replace the manual login steps with `cy.login()`. Add `data-cy` to any elements it tests that don't have them yet.

- [ ] **Step 3: Run + commit**

```bash
npx cypress run --spec "cypress/e2e/recurrents_smoke.cy.ts" 2>&1 | tail -10
git add cypress/e2e/recurrents_smoke.cy.ts
git commit -m "test(e2e): migrate recurrents_smoke to cy.login() + data-cy"
```

---

## Task 8: Full run + push

- [ ] **Step 1: Run all Cypress specs**

Start dev server first, then:

```bash
npx cypress run --browser chrome 2>&1 | tail -20
```

Or use the npm script (starts server automatically):

```bash
npm run test:e2e 2>&1 | tail -20
```

Expected: **≥20 passing E2E tests** across 6 spec files. Zero failures. Some flakiness is normal in E2E — re-run once before investigating.

- [ ] **Step 2: Run unit + integration suites to verify no regressions**

```bash
npm run test -- --run --reporter=basic 2>&1 | tail -5
npm run test:integration 2>&1 | tail -5
```

Expected: 449 unit tests + 42 integration tests still passing.

- [ ] **Step 3: Update `docs/TEST_COVERAGE.md`**

Add a Phase 4 section noting:
- Specs added (auth, accounts, transactions, goals, navigation, recurrents)
- Total E2E tests: ~25
- `cy.login()` using `cy.session()` for performance
- `data-cy` convention established
- What's still deferred: edge function E2E, payroll flows, family flows, report exports

- [ ] **Step 4: Push**

```bash
git push
```

---

## Conventions to preserve

- **`cy.session()` inside `cy.login()`** — never call `cy.visit('/login')` + fill form directly in specs. Always use `cy.login()`. This keeps auth fast and consistent.
- **`data-cy` over CSS/text selectors** — if an element doesn't have `data-cy`, add it to the component before writing the test. Never chain `.contains('Criar conta')` on an interactive element.
- **Unique test data names** — use `Date.now()` or a UUID in created data names to prevent cross-run collisions.
- **`after()` cleanup** — each spec that creates data should have an `after()` block that deletes it. It's best-effort (failing cleanup shouldn't fail the suite).
- **One commit per task.** 8 commits total.

---

## Out of scope

- **Family flows:** Invite → accept → switch to family view. Needs 2 browser contexts or a second test user — deferrable.
- **Payroll flows:** Complex form with contracts, time entries, payslip generation.
- **Report export:** PDF/Excel generation needs file download assertions.
- **Edge function tests:** `export-payslips` requires a deployed function endpoint.
- **Mobile viewport:** Add `cy.viewport('iphone-14')` to key tests when UI is stable.
