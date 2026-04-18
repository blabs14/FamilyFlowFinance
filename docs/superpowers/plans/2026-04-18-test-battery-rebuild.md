# Test Battery Rebuild — Phase 1 (Foundation + Unit Coverage)

> **For agentic workers:** This plan is self-contained. Execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Commit after every task (not batch). Run `npm run test -- --run <pattern>` to verify each task's tests pass before committing.

**Goal:** Rebuild a solid test foundation after the test triage in the cleanup branch. Phase 1 covers test infrastructure fixes, pure-function unit tests (validation schemas, formatters, calc helpers), and re-enabling the 4 skipped unit tests. Integration tests against real Supabase and E2E flows are deferred to Phases 2–4 (separate plans).

**Architecture:**
- Vitest + jsdom + React Testing Library (already installed).
- Global mocks for `supabaseClient` and `AuthContext` live in `tests/config/setup.ts` — keep them; individual tests can override via `vi.mock(...)`.
- Test files co-located with source (`src/**/__tests__/*.test.ts` and `src/**/*.test.ts`) for pure-function/unit tests; integration-style tests go in `tests/integration/`.
- Factories and shared test utilities in `tests/utils/`.

**Tech Stack:** Vitest 3.2, @testing-library/react 16.3, @testing-library/jest-dom 6.8, jsdom 26, Zod (existing schemas), React Query 5.

---

## Context you need before starting

### What was deleted/skipped in the previous session
- All `tests/obsolete/` removed.
- 4 individual tests have `it.skip` because expectations were wrong (not real failures):
  - `src/features/payroll/lib/calc.test.ts:119` — formatação currency (esperava cêntimos mas função aceita euros)
  - `src/features/payroll/lib/calc.test.ts:468` — large numbers (mesma causa)
  - `src/features/payroll/services/payrollService.test.ts:943` — mock de feriados desactualizado
  - `src/features/family/__tests__/FamilyAccounts.test.tsx:442` — formatação locale-dependente
- 7 suites têm `describe.skip` porque precisam de DB real — **não tocar nestes neste plano**. Ficam para Phase 3.

### Validation schemas inventory (src/validation/)
15 schemas existem; apenas 3 têm testes. Os 12 sem testes:
- `accountSchema.ts`, `attachmentSchema.ts`, `categorySchema.ts`, `familyInviteSchema.ts`, `fixedExpenseSchema.ts`, `goalAllocationSchema.ts`, `goalSchema.ts`, `notificationSchema.ts`, `personalSettingsSchema.ts`, `profileSchema.ts`, `reminderSchema.ts`, `settingsSchema.ts`, `webhookSchema.ts`

### Critical vitest config issue
`tests/config/vitest.config.ts` include glob is `tests/**/*.{test,spec}.{ts,tsx,...}` — this **excludes** tests co-located in `src/`. Feature tests in `src/features/payroll/*.test.ts`, `src/validation/__tests__/*.test.ts`, `src/features/family/__tests__/*.test.tsx` **are not running in the main suite**. Task 1 fixes this.

---

## File Structure

```
tests/
  config/
    vitest.config.ts        # MODIFY: widen include glob to src/
    setup.ts                # KEEP: global mocks live here
  utils/                    # CREATE
    factories.ts            # CREATE: User, Account, Transaction, Goal, Category factories
    renderWithProviders.tsx # CREATE: wraps QueryClient + Router + Auth for component tests
    mockSupabase.ts         # CREATE: helper to build scoped supabase mocks per-test

src/
  validation/
    __tests__/
      accountSchema.test.ts         # CREATE
      attachmentSchema.test.ts      # CREATE
      categorySchema.test.ts        # CREATE
      familyInviteSchema.test.ts    # CREATE
      fixedExpenseSchema.test.ts    # CREATE
      goalAllocationSchema.test.ts  # CREATE
      goalSchema.test.ts            # CREATE
      notificationSchema.test.ts    # CREATE
      personalSettingsSchema.test.ts # CREATE
      profileSchema.test.ts         # CREATE
      reminderSchema.test.ts        # CREATE
      settingsSchema.test.ts        # CREATE
      webhookSchema.test.ts         # CREATE

  features/payroll/lib/calc.test.ts          # MODIFY: fix 2 it.skip
  features/payroll/services/payrollService.test.ts # MODIFY: fix 1 it.skip
  features/family/__tests__/FamilyAccounts.test.tsx # MODIFY: fix 1 it.skip

  lib/
    __tests__/
      formatters.test.ts    # CREATE (if src/lib/formatters.ts or similar exists — discover first)
      dates.test.ts         # CREATE (same — only if helpers exist)
```

