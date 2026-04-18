# Test Battery Rebuild — Phase 2 (Auth Forms, Critical Services, High-Value Components)

> **For agentic workers:** This plan is self-contained. Execute task-by-task. Steps use checkbox (`- [ ]`) syntax. Commit after every task. Run `npm run test -- --run <pattern>` to verify each task before committing.

**Goal:** Build on Phase 1 (390 unit tests green + factories + `renderWithProviders`) by covering the next highest-value targets: authentication forms, the `goals` service (no tests despite being the most-debugged feature), and a few user-critical forms. End state: ~450+ passing tests, auth flow covered, and a clear convention for future component tests.

**Architecture decisions (locked in by Phase 1):**
- Unit tests co-located in `src/**/__tests__/` or `tests/unit/`.
- Component tests in `tests/unit/components/`.
- Service tests in `tests/unit/services/`.
- Helpers: `tests/utils/factories.ts` and `tests/utils/renderWithProviders.tsx`.
- Global mocks for `supabaseClient` and `AuthContext` live in `tests/config/setup.ts`. Individual tests override via `vi.mock` when they need specific behaviour.

**Tech Stack:** Vitest 3.2, @testing-library/react 16.3, @testing-library/user-event 14.6, jsdom 26.

---

## Context you need before starting

### What already exists (from Phase 1 — do not duplicate)
- `tests/utils/factories.ts` — `makeUser`, `makeAccount`, `makeTransaction`, `makeCategory`, `makeGoal`, `resetFactoryCounter`
- `tests/utils/renderWithProviders.tsx` — wraps QueryClient + MemoryRouter; returns `{ queryClient, ...rtl }`
- Existing component tests (read these first for the current convention):
  - `tests/unit/components/BudgetForm.test.tsx`
  - `tests/unit/components/CategoryManagement.test.tsx`
  - `tests/unit/components/AccountForm.test.tsx`
  - `tests/unit/components/TransactionForm.test.tsx`
  - `tests/unit/components/GoalForm.test.tsx`

### Convention observed from those 5 existing tests
- They mock React Query hooks directly (`useBudgetsQuery`, etc.) instead of going through `renderWithProviders`. Keep doing this for form tests — it's the right choice when the form owns its own queries.
- They use `fireEvent` instead of `userEvent`. **Phase 2 switches to `userEvent`** because it simulates real interactions (focus events, debouncing, paste behaviour) that `fireEvent` misses. Don't retrofit existing tests — just use `userEvent` in new tests.
- Assertions: `screen.getByRole`, `getByLabelText`, `waitFor` for async. Keep this.

### Why `userEvent` over `fireEvent`
`fireEvent` dispatches synthetic events directly (skips browser-like sequencing). `userEvent` simulates what an actual user does (focus → keydown → input → keyup → change), which catches bugs like missing debounce handlers, onBlur validation, and pointer events. Modern RTL recommendation.

```ts
// fireEvent (old, Phase 1 pattern)
fireEvent.change(emailInput, { target: { value: 'a@b.c' } });
fireEvent.click(submitButton);

// userEvent (new, Phase 2 pattern)
const user = userEvent.setup();
await user.type(emailInput, 'a@b.c');
await user.click(submitButton);
```

### Components/services to cover in this plan

| Target | File | Why |
|---|---|---|
| LoginForm | `src/components/LoginForm.tsx` | Entry point — auth = highest security risk without tests |
| RegisterForm | `src/components/auth/RegisterForm.tsx` | Same as above + Zod validation |
| goals service | `src/services/goals.ts` | High complexity, no tests, recently debugged |
| FamilyInviteForm | `src/components/FamilyInviteForm.tsx` | Role/permission logic = security-adjacent |
| CreditCardForm | `src/components/CreditCardForm.tsx` | Had bugs fixed recently (commit `942bfa5`) |
| ReminderForm | `src/components/ReminderForm.tsx` | Establishes CRUD form pattern with recurrence |
| Dashboard page | `src/pages/Dashboard.tsx` | Smoke test — home page aggregates 6 queries |

### Out of scope (deferred to Phase 3/4)
- DB-backed integration tests (7 `describe.skip` suites in `tests/integration/`) → Phase 3
- E2E flows in Cypress → Phase 4
- Settings/Webhook/Notification/Profile forms — low traffic, can wait
- Hooks-level tests (`useBudgetsQuery`, etc.) — mocking React Query at that layer adds more friction than value; prefer testing at the form level

