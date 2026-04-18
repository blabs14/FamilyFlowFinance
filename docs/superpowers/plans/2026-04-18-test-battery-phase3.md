# Test Battery Rebuild — Phase 3 (DB Integration Tests)

> **For agentic workers:** This plan re-enables 7 `describe.skip` suites that need a real Supabase instance. Execute task-by-task. Commit after every task. Run `npm run test:integration` to verify each task.

**Goal:** Re-enable the 7 integration test suites that were skipped during the test triage. These tests run against the real Supabase project (`ebitcwrrcumsvqjgrapw`) using pre-created test users, service-role setup/teardown, and RLS validation. End state: all integration suites green, covering Goals RPCs, RLS enforcement for categories and transactions.

**Architecture:**
- Tests run via `npm run test:integration` → `vitest.integration.config.ts` (sequential, timeout 30s, loads `.env.local`).
- Setup/teardown uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.
- Tests execute as regular authenticated users (anon key + `signInWithPassword`) to exercise RLS.
- No local Supabase — runs against the remote project. `.env.local` must be present.

**Tech Stack:** Vitest 3.2, @supabase/supabase-js 2.52, real PostgreSQL 17 on Supabase.

---

## Context you need before starting

### What was skipped and why
All 7 suites have `describe.skip` added during a cleanup session because they required a real DB. None have code bugs — they just needed the right environment.

### Critical fact: `idempotent_ops` vs `idempotent_operations`
- `idempotent_operations` was **dropped** (had 2 test rows, no production use).
- `idempotent_ops` is a **different table** — it still exists and is used by `goal-delete-idempotency.spec.ts`. Do not confuse these.

### Test user pool
Tests authenticate as `test-user-1@familyflow.test` through `test-user-10@familyflow.test` (password: configurable, probably `teste14` from `.env.local` `VITE_TEST_PASSWORDS`).

These users must exist in Supabase Auth. Task 1 verifies and creates them if missing.

### The 7 suites (ordered by complexity — re-enable simplest first)

| Suite | Tests | Complexity |
|---|---|---|
| `rls/transactions-simple.spec.ts` | 4 | Low — basic CRUD, 1 user |
| `rls/categories.spec.ts` | 12 | Medium — 3 users, family, roles |
| `rls/transactions.spec.ts` | 8 | Medium — same setup as categories |
| `goal-completion-logic.spec.ts` | 1 | Medium — full goal lifecycle |
| `goal-canonical-functions.test.ts` | 3 | High — RPCs, multi-step |
| `goal-delete-100-multi-origins.spec.ts` | 1 | High — multi-account goal |
| `goal-delete-idempotency.spec.ts` | 1 | High — idempotency key, `idempotent_ops` |

### Environment variables needed
All should be present in `.env.local` already:
- `VITE_SUPABASE_URL` — project URL
- `VITE_SUPABASE_ANON_KEY` — for authenticated queries
- `VITE_SUPABASE_SERVICE_ROLE_KEY` — for setup/teardown bypass RLS
- `VITE_TEST_EMAIL` — fallback test email
- `VITE_TEST_PASSWORD` / `VITE_TEST_PASSWORDS` — pool passwords

---

## File Structure

No new files needed. Only modifications:

```
tests/integration/
  rls/
    transactions-simple.spec.ts   # MODIFY: remove describe.skip
    categories.spec.ts            # MODIFY: remove describe.skip
    transactions.spec.ts          # MODIFY: remove describe.skip
  goal-completion-logic.spec.ts   # MODIFY: remove describe.skip
  goals/
    goal-canonical-functions.test.ts       # MODIFY: remove describe.skip
    goal-delete-100-multi-origins.spec.ts  # MODIFY: remove describe.skip
    goal-delete-idempotency.spec.ts        # MODIFY: remove describe.skip

scripts/
  create-test-users.mjs           # CREATE: one-shot script to create test user pool
```

---

## Task 1: Verify prerequisites + create test user pool

**Why first:** Every subsequent task depends on authenticated test users existing. This task is safe to run multiple times — it only creates users that don't exist yet.

