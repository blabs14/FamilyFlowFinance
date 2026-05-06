# Unit 11 — Payroll Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing payroll calculator into an integrated system that calculates IRS via progressive DB brackets and atomically posts payslips as income transactions.

**Architecture:** Hybrid DB/TypeScript — four SECURITY DEFINER RPCs (`calculate_payslip`, `create_payslip_draft`, `post_payslip`, `save_payroll_contract`) own all financial logic and atomicity; TypeScript handles UI state, React Query caching, and formatting only. Goal funding fires automatically via the existing `trg_goal_funding_on_transaction` trigger when the salary transaction is inserted.

**Tech Stack:** Supabase (PostgreSQL RPCs, RLS), React, TypeScript, React Query v5, Vitest + @testing-library/react, Tailwind CSS, shadcn/ui components.

**Spec:** `docs/superpowers/specs/2026-05-05-unit-11-payroll-core-design.md`

---

## File Structure

```
supabase/migrations/
  20260505000001_unit11_tax_tables.sql          CREATE — tax_tables versioning + 2026 seed
  20260505000002_unit11_payroll_contracts.sql   ALTER — add account_id, status columns
  20260505000003_unit11_payroll_payslips.sql    ALTER — extend payroll_payslips for integration
  20260505000004_unit11_rpcs.sql               CREATE — calculate_payslip, create_payslip_draft,
                                                         post_payslip, save_payroll_contract

src/features/payroll/
  types/
    payroll-core.types.ts                       CREATE — Unit 11 types (separate from index.ts)
  services/
    payrollCalculator.ts                        CREATE — pure formatting helpers (replaces calc.ts logic)
    payrollService.ts                           MODIFY — add calculatePayslip, createPayslipDraft,
                                                         postPayslip, savePayrollContractCore,
                                                         getPostedPayslips
    __tests__/
      payrollCalculator.test.ts                 CREATE — unit tests for formatting helpers
      payrollCoreService.test.ts               CREATE — mocked tests for new service methods
  hooks/
    usePayslipCalculation.ts                    CREATE — React Query hook wrapping calculate_payslip
    usePayslips.ts                              CREATE — React Query hook for posted payslips list
  components/
    PayslipPreview.tsx                          CREATE — period picker + simulation + posting UI
    PayslipHistory.tsx                          CREATE — paginated list of posted payslips
    PayrollContractForm.tsx                     MODIFY — add account_id selector (account where salary lands)
    PayrollModule.tsx                           MODIFY — add /recibos route + family-scope banner
    __tests__/
      PayslipPreview.test.tsx                   CREATE — state machine + posting flow tests
```

**Files NOT touching:**
- `src/features/payroll/lib/calc.ts` — kept as-is (existing OT/hour calculations; deprecated for IRS)
- `src/features/payroll/lib/calc.test.ts` — not touched
- All existing pages/components not listed above

---

## Task 1: Migration — tax_tables versioning + 2026 brackets

**Files:**
- Create: `supabase/migrations/20260505000001_unit11_tax_tables.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260505000001_unit11_tax_tables.sql
-- CREATE tax_tables (does not exist yet) and seed 2026 IRS progressive brackets.
-- Despacho 233-A/2026: rates in basis points (1000 bp = 10%)
-- min/max in cents (annual income)

SET search_path = public;

CREATE TABLE IF NOT EXISTS public.tax_tables (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_year  int  NOT NULL DEFAULT 2026,
  min_annual_cents bigint NOT NULL,
  max_annual_cents bigint NOT NULL,
  marginal_rate_bp int    NOT NULL,  -- basis points: 1300 = 13%
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_tables ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated users (data is not user-specific)
DROP POLICY IF EXISTS sel_tax_tables ON public.tax_tables;
CREATE POLICY sel_tax_tables ON public.tax_tables
  FOR SELECT TO authenticated USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS tax_tables_year_bracket_idx
  ON public.tax_tables(effective_year, min_annual_cents);

-- Seed 2026 brackets (only if not already present)
INSERT INTO public.tax_tables (effective_year, min_annual_cents, max_annual_cents, marginal_rate_bp)
SELECT * FROM (VALUES
  (2026,        0,   770300, 1300),
  (2026,   770300,  1162300, 1650),
  (2026,  1162300,  1647200, 2200),
  (2026,  1647200,  2132100, 2500),
  (2026,  2132100,  2714600, 3200),
  (2026,  2714600,  3979100, 3550),
  (2026,  3979100,  5199700, 4350),
  (2026,  5199700,  8119900, 4500),
  (2026,  8119900, 2147483647, 4800)
) AS t(effective_year, min_annual_cents, max_annual_cents, marginal_rate_bp)
ON CONFLICT ON CONSTRAINT tax_tables_year_bracket_idx DO NOTHING;
```

> **Note:** `tax_tables` is created by this migration — it does not exist beforehand. Column names used throughout are `min_annual_cents`, `max_annual_cents`, `marginal_rate_bp`. All RPCs in later tasks use these same names.

- [ ] **Step 2: Apply migration via Supabase CLI (local) or verify manually**

```bash
# If using Supabase local dev:
npx supabase db push

# Or verify via Supabase Studio / SQL editor:
# SELECT * FROM tax_tables WHERE effective_year = 2026 ORDER BY min_annual_cents;
# Expected: 9 rows
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260505000001_unit11_tax_tables.sql
git commit -m "feat(payroll): add tax_tables effective_year + seed 2026 IRS brackets"
```

---

## Task 2: Migration — payroll_contracts extensions

**Files:**
- Create: `supabase/migrations/20260505000002_unit11_payroll_contracts.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260505000002_unit11_payroll_contracts.sql
-- Extend payroll_contracts with:
--   account_id: which bank account receives the net salary
--   status: 'active'|'inactive' (replaces is_active boolean pattern)
-- Contract versioning: UNIQUE partial index ensures max 1 active per user.

SET search_path = public;

-- Add account_id (nullable: existing contracts have no account configured)
ALTER TABLE public.payroll_contracts
  ADD COLUMN IF NOT EXISTS account_id uuid
    REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Add status column
ALTER TABLE public.payroll_contracts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive'));

-- Migrate existing is_active → status
UPDATE public.payroll_contracts
  SET status = CASE WHEN COALESCE(is_active, true) THEN 'active' ELSE 'inactive' END
  WHERE status = 'active';  -- only touch rows not yet migrated

-- Unique partial index: max 1 active contract per user
CREATE UNIQUE INDEX IF NOT EXISTS payroll_contracts_one_active_per_user_idx
  ON public.payroll_contracts(user_id)
  WHERE status = 'active';
```