---

## File Structure

```
tests/
  unit/
    components/
      LoginForm.test.tsx            # CREATE
      RegisterForm.test.tsx         # CREATE
      FamilyInviteForm.test.tsx     # CREATE
      CreditCardForm.test.tsx       # CREATE
      ReminderForm.test.tsx         # CREATE
    services/
      goals.test.ts                 # CREATE
    pages/
      Dashboard.test.tsx            # CREATE

  utils/
    factories.ts                    # MODIFY: add makeBudget, makeReminder, makeFamilyMember
    testHelpers.ts                  # CREATE: shared userEvent + form helpers

tests/config/
  vitest.config.ts                  # MODIFY at the end: raise ratchet
docs/
  TEST_COVERAGE.md                  # MODIFY at the end
```

---

## Task 1: Extend factories and add userEvent helper

**Why:** Phase 1's factories covered 5 entities; we need 3 more (Budget, Reminder, FamilyMember) for Phase 2. A shared `testHelpers.ts` establishes the `userEvent.setup()` convention so every new test opens the same way.

**Files:**
- Modify: `tests/utils/factories.ts`
- Create: `tests/utils/testHelpers.ts`

- [ ] **Step 1: Read the current factories file**

```bash
cat tests/utils/factories.ts
```

Note the existing pattern (`const uuid = ...`, row types from `database.types.ts`). Match it exactly.

- [ ] **Step 2: Add three factories**

Append to `tests/utils/factories.ts`. Inspect `database.types.ts` for the exact column names — adjust below if needed:

```ts
export const makeBudget = (overrides: Partial<Tables['budgets']['Row']> = {}): Tables['budgets']['Row'] => ({
  id: uuid(),
  user_id: uuid(),
  categoria_id: uuid(),
  valor: 500,
  mes: new Date().toISOString().slice(0, 7), // YYYY-MM
  created_at: new Date().toISOString(),
  ...overrides,
} as Tables['budgets']['Row']);

export const makeReminder = (overrides: Partial<Tables['reminders']['Row']> = {}): Tables['reminders']['Row'] => ({
  id: uuid(),
  user_id: uuid(),
  titulo: 'Lembrete teste',
  descricao: null,
  data_lembrete: new Date().toISOString(),
  recorrencia: null,
  ativo: true,
  created_at: new Date().toISOString(),
  ...overrides,
} as Tables['reminders']['Row']);

export const makeFamilyMember = (overrides: Partial<Tables['family_members']['Row']> = {}): Tables['family_members']['Row'] => ({
  id: uuid(),
  family_id: uuid(),
  user_id: uuid(),
  role: 'member',
  joined_at: new Date().toISOString(),
  ...overrides,
} as Tables['family_members']['Row']);
```

- [ ] **Step 3: Create the userEvent helper**

Create `tests/utils/testHelpers.ts`:

```ts
import userEvent from '@testing-library/user-event';

/**
 * Always use this instead of calling userEvent.setup() inline.
 * Centralising means future changes (e.g. advance-timers) land in one place.
 */
export function setupUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

/** Fill multiple labelled inputs in one call. */
export async function fillForm(
  user: ReturnType<typeof setupUser>,
  fields: Record<string, string>,
  getByLabel: (label: string | RegExp) => HTMLElement
) {
  for (const [label, value] of Object.entries(fields)) {
    const el = getByLabel(new RegExp(label, 'i'));
    await user.clear(el);
    await user.type(el, value);
  }
}
```