**Files:**
- Create: `scripts/create-test-users.mjs` (run once, then optionally delete)

- [ ] **Step 1: Check if test users already exist**

```bash
node -e "
import('@supabase/supabase-js').then(({ createClient }) => {
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
  sb.auth.admin.listUsers({ perPage: 100 }).then(({ data, error }) => {
    if (error) { console.error('ERROR:', error.message); process.exit(1); }
    const testUsers = data.users.filter(u => u.email?.includes('familyflow.test'));
    console.log('Test users found:', testUsers.map(u => u.email).join(', ') || '(none)');
  });
});
" VITE_SUPABASE_URL=$(grep VITE_SUPABASE_URL .env.local | head -1 | cut -d= -f2) VITE_SUPABASE_SERVICE_ROLE_KEY=$(grep VITE_SUPABASE_SERVICE_ROLE_KEY .env.local | head -1 | cut -d= -f2) node --input-type=module <<< "..."
```

If that's hard to run inline, use this simpler approach — create `scripts/create-test-users.mjs`:

```js
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const PASSWORD = 'TestUser123!';
const USERS = Array.from({ length: 10 }, (_, i) => `test-user-${i + 1}@familyflow.test`);

const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 200 });
const existingEmails = new Set(users.map(u => u.email));

for (const email of USERS) {
  if (existingEmails.has(email)) {
    console.log(`✓ already exists: ${email}`);
    continue;
  }
  const { error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) {
    console.error(`✗ failed: ${email} — ${error.message}`);
  } else {
    console.log(`+ created: ${email}`);
  }
}
console.log('Done.');
```

- [ ] **Step 2: Run the script**

```bash
node scripts/create-test-users.mjs
```

Expected: each user either `✓ already exists` or `+ created`. No errors.

- [ ] **Step 3: Read each integration spec to find the expected password**

```bash
grep -r "password\|Password\|PASSWORD" tests/integration/ | grep -v "node_modules" | head -20
```

Find the password string the tests use (likely `'TestUser123!'` or `process.env.VITE_TEST_PASSWORDS`). If different from `'TestUser123!'`, re-run the script with the correct password, or update the users in the Supabase dashboard.

- [ ] **Step 4: Verify connection**

```bash
npm run test:integration -- --reporter=basic 2>&1 | tail -10
```

Expected: the 4 existing non-skipped tests (`supabase-connection.spec.ts`, `simple-test.spec.ts`, etc.) pass. If they fail, fix the connection before proceeding.

- [ ] **Step 5: Commit the helper script**

```bash
git add scripts/create-test-users.mjs
git commit -m "test: add test user pool creation script"
```

---

## Task 2: Re-enable `rls/transactions-simple.spec.ts`

**Why start here:** 4 tests, simplest setup (single user, basic CRUD). A good first proof that the test infrastructure works.

**Files:**
- Modify: `tests/integration/rls/transactions-simple.spec.ts`

- [ ] **Step 1: Read the file**

```bash
cat tests/integration/rls/transactions-simple.spec.ts
```

Note the `describe.skip(` — usually on line 8 or similar. Note also how `beforeAll`/`afterAll` work.

- [ ] **Step 2: Remove the `.skip`**

Change `describe.skip(` → `describe(`. Do not change anything else.

- [ ] **Step 3: Run just this file**

```bash
npm run test:integration -- tests/integration/rls/transactions-simple.spec.ts 2>&1 | tail -15
```