---

## Task 1: Fix vitest config include glob

**Why this matters:** Right now, ~8 test files co-located in `src/` are invisible to the main test runner. Fixing this immediately reveals the real state of the suite and unlocks co-location for the rest of the plan.

**Files:**
- Modify: `tests/config/vitest.config.ts`

- [ ] **Step 1: Run the suite to capture the current baseline**

```bash
npm run test -- --run 2>&1 | tail -20
```

Write down (or screenshot) the totals: `X passed | Y failed | Z skipped`. This is your "before" number.

- [ ] **Step 2: Widen the include glob**

Edit `tests/config/vitest.config.ts` line 10–12. Change:

```ts
    include: [
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
```

to:

```ts
    include: [
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
```

- [ ] **Step 3: Run the suite again and compare**

```bash
npm run test -- --run 2>&1 | tail -20
```

Expected: more tests picked up. If **any new failures appear**, they are pre-existing bugs in co-located tests that were hidden. Capture the list, fix only the trivial ones (typos, stale imports). For anything that needs real investigation, add `describe.skip` with a TODO comment and record in a `test-rebuild-findings.md` scratchpad — don't spend more than 10 min per failure in this task.

- [ ] **Step 4: Commit**

```bash
git add tests/config/vitest.config.ts
git commit -m "test: include src/ tests in vitest runner"
```

---

## Task 2: Fix the 4 it.skip unit tests

**Why this matters:** These are known expectation bugs, not real failures. Fixing them is a quick win and validates that the runner is wired up correctly after Task 1.

**Files:**
- Modify: `src/features/payroll/lib/calc.test.ts` (lines ~119 and ~468)
- Modify: `src/features/payroll/services/payrollService.test.ts` (line ~943)
- Modify: `src/features/family/__tests__/FamilyAccounts.test.tsx` (line ~442)

- [ ] **Step 1: Open each file and read the skipped test + the function under test**

For each of the 4 tests, identify whether:
- **Option A:** the test's expectation is wrong → fix the expectation.
- **Option B:** the function's behaviour is wrong → fix the function (and verify nothing else breaks).