(If `vi` isn't auto-imported, add `import { vi } from 'vitest';` at the top.)

- [ ] **Step 4: Smoke-test the helpers**

Extend `tests/utils/factories.test.ts` with three more cases:

```ts
import { makeBudget, makeReminder, makeFamilyMember } from './factories';

it('budget factory returns a budget-shaped object', () => {
  const b = makeBudget();
  expect(b).toHaveProperty('id');
  expect(b).toHaveProperty('valor');
});

it('reminder factory respects overrides', () => {
  expect(makeReminder({ titulo: 'X' }).titulo).toBe('X');
});

it('family member factory defaults role to member', () => {
  expect(makeFamilyMember().role).toBe('member');
});
```

- [ ] **Step 5: Run**

```bash
npm run test -- --run tests/utils/
```

Expected: 6+ passing (3 original + 3 new).

- [ ] **Step 6: Commit**

```bash
git add tests/utils/factories.ts tests/utils/factories.test.ts tests/utils/testHelpers.ts
git commit -m "test: extend factories + add userEvent helper"
```

---

## Task 2: LoginForm component tests

**Why:** Auth forms are the single highest-risk surface in any app. If registration or login is broken, everything downstream is broken.

**Files:**
- Create: `tests/unit/components/LoginForm.test.tsx`

- [ ] **Step 1: Read LoginForm source**

```bash
cat src/components/LoginForm.tsx
```

Note:
- What props does it accept? (onSuccess callback? redirect route?)
- What hook does it use for login? (`useAuth().login`? A custom hook?)
- What validation does it do? (Zod? inline?)
- Are there SSO buttons (Google)?
- What happens on error? (toast? inline error?)

- [ ] **Step 2: Write the test file**

Create `tests/unit/components/LoginForm.test.tsx`. Template:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { setupUser } from '@/../tests/utils/testHelpers';
import LoginForm from '@/components/LoginForm';

// Mock the auth hook that LoginForm uses. Read the source first to get the exact path.
const loginMock = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: loginMock,
    register: vi.fn(),
    resetPassword: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it('renders email and password inputs and submit button', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/palavra-passe|password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar|login|sign in/i })).toBeInTheDocument();
  });

  it('shows validation error when submitting empty form', async () => {
    const user = setupUser();
    render(<LoginForm />);
    await user.click(screen.getByRole('button', { name: /entrar|login|sign in/i }));
    // At least one validation message should appear. Adjust to match the real error text.
    expect(await screen.findByText(/obrigatório|required|inválido/i)).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('calls login with email and password on valid submit', async () => {
    const user = setupUser();
    loginMock.mockResolvedValue({ error: null });
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/palavra-passe|password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /entrar|login|sign in/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('user@example.com', 'secret123');
    });
  });

  it('displays an error message when login fails', async () => {
    const user = setupUser();
    loginMock.mockResolvedValue({ error: { message: 'Invalid credentials' } });
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/palavra-passe|password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /entrar|login|sign in/i }));

    expect(await screen.findByText(/invalid|erro|incorret/i)).toBeInTheDocument();
  });

  it('disables submit button while login is pending', async () => {
    const user = setupUser();
    let resolveLogin!: (v: { error: null }) => void;
    loginMock.mockReturnValue(new Promise(r => (resolveLogin = r)));
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/palavra-passe|password/i), 'secret');
    const btn = screen.getByRole('button', { name: /entrar|login|sign in/i });
    await user.click(btn);

    expect(btn).toBeDisabled();
    resolveLogin({ error: null });
  });
});
```

**Important:** Adjust label matchers to the actual labels in LoginForm.tsx. If the form uses `<Label htmlFor="email">Email</Label>`, `getByLabelText(/email/i)` works. If it uses `<Input placeholder="Email" />` without a label, use `getByPlaceholderText` or `getByRole('textbox', { name: /email/i })`.

- [ ] **Step 3: Run**

```bash
npm run test -- --run tests/unit/components/LoginForm.test.tsx
```

Iterate until 5/5 pass. Don't soften assertions to make them pass — if an assertion is wrong, update it to match actual behaviour, but the real behaviour must be correct.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/components/LoginForm.test.tsx
git commit -m "test: cover LoginForm (5 tests)"
```

---

## Task 3: RegisterForm component tests

**Why:** Same as LoginForm. Plus: the registration schema uses Zod, so we get validation surface coverage for free.

**Files:**
- Create: `tests/unit/components/RegisterForm.test.tsx`

- [ ] **Step 1: Read the source**

```bash
cat src/components/auth/RegisterForm.tsx
```

Note the schema it uses (`src/validation/signupSchema.ts` if it exists, or inline Zod) and what fields are required: name? email? password? confirm password?

- [ ] **Step 2: Write tests**

Follow the LoginForm pattern. Cover at minimum:

1. All inputs render.
2. Empty submit → validation errors.
3. Password mismatch → validation error.
4. Weak password (if schema enforces) → error.
5. Valid submit calls `register(email, password, name)`.
6. Supabase "already registered" error surfaces inline.