Expected: 4 passing. If any fail:
- **Auth error** → test user doesn't exist or wrong password. Fix in Task 1 script.
- **RLS error (permission denied)** → RLS policy changed since test was written. Read the error carefully, check if our recent RLS migrations broke the expected behaviour. Fix the policy (not the test) if the policy is wrong; fix the test if the expectation was incorrect.
- **Table not found** → a table was renamed or dropped. Update the query.
- **Data cleanup issue** → `afterAll` didn't clean up from a previous run. Manually clean via Supabase dashboard or add a cleanup in `beforeAll`.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/rls/transactions-simple.spec.ts
git commit -m "test: re-enable rls/transactions-simple (4 tests)"
```

---

## Task 3: Re-enable `rls/categories.spec.ts`

**12 tests — admin/member/viewer roles.**

- [ ] **Step 1: Remove `.skip`**

```bash
# Edit the file to change describe.skip( → describe(
```

- [ ] **Step 2: Read the setup carefully**

```bash
cat tests/integration/rls/categories.spec.ts
```

Note how it sets up 3 users + a family with roles. If any of those test users don't exist, the `beforeAll` will fail. Our script in Task 1 creates `test-user-1` through `test-user-10` — verify the spec uses emails from that pool.

- [ ] **Step 3: Run**

```bash
npm run test:integration -- tests/integration/rls/categories.spec.ts 2>&1 | tail -20
```

Expected: 12 passing. Common failure modes same as Task 2 plus:
- **Family member setup fails** → check `families` + `family_members` tables exist and RLS allows service-role inserts.
- **Role enforcement wrong** → one of our recent RLS migrations (`20260418100000_*` etc.) might have changed the policy. Read the policy name from the error and check if it was intentionally changed.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/rls/categories.spec.ts
git commit -m "test: re-enable rls/categories (12 tests)"
```

---

## Task 4: Re-enable `rls/transactions.spec.ts`

**8 tests — same 3-user family setup, transactions table.**

Follow the exact same pattern as Task 3. Run, fix if needed, commit.

```bash
git add tests/integration/rls/transactions.spec.ts
git commit -m "test: re-enable rls/transactions (8 tests)"
```

---

## Task 5: Re-enable `goal-completion-logic.spec.ts`

**1 test — full goal lifecycle: create → deposit → reach 100% → verify status.**

- [ ] **Step 1: Remove `.skip` and read**

```bash
cat tests/integration/goal-completion-logic.spec.ts
```

This test likely:
1. Creates an account with balance X via service client.
2. Creates a goal with `valor_objetivo = X`.
3. Calls `allocate_to_goal_with_transaction` RPC.
4. Verifies goal status becomes `completed` or `100%`.
5. Cleans up.

- [ ] **Step 2: Run**

```bash
npm run test:integration -- tests/integration/goal-completion-logic.spec.ts 2>&1 | tail -20
```

Common failure:
- **RPC signature mismatch** → our migrations added parameters or changed the function. Read the exact RPC call in the test and compare to the current function signature (check the last migration that touched that function).
- **Goal progress view wrong** → check `goal_progress` view still exists and returns the expected columns.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/goal-completion-logic.spec.ts
git commit -m "test: re-enable goal-completion-logic (1 test)"
```

---

## Task 6: Re-enable `goals/goal-canonical-functions.test.ts`

**3 tests — allocate / deallocate / delete RPCs.**

This is the most comprehensive goal test: it exercises `allocate_to_goal_with_transaction`, `deallocate_from_goal_with_transaction`, and `delete_goal_with_restoration` in sequence.

- [ ] **Step 1: Remove `.skip` and read carefully**

```bash
cat tests/integration/goals/goal-canonical-functions.test.ts
```

Map each test to the RPC it calls. Note the expected side effects (account balance changes, transaction records created, goal status).

- [ ] **Step 2: Cross-check RPCs against current migrations**

The last migrations that touched these functions were in the `20260202*` series and `20260418120000_fix_search_path_rls_functions.sql`. The `search_path` change was cosmetic — function behaviour unchanged. But verify the function signatures match what the test expects:

```bash
grep "rpc\|from(" tests/integration/goals/goal-canonical-functions.test.ts | head -20
```

Compare each RPC call with the signature in `supabase/migrations/20260202000011_rewrite_fn_goal_allocate.sql` (and the equivalent files for deallocate/delete).

- [ ] **Step 3: Run**

```bash
npm run test:integration -- tests/integration/goals/goal-canonical-functions.test.ts 2>&1 | tail -25
```

- [ ] **Step 4: Commit**

```bash
git add tests/integration/goals/goal-canonical-functions.test.ts
git commit -m "test: re-enable goal-canonical-functions (3 tests)"
```

---

## Task 7: Re-enable `goals/goal-delete-100-multi-origins.spec.ts`

**1 test — delete a 100%-funded goal that was funded from 2 different accounts.**

The test verifies that when a goal is deleted, funds return to the correct source accounts without double-credit.

- [ ] **Step 1: Remove `.skip`**

- [ ] **Step 2: Run**

```bash
npm run test:integration -- tests/integration/goals/goal-delete-100-multi-origins.spec.ts 2>&1 | tail -20
```

Common failure: balance arithmetic changed in a recent migration. Compare actual vs expected balances and trace through `fn_goal_delete_with_correct_logic` in the last migration that defines it.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/goals/goal-delete-100-multi-origins.spec.ts
git commit -m "test: re-enable goal-delete-100-multi-origins (1 test)"
```