- [ ] **Step 2: Apply and verify**

```sql
-- Verify in Supabase Studio:
SELECT id, user_id, name, is_active, status, account_id
  FROM payroll_contracts LIMIT 5;
-- Expected: status column populated, account_id is NULL for existing rows
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260505000002_unit11_payroll_contracts.sql
git commit -m "feat(payroll): extend payroll_contracts with account_id and status"
```

---

## Task 3: Migration — payroll_payslips extensions

**Files:**
- Create: `supabase/migrations/20260505000003_unit11_payroll_payslips.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260505000003_unit11_payroll_payslips.sql
-- Extend payroll_payslips for the Unit 11 integrated posting flow.
-- The existing table keeps all legacy columns intact.
-- period_id becomes nullable (new payslips use period text directly).
-- New columns: contract_id, period, status, transaction_id, working_days, components.

SET search_path = public;

-- Make period_id nullable (new payslips bypass payroll_periods)
ALTER TABLE public.payroll_payslips
  ALTER COLUMN period_id DROP NOT NULL;

-- New columns
ALTER TABLE public.payroll_payslips
  ADD COLUMN IF NOT EXISTS contract_id uuid
    REFERENCES public.payroll_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS period text,                   -- 'YYYY-MM'
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'posted', 'void')),
  ADD COLUMN IF NOT EXISTS transaction_id uuid
    REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS irs_cents bigint,              -- alias of irs_deduction_cents
  ADD COLUMN IF NOT EXISTS ss_cents bigint,               -- alias of ss_deduction_cents
  ADD COLUMN IF NOT EXISTS working_days integer,
  ADD COLUMN IF NOT EXISTS components jsonb;              -- breakdown array for display

-- Idempotency: 1 draft/posted payslip per contract per period
CREATE UNIQUE INDEX IF NOT EXISTS payroll_payslips_unique_contract_period_idx
  ON public.payroll_payslips(contract_id, period)
  WHERE contract_id IS NOT NULL AND period IS NOT NULL;
```

- [ ] **Step 2: Apply and verify**

```sql
-- Verify new columns exist:
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'payroll_payslips'
  ORDER BY ordinal_position;
-- Expected: period, status, contract_id, transaction_id, irs_cents, ss_cents,
--           working_days, components all present
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260505000003_unit11_payroll_payslips.sql
git commit -m "feat(payroll): extend payroll_payslips with Unit 11 integration columns"
```

---

## Task 4: Migration — calculate_payslip RPC

**Files:**
- Create: `supabase/migrations/20260505000004_unit11_rpc_calculate.sql`

- [ ] **Step 1: Create the migration file**

The function is read-only (no side-effects). Returns jsonb with gross, irs, ss, meal, net, working_days, components.

```sql
-- supabase/migrations/20260505000004_unit11_rpc_calculate.sql
SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.calculate_payslip(
  p_contract_id uuid,
  p_period      text   -- 'YYYY-MM'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract        record;
  v_meal_config     record;
  v_gross_annual    bigint;
  v_min_existencia  bigint := 1288000;  -- €12 880 × 100
  v_irs_annual      bigint := 0;
  v_taxable_annual  bigint;
  v_ss_cents        bigint;
  v_meal_cap        integer;
  v_meal_cents      bigint;
  v_net_cents       bigint;
  v_working_days    integer;
  v_period_start    date;
  v_period_end      date;
  v_bracket         record;
  v_components      jsonb := '[]'::jsonb;
BEGIN
  -- Ownership check
  SELECT * INTO v_contract
    FROM public.payroll_contracts
    WHERE id = p_contract_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONTRACT_NOT_FOUND';
  END IF;

  -- Period bounds
  v_period_start := to_date(p_period || '-01', 'YYYY-MM-DD');
  v_period_end   := (date_trunc('month', v_period_start) + INTERVAL '1 month - 1 day')::date;

  -- Working days = Mon–Fri in calendar month minus user holidays in period
  SELECT COUNT(*)::integer INTO v_working_days
    FROM generate_series(v_period_start, v_period_end, INTERVAL '1 day') AS d
    WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5
      AND NOT EXISTS (
        SELECT 1 FROM public.payroll_holidays h
        WHERE h.user_id = auth.uid()
          AND h.date = d::date
      );

  -- Meal allowance config
  SELECT * INTO v_meal_config
    FROM public.payroll_meal_allowance_configs
    WHERE contract_id = p_contract_id
    LIMIT 1;

  v_meal_cap := CASE
    WHEN v_meal_config.payment_method = 'card' THEN 1046  -- €10.46
    ELSE 615                                               -- €6.15 (default cash)
  END;
  v_meal_cents := v_working_days * LEAST(COALESCE(v_meal_config.daily_amount_cents, 0), v_meal_cap);

  -- IRS progressive brackets (projected annual income)
  v_gross_annual := v_contract.base_salary_cents * 12;

  IF v_gross_annual <= v_min_existencia THEN
    v_irs_annual := 0;
  ELSE
    v_taxable_annual := v_gross_annual;
    FOR v_bracket IN
      SELECT min_annual_cents, max_annual_cents, marginal_rate_bp
        FROM public.tax_tables
        WHERE effective_year = EXTRACT(YEAR FROM v_period_start)::int
        ORDER BY min_annual_cents ASC
    LOOP
      IF v_taxable_annual <= v_bracket.min_annual_cents THEN EXIT; END IF;
      v_irs_annual := v_irs_annual
        + (LEAST(v_taxable_annual, v_bracket.max_annual_cents) - v_bracket.min_annual_cents)
          * v_bracket.marginal_rate_bp / 10000;
    END LOOP;
  END IF;

  -- SS: 11% of gross
  v_ss_cents := ROUND(v_contract.base_salary_cents * 0.11)::bigint;

  -- Net
  v_net_cents := v_contract.base_salary_cents
    - ROUND(v_irs_annual / 12.0)::bigint
    - v_ss_cents
    + v_meal_cents;

  -- Components array for display
  v_components := jsonb_build_array(
    jsonb_build_object('label', 'Vencimento Base',      'amount_cents', v_contract.base_salary_cents, 'sign', '+'),
    jsonb_build_object('label', 'IRS (retenção)',       'amount_cents', ROUND(v_irs_annual/12.0)::bigint, 'sign', '-'),
    jsonb_build_object('label', 'Segurança Social (11%)', 'amount_cents', v_ss_cents, 'sign', '-'),
    jsonb_build_object('label', 'Subsídio de Refeição', 'amount_cents', v_meal_cents, 'sign', '+')
  );

  RETURN jsonb_build_object(
    'gross_cents',  v_contract.base_salary_cents,
    'irs_cents',    ROUND(v_irs_annual / 12.0)::bigint,
    'ss_cents',     v_ss_cents,
    'meal_cents',   v_meal_cents,
    'net_cents',    v_net_cents,
    'working_days', v_working_days,
    'components',   v_components
  );
END;
$$;

-- Grant to authenticated users (SECURITY DEFINER enforces ownership inside)
GRANT EXECUTE ON FUNCTION public.calculate_payslip(uuid, text) TO authenticated;
```