Use the same `vi.mock('@/contexts/AuthContext', ...)` pattern, intercepting `register` instead of `login`.

- [ ] **Step 3: Run**

```bash
npm run test -- --run tests/unit/components/RegisterForm.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add tests/unit/components/RegisterForm.test.tsx
git commit -m "test: cover RegisterForm (6 tests)"
```

---

## Task 4: goals service unit tests

**Why:** `src/services/goals.ts` is the most-debugged file in the project (see last 5 commits on main before this plan). It has zero unit tests. This is where a regression would hurt most.

**Files:**
- Create: `tests/unit/services/goals.test.ts`

- [ ] **Step 1: Map the surface area**

```bash
cat src/services/goals.ts
```

List every exported function. For each, note:
- Signature (inputs, return).
- Supabase calls it makes (`.from('goals').select(...)`, `.rpc('fn_goal_...', ...)`).
- Whether it returns rows or void.

- [ ] **Step 2: Build a Supabase mock that covers the shape**

Because the service uses method-chaining (`supabase.from(X).select().eq().single()`), a full mock is tedious. Use this per-test pattern:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeGoal, resetFactoryCounter } from '@/../tests/utils/factories';

const fromMock = vi.fn();
const rpcMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabaseClient: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

// Helper to build a chain-friendly "from" result.
function mockFrom({ data = null, error = null }: { data?: unknown; error?: unknown } = {}) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve),
  };
  return chain;
}

beforeEach(() => {
  resetFactoryCounter();
  fromMock.mockReset();
  rpcMock.mockReset();
});
```

- [ ] **Step 3: Write at minimum 2 tests per exported function**

Happy path + error path. Example for `getGoalsByUser`:

```ts
import { getGoalsByUser } from '@/services/goals'; // adjust to real export name