---

## Task 8: Re-enable `goals/goal-delete-idempotency.spec.ts`

**1 test — calling goal delete twice with same idempotency key produces the same result.**

⚠️ **Important note:** This spec queries `idempotent_ops` (not `idempotent_operations`). The `idempotent_ops` table **still exists** in the DB. The `idempotent_operations` table was a different table that was dropped. No action needed on the table — just remove the `.skip`.

- [ ] **Step 1: Verify `idempotent_ops` exists before running**

```bash
npx supabase@latest inspect db table-sizes --linked 2>/dev/null | grep idempotent || echo "check manually in dashboard"
```

Or simply note: we verified in the plan preparation that `idempotent_ops` exists. Proceed.

- [ ] **Step 2: Remove `.skip`**

- [ ] **Step 3: Run**

```bash
npm run test:integration -- tests/integration/goals/goal-delete-idempotency.spec.ts 2>&1 | tail -20
```

If it fails with `table "idempotent_ops" does not exist` — that would be a surprise (we checked). In that case, read the error and check the DB directly; don't guess.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/goals/goal-delete-idempotency.spec.ts
git commit -m "test: re-enable goal-delete-idempotency (1 test)"
```

---

## Task 9: Full integration run + push

- [ ] **Step 1: Run the full integration suite**

```bash
npm run test:integration 2>&1 | tail -15
```

Expected: all 30 tests (4 + 12 + 8 + 1 + 3 + 1 + 1 = 30 from skipped suites, plus the 4 trivial ones already active) passing. Zero failures. Some suites may still show `skipped` for the edge function tests — that's expected (they require a deployed edge function endpoint).

- [ ] **Step 2: Run the full unit suite too (to verify no regressions)**

```bash
npm run test -- --run --reporter=basic 2>&1 | tail -5
```

Expected: 449 passing (unchanged from Phase 2).

- [ ] **Step 3: Push**

```bash
git push
```

---

## If a test needs to be fixed (not just re-enabled)

Follow this decision tree for each failure:

1. **Auth / connection error** → environment issue. Fix `.env.local` or re-run `create-test-users.mjs`.
2. **Table/column not found** → schema changed. Update the test query to match current schema. If the column was intentionally removed, remove the assertion too.
3. **RPC not found or signature mismatch** → a migration changed the function. Update the RPC call in the test to match the current signature. **Don't change the function** — tests adapt to code, not the reverse.
4. **RLS denies when it shouldn't** → a policy we added/changed broke expected access. Check the migration and whether the policy change was intentional. If yes, update the test expectation. If no, fix the policy.
5. **Balance arithmetic wrong** → expected vs actual balance differs. Trace through the RPC SQL (read the migration file). If the function logic changed intentionally (it was a bug fix), update the expected values in the test.

**Do NOT `it.skip` new failures** without a `// TODO:` comment explaining what needs to change and why. A skip without explanation is technical debt — it's worse than no test.

---

## Out of scope (Phase 4)

- **E2E flows in Cypress:** Login → create account → create transaction → check dashboard. Goal create → allocate → deallocate → delete. Family invite → role change. Write a separate plan when ready.
- **Edge function tests (`export-payslips`):** These need a deployed edge function endpoint + access token. Already conditionally skipped. Activate when the function is stable.