> **Note:** Column names (`min_annual_cents`, `max_annual_cents`, `marginal_rate_bp`) match exactly what Task 1 creates and seeds. No adjustment needed.

- [ ] **Step 2: Apply and smoke-test**

Run in Supabase Studio SQL editor (replace `<your-contract-id>` with a real contract UUID for a user that's logged in, or test via a direct `SET LOCAL role = ...` if using the Supabase service role):

```sql
-- Quick structure check (run as service role):
SELECT proname FROM pg_proc WHERE proname = 'calculate_payslip';
-- Expected: 1 row
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260505000004_unit11_rpc_calculate.sql
git commit -m "feat(payroll): add calculate_payslip RPC (read-only IRS simulation)"
```

---

## Task 5: Migration — post_payslip, save_payroll_contract, create_payslip_draft RPCs

**Files:**
- Create: `supabase/migrations/20260505000005_unit11_rpc_post_save.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260505000005_unit11_rpc_post_save.sql
SET search_path = public, pg_temp;

-- ─────────────────────────────────────────────
-- RPC: save_payroll_contract
-- Soft-replaces the active contract for the user.
-- Validates account ownership before insert.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_payroll_contract(
  p_name                 text,
  p_base_salary_cents    integer,
  p_weekly_hours         numeric,
  p_schedule_json        jsonb,
  p_vacation_bonus_mode  text,
  p_christmas_bonus_mode text,
  p_account_id           uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_id uuid;
BEGIN
  -- Verify account belongs to the calling user
  PERFORM 1 FROM public.accounts
    WHERE id = p_account_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND';
  END IF;

  -- Soft-replace: deactivate current active contract
  UPDATE public.payroll_contracts
    SET status    = 'inactive',
        is_active = false,
        updated_at = now()
    WHERE user_id = auth.uid() AND status = 'active';

  -- Insert new active contract
  INSERT INTO public.payroll_contracts (
    user_id, name, base_salary_cents, weekly_hours,
    schedule_json, vacation_bonus_mode, christmas_bonus_mode,
    account_id, status, is_active, currency, auto_deductions_enabled
  ) VALUES (
    auth.uid(), p_name, p_base_salary_cents, p_weekly_hours,
    p_schedule_json, p_vacation_bonus_mode, p_christmas_bonus_mode,
    p_account_id, 'active', true, 'EUR', false
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_payroll_contract(text,integer,numeric,jsonb,text,text,uuid) TO authenticated;

-- ─────────────────────────────────────────────
-- RPC: create_payslip_draft
-- Idempotent: returns existing draft id if already exists for period.
-- Calls calculate_payslip internally and stores snapshot.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_payslip_draft(
  p_contract_id uuid,
  p_period      text   -- 'YYYY-MM'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_calc    jsonb;
  v_slip_id uuid;
BEGIN
  -- Ownership check
  PERFORM 1 FROM public.payroll_contracts
    WHERE id = p_contract_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTRACT_NOT_FOUND'; END IF;

  -- Idempotency: return existing if already exists
  SELECT id INTO v_slip_id
    FROM public.payroll_payslips
    WHERE contract_id = p_contract_id AND period = p_period;
  IF FOUND THEN RETURN v_slip_id; END IF;

  -- Calculate components
  v_calc := public.calculate_payslip(p_contract_id, p_period);

  -- Insert draft (write both legacy and alias columns for compatibility)
  INSERT INTO public.payroll_payslips (
    user_id, contract_id, period, status,
    gross_cents,
    irs_deduction_cents, irs_cents,
    ss_deduction_cents,  ss_cents,
    meal_allowance_cents,
    net_cents, working_days, components
  ) VALUES (
    auth.uid(), p_contract_id, p_period, 'draft',
    (v_calc->>'gross_cents')::bigint,
    (v_calc->>'irs_cents')::bigint, (v_calc->>'irs_cents')::bigint,
    (v_calc->>'ss_cents')::bigint,  (v_calc->>'ss_cents')::bigint,
    (v_calc->>'meal_cents')::bigint,
    (v_calc->>'net_cents')::bigint,
    (v_calc->>'working_days')::integer,
    v_calc->'components'
  )
  RETURNING id INTO v_slip_id;

  RETURN v_slip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_payslip_draft(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────
-- RPC: post_payslip
-- Atomically: inserts income transaction → marks payslip posted.
-- Goal funding fires automatically via trg_goal_funding_on_transaction.
-- Idempotent: if already posted, returns existing transaction_id.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_payslip(
  p_payslip_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payslip         record;
  v_cat_id          uuid;
  v_tx_id           uuid;
BEGIN
  -- Load payslip + contract (verify ownership via contract)
  SELECT
    ps.id,
    ps.status,
    ps.transaction_id,
    ps.net_cents,
    ps.period,
    pc.account_id AS contract_account_id,
    pc.user_id    AS contract_user_id
  INTO v_payslip
    FROM public.payroll_payslips ps
    JOIN public.payroll_contracts pc ON pc.id = ps.contract_id
    WHERE ps.id = p_payslip_id
      AND pc.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYSLIP_NOT_FOUND';
  END IF;

  -- Idempotency: already posted → return existing
  IF v_payslip.status = 'posted' THEN
    RETURN jsonb_build_object('transaction_id', v_payslip.transaction_id, 'idempotent', true);
  END IF;

  IF v_payslip.status = 'void' THEN
    RAISE EXCEPTION 'PAYSLIP_VOID';
  END IF;

  -- Account configured?
  IF v_payslip.contract_account_id IS NULL THEN
    RAISE EXCEPTION 'NO_ACCOUNT_CONFIGURED';
  END IF;

  -- Resolve (or create) 'Salário' category
  v_cat_id := public.ensure_category_for_user(auth.uid(), 'Salário', '#4CAF50');

  -- Insert income transaction
  -- trg_goal_funding_on_transaction fires automatically on INSERT
  INSERT INTO public.transactions (
    user_id,
    account_id,
    categoria_id,
    amount_cents,
    tipo,
    data,
    descricao,
    currency,
    family_id
  ) VALUES (
    auth.uid(),
    v_payslip.contract_account_id,
    v_cat_id,
    v_payslip.net_cents,
    'receita',
    to_date(v_payslip.period || '-01', 'YYYY-MM-DD'),
    'Ordenado líquido ' || v_payslip.period,
    'EUR',
    NULL
  )
  RETURNING id INTO v_tx_id;

  -- Mark payslip as posted
  UPDATE public.payroll_payslips
    SET status         = 'posted',
        transaction_id = v_tx_id,
        updated_at     = now()
    WHERE id = p_payslip_id;

  RETURN jsonb_build_object('transaction_id', v_tx_id, 'idempotent', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_payslip(uuid) TO authenticated;
```

- [ ] **Step 2: Verify all 3 RPCs exist**

```sql
SELECT proname FROM pg_proc
  WHERE proname IN ('save_payroll_contract', 'create_payslip_draft', 'post_payslip');
-- Expected: 3 rows
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260505000005_unit11_rpc_post_save.sql
git commit -m "feat(payroll): add post_payslip, save_payroll_contract, create_payslip_draft RPCs"
```

---

## Task 6: TypeScript types + payrollCalculator.ts (TDD)

**Files:**
- Create: `src/features/payroll/types/payroll-core.types.ts`
- Create: `src/features/payroll/services/payrollCalculator.ts`
- Create: `src/features/payroll/services/__tests__/payrollCalculator.test.ts`

- [ ] **Step 1: Write the failing tests first**

```typescript
// src/features/payroll/services/__tests__/payrollCalculator.test.ts
import { describe, it, expect } from 'vitest';
import {
  formatCents,
  periodLabel,
  currentPeriod,
  availablePeriods,
  enrichComponents,
} from '../payrollCalculator';

describe('formatCents', () => {
  it('formats 92000 cents as Portuguese currency', () => {
    const result = formatCents(92000);
    expect(result).toContain('920');
    expect(result).toContain('€');
  });

  it('formats 0 cents', () => {
    const result = formatCents(0);
    expect(result).toContain('0');
    expect(result).toContain('€');
  });

  it('formats negative cents (absolute value)', () => {
    const result = formatCents(150000);
    expect(result).toContain('1');
    expect(result).toContain('500');
  });
});

describe('periodLabel', () => {
  it('converts YYYY-MM to Portuguese month label', () => {
    const result = periodLabel('2026-05');
    expect(result.toLowerCase()).toContain('maio');
    expect(result).toContain('2026');
  });

  it('handles January', () => {
    const result = periodLabel('2026-01');
    expect(result.toLowerCase()).toContain('janeiro');
  });
});

describe('currentPeriod', () => {
  it('returns YYYY-MM format', () => {
    const result = currentPeriod();
    expect(result).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('availablePeriods', () => {
  it('returns monthsBack+1 periods', () => {
    expect(availablePeriods(12)).toHaveLength(13);
  });

  it('first element is current period', () => {
    expect(availablePeriods(12)[0]).toBe(currentPeriod());
  });

  it('periods are in descending order', () => {
    const periods = availablePeriods(3);
    expect(periods[0] >= periods[1]).toBe(true);
    expect(periods[1] >= periods[2]).toBe(true);
  });
});

describe('enrichComponents', () => {
  it('marks deductions correctly', () => {
    const components = [
      { label: 'Salário', amount_cents: 150000, sign: '+' as const },
      { label: 'IRS', amount_cents: 25808, sign: '-' as const },
    ];
    const enriched = enrichComponents(components);
    expect(enriched[0].isDeduction).toBe(false);
    expect(enriched[1].isDeduction).toBe(true);
  });

  it('formats amount_cents as currency string', () => {
    const components = [{ label: 'Salário', amount_cents: 150000, sign: '+' as const }];
    const enriched = enrichComponents(components);
    expect(enriched[0].formatted).toContain('€');
    expect(enriched[0].formatted).toContain('1');
    expect(enriched[0].formatted).toContain('500');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
npx vitest run src/features/payroll/services/__tests__/payrollCalculator.test.ts
```

Expected: `Cannot find module '../payrollCalculator'`

- [ ] **Step 3: Create the types file**

```typescript
// src/features/payroll/types/payroll-core.types.ts

export type PayslipStatus = 'draft' | 'posted' | 'void';

export interface PayslipComponent {
  label: string;
  amount_cents: number;
  sign: '+' | '-';
}

export interface PayslipCalculation {
  gross_cents: number;
  irs_cents: number;
  ss_cents: number;
  meal_cents: number;
  net_cents: number;
  working_days: number;
  components: PayslipComponent[];
}

export interface PayslipRecord {
  id: string;
  contractId: string;
  period: string;            // 'YYYY-MM'
  status: PayslipStatus;
  transactionId: string | null;
  gross_cents: number;
  irs_cents: number;
  ss_cents: number;
  meal_cents: number;
  net_cents: number;
  working_days: number;
  components: PayslipComponent[];
  createdAt: string;
}

export interface ActiveContractCore {
  id: string;
  name: string;
  base_salary_cents: number;
  account_id: string | null;
  status: string;
  vacation_bonus_mode: string;
  christmas_bonus_mode: string;
}
```

- [ ] **Step 4: Implement payrollCalculator.ts**

```typescript
// src/features/payroll/services/payrollCalculator.ts
// Pure formatting helpers — NO business logic, NO supabase calls.
// IRS calculation lives exclusively in the calculate_payslip DB RPC.

import type { PayslipComponent } from '../types/payroll-core.types';

export const formatCents = (cents: number): string =>
  (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

export const periodLabel = (period: string): string => {
  const [year, month] = period.split('-');
  return new Date(+year, +month - 1).toLocaleString('pt-PT', {
    month: 'long',
    year: 'numeric',
  });
};

export const currentPeriod = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/** Returns periods from current month going back monthsBack months, descending. */
export const availablePeriods = (monthsBack = 12): string[] => {
  const periods: string[] = [];
  const now = new Date();
  for (let i = 0; i <= monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return periods;
};

export interface EnrichedComponent extends PayslipComponent {
  formatted: string;
  isDeduction: boolean;
}

export const enrichComponents = (components: PayslipComponent[]): EnrichedComponent[] =>
  components.map(c => ({
    ...c,
    formatted: formatCents(Math.abs(c.amount_cents)),
    isDeduction: c.sign === '-',
  }));
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx vitest run src/features/payroll/services/__tests__/payrollCalculator.test.ts
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/features/payroll/types/payroll-core.types.ts \
        src/features/payroll/services/payrollCalculator.ts \
        src/features/payroll/services/__tests__/payrollCalculator.test.ts
git commit -m "feat(payroll): add payroll-core types and payrollCalculator formatting helpers"
```

---

## Task 7: Service layer — new RPC methods in payrollService.ts

**Files:**
- Modify: `src/features/payroll/services/payrollService.ts` (append at end of file)
- Create: `src/features/payroll/services/__tests__/payrollCoreService.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/features/payroll/services/__tests__/payrollCoreService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before any imports
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabaseClient';
import {
  calculatePayslip,
  createPayslipDraft,
  postPayslip,
  savePayrollContractCore,
  getPostedPayslips,
} from '../payrollService';

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;
const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('calculatePayslip', () => {
  it('calls calculate_payslip RPC with correct params', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { gross_cents: 150000, irs_cents: 25808, ss_cents: 16500, meal_cents: 9840, net_cents: 117532, working_days: 16, components: [] },
      error: null,
    });

    const result = await calculatePayslip('contract-123', '2026-05');

    expect(mockRpc).toHaveBeenCalledWith('calculate_payslip', {
      p_contract_id: 'contract-123',
      p_period: '2026-05',
    });
    expect(result.gross_cents).toBe(150000);
    expect(result.net_cents).toBe(117532);
  });

  it('throws when RPC returns error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'CONTRACT_NOT_FOUND' } });
    await expect(calculatePayslip('bad-id', '2026-05')).rejects.toBeTruthy();
  });
});

describe('postPayslip', () => {
  it('calls post_payslip RPC and returns transaction_id', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { transaction_id: 'tx-abc', idempotent: false },
      error: null,
    });

    const result = await postPayslip('slip-123');

    expect(mockRpc).toHaveBeenCalledWith('post_payslip', { p_payslip_id: 'slip-123' });
    expect(result.transaction_id).toBe('tx-abc');
    expect(result.idempotent).toBe(false);
  });
});

describe('createPayslipDraft', () => {
  it('calls create_payslip_draft and returns payslip id', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'payslip-uuid-1', error: null });

    const id = await createPayslipDraft('contract-123', '2026-05');

    expect(mockRpc).toHaveBeenCalledWith('create_payslip_draft', {
      p_contract_id: 'contract-123',
      p_period: '2026-05',
    });
    expect(id).toBe('payslip-uuid-1');
  });
});

describe('getPostedPayslips', () => {
  it('queries payroll_payslips filtered by contract and status=posted', async () => {
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(mockChain);

    const result = await getPostedPayslips('contract-123');

    expect(mockFrom).toHaveBeenCalledWith('payroll_payslips');
    expect(mockChain.eq).toHaveBeenCalledWith('contract_id', 'contract-123');
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (functions not exported)**

```bash
npx vitest run src/features/payroll/services/__tests__/payrollCoreService.test.ts
```

Expected: `is not a function` or similar

- [ ] **Step 3: Append new methods to payrollService.ts**

Open `src/features/payroll/services/payrollService.ts`:
1. Add this import at the **very top** of the file (after existing imports):
```typescript
import type { PayslipCalculation, PayslipRecord } from '../types/payroll-core.types';
```
2. Then append the following at the **very end** of the file:

```typescript
// ─────────────────────────────────────────────────────────────────
// Unit 11 — Payroll Core: RPC-backed methods
// ─────────────────────────────────────────────────────────────────

export const calculatePayslip = async (
  contractId: string,
  period: string,
): Promise<PayslipCalculation> => {
  const { data, error } = await supabase.rpc('calculate_payslip', {
    p_contract_id: contractId,
    p_period: period,
  });
  if (error) throw error;
  return data as PayslipCalculation;
};

export const createPayslipDraft = async (
  contractId: string,
  period: string,
): Promise<string> => {
  const { data, error } = await supabase.rpc('create_payslip_draft', {
    p_contract_id: contractId,
    p_period: period,
  });
  if (error) throw error;
  return data as string;
};

export const postPayslip = async (
  payslipId: string,
): Promise<{ transaction_id: string; idempotent: boolean }> => {
  const { data, error } = await supabase.rpc('post_payslip', {
    p_payslip_id: payslipId,
  });
  if (error) throw error;
  // RPC returns snake_case — do NOT rename to camelCase here
  return data as { transaction_id: string; idempotent: boolean };
};

export const savePayrollContractCore = async (params: {
  name: string;
  baseSalaryCents: number;
  weeklyHours: number;
  scheduleJson: Record<string, unknown>;
  vacationBonusMode: string;
  christmasBonusMode: string;
  accountId: string;
}): Promise<string> => {
  const { data, error } = await supabase.rpc('save_payroll_contract', {
    p_name:                  params.name,
    p_base_salary_cents:     params.baseSalaryCents,
    p_weekly_hours:          params.weeklyHours,
    p_schedule_json:         params.scheduleJson,
    p_vacation_bonus_mode:   params.vacationBonusMode,
    p_christmas_bonus_mode:  params.christmasBonusMode,
    p_account_id:            params.accountId,
  });
  if (error) throw error;
  return data as string;
};

export const getPostedPayslips = async (contractId: string): Promise<PayslipRecord[]> => {
  const { data, error } = await supabase
    .from('payroll_payslips')
    .select(
      'id, contract_id, period, status, transaction_id, gross_cents, irs_cents, ss_cents, meal_allowance_cents, net_cents, working_days, components, created_at',
    )
    .eq('contract_id', contractId)
    .in('status', ['posted'])
    .order('period', { ascending: false });

  if (error) throw error;

  return (data ?? []).map(r => ({
    id: r.id,
    contractId: r.contract_id,
    period: r.period ?? '',
    status: (r.status ?? 'draft') as PayslipRecord['status'],
    transactionId: r.transaction_id ?? null,
    gross_cents:   r.gross_cents   ?? 0,
    irs_cents:     r.irs_cents     ?? 0,
    ss_cents:      r.ss_cents      ?? 0,
    meal_cents:    r.meal_allowance_cents ?? 0,
    net_cents:     r.net_cents     ?? 0,
    working_days:  r.working_days  ?? 0,
    components:    (r.components   ?? []) as PayslipRecord['components'],
    createdAt:     r.created_at    ?? '',
  }));
};
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/features/payroll/services/__tests__/payrollCoreService.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/features/payroll/services/payrollService.ts \
        src/features/payroll/services/__tests__/payrollCoreService.test.ts
git commit -m "feat(payroll): add Unit 11 service methods (calculatePayslip, postPayslip, etc.)"
```

---

## Task 8: React Query hooks — usePayslipCalculation + usePayslips

**Files:**
- Create: `src/features/payroll/hooks/usePayslipCalculation.ts`
- Create: `src/features/payroll/hooks/usePayslips.ts`

- [ ] **Step 1: Create usePayslipCalculation.ts**

```typescript
// src/features/payroll/hooks/usePayslipCalculation.ts
import { useQuery } from '@tanstack/react-query';
import { calculatePayslip } from '../services/payrollService';
import type { PayslipCalculation } from '../types/payroll-core.types';

export const usePayslipCalculation = (
  contractId: string | null | undefined,
  period: string,
) => {
  return useQuery<PayslipCalculation, Error>({
    queryKey: ['payslip-calculation', contractId, period],
    queryFn: () => calculatePayslip(contractId!, period),
    enabled: !!contractId && !!period,
    staleTime: 5 * 60 * 1000,  // 5 minutes — calculation rarely changes
    retry: false,               // don't retry on CONTRACT_NOT_FOUND
  });
};
```

- [ ] **Step 2: Create usePayslips.ts**

```typescript
// src/features/payroll/hooks/usePayslips.ts
import { useQuery } from '@tanstack/react-query';
import { getPostedPayslips } from '../services/payrollService';
import type { PayslipRecord } from '../types/payroll-core.types';

export const usePayslips = (contractId: string | null | undefined) => {
  return useQuery<PayslipRecord[], Error>({
    queryKey: ['payroll-payslips', contractId],
    queryFn: () => getPostedPayslips(contractId!),
    enabled: !!contractId,
    staleTime: 30 * 1000,  // 30 seconds
  });
};
```

- [ ] **Step 3: Run full test suite to check no regressions**

```bash
npx vitest run src/features/payroll
```

Expected: all existing tests pass + new tests pass

- [ ] **Step 4: Commit**

```bash
git add src/features/payroll/hooks/usePayslipCalculation.ts \
        src/features/payroll/hooks/usePayslips.ts
git commit -m "feat(payroll): add usePayslipCalculation and usePayslips React Query hooks"
```

---

## Task 9: PayrollContractForm — add account_id selector

**Files:**
- Modify: `src/features/payroll/components/PayrollContractForm.tsx`

The goal is to add an account dropdown so the user can specify where the net salary lands. This form currently calls `payrollService.saveContract` — we'll add a save path using `savePayrollContractCore` for the Unit 11 integrated flow.

- [ ] **Step 1: Add account query and selector to the form**

At the top of `PayrollContractForm.tsx`, add the account data fetch. Find the existing imports and add:

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { savePayrollContractCore } from '../services/payrollService';
```

Inside the component, add the accounts query (after existing hooks):

```typescript
// Fetch user's personal accounts for salary destination selector
const { data: accounts = [] } = useQuery({
  queryKey: ['accounts-for-payroll'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('accounts')
      .select('id, nome, tipo')
      .is('family_id', null)    // personal accounts only
      .order('nome');
    if (error) throw error;
    return data ?? [];
  },
});
```

Add `accountId` to the form state:

```typescript
const [accountId, setAccountId] = useState<string>(contract?.account_id ?? '');
```

Add the account selector in the JSX (after the existing salary input, before the submit button):

```tsx
<div className="space-y-2">
  <Label htmlFor="accountId">Conta para receber o salário líquido</Label>
  <Select value={accountId} onValueChange={setAccountId}>
    <SelectTrigger id="accountId">
      <SelectValue placeholder="Selecionar conta..." />
    </SelectTrigger>
    <SelectContent>
      {accounts.map(acc => (
        <SelectItem key={acc.id} value={acc.id}>
          {acc.nome} <span className="text-muted-foreground ml-1">({acc.tipo})</span>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  {!accountId && (
    <p className="text-sm text-muted-foreground">
      Necessário para lançar recibos de vencimento.
    </p>
  )}
</div>
```

Update the submit handler to call `savePayrollContractCore` when `accountId` is set:

```typescript
// In the existing handleSubmit (or onSubmit), add a new code path:
if (accountId) {
  try {
    const newContractId = await savePayrollContractCore({
      name: formData.name,
      baseSalaryCents: formData.base_salary_cents,
      weeklyHours: formData.weekly_hours,
      scheduleJson: formData.schedule_json,
      vacationBonusMode: formData.vacation_bonus_mode,
      christmasBonusMode: formData.christmas_bonus_mode,
      accountId,
    });
    toast({ title: 'Contrato guardado', description: 'Contrato activo actualizado.' });
    queryClient.invalidateQueries({ queryKey: ['payroll-payslips'] });
    queryClient.invalidateQueries({ queryKey: ['payroll-contracts'] });
    // call onSave if exists
    onSave?.({ ...formData, id: newContractId } as any);
    return;
  } catch (err: any) {
    toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    return;
  }
}
// existing save path continues below for backward compat
```

Also add `useQueryClient` import:
```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
// ...
const queryClient = useQueryClient();
```

- [ ] **Step 2: Build check**

```bash
npx vite build --mode development 2>&1 | tail -5
```

Expected: `built in X.XXs` (no TypeScript errors)

- [ ] **Step 3: Commit**

```bash
git add src/features/payroll/components/PayrollContractForm.tsx
git commit -m "feat(payroll): add account selector to PayrollContractForm for salary deposit"
```

---

## Task 10: PayslipPreview component (TDD)

**Files:**
- Create: `src/features/payroll/components/PayslipPreview.tsx`
- Create: `src/features/payroll/components/__tests__/PayslipPreview.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// src/features/payroll/components/__tests__/PayslipPreview.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));

vi.mock('../../services/payrollService', () => ({
  calculatePayslip: vi.fn(),
  createPayslipDraft: vi.fn(),
  postPayslip: vi.fn(),
  getPostedPayslips: vi.fn(),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

import { calculatePayslip, createPayslipDraft, postPayslip, getPostedPayslips } from '../../services/payrollService';
import PayslipPreview from '../PayslipPreview';

const mockCalc = vi.mocked(calculatePayslip);
const mockDraft = vi.mocked(createPayslipDraft);
const mockPost = vi.mocked(postPayslip);
const mockHistory = vi.mocked(getPostedPayslips);

const makeQC = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const mockCalculation = {
  gross_cents: 150000,
  irs_cents: 25808,
  ss_cents: 16500,
  meal_cents: 9840,
  net_cents: 117532,
  working_days: 16,
  components: [
    { label: 'Vencimento Base', amount_cents: 150000, sign: '+' as const },
    { label: 'IRS (retenção)', amount_cents: 25808, sign: '-' as const },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockHistory.mockResolvedValue([]);
});

const renderComponent = (contractId = 'contract-1', period = '2026-05') => {
  const qc = makeQC();
  return render(
    <QueryClientProvider client={qc}>
      <PayslipPreview contractId={contractId} defaultPeriod={period} />
    </QueryClientProvider>,
  );
};

describe('PayslipPreview', () => {
  it('shows loading skeleton while calculating', async () => {
    mockCalc.mockReturnValue(new Promise(() => {})); // never resolves
    renderComponent();
    expect(screen.getByTestId('payslip-skeleton')).toBeTruthy();
  });

  it('displays calculated values when ready', async () => {
    mockCalc.mockResolvedValue(mockCalculation);
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/Vencimento Base/i)).toBeTruthy();
    });
    expect(screen.getByText(/Lançar Recibo/i)).toBeTruthy();
  });

  it('disables Lançar button when period is already posted', async () => {
    mockCalc.mockResolvedValue(mockCalculation);
    mockHistory.mockResolvedValue([{
      id: 'slip-1', contractId: 'contract-1', period: '2026-05',
      status: 'posted', transactionId: 'tx-1',
      gross_cents: 150000, irs_cents: 25808, ss_cents: 16500,
      meal_cents: 9840, net_cents: 117532, working_days: 16,
      components: [], createdAt: '2026-05-01',
    }]);
    renderComponent();
    await waitFor(() => {
      const btn = screen.queryByRole('button', { name: /Lançar Recibo/i });
      expect(btn).toBeNull(); // button not rendered for already-posted periods
    });
    expect(screen.getByText(/já lançado/i)).toBeTruthy();
  });

  it('calls createPayslipDraft then postPayslip on Lançar click', async () => {
    mockCalc.mockResolvedValue(mockCalculation);
    mockDraft.mockResolvedValue('payslip-uuid-1');
    mockPost.mockResolvedValue({ transaction_id: 'tx-new', idempotent: false });

    renderComponent();
    await waitFor(() => screen.getByText(/Lançar Recibo/i));

    fireEvent.click(screen.getByText(/Lançar Recibo/i));

    await waitFor(() => {
      expect(mockDraft).toHaveBeenCalledWith('contract-1', '2026-05');
      expect(mockPost).toHaveBeenCalledWith('payslip-uuid-1');
    });
  });

  it('shows error toast when postPayslip fails', async () => {
    // mockToast is declared at module level (hoisted via vi.mock factory)
    mockToast.mockClear();

    mockCalc.mockResolvedValue(mockCalculation);
    mockDraft.mockResolvedValue('payslip-uuid-1');
    mockPost.mockRejectedValue(new Error('NO_ACCOUNT_CONFIGURED'));

    renderComponent();
    await waitFor(() => screen.getByText(/Lançar Recibo/i));
    fireEvent.click(screen.getByText(/Lançar Recibo/i));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' }),
      );
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/features/payroll/components/__tests__/PayslipPreview.test.tsx
```

Expected: `Cannot find module '../PayslipPreview'`

- [ ] **Step 3: Implement PayslipPreview.tsx**

```tsx
// src/features/payroll/components/PayslipPreview.tsx
import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { usePayslipCalculation } from '../hooks/usePayslipCalculation';
import { usePayslips } from '../hooks/usePayslips';
import { createPayslipDraft, postPayslip } from '../services/payrollService';
import {
  formatCents,
  periodLabel,
  currentPeriod,
  availablePeriods,
  enrichComponents,
} from '../services/payrollCalculator';

interface PayslipPreviewProps {
  contractId: string;
  defaultPeriod?: string;
}

type PostingState = 'idle' | 'posting' | 'done' | 'error';

export default function PayslipPreview({ contractId, defaultPeriod }: PayslipPreviewProps) {
  const [period, setPeriod] = useState(defaultPeriod ?? currentPeriod());
  const [postingState, setPostingState] = useState<PostingState>('idle');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const periods = useMemo(() => availablePeriods(12), []);

  const { data: calculation, isLoading, error } = usePayslipCalculation(contractId, period);
  const { data: payslips = [] } = usePayslips(contractId);

  const isAlreadyPosted = useMemo(
    () => payslips.some(p => p.period === period && p.status === 'posted'),
    [payslips, period],
  );

  const postedRecord = useMemo(
    () => payslips.find(p => p.period === period && p.status === 'posted'),
    [payslips, period],
  );

  const handlePost = async () => {
    if (!calculation) return;
    setPostingState('posting');
    try {
      const payslipId = await createPayslipDraft(contractId, period);
      await postPayslip(payslipId);
      queryClient.invalidateQueries({ queryKey: ['payroll-payslips', contractId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      setPostingState('done');
      toast({ title: 'Recibo lançado', description: `Ordenado líquido de ${periodLabel(period)} registado.` });
    } catch (err: any) {
      setPostingState('error');
      toast({
        title: 'Erro ao lançar recibo',
        description: err?.message ?? 'Erro inesperado',
        variant: 'destructive',
      });
    }
  };

  const enriched = calculation ? enrichComponents(calculation.components) : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Recibo de Vencimento</CardTitle>
        <Select value={period} onValueChange={p => { setPeriod(p); setPostingState('idle'); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map(p => (
              <SelectItem key={p} value={p}>{periodLabel(p)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div data-testid="payslip-skeleton" className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-8 bg-muted animate-pulse rounded" />
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">Erro ao calcular: {error.message}</p>
        )}

        {!isLoading && calculation && (
          <>
            {/* Components table */}
            <div className="divide-y text-sm">
              {enriched.map((c, i) => (
                <div key={i} className="flex justify-between py-2">
                  <span className={c.isDeduction ? 'text-destructive' : ''}>{c.label}</span>
                  <span className={`font-mono ${c.isDeduction ? 'text-destructive' : 'text-green-600'}`}>
                    {c.sign === '-' ? '−' : '+'} {c.formatted}
                  </span>
                </div>
              ))}
            </div>

            {/* Net total */}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Líquido a receber</span>
              <span className="text-green-700 font-mono text-lg">
                {formatCents(calculation.net_cents)}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              {calculation.working_days} dias úteis · Seg–Sex excluindo feriados
            </p>

            {/* Action area */}
            {isAlreadyPosted ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Recibo já lançado</span>
                {postedRecord?.transactionId && (
                  <span className="ml-auto font-mono text-xs">{postedRecord.transactionId.slice(0, 8)}</span>
                )}
              </div>
            ) : (
              <Button
                onClick={handlePost}
                disabled={postingState === 'posting'}
                className="w-full"
              >
                {postingState === 'posting' ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> A lançar...</>
                ) : (
                  'Lançar Recibo'
                )}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/features/payroll/components/__tests__/PayslipPreview.test.tsx
```

- [ ] **Step 5: Build check**

```bash
npx vite build --mode development 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add src/features/payroll/components/PayslipPreview.tsx \
        src/features/payroll/components/__tests__/PayslipPreview.test.tsx
git commit -m "feat(payroll): add PayslipPreview with period picker and posting flow"
```

---

## Task 11: PayslipHistory component

**Files:**
- Create: `src/features/payroll/components/PayslipHistory.tsx`

- [ ] **Step 1: Implement PayslipHistory.tsx**

```tsx
// src/features/payroll/components/PayslipHistory.tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePayslips } from '../hooks/usePayslips';
import { formatCents, periodLabel, enrichComponents } from '../services/payrollCalculator';

interface PayslipHistoryProps {
  contractId: string;
}

const PAGE_SIZE = 10;

export default function PayslipHistory({ contractId }: PayslipHistoryProps) {
  const { data: payslips = [], isLoading } = usePayslips(contractId);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const paged = payslips.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(payslips.length / PAGE_SIZE);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de Recibos</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (payslips.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de Recibos</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            Sem recibos lançados ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Histórico de Recibos</CardTitle></CardHeader>
      <CardContent className="space-y-1 p-0">
        {paged.map(slip => {
          const isOpen = expanded === slip.id;
          const enriched = enrichComponents(slip.components ?? []);
          return (
            <div key={slip.id} className="border-b last:border-0">
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
                onClick={() => setExpanded(isOpen ? null : slip.id)}
              >
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span className="font-medium">{periodLabel(slip.period)}</span>
                  <Badge variant="secondary">{slip.status}</Badge>
                </div>
                <span className="font-mono font-semibold text-green-700">
                  {formatCents(slip.net_cents)}
                </span>
              </button>

              {isOpen && (
                <div className="px-4 pb-3 pt-1 space-y-1 bg-muted/20">
                  {enriched.map((c, i) => (
                    <div key={i} className="flex justify-between text-xs text-muted-foreground">
                      <span>{c.label}</span>
                      <span className={`font-mono ${c.isDeduction ? 'text-destructive' : ''}`}>
                        {c.sign === '-' ? '−' : '+'} {c.formatted}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-semibold pt-1 border-t">
                    <span>Líquido</span>
                    <span className="font-mono">{formatCents(slip.net_cents)}</span>
                  </div>
                  {slip.transactionId && (
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      Transacção: {slip.transactionId.slice(0, 8)}…
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-2 text-sm text-muted-foreground">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              Anterior
            </Button>
            <span>{page + 1} / {totalPages}</span>
            <Button variant="ghost" size="sm" disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Próximo
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Build check**

```bash
npx vite build --mode development 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/features/payroll/components/PayslipHistory.tsx
git commit -m "feat(payroll): add PayslipHistory component with pagination and expandable rows"
```

---

## Task 12: PayrollModule integration

**Files:**
- Modify: `src/features/payroll/components/PayrollModule.tsx`

Add a `/app/payroll/recibos` route with the new components, and a family-scope guard.

- [ ] **Step 1: Read the existing PayrollModule to understand its full structure**

```bash
# Count lines to understand the full file
wc -l src/features/payroll/components/PayrollModule.tsx
```

- [ ] **Step 2: Add new imports and route**

At the top of `PayrollModule.tsx`, add:

```typescript
import { lazy, Suspense } from 'react';
import { useScope } from '@/features/scope';
import { LoadingSpinner } from '@/components/ui/loading-states';
import { useActiveContract } from '../hooks/useActiveContract';

const PayslipPreview = lazy(() => import('./PayslipPreview'));
const PayslipHistory = lazy(() => import('./PayslipHistory'));
```

Create a new `RecibosPage` component (add above `PayrollContent`):

```tsx
function RecibosPage() {
  const { scope } = useScope();
  const { contract } = useActiveContract();

  // Family-scope guard: payroll is always personal
  if (scope.kind === 'family') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
        <p className="text-base font-medium">Recibos de vencimento são individuais</p>
        <p className="text-sm">Os recibos são geridos individualmente por cada membro da família.</p>
      </div>
    );
  }

  if (!contract?.id) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        Configure um contrato de trabalho para poder lançar recibos.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={<LoadingSpinner size="md" />}>
        <PayslipPreview contractId={contract.id} />
      </Suspense>
      <Suspense fallback={<LoadingSpinner size="sm" />}>
        <PayslipHistory contractId={contract.id} />
      </Suspense>
    </div>
  );
}
```

Inside the `<Routes>` block in `PayrollContent`, add the new route:

```tsx
<Route path="recibos" element={<RecibosPage />} />
```

- [ ] **Step 3: Add Recibos link to PayrollNavigation (optional — check if NavLink pattern exists)**

Open `src/features/payroll/components/PayrollNavigation.tsx` and add a link to `/app/payroll/recibos` following the existing nav link pattern in that file.

- [ ] **Step 4: Build check**

```bash
npx vite build --mode development 2>&1 | tail -5
```

Expected: `built in X.XXs`

- [ ] **Step 5: Run full payroll test suite**

```bash
npx vitest run src/features/payroll
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/features/payroll/components/PayrollModule.tsx \
        src/features/payroll/components/PayrollNavigation.tsx
git commit -m "feat(payroll): integrate PayslipPreview + PayslipHistory into PayrollModule (/recibos route)"
```

---

## Task 13: Final validation

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass, 0 failures

- [ ] **Step 2: Build check**

```bash
npx vite build --mode development
```

Expected: `built in X.XXs`, no TypeScript errors

- [ ] **Step 3: Manual smoke-test checklist**

Navigate to `/app/payroll/recibos` in the browser:
- [ ] Family scope → banner shown, no data loaded
- [ ] Personal scope without contract → "Configure um contrato" message
- [ ] Personal scope with contract → PayslipPreview loads with current month calculation
- [ ] Period picker → changing month recalculates
- [ ] Click "Lançar Recibo" → spinner → toast success → history updates
- [ ] Click same month again → read-only "já lançado" view
- [ ] History paginator → works with >10 payslips
- [ ] Row expand → shows components breakdown

- [ ] **Step 4: Final commit**

```bash
git add -u
git commit -m "feat(payroll): Unit 11 Payroll Core — integrated IRS calculation and payslip posting"
```