describe('goals service — getGoalsByUser', () => {
  it('returns goals for the user', async () => {
    const goals = [makeGoal(), makeGoal()];
    fromMock.mockReturnValueOnce(mockFrom({ data: goals }));

    const result = await getGoalsByUser('user-id');

    expect(fromMock).toHaveBeenCalledWith('goals');
    expect(result).toEqual(goals);
  });

  it('propagates Supabase errors', async () => {
    fromMock.mockReturnValueOnce(mockFrom({ error: { message: 'db down' } }));
    await expect(getGoalsByUser('user-id')).rejects.toThrow(/db down/);
  });
});
```

Repeat for every exported function. For RPC-based functions (`allocate_to_goal_with_transaction`, `fn_goal_deallocate`, `fn_goal_delete_with_correct_logic`), assert `rpcMock` was called with the right function name and payload:

```ts
rpcMock.mockResolvedValueOnce({ data: null, error: null });
await allocateToGoal({ goal_id: 'g1', account_id: 'a1', amount: 100, user_id: 'u1' });
expect(rpcMock).toHaveBeenCalledWith('allocate_to_goal_with_transaction', expect.objectContaining({
  goal_id_param: 'g1',
  amount_param: 100,
}));
```

Target: **≥12 tests total** covering the 6+ exports.

- [ ] **Step 4: Run**

```bash
npm run test -- --run tests/unit/services/goals.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/services/goals.test.ts
git commit -m "test: cover goals service (happy + error paths)"
```

---

## Task 5: FamilyInviteForm component tests

**Why:** Family invites touch role assignment (owner/admin/member/viewer). A regression here = privilege escalation risk.

**Files:**
- Create: `tests/unit/components/FamilyInviteForm.test.tsx`

- [ ] **Step 1: Read the source**

```bash
cat src/components/FamilyInviteForm.tsx
```

Note: email input? role dropdown with which options? Does the submit go through a mutation hook?

- [ ] **Step 2: Write ≥5 tests**

1. Renders email input + role selector.
2. Empty submit → validation error.
3. Invalid email format → validation error.
4. Valid submit calls the invite mutation with `{ email, role }`.
5. Role defaults to `member` (or whatever the actual default is).
6. Each role option from the dropdown can be selected.

Use the `vi.mock` pattern from Task 2. Mock the invite hook (probably `useInviteFamilyMember` or similar — read the import).

- [ ] **Step 3: Run + commit**

```bash
npm run test -- --run tests/unit/components/FamilyInviteForm.test.tsx
git add tests/unit/components/FamilyInviteForm.test.tsx
git commit -m "test: cover FamilyInviteForm (6 tests)"
```

---

## Task 6: CreditCardForm component tests

**Why:** Commit `942bfa5` on main fixed bugs in credit card creation and transfers. Test coverage here prevents regression.

**Files:**
- Create: `tests/unit/components/CreditCardForm.test.tsx`

- [ ] **Step 1: Read the source + the bug-fix commit**

```bash
cat src/components/CreditCardForm.tsx
git show 942bfa5 -- src/components/CreditCardForm.tsx | head -80
```

Understand what was broken. Write tests that would have caught those bugs.

- [ ] **Step 2: Write ≥6 tests**

Cover:
1. Renders all inputs (name, credit limit, current balance, etc.).
2. Required field validation.
3. Numeric validation (no letters in balance).
4. Submit creates a card with the right payload.
5. Edit mode populates inputs with existing values.
6. The specific behaviour that was fixed in `942bfa5` — whatever that is (read the commit).

- [ ] **Step 3: Run + commit**

```bash
npm run test -- --run tests/unit/components/CreditCardForm.test.tsx
git add tests/unit/components/CreditCardForm.test.tsx
git commit -m "test: cover CreditCardForm including regression guard for 942bfa5"
```

---

## Task 7: ReminderForm component tests

**Why:** Reminders have recurrence logic (daily/weekly/monthly). Establishes how we test forms with conditional fields.

**Files:**
- Create: `tests/unit/components/ReminderForm.test.tsx`

- [ ] **Step 1: Read the source**

```bash
cat src/components/ReminderForm.tsx
```

- [ ] **Step 2: Write ≥5 tests**

Cover:
1. Renders title, description, date, recurrence toggle.
2. Empty submit → validation.
3. Recurrence toggle reveals the recurrence-type dropdown.
4. Valid submit calls create mutation with the right payload (including `recorrencia: null` when toggle is off, or the selected type when on).
5. Edit mode populates from an existing reminder (use `makeReminder` factory).

- [ ] **Step 3: Run + commit**

```bash
npm run test -- --run tests/unit/components/ReminderForm.test.tsx
git add tests/unit/components/ReminderForm.test.tsx
git commit -m "test: cover ReminderForm with recurrence cases"
```

---

## Task 8: Dashboard page smoke test

**Why:** Dashboard aggregates 6 queries (accounts, transactions, goals, reminders, budgets, dashboard data). A smoke test here catches routing/provider regressions.

**Files:**
- Create: `tests/unit/pages/Dashboard.test.tsx`

- [ ] **Step 1: Read the page**

```bash
cat src/pages/Dashboard.tsx
```

- [ ] **Step 2: Write 3 tests using `renderWithProviders`**

This is the first test in the codebase to use `renderWithProviders` for a page-level test. Pattern:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/../tests/utils/renderWithProviders';
import Dashboard from '@/pages/Dashboard';
import { makeAccount, makeTransaction, makeGoal } from '@/../tests/utils/factories';

// Mock every query hook the page uses. Read imports in Dashboard.tsx to find the exact list.
vi.mock('@/hooks/useAccountsQuery', () => ({
  useAccountsWithBalances: () => ({ data: [makeAccount({ saldo: 1500 })], isLoading: false, error: null }),
}));
vi.mock('@/hooks/useTransactionsQuery', () => ({
  useTransactions: () => ({ data: [makeTransaction()], isLoading: false, error: null }),
}));
vi.mock('@/hooks/useGoalsQuery', () => ({
  useGoals: () => ({ data: [makeGoal()], isLoading: false, error: null }),
}));
// ...repeat for useRemindersQuery, useBudgetsQuery, useDashboardQuery

describe('Dashboard page', () => {
  it('renders without crashing with data available', () => {
    renderWithProviders(<Dashboard />);
    // At least the page title or some identifiable element:
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('shows a loading state when queries are pending', () => {
    // Override one of the mocks to return isLoading: true
    vi.doMock('@/hooks/useAccountsQuery', () => ({
      useAccountsWithBalances: () => ({ data: undefined, isLoading: true, error: null }),
    }));
    renderWithProviders(<Dashboard />);
    expect(screen.getByRole('status') || screen.getByText(/carregando|loading/i)).toBeInTheDocument();
  });

  it('renders account balance from mocked data', () => {
    renderWithProviders(<Dashboard />);
    // Adjust matcher to real formatter output (locale-aware, with nbsp):
    expect(screen.getByText(/1\.500|1500/)).toBeInTheDocument();
  });
});
```