**Guidance:**
- `calc.test.ts` cases: the function returns formatted euros (e.g. `"1.234,56 €"`), but tests expect cents. Assume the function is correct (it's been shipping) — fix the expectations.
- `payrollService.test.ts` line 943: the holiday mock is out-of-date. Update the mock to current shape (inspect `payrollService.ts` to see what it now expects).
- `FamilyAccounts.test.tsx` line 442: locale-dependent. Use `Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)` inside the expectation instead of a hardcoded string.

- [ ] **Step 2: Remove `.skip` and run each test individually**

```bash
npm run test -- --run src/features/payroll/lib/calc.test.ts
npm run test -- --run src/features/payroll/services/payrollService.test.ts
npm run test -- --run src/features/family/__tests__/FamilyAccounts.test.tsx
```

Expected: each file passes. If not, iterate (but don't fix unrelated pre-existing failures — only the ones you just un-skipped).

- [ ] **Step 3: Commit**

```bash
git add src/features/payroll/lib/calc.test.ts src/features/payroll/services/payrollService.test.ts src/features/family/__tests__/FamilyAccounts.test.tsx
git commit -m "test: re-enable 4 previously skipped unit tests"
```

---

## Task 3: Create test factories

**Why this matters:** Test data duplication is the #1 cause of tests that are expensive to maintain. A factory per entity lets every future test build realistic objects with one line.

**Files:**
- Create: `tests/utils/factories.ts`

- [ ] **Step 1: Inventory the entity shapes you need**

Read `src/integrations/supabase/database.types.ts` and extract the row types for: `profiles`, `accounts`, `transactions`, `categories`, `goals`, `budgets`, `family_members`, `families`. Keep these row types in mind for the factories.

- [ ] **Step 2: Write the factories file**

Create `tests/utils/factories.ts`:

```ts
import type { Database } from '@/integrations/supabase/database.types';

type Tables = Database['public']['Tables'];

let idCounter = 1;
const uuid = () => `00000000-0000-0000-0000-${String(idCounter++).padStart(12, '0')}`;

export const makeUser = (overrides: Partial<{ id: string; email: string; name: string }> = {}) => ({
  id: overrides.id ?? uuid(),
  email: overrides.email ?? 'test@example.com',
  user_metadata: { name: overrides.name ?? 'Test User' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
});

export const makeAccount = (overrides: Partial<Tables['accounts']['Row']> = {}): Tables['accounts']['Row'] => ({
  id: uuid(),
  user_id: uuid(),
  family_id: null,
  nome: 'Conta Teste',
  tipo: 'corrente',
  saldo: 1000,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
} as Tables['accounts']['Row']);

export const makeTransaction = (overrides: Partial<Tables['transactions']['Row']> = {}): Tables['transactions']['Row'] => ({
  id: uuid(),
  user_id: uuid(),
  account_id: uuid(),
  categoria_id: uuid(),
  tipo: 'despesa',
  valor: 50,
  descricao: 'Teste',
  data: new Date().toISOString().slice(0, 10),
  created_at: new Date().toISOString(),
  ...overrides,
} as Tables['transactions']['Row']);

export const makeCategory = (overrides: Partial<Tables['categories']['Row']> = {}): Tables['categories']['Row'] => ({
  id: uuid(),
  user_id: uuid(),
  nome: 'Categoria Teste',
  tipo: 'despesa',
  cor: '#888',
  created_at: new Date().toISOString(),
  ...overrides,
} as Tables['categories']['Row']);

export const makeGoal = (overrides: Partial<Tables['goals']['Row']> = {}): Tables['goals']['Row'] => ({
  id: uuid(),
  user_id: uuid(),
  nome: 'Objetivo Teste',
  valor_objetivo: 1000,
  valor_atual: 0,
  prazo: null,
  account_id: uuid(),
  status: 'active',
  created_at: new Date().toISOString(),
  ...overrides,
} as Tables['goals']['Row']);

export const resetFactoryCounter = () => { idCounter = 1; };
```

**Note:** The exact column names (`nome` vs `name`, `valor_objetivo` vs `target_amount`, etc.) must match the current schema. Read `database.types.ts` before writing and adjust field names. If a column doesn't exist in the Row type, remove it. TypeScript errors will guide you — the `as Tables['...']['Row']` cast is intentional so you can iterate.

- [ ] **Step 3: Write a smoke test for the factories**

Create `tests/utils/factories.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { makeUser, makeAccount, makeTransaction, makeCategory, makeGoal, resetFactoryCounter } from './factories';

describe('test factories', () => {
  beforeEach(() => resetFactoryCounter());

  it('produces unique ids by default', () => {
    expect(makeAccount().id).not.toBe(makeAccount().id);
  });

  it('respects overrides', () => {
    expect(makeAccount({ nome: 'Custom' }).nome).toBe('Custom');
  });

  it('each entity factory returns an object with an id', () => {
    for (const fn of [makeUser, makeAccount, makeTransaction, makeCategory, makeGoal]) {
      expect(fn()).toHaveProperty('id');
    }
  });
});
```

- [ ] **Step 4: Run**

```bash
npm run test -- --run tests/utils/factories.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add tests/utils/factories.ts tests/utils/factories.test.ts
git commit -m "test: add entity factories for test data"
```

---

## Task 4: Create renderWithProviders helper

**Why this matters:** Component tests that touch React Query or routing need the same provider tree every time. One helper = zero duplication and a single place to update when providers evolve.

**Files:**
- Create: `tests/utils/renderWithProviders.tsx`

- [ ] **Step 1: Create the helper**

```tsx
import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

type ProviderOpts = {
  queryClient?: QueryClient;
  initialRoute?: string;
  wrapper?: (children: ReactNode) => ReactElement;
};

export function renderWithProviders(
  ui: ReactElement,
  { queryClient = makeQueryClient(), initialRoute = '/', wrapper, ...renderOptions }: ProviderOpts & Omit<RenderOptions, 'wrapper'> = {}
) {
  const Wrapper = ({ children }: { children: ReactNode }) => {
    const tree = (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
    return wrapper ? wrapper(tree) : tree;
  };
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
```

- [ ] **Step 2: Smoke test**

Create `tests/utils/renderWithProviders.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { renderWithProviders } from './renderWithProviders';

function Probe() {
  const { data } = useQuery({ queryKey: ['probe'], queryFn: () => 'hello' });
  const location = useLocation();
  return <div data-testid="probe">{data ?? 'loading'}-{location.pathname}</div>;
}

describe('renderWithProviders', () => {
  it('wires up react-query and router', async () => {
    renderWithProviders(<Probe />, { initialRoute: '/foo' });
    expect(await screen.findByTestId('probe')).toHaveTextContent('hello-/foo');
  });
});
```

- [ ] **Step 3: Run**

```bash
npm run test -- --run tests/utils/renderWithProviders.test.tsx
```

Expected: 1 passing.

- [ ] **Step 4: Commit**

```bash
git add tests/utils/renderWithProviders.tsx tests/utils/renderWithProviders.test.tsx
git commit -m "test: add renderWithProviders helper"
```

---

## Task 5: Validation schema tests (12 schemas)

**Why this matters:** Validation is the cheapest, highest-ROI test target — pure functions, no mocks, catches regressions immediately. Writing all 12 as one task is acceptable because each file is ~20 lines.

**Files:**
- Create: 12 test files in `src/validation/__tests__/` (names listed above in File Structure).

- [ ] **Step 1: Open each schema file first**

Before writing a test, read the corresponding `src/validation/<name>.ts`. Note:
- The exported schema name (some export `schemaName`, some `schemaNameSchema`).
- Required vs optional fields.
- Any `.refine(...)` / `.superRefine(...)` custom rules.
- Any transform steps.

- [ ] **Step 2: Use this template for each of the 12**

Template — adapt per schema:

```ts
import { describe, it, expect } from 'vitest';
import { accountSchema } from '../accountSchema'; // adjust import

describe('accountSchema', () => {
  const valid = {
    // fill with minimal valid payload from reading accountSchema.ts
  };

  it('accepts a valid payload', () => {
    expect(() => accountSchema.parse(valid)).not.toThrow();
  });

  it('rejects a payload missing a required field', () => {
    const { /* required field */: _, ...rest } = valid;
    const result = accountSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid field types', () => {
    const result = accountSchema.safeParse({ ...valid, /* field */: /* wrong type */ });
    expect(result.success).toBe(false);
  });

  // If there are custom .refine rules, add one test per rule verifying it fires.
});
```

Write **at minimum 3 tests per schema**: happy path, missing required, invalid type. Add one extra test per custom `refine` rule.

- [ ] **Step 3: Run per-file, then all together**

```bash
npm run test -- --run src/validation/__tests__/
```

Expected: ≥36 passing (12 schemas × 3 tests minimum).

- [ ] **Step 4: Commit**

```bash
git add src/validation/__tests__/
git commit -m "test: cover 12 validation schemas (happy path + error cases)"
```

---

## Task 6: Money/formatter utility tests

**Why this matters:** Currency formatting is used everywhere and is locale-sensitive — silent drift here ripples into every screen.

**Files:**
- Discover first: `rg -l "formatCurrency|formatMoney|formatEuro" src/` and `ls src/lib/` and `ls src/utils/` to find the real helper file(s).
- Create: `src/lib/__tests__/formatters.test.ts` (or adjust path to wherever the helpers actually live)

- [ ] **Step 1: Find the formatter helpers**

```bash
rg -l "formatCurrency|formatMoney|formatEuro|formatDate" src/
```

List the helper files. If there are multiple, write one test file per helper file, co-located in `__tests__/`. If you find zero, **skip this task** and record in the scratchpad.

- [ ] **Step 2: Write tests for each helper you found**

Example template for a `formatCurrency` helper:

```ts
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../formatters';

describe('formatCurrency', () => {
  it('formats an integer euro value', () => {
    expect(formatCurrency(1000)).toMatch(/1\.000,00\s*€/);
  });

  it('formats a decimal', () => {
    expect(formatCurrency(1234.56)).toMatch(/1\.234,56\s*€/);
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toMatch(/0,00\s*€/);
  });

  it('formats negative values', () => {
    expect(formatCurrency(-50)).toMatch(/-.*50,00\s*€/);
  });

  it('handles null/undefined gracefully', () => {
    // Adjust expectation to whatever the helper actually does — read it first
    expect(() => formatCurrency(null as unknown as number)).not.toThrow();
  });
});
```

Use `toMatch(/regex/)` instead of `.toBe('exact string')` because different Node/ICU versions emit different non-breaking space characters between number and `€`. This was the root cause of one of the 4 `.skip` tests.

- [ ] **Step 3: Run**

```bash
npm run test -- --run src/lib/__tests__/
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/__tests__/
git commit -m "test: cover currency/date formatters"
```

---

## Task 7: Adjust coverage thresholds to reality

**Why this matters:** `vitest.config.ts` currently declares global thresholds of `branches: 60, functions: 65, lines: 70, statements: 70`. After this plan Phase 1 we'll be far from those numbers and coverage reports will fail CI. Set honest targets now; raise them task-by-task in future phases.

**Files:**
- Modify: `tests/config/vitest.config.ts`

- [ ] **Step 1: Measure current coverage**

```bash
npm run test -- --run --coverage 2>&1 | tail -30
```

Write down the actual `All files` row numbers.

- [ ] **Step 2: Update thresholds**

Edit `tests/config/vitest.config.ts`. Replace the `thresholds` block with numbers **equal to current measured coverage, rounded down to the nearest 5%**. Example: if measured is 42% lines → threshold = 40%. This is the "ratchet" — from now on, coverage cannot go down.

Keep (or add) per-path overrides for `src/validation/**` (target: 90% lines now that it's fully tested):

```ts
thresholds: {
  global: {
    branches: <measured_branches - 5>,
    functions: <measured_functions - 5>,
    lines: <measured_lines - 5>,
    statements: <measured_statements - 5>
  },
  'src/validation/**': {
    branches: 80,
    functions: 90,
    lines: 90,
    statements: 90
  }
}
```

- [ ] **Step 3: Re-run coverage and verify no threshold failures**

```bash
npm run test -- --run --coverage 2>&1 | tail -10
```

Expected: exit code 0, no "coverage threshold" errors.

- [ ] **Step 4: Commit**

```bash
git add tests/config/vitest.config.ts
git commit -m "test: set honest coverage thresholds as a ratchet"
```

---

## Task 8: Update docs/TEST_COVERAGE.md

**Files:**
- Modify: `docs/TEST_COVERAGE.md`

- [ ] **Step 1: Replace the content with the current state**

Open the file and rewrite to reflect:
- What runners exist (vitest main + vitest integration + cypress + playwright)
- Where tests live (co-located in `src/` for unit; `tests/integration/` for DB-backed)
- Current coverage numbers (from Task 7 Step 1)
- Current ratchet thresholds
- What's deferred to future phases (Phase 2: component tests; Phase 3: re-enable the 7 DB-backed integration suites; Phase 4: E2E flows in Cypress)

Keep it ≤1 page. Don't include file-by-file tables — those rot instantly.

- [ ] **Step 2: Commit**

```bash
git add docs/TEST_COVERAGE.md
git commit -m "docs: refresh TEST_COVERAGE.md for rebuilt suite"
```

---

## Task 9: Final verification

- [ ] **Step 1: Full suite run**

```bash
npm run test -- --run 2>&1 | tail -10
```

Expected: all green, no failures. Record the final totals.

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -5
```

Expected: clean build.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```

(If no `typecheck` script exists, run `npx tsc --noEmit`.)

Expected: no errors.

- [ ] **Step 4: Push**

```bash
git push
```

---

## Out of scope for this plan (deferred phases)

- **Phase 2 — Component tests.** Use `renderWithProviders` from Task 4 to cover the critical screens: AccountForm, TransactionForm, GoalForm, BudgetForm, FamilyAccounts, CategoriesList. Target: 1–2 interaction tests per screen.
- **Phase 3 — Re-enable DB-backed integration suites.** The 7 `describe.skip` suites in `tests/integration/goals/` and `tests/integration/rls/` need a real Supabase instance. Options: (a) Supabase CLI local with seed, (b) dedicated test project. Decide and document before re-enabling.
- **Phase 4 — E2E flows.** Currently only `cypress/e2e/recurrents_smoke.cy.ts` exists. Add at least: login → create account → create transaction → check dashboard. Login → create goal → allocate → deallocate → delete.

Each deferred phase should have its own plan document when you start it.

---

## Conventions to preserve throughout

- **Commit after every task** (not every step). 9 commits total for this plan.
- **No snapshot tests** unless a component is purely presentational — snapshots rot and hide regressions in visual noise.
- **Don't mock what you're testing.** If you're testing `useAccountForm`, don't mock `useAccountForm` internals — mock the boundary (Supabase calls, Query hooks, `navigator.clipboard`, etc.).
- **`.skip` is a last resort.** If a test is broken, either fix it in the same task or delete it. Skipped tests rot.
- **No `console.log` in tests.** Use `screen.debug()` if you need to inspect DOM during development, then remove it before committing.