If a mock can't be overridden cleanly with `vi.doMock`, split that case into a separate test file where the top-level mock returns the loading state.

- [ ] **Step 3: Run + commit**

```bash
npm run test -- --run tests/unit/pages/Dashboard.test.tsx
git add tests/unit/pages/Dashboard.test.tsx
git commit -m "test: add Dashboard page smoke test (3 tests)"
```

---

## Task 9: Ratchet coverage and update docs

**Why:** After adding ~30 new tests, coverage will be higher. Lock it in.

**Files:**
- Modify: `tests/config/vitest.config.ts`
- Modify: `docs/TEST_COVERAGE.md`

- [ ] **Step 1: Measure new coverage**

```bash
npm run test -- --run --coverage 2>&1 | tail -20
```

Write down the `All files` numbers.

- [ ] **Step 2: Update `thresholds.global` to the measured values minus 3%**

(Using `-3%` instead of `-5%` this time — we're building a stricter ratchet as coverage grows.)

Also add or update per-path overrides:

```ts
thresholds: {
  global: { /* measured - 3% */ },
  'src/validation/**': { branches: 80, functions: 90, lines: 90, statements: 90 },
  'src/services/**': { branches: 50, functions: 60, lines: 60, statements: 60 }, // new
  'src/components/LoginForm.tsx': { lines: 80, functions: 80 },     // new
  'src/components/auth/RegisterForm.tsx': { lines: 80, functions: 80 }, // new
}
```

- [ ] **Step 3: Verify no threshold failures**

```bash
npm run test -- --run --coverage 2>&1 | tail -10
```

- [ ] **Step 4: Update `docs/TEST_COVERAGE.md`**

Add a Phase 2 section:
- What it added (list of new test files + count).
- New total: X test files, Y tests passing.
- What's now covered that wasn't before: auth forms, goals service, family invite, credit cards, reminders, dashboard smoke.
- What's still deferred: Phase 3 (DB integration), Phase 4 (E2E).

- [ ] **Step 5: Commit**

```bash
git add tests/config/vitest.config.ts docs/TEST_COVERAGE.md
git commit -m "test: ratchet coverage + document Phase 2"
```

---

## Task 10: Final verification + push

- [ ] **Step 1: Full suite**

```bash
npm run test -- --run --reporter=basic 2>&1 | tail -5
```

Expected: **≥420 passing** (390 from Phase 1 + ~30 new), zero failures.

- [ ] **Step 2: Typecheck + build**

```bash
npm run typecheck && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Push**

```bash
git push
```

---

## Conventions for this plan

- **New tests use `userEvent`**, not `fireEvent`. Don't retrofit existing tests — just establish the new convention.
- **Use factories**: `makeAccount`, `makeGoal`, etc. No inline ad-hoc test objects for entity rows.
- **Mock at the right layer**: for form tests, mock the React Query mutation hook or the AuthContext — don't mock Supabase directly. For service tests, mock Supabase directly. For page-level smoke tests, mock every query hook the page uses.
- **Don't soften failing assertions** — if a test fails, understand why before changing the expectation.
- **One commit per task.** 9 commits total.

---

## Out of scope for Phase 2 (noted for future plans)

- **Phase 3 — DB integration.** Re-enable the 7 `describe.skip` suites in `tests/integration/goals/` and `tests/integration/rls/`. Requires a real Supabase instance (local or test project) + seed strategy.
- **Phase 4 — E2E.** Expand `cypress/e2e/` beyond the single `recurrents_smoke.cy.ts`. Target flows: login → create account → create transaction; goal create → allocate → deallocate → delete; family invite → role change.
- **Remaining low-traffic forms**: Settings, Webhook, Notification, Profile, FixedExpenses, RegularAccount. Can be batched into a Phase 2b when someone touches them.
- **Hooks-level tests**: `useAccountsQuery`, `useBudgetsQuery`, etc. Only worth testing directly if they contain non-trivial logic beyond the default React Query call. Most don't — skip.
