# Unit 10: Dashboard / Reports / Cashflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Dashboard, Reports and Cashflow fully scope-aware via 4 new unified RPCs, replacing 4 old parallel RPCs, and eliminate ~1000 lines of dead code.

**Architecture:** One SQL migration creates `get_kpis`, `get_category_breakdown`, `get_dashboard_insights` and `get_cashflow_timeline` — all SECURITY DEFINER, scope-aware via `scope_family_id` parameter. Frontend hooks wrap these RPCs with React Query v5. Dashboard, CashflowView and Reports are refactored to consume the new hooks and react to the global `useScope()` toggle.

**Tech Stack:** Supabase (PostgreSQL RPCs), React Query v5 (`useQuery`), Vitest + Testing Library, TypeScript, React + Vite, Tailwind / shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-05-04-unit-10-dashboard-reports-cashflow.md`

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/20260505100000_unit10_rpcs.sql` | Create — 4 new RPCs, deprecate 4 old |
| `tests/utils/factories.ts` | Modify — add `makeKpiResult`, `makeCashflowTimelineEvent`, `makeInsight` |
| `src/hooks/useDashboardQuery.ts` | Rewrite — scope-aware, calls `get_kpis` |
| `src/hooks/__tests__/useDashboardQuery.test.ts` | Create — tests for scope reactivity |
| `src/hooks/useInsightsQuery.ts` | Create — wraps `get_dashboard_insights` |
| `src/hooks/__tests__/useInsightsQuery.test.ts` | Create |
| `src/hooks/useCashflowQuery.ts` | Create — wraps `get_cashflow_timeline` |
| `src/hooks/__tests__/useCashflowQuery.test.ts` | Create |
| `src/components/dashboard/DashboardInsights.tsx` | Create — 2–3 insight cards |
| `src/components/dashboard/__tests__/DashboardInsights.test.tsx` | Create |
| `src/pages/Dashboard.tsx` | Refactor — widgets MVP, fix all `/personal/` URLs |
| `src/pages/__tests__/Dashboard.test.tsx` | Create — scope toggle + URL tests |
| `src/pages/cashflow.tsx` | Modify — pass dateRange + slider to CashflowView |
| `src/components/cashflow/CashflowView.tsx` | Rewrite — timeline −30d/+90d, slider, "agora" line |
| `src/components/cashflow/__tests__/CashflowView.test.tsx` | Create |
| `src/pages/reports.tsx` | Modify — use unified RPCs, add Análise Anual tab |
| `src/services/exportService.ts` | Modify — consolidate to `exportCashflow()` |
| `src/services/__tests__/exportService.test.ts` | Modify — add `exportCashflow` test |
| `src/pages/Insights.tsx` | **Delete** |
| `src/App.tsx` | Modify — remove `/personal/insights` route |
| `src/services/accounts.ts` | Modify — mark `getPersonalKPIs` deprecated |
| `src/services/family.ts` | Modify — mark `getFamilyKPIs*` / `getFamilyCategoryBreakdown` deprecated |

---

## Task 1: DB Migration — 4 Unified RPCs

**Files:**
- Create: `supabase/migrations/20260505100000_unit10_rpcs.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260505100000_unit10_rpcs.sql
-- Unit 10: Unified scope-aware RPCs for Dashboard, Reports, Cashflow
-- Replaces: get_personal_kpis, get_family_kpis, get_family_kpis_with_user,
--           get_family_category_breakdown

-- ============================================================
-- 1. get_kpis — unified KPI aggregation (personal or family)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_kpis(
  scope_family_id       uuid    DEFAULT NULL,
  date_start            date    DEFAULT date_trunc('month', now())::date,
  date_end              date    DEFAULT now()::date,
  exclude_transfers     boolean DEFAULT true
)
RETURNS TABLE (
  total_balance_cents       bigint,
  income_cents              bigint,
  expense_cents             bigint,
  net_cents                 bigint,
  goals_progress_percentage numeric,
  budget_spent_percentage   numeric,
  budgets_at_risk           integer,
  reserved_cents            bigint,
  inbox_pending_count       integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mes text := to_char(date_start, 'YYYY-MM');
BEGIN
  IF scope_family_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = scope_family_id
        AND fm.user_id = v_uid
        AND fm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED';
    END IF;
  END IF;

  RETURN QUERY
  WITH
  acct AS (
    SELECT COALESCE(SUM(a.amount_cents), 0)::bigint AS total
    FROM public.accounts a
    WHERE
      CASE WHEN scope_family_id IS NULL
        THEN a.user_id = v_uid
        ELSE a.family_id = scope_family_id
      END
  ),
  tx AS (
    SELECT t.amount_cents, t.tipo
    FROM public.transactions t
    WHERE t.data BETWEEN date_start AND date_end
      AND (NOT exclude_transfers OR t.tipo <> 'transferencia')
      AND CASE WHEN scope_family_id IS NULL
        THEN t.user_id = v_uid
        ELSE t.family_id = scope_family_id
      END
  ),
  tx_agg AS (
    SELECT
      COALESCE(SUM(CASE WHEN tipo = 'receita' THEN amount_cents ELSE 0 END), 0)::bigint AS income,
      COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN amount_cents ELSE 0 END), 0)::bigint AS expense
    FROM tx
  ),
  gl_agg AS (
    SELECT gl.goal_id, SUM(gl.amount_cents * gl.signed) AS bal
    FROM public.goal_ledger gl
    JOIN public.goals g ON g.id = gl.goal_id
    WHERE g.ativa = true
      AND CASE WHEN scope_family_id IS NULL
        THEN g.user_id = v_uid
        ELSE g.family_id = scope_family_id
      END
    GROUP BY gl.goal_id
  ),
  goals_agg AS (
    SELECT
      COALESCE(
        CASE WHEN SUM(g.target_cents) = 0 THEN 0
          ELSE ROUND(SUM(GREATEST(COALESCE(gl.bal,0), 0))::numeric / NULLIF(SUM(g.target_cents),0) * 100, 2)
        END, 0)::numeric AS pct,
      COALESCE(SUM(GREATEST(COALESCE(gl.bal,0), 0)), 0)::bigint AS reserved
    FROM public.goals g
    LEFT JOIN gl_agg gl ON gl.goal_id = g.id
    WHERE g.ativa = true
      AND CASE WHEN scope_family_id IS NULL
        THEN g.user_id = v_uid
        ELSE g.family_id = scope_family_id
      END
  ),
  bud_agg AS (
    SELECT
      COALESCE(
        CASE WHEN SUM(bi.budget_cents) = 0 THEN 0
          ELSE ROUND(SUM(bi.spent_cents)::numeric / NULLIF(SUM(bi.budget_cents),0) * 100, 2)
        END, 0)::numeric AS spent_pct,
      COUNT(CASE WHEN bi.is_projected_over
                   OR (bi.budget_cents > 0 AND bi.spent_cents::numeric / bi.budget_cents >= 0.8)
                 THEN 1 END)::integer AS at_risk
    FROM public.budget_instances bi
    JOIN public.budgets b ON b.id = bi.budget_id
    WHERE bi.mes = v_mes
      AND CASE WHEN scope_family_id IS NULL
        THEN b.user_id = v_uid
        ELSE b.family_id = scope_family_id
      END
  ),
  inbox_agg AS (
    SELECT COUNT(*)::integer AS cnt
    FROM public.inbox_items
    WHERE status = 'pending'
      AND CASE WHEN scope_family_id IS NULL
        THEN user_id = v_uid AND family_id IS NULL
        ELSE family_id = scope_family_id
      END
  )
  SELECT
    ac.total,
    ta.income,
    ta.expense,
    (ta.income - ta.expense)::bigint,
    ga.pct,
    ba.spent_pct,
    ba.at_risk,
    ga.reserved,
    ia.cnt
  FROM acct ac, tx_agg ta, goals_agg ga, bud_agg ba, inbox_agg ia;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_kpis(uuid,date,date,boolean) TO authenticated;

-- ============================================================
-- 2. get_category_breakdown — scope-aware category aggregation
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_category_breakdown(
  scope_family_id uuid DEFAULT NULL,
  date_start      date DEFAULT date_trunc('month', now())::date,
  date_end        date DEFAULT now()::date,
  kind            text DEFAULT 'expense'  -- 'income' | 'expense'
)
RETURNS TABLE (
  categoria_id    uuid,
  categoria_nome  text,
  amount_cents    bigint,
  share_percent   numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tipo text := CASE WHEN kind = 'income' THEN 'receita' ELSE 'despesa' END;
BEGIN
  IF scope_family_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = scope_family_id AND fm.user_id = v_uid AND fm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED';
    END IF;
  END IF;

  RETURN QUERY
  WITH tx AS (
    SELECT t.categoria_id, t.amount_cents
    FROM public.transactions t
    WHERE t.tipo = v_tipo
      AND t.data BETWEEN date_start AND date_end
      AND CASE WHEN scope_family_id IS NULL
        THEN t.user_id = v_uid
        ELSE t.family_id = scope_family_id
      END
  ),
  agg AS (
    SELECT
      t.categoria_id,
      c.nome AS cat_nome,
      SUM(t.amount_cents)::bigint AS total
    FROM tx t
    LEFT JOIN public.categories c ON c.id = t.categoria_id
    GROUP BY t.categoria_id, c.nome
  ),
  grand AS (SELECT SUM(total) AS grand_total FROM agg)
  SELECT
    a.categoria_id,
    a.cat_nome,
    a.total,
    CASE WHEN g.grand_total = 0 THEN 0
      ELSE ROUND(a.total::numeric / g.grand_total * 100, 2)
    END
  FROM agg a, grand g
  ORDER BY a.total DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_category_breakdown(uuid,date,date,text) TO authenticated;

-- ============================================================
-- 3. get_dashboard_insights — 2-3 contextual insight cards
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_insights(
  scope_family_id uuid DEFAULT NULL
)
RETURNS TABLE (
  type    text,
  title   text,
  value   numeric,
  detail  jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_this_start date := date_trunc('month', now())::date;
  v_this_end   date := now()::date;
  v_prev_start date := date_trunc('month', now() - interval '1 month')::date;
  v_prev_end   date := (date_trunc('month', now()) - interval '1 day')::date;
BEGIN
  IF scope_family_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = scope_family_id AND fm.user_id = v_uid AND fm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED';
    END IF;
  END IF;

  -- Insight 1: month-over-month expense change
  RETURN QUERY
  WITH this_exp AS (
    SELECT COALESCE(SUM(amount_cents), 0)::numeric AS val
    FROM public.transactions
    WHERE tipo = 'despesa' AND data BETWEEN v_this_start AND v_this_end
      AND CASE WHEN scope_family_id IS NULL THEN user_id = v_uid ELSE family_id = scope_family_id END
  ),
  prev_exp AS (
    SELECT COALESCE(SUM(amount_cents), 0)::numeric AS val
    FROM public.transactions
    WHERE tipo = 'despesa' AND data BETWEEN v_prev_start AND v_prev_end
      AND CASE WHEN scope_family_id IS NULL THEN user_id = v_uid ELSE family_id = scope_family_id END
  )
  SELECT
    'mom_change'::text,
    'Despesas vs. mês anterior'::text,
    CASE WHEN p.val = 0 THEN 0
      ELSE ROUND((t.val - p.val) / p.val * 100, 1)
    END,
    jsonb_build_object('this_month_cents', t.val, 'prev_month_cents', p.val)
  FROM this_exp t, prev_exp p;

  -- Insight 2: top expense category this month
  RETURN QUERY
  SELECT
    'top_category'::text,
    'Categoria principal'::text,
    SUM(t.amount_cents)::numeric,
    jsonb_build_object('categoria_nome', c.nome)
  FROM public.transactions t
  LEFT JOIN public.categories c ON c.id = t.categoria_id
  WHERE t.tipo = 'despesa' AND t.data BETWEEN v_this_start AND v_this_end
    AND CASE WHEN scope_family_id IS NULL THEN t.user_id = v_uid ELSE t.family_id = scope_family_id END
  GROUP BY c.nome
  ORDER BY SUM(t.amount_cents) DESC
  LIMIT 1;

  -- Insight 3: budgets at risk (>=80%)
  RETURN QUERY
  SELECT
    'budget_risk'::text,
    'Orçamentos em risco'::text,
    COUNT(*)::numeric,
    jsonb_build_object()
  FROM public.budget_instances bi
  JOIN public.budgets b ON b.id = bi.budget_id
  WHERE bi.mes = to_char(now(), 'YYYY-MM')
    AND bi.budget_cents > 0
    AND (bi.is_projected_over OR bi.spent_cents::numeric / bi.budget_cents >= 0.8)
    AND CASE WHEN scope_family_id IS NULL THEN b.user_id = v_uid ELSE b.family_id = scope_family_id END
  HAVING COUNT(*) > 0;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_dashboard_insights(uuid) TO authenticated;

-- ============================================================
-- 4. get_cashflow_timeline — unified past + future timeline
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_cashflow_timeline(
  scope_family_id uuid    DEFAULT NULL,
  date_start      date    DEFAULT (now() - interval '30 days')::date,
  date_end        date    DEFAULT (now() + interval '60 days')::date,
  account_ids     uuid[]  DEFAULT NULL
)
RETURNS TABLE (
  event_date      date,
  amount_cents    bigint,
  direction       text,
  source_type     text,
  source_id       uuid,
  description     text,
  is_projected    boolean,
  needs_confirm   boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_today date := now()::date;
BEGIN
  IF scope_family_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = scope_family_id AND fm.user_id = v_uid AND fm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED';
    END IF;
  END IF;

  -- Past: real transactions
  RETURN QUERY
  SELECT
    t.data::date,
    t.amount_cents,
    CASE WHEN t.tipo = 'receita' THEN 'in' ELSE 'out' END::text,
    'transaction'::text,
    t.id,
    t.descricao,
    false,
    false
  FROM public.transactions t
  WHERE t.data BETWEEN date_start AND v_today
    AND t.tipo <> 'transferencia'
    AND CASE WHEN scope_family_id IS NULL THEN t.user_id = v_uid ELSE t.family_id = scope_family_id END
    AND (account_ids IS NULL OR t.account_id = ANY(account_ids));

  -- Future: active recurring rules (next_run_date in range)
  RETURN QUERY
  SELECT
    r.next_run_date,
    r.amount_cents,
    CASE WHEN r.type = 'income' THEN 'in' ELSE 'out' END::text,
    CASE WHEN r.type = 'credit_card_payment' THEN 'credit_card_payment' ELSE 'recurring_rule' END::text,
    r.id,
    COALESCE(r.description, r.payee, 'Recorrente'),
    true,
    (r.execution_mode = 'confirm')
  FROM public.recurring_rules r
  WHERE r.status = 'active'
    AND r.next_run_date BETWEEN v_today + 1 AND date_end
    AND CASE WHEN scope_family_id IS NULL THEN r.user_id = v_uid ELSE r.family_id = scope_family_id END;

  -- Future: goal deadlines (as negative cash event — "need to save")
  RETURN QUERY
  SELECT
    g.prazo,
    GREATEST(0, g.target_cents - COALESCE(gl_sum.bal, 0))::bigint,
    'out'::text,
    'goal_deadline'::text,
    g.id,
    g.nome || ' (prazo)',
    true,
    false
  FROM public.goals g
  LEFT JOIN (
    SELECT goal_id, SUM(amount_cents * signed) AS bal
    FROM public.goal_ledger GROUP BY goal_id
  ) gl_sum ON gl_sum.goal_id = g.id
  WHERE g.ativa = true
    AND g.prazo BETWEEN v_today + 1 AND date_end
    AND COALESCE(gl_sum.bal, 0) < COALESCE(g.target_cents, 0)
    AND CASE WHEN scope_family_id IS NULL THEN g.user_id = v_uid ELSE g.family_id = scope_family_id END;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_cashflow_timeline(uuid,date,date,uuid[]) TO authenticated;

-- ============================================================
-- 5. Deprecate old RPCs (keep for 1 release, then drop)
-- ============================================================
COMMENT ON FUNCTION public.get_personal_kpis() IS
  'DEPRECATED: use get_kpis(scope_family_id := NULL) — Unit 10';
COMMENT ON FUNCTION public.get_family_kpis() IS
  'DEPRECATED: use get_kpis(scope_family_id := <id>) — Unit 10';
COMMENT ON FUNCTION public.get_family_category_breakdown(uuid, date, date, text) IS
  'DEPRECATED: use get_category_breakdown(scope_family_id := <id>) — Unit 10';
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push --password '!CapitaoMat14'
```

Expected: `Applying migration 20260505100000_unit10_rpcs.sql... done`

If any SQL error appears (type mismatch, missing table), fix the SQL and re-run before proceeding.

- [ ] **Step 3: Verify RPCs exist in DB**

```bash
npx supabase db push --password '!CapitaoMat14' 2>&1 | grep -E "error|Error|done"
```

Expected: all `done`, no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260505100000_unit10_rpcs.sql
git commit -m "feat(db): unit10 — get_kpis, get_category_breakdown, get_dashboard_insights, get_cashflow_timeline RPCs"
```

---

## Task 2: Test Factories

**Files:**
- Modify: `tests/utils/factories.ts` (append at bottom, after existing Unit 09 factories)

- [ ] **Step 1: Add the three new factory functions**

Append to the end of `tests/utils/factories.ts`:

```typescript
// --- Unit 10 factories ---

export const makeKpiResult = (overrides: Record<string, unknown> = {}) => ({
  total_balance_cents: 100000,
  income_cents: 50000,
  expense_cents: 30000,
  net_cents: 20000,
  goals_progress_percentage: 45.5,
  budget_spent_percentage: 62.0,
  budgets_at_risk: 1,
  reserved_cents: 20000,
  inbox_pending_count: 3,
  ...overrides,
});

export const makeCashflowTimelineEvent = (overrides: Record<string, unknown> = {}) => ({
  event_date: '2026-05-10',
  amount_cents: 5000,
  direction: 'out' as 'in' | 'out',
  source_type: 'transaction',
  source_id: uuid(),
  description: 'Evento Teste',
  is_projected: false,
  needs_confirm: false,
  ...overrides,
});

export const makeInsight = (overrides: Record<string, unknown> = {}) => ({
  type: 'mom_change',
  title: 'Despesas vs. mês anterior',
  value: -12.5,
  detail: { this_month_cents: 30000, prev_month_cents: 34286 },
  ...overrides,
});
```

- [ ] **Step 2: Run existing tests to confirm factories compile**

```bash
npm run test:run -- --reporter=basic tests/utils/factories.ts 2>&1 | tail -5
```

Expected: no TypeScript compile errors. (No tests in that file — just checking it compiles.)

- [ ] **Step 3: Commit**

```bash
git add tests/utils/factories.ts
git commit -m "test(factories): add makeKpiResult, makeCashflowTimelineEvent, makeInsight (Unit 10)"
```

---

## Task 3: Rewrite `useDashboardQuery.ts`

**Files:**
- Rewrite: `src/hooks/useDashboardQuery.ts`
- Create: `src/hooks/__tests__/useDashboardQuery.test.ts`

The old hook calls `getPersonalKPIs()` directly and never reacts to the scope toggle. The new one calls `get_kpis` via supabase RPC, passing `scope_family_id` from `useScope()`.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/useDashboardQuery.test.ts`:

```typescript
// src/hooks/__tests__/useDashboardQuery.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { makeKpiResult } from '../../../tests/utils/factories';

// Hoist mocks before imports
const mockRpc = vi.hoisted(() => vi.fn());
const mockScope = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { rpc: mockRpc },
}));
vi.mock('@/features/scope', () => ({ useScope: mockScope }));

import { useDashboardData } from '../useDashboardQuery';

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

beforeEach(() => { vi.clearAllMocks(); });

describe('useDashboardData', () => {
  it('calls get_kpis with null scope_family_id in personal scope', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'personal' } });
    mockRpc.mockResolvedValueOnce({ data: [makeKpiResult()], error: null });

    const { result } = renderHook(() => useDashboardData(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_kpis', expect.objectContaining({
      scope_family_id: null,
    }));
  });

  it('calls get_kpis with familyId in family scope', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'family', familyId: 'fam-1' } });
    mockRpc.mockResolvedValueOnce({ data: [makeKpiResult()], error: null });

    const { result } = renderHook(() => useDashboardData(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_kpis', expect.objectContaining({
      scope_family_id: 'fam-1',
    }));
  });

  it('exposes inbox_pending_count from RPC result', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'personal' } });
    mockRpc.mockResolvedValueOnce({ data: [makeKpiResult({ inbox_pending_count: 5 })], error: null });

    const { result } = renderHook(() => useDashboardData(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.inboxPendingCount).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:run -- src/hooks/__tests__/useDashboardQuery.test.ts 2>&1 | tail -10
```

Expected: FAIL — `useDashboardData` does not call `get_kpis`.

- [ ] **Step 3: Rewrite `src/hooks/useDashboardQuery.ts`**

```typescript
// src/hooks/useDashboardQuery.ts
import { useQuery } from '@tanstack/react-query';
import { useScope } from '@/features/scope';
import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';

export type KpiResult = {
  totalBalanceCents: number;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  goalsProgressPercentage: number;
  budgetSpentPercentage: number;
  budgetsAtRisk: number;
  reservedCents: number;
  inboxPendingCount: number;
};

export const useDashboardData = () => {
  const { scope } = useScope();
  const scopeFamilyId = scope.kind === 'family' ? scope.familyId : null;

  return useQuery<KpiResult>({
    queryKey: ['dashboard', 'kpis', scopeFamilyId],
    queryFn: async () => {
      const today = new Date();
      const dateStart = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString().slice(0, 10);
      const dateEnd = today.toISOString().slice(0, 10);

      const { data, error } = await supabase.rpc('get_kpis', {
        scope_family_id: scopeFamilyId,
        date_start: dateStart,
        date_end: dateEnd,
        exclude_transfers: true,
      });

      if (error) {
        logger.error('get_kpis error:', error);
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      return {
        totalBalanceCents:        Number(row?.total_balance_cents)       || 0,
        incomeCents:              Number(row?.income_cents)              || 0,
        expenseCents:             Number(row?.expense_cents)             || 0,
        netCents:                 Number(row?.net_cents)                 || 0,
        goalsProgressPercentage:  Number(row?.goals_progress_percentage) || 0,
        budgetSpentPercentage:    Number(row?.budget_spent_percentage)   || 0,
        budgetsAtRisk:            Number(row?.budgets_at_risk)           || 0,
        reservedCents:            Number(row?.reserved_cents)            || 0,
        inboxPendingCount:        Number(row?.inbox_pending_count)       || 0,
      };
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test:run -- src/hooks/__tests__/useDashboardQuery.test.ts 2>&1 | tail -10
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDashboardQuery.ts src/hooks/__tests__/useDashboardQuery.test.ts
git commit -m "feat(hooks): useDashboardQuery scope-aware — calls get_kpis (Unit 10)"
```

---

## Task 4: New `useInsightsQuery.ts`

**Files:**
- Create: `src/hooks/useInsightsQuery.ts`
- Create: `src/hooks/__tests__/useInsightsQuery.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/hooks/__tests__/useInsightsQuery.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { makeInsight } from '../../../tests/utils/factories';

const mockRpc = vi.hoisted(() => vi.fn());
const mockScope = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: mockRpc } }));
vi.mock('@/features/scope', () => ({ useScope: mockScope }));

import { useDashboardInsights } from '../useInsightsQuery';

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

beforeEach(() => { vi.clearAllMocks(); });

describe('useDashboardInsights', () => {
  it('calls get_dashboard_insights with null in personal scope', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'personal' } });
    mockRpc.mockResolvedValueOnce({ data: [makeInsight()], error: null });

    const { result } = renderHook(() => useDashboardInsights(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_dashboard_insights', { scope_family_id: null });
  });

  it('returns array of insights', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'personal' } });
    mockRpc.mockResolvedValueOnce({
      data: [makeInsight(), makeInsight({ type: 'budget_risk', value: 2 })],
      error: null,
    });

    const { result } = renderHook(() => useDashboardInsights(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:run -- src/hooks/__tests__/useInsightsQuery.test.ts 2>&1 | tail -5
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/hooks/useInsightsQuery.ts`**

```typescript
// src/hooks/useInsightsQuery.ts
import { useQuery } from '@tanstack/react-query';
import { useScope } from '@/features/scope';
import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';

export type DashboardInsight = {
  type: 'mom_change' | 'top_category' | 'budget_risk' | 'projected_over';
  title: string;
  value: number;
  detail: Record<string, unknown>;
};

export const useDashboardInsights = () => {
  const { scope } = useScope();
  const scopeFamilyId = scope.kind === 'family' ? scope.familyId : null;

  return useQuery<DashboardInsight[]>({
    queryKey: ['dashboard', 'insights', scopeFamilyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_insights', {
        scope_family_id: scopeFamilyId,
      });
      if (error) {
        logger.error('get_dashboard_insights error:', error);
        throw error;
      }
      return (Array.isArray(data) ? data : []) as DashboardInsight[];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
};
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test:run -- src/hooks/__tests__/useInsightsQuery.test.ts 2>&1 | tail -5
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useInsightsQuery.ts src/hooks/__tests__/useInsightsQuery.test.ts
git commit -m "feat(hooks): useInsightsQuery wraps get_dashboard_insights (Unit 10)"
```

---

## Task 5: New `useCashflowQuery.ts`

**Files:**
- Create: `src/hooks/useCashflowQuery.ts`
- Create: `src/hooks/__tests__/useCashflowQuery.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/hooks/__tests__/useCashflowQuery.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { makeCashflowTimelineEvent } from '../../../tests/utils/factories';

const mockRpc = vi.hoisted(() => vi.fn());
const mockScope = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: mockRpc } }));
vi.mock('@/features/scope', () => ({ useScope: mockScope }));

import { useCashflowTimeline } from '../useCashflowQuery';

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

beforeEach(() => { vi.clearAllMocks(); });

describe('useCashflowTimeline', () => {
  it('calls get_cashflow_timeline with correct date range', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'personal' } });
    mockRpc.mockResolvedValueOnce({ data: [makeCashflowTimelineEvent()], error: null });

    const { result } = renderHook(
      () => useCashflowTimeline({ daysBefore: 30, daysAfter: 60 }),
      { wrapper: makeWrapper() }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_cashflow_timeline', expect.objectContaining({
      scope_family_id: null,
    }));
  });

  it('flags is_projected events separately', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'personal' } });
    mockRpc.mockResolvedValueOnce({
      data: [
        makeCashflowTimelineEvent({ is_projected: false }),
        makeCashflowTimelineEvent({ is_projected: true, needs_confirm: true }),
      ],
      error: null,
    });

    const { result } = renderHook(
      () => useCashflowTimeline({ daysBefore: 30, daysAfter: 60 }),
      { wrapper: makeWrapper() }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const confirmed = result.current.data?.filter(e => e.needsConfirm);
    expect(confirmed).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:run -- src/hooks/__tests__/useCashflowQuery.test.ts 2>&1 | tail -5
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/hooks/useCashflowQuery.ts`**

```typescript
// src/hooks/useCashflowQuery.ts
import { useQuery } from '@tanstack/react-query';
import { useScope } from '@/features/scope';
import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';

export type CashflowTimelineEvent = {
  eventDate: string;
  amountCents: number;
  direction: 'in' | 'out';
  sourceType: string;
  sourceId: string;
  description: string;
  isProjected: boolean;
  needsConfirm: boolean;
};

export const useCashflowTimeline = ({
  daysBefore = 30,
  daysAfter = 60,
  accountIds,
}: {
  daysBefore?: number;
  daysAfter?: number;
  accountIds?: string[];
} = {}) => {
  const { scope } = useScope();
  const scopeFamilyId = scope.kind === 'family' ? scope.familyId : null;

  const today = new Date();
  const dateStart = new Date(today);
  dateStart.setDate(today.getDate() - daysBefore);
  const dateEnd = new Date(today);
  dateEnd.setDate(today.getDate() + daysAfter);

  return useQuery<CashflowTimelineEvent[]>({
    queryKey: ['cashflow', 'timeline', scopeFamilyId, daysBefore, daysAfter, accountIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cashflow_timeline', {
        scope_family_id: scopeFamilyId,
        date_start: dateStart.toISOString().slice(0, 10),
        date_end: dateEnd.toISOString().slice(0, 10),
        account_ids: accountIds ?? null,
      });
      if (error) {
        logger.error('get_cashflow_timeline error:', error);
        throw error;
      }
      return ((Array.isArray(data) ? data : []) as Record<string, unknown>[]).map(r => ({
        eventDate:   r.event_date as string,
        amountCents: Number(r.amount_cents) || 0,
        direction:   r.direction as 'in' | 'out',
        sourceType:  r.source_type as string,
        sourceId:    r.source_id as string,
        description: r.description as string,
        isProjected: Boolean(r.is_projected),
        needsConfirm: Boolean(r.needs_confirm),
      }));
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test:run -- src/hooks/__tests__/useCashflowQuery.test.ts 2>&1 | tail -5
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCashflowQuery.ts src/hooks/__tests__/useCashflowQuery.test.ts
git commit -m "feat(hooks): useCashflowQuery wraps get_cashflow_timeline (Unit 10)"
```

---

## Task 6: `DashboardInsights` Component

**Files:**
- Create: `src/components/dashboard/DashboardInsights.tsx`
- Create: `src/components/dashboard/__tests__/DashboardInsights.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/dashboard/__tests__/DashboardInsights.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { makeInsight } from '../../../../tests/utils/factories';

const mockInsights = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));
vi.mock('@/hooks/useInsightsQuery', () => ({
  useDashboardInsights: mockInsights,
}));

import { DashboardInsights } from '../DashboardInsights';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('DashboardInsights', () => {
  it('renders insight titles', async () => {
    mockInsights.mockReturnValue({
      data: [
        makeInsight({ title: 'Despesas vs. mês anterior', value: -12.5 }),
        makeInsight({ type: 'budget_risk', title: 'Orçamentos em risco', value: 2 }),
      ],
      isLoading: false,
    });

    render(<DashboardInsights />, { wrapper });
    expect(await screen.findByText('Despesas vs. mês anterior')).toBeInTheDocument();
    expect(screen.getByText('Orçamentos em risco')).toBeInTheDocument();
  });

  it('shows negative mom_change as red', async () => {
    mockInsights.mockReturnValue({
      data: [makeInsight({ type: 'mom_change', value: -12.5 })],
      isLoading: false,
    });

    render(<DashboardInsights />, { wrapper });
    const badge = await screen.findByText(/-12\.5%/);
    expect(badge).toBeInTheDocument();
  });

  it('renders nothing when no insights', () => {
    mockInsights.mockReturnValue({ data: [], isLoading: false });
    const { container } = render(<DashboardInsights />, { wrapper });
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:run -- src/components/dashboard/__tests__/DashboardInsights.test.tsx 2>&1 | tail -5
```

Expected: FAIL.

- [ ] **Step 3: Implement `DashboardInsights.tsx`**

```typescript
// src/components/dashboard/DashboardInsights.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, TrendingUp, AlertTriangle, Wallet } from 'lucide-react';
import { useDashboardInsights, DashboardInsight } from '@/hooks/useInsightsQuery';

const icons: Record<string, React.ReactNode> = {
  mom_change:   <TrendingDown className="h-4 w-4" />,
  top_category: <Wallet className="h-4 w-4" />,
  budget_risk:  <AlertTriangle className="h-4 w-4 text-amber-500" />,
  projected_over: <AlertTriangle className="h-4 w-4 text-red-500" />,
};

function InsightCard({ insight }: { insight: DashboardInsight }) {
  const isNegative = insight.type === 'mom_change' && insight.value < 0;
  const isPositive = insight.type === 'mom_change' && insight.value >= 0;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
      <div className="mt-0.5 text-muted-foreground">{icons[insight.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{insight.title}</p>
        {insight.type === 'mom_change' && (
          <Badge variant={isNegative ? 'destructive' : 'secondary'} className="mt-1 text-xs">
            {isPositive ? '+' : ''}{insight.value}%
          </Badge>
        )}
        {insight.type === 'top_category' && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {(insight.detail as { categoria_nome?: string }).categoria_nome ?? '—'}
          </p>
        )}
        {(insight.type === 'budget_risk' || insight.type === 'projected_over') && (
          <p className="text-xs text-amber-600 mt-0.5">
            {insight.value} {insight.value === 1 ? 'orçamento' : 'orçamentos'} em risco
          </p>
        )}
      </div>
    </div>
  );
}

export function DashboardInsights() {
  const { data: insights = [], isLoading } = useDashboardInsights();

  if (isLoading || insights.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((ins, i) => (
          <InsightCard key={`${ins.type}-${i}`} insight={ins} />
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test:run -- src/components/dashboard/__tests__/DashboardInsights.test.tsx 2>&1 | tail -5
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/DashboardInsights.tsx src/components/dashboard/__tests__/DashboardInsights.test.tsx
git commit -m "feat(ui): DashboardInsights component with insight cards (Unit 10)"
```

---

## Task 7: Refactor `Dashboard.tsx`

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Create: `src/pages/__tests__/Dashboard.test.tsx`

Replace all `/personal/...` URLs with `/app/...`, add Inbox badge widget, wire up `useDashboardData` fields, add `DashboardInsights`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/pages/__tests__/Dashboard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { makeKpiResult } from '../../../tests/utils/factories';

const mockDashboard = vi.hoisted(() => vi.fn());
const mockScope = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn(), auth: { getUser: vi.fn() } },
}));
vi.mock('@/hooks/useDashboardQuery', () => ({ useDashboardData: mockDashboard }));
vi.mock('@/features/scope', () => ({ useScope: mockScope }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false }),
}));
// Stub heavy sub-queries
vi.mock('@/hooks/useAccountsQuery', () => ({ useAccountsWithBalances: () => ({ data: [] }) }));
vi.mock('@/hooks/useTransactionsQuery', () => ({ useTransactions: () => ({ data: [] }) }));
vi.mock('@/hooks/useGoalsQuery', () => ({ useGoals: () => ({ data: [] }) }));
vi.mock('@/hooks/useRemindersQuery', () => ({ useReminders: () => ({ data: [] }) }));
vi.mock('@/hooks/useBudgetsQuery', () => ({ useBudgets: () => ({ data: [] }) }));
vi.mock('@/hooks/useInsightsQuery', () => ({ useDashboardInsights: () => ({ data: [] }) }));
vi.mock('@/hooks/useCashflowQuery', () => ({ useCashflowTimeline: () => ({ data: [] }) }));
vi.mock('@/components/dashboard/ContributionsWidget', () => ({
  ContributionsWidget: () => <div>ContributionsWidget</div>,
}));

import Dashboard from '../Dashboard';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);

beforeEach(() => { vi.clearAllMocks(); });

describe('Dashboard', () => {
  it('shows inbox badge with pending count', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'personal' } });
    mockDashboard.mockReturnValue({
      data: makeKpiResult({ inbox_pending_count: 7 }),
      isLoading: false,
    });

    render(<Dashboard />, { wrapper });
    expect(await screen.findByText('7')).toBeInTheDocument();
  });

  it('has no hardcoded /personal/ links', () => {
    mockScope.mockReturnValue({ scope: { kind: 'personal' } });
    mockDashboard.mockReturnValue({ data: makeKpiResult(), isLoading: false });

    const { container } = render(<Dashboard />, { wrapper });
    const links = container.querySelectorAll('a[href*="/personal/"]');
    expect(links).toHaveLength(0);
  });

  it('shows ContributionsWidget in family scope', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'family', familyId: 'fam-1' } });
    mockDashboard.mockReturnValue({ data: makeKpiResult(), isLoading: false });

    render(<Dashboard />, { wrapper });
    expect(await screen.findByText('ContributionsWidget')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:run -- src/pages/__tests__/Dashboard.test.tsx 2>&1 | tail -10
```

Expected: FAIL — "7" not found, `/personal/` links still exist.

- [ ] **Step 3: Refactor `src/pages/Dashboard.tsx`**

Key changes (do NOT rewrite wholesale — apply targeted edits):

1. Remove imports: `useAccountsWithBalances`, `useTransactions`, `useGoals`, `useReminders`, `useBudgets`, `useAuth`, `DashboardChart`
2. Add imports: `useDashboardData` (already imported), `DashboardInsights`, `useCashflowQuery`
3. Replace `useDashboardData()` usage — the new hook returns `KpiResult` with camelCase fields
4. Replace every `navigate('/personal/...')` → `navigate('/app/...')` and `navigate('/Goals')` → `navigate('/app/goals')`
5. Add **Inbox badge card** after the "Este Mês" card:

```tsx
{/* Inbox Badge */}
{(dashboardData?.inboxPendingCount ?? 0) > 0 && (
  <Card
    className="hover:shadow-md transition-shadow cursor-pointer"
    onClick={() => navigate('/app/inbox')}
    role="link"
    aria-label="Ver inbox"
  >
    <CardContent className="p-4 flex items-center gap-3">
      <Bell className="h-5 w-5 text-amber-500" />
      <div>
        <p className="text-sm font-medium">Inbox</p>
        <p className="text-xs text-muted-foreground">
          {dashboardData.inboxPendingCount} {dashboardData.inboxPendingCount === 1 ? 'item' : 'itens'} pendentes
        </p>
      </div>
      <Badge className="ml-auto">{dashboardData.inboxPendingCount}</Badge>
    </CardContent>
  </Card>
)}
```

6. Add `<DashboardInsights />` component above "Transações Recentes" card
7. Remove "Estado do Sistema" card (the 3-card row at the bottom with "Online")
8. Remove `selectedPeriod` state (unused)
9. Fix Ações Rápidas buttons — all must point to `/app/...`:

```tsx
<Button onClick={() => navigate('/app/transactions')}>...</Button>
<Button onClick={() => navigate('/app/accounts')}>...</Button>
<Button onClick={() => navigate('/app/goals')}>...</Button>
<Button onClick={() => navigate('/app/reports')}>...</Button>
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm run test:run -- src/pages/__tests__/Dashboard.test.tsx 2>&1 | tail -10
```

Expected: 3 tests PASS.

- [ ] **Step 5: Run full suite to catch regressions**

```bash
npm run test:run -- --reporter=basic 2>&1 | tail -15
```

Expected: no new failures.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dashboard.tsx src/pages/__tests__/Dashboard.test.tsx
git commit -m "feat(ui): Dashboard widgets MVP + inbox badge + scope-aware URLs (Unit 10)"
```

---

## Task 8: Refactor Cashflow (CashflowView + Page)

**Files:**
- Rewrite: `src/components/cashflow/CashflowView.tsx`
- Modify: `src/pages/cashflow.tsx`
- Create: `src/components/cashflow/__tests__/CashflowView.test.tsx`

The old `CashflowView` uses `useEffect` + `cashflowService.generateProjection()` (frontend). The new one consumes `useCashflowTimeline` and renders a list-based timeline with a slider and "agora" divider.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/cashflow/__tests__/CashflowView.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { makeCashflowTimelineEvent } from '../../../../tests/utils/factories';

const mockTimeline = vi.hoisted(() => vi.fn());
const mockScope = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/hooks/useCashflowQuery', () => ({ useCashflowTimeline: mockTimeline }));
vi.mock('@/features/scope', () => ({ useScope: mockScope }));

import { CashflowView } from '../CashflowView';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);

beforeEach(() => {
  mockScope.mockReturnValue({ scope: { kind: 'personal' } });
  vi.clearAllMocks();
});

describe('CashflowView', () => {
  it('renders past event description', async () => {
    mockTimeline.mockReturnValue({
      data: [makeCashflowTimelineEvent({ description: 'Supermercado', is_projected: false })],
      isLoading: false,
    });
    render(<CashflowView />, { wrapper });
    expect(await screen.findByText('Supermercado')).toBeInTheDocument();
  });

  it('shows warning badge for needs_confirm events', async () => {
    mockTimeline.mockReturnValue({
      data: [makeCashflowTimelineEvent({
        is_projected: true,
        needs_confirm: true,
        description: 'Netflix',
      })],
      isLoading: false,
    });
    render(<CashflowView />, { wrapper });
    expect(await screen.findByText('Netflix')).toBeInTheDocument();
    expect(screen.getByTitle(/por confirmar/i)).toBeInTheDocument();
  });

  it('shows "Hoje" divider in timeline', async () => {
    mockTimeline.mockReturnValue({
      data: [
        makeCashflowTimelineEvent({ event_date: '2020-01-01', is_projected: false }),
        makeCashflowTimelineEvent({ event_date: '2099-01-01', is_projected: true }),
      ],
      isLoading: false,
    });
    render(<CashflowView />, { wrapper });
    expect(await screen.findByText(/hoje/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm run test:run -- src/components/cashflow/__tests__/CashflowView.test.tsx 2>&1 | tail -5
```

Expected: FAIL.

- [ ] **Step 3: Rewrite `src/components/cashflow/CashflowView.tsx`**

```typescript
// src/components/cashflow/CashflowView.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingDown, TrendingUp, Calendar } from 'lucide-react';
import { useCashflowTimeline, CashflowTimelineEvent } from '@/hooks/useCashflowQuery';
import { formatCurrency } from '@/lib/utils';

interface CashflowViewProps {
  daysBefore?: number;
  daysAfter?: number;
}

const BEFORE_OPTIONS = [15, 30, 60] as const;
const AFTER_OPTIONS  = [30, 60, 90] as const;

function EventRow({ event }: { event: CashflowTimelineEvent }) {
  return (
    <div className={`flex items-center justify-between p-2 rounded-lg ${event.isProjected ? 'opacity-75 border border-dashed border-muted' : 'hover:bg-muted/40'}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {event.direction === 'in'
          ? <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
          : <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{event.description}</p>
          <p className="text-xs text-muted-foreground">{event.eventDate}</p>
        </div>
        {event.needsConfirm && (
          <AlertTriangle
            className="h-4 w-4 text-amber-500 shrink-0 ml-1"
            title="Por confirmar"
          />
        )}
      </div>
      <span className={`text-sm font-semibold ml-2 ${event.direction === 'in' ? 'text-green-600' : 'text-red-600'}`}>
        {event.direction === 'in' ? '+' : '-'}{formatCurrency(event.amountCents / 100)}
      </span>
    </div>
  );
}

export function CashflowView({ daysBefore: initBefore = 30, daysAfter: initAfter = 60 }: CashflowViewProps) {
  const [daysBefore, setDaysBefore] = useState(initBefore);
  const [daysAfter, setDaysAfter]   = useState(initAfter);

  const { data: events = [], isLoading } = useCashflowTimeline({ daysBefore, daysAfter });
  const today = new Date().toISOString().slice(0, 10);

  const past   = events.filter(e => e.eventDate <= today);
  const future = events.filter(e => e.eventDate >  today);

  return (
    <div className="space-y-4">
      {/* Slider controls */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Passado:</span>
            {BEFORE_OPTIONS.map(d => (
              <Button key={d} size="sm" variant={daysBefore === d ? 'default' : 'outline'}
                onClick={() => setDaysBefore(d)}>{d}d</Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Futuro:</span>
            {AFTER_OPTIONS.map(d => (
              <Button key={d} size="sm" variant={daysAfter === d ? 'default' : 'outline'}
                onClick={() => setDaysAfter(d)}>{d}d</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Linha do tempo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {isLoading && <p className="text-sm text-muted-foreground py-4 text-center">A carregar...</p>}

          {past.map((e, i) => <EventRow key={`p-${i}`} event={e} />)}

          {/* "Hoje" divider */}
          <div className="relative flex items-center py-2">
            <div className="flex-1 border-t border-primary/50" />
            <span className="mx-3 text-xs font-semibold text-primary uppercase">Hoje</span>
            <div className="flex-1 border-t border-primary/50" />
          </div>

          {future.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground text-center py-2">Sem eventos futuros</p>
          )}
          {future.map((e, i) => <EventRow key={`f-${i}`} event={e} />)}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Modify `src/pages/cashflow.tsx` to pass scope**

Replace the `<CashflowView />` invocation to remove the old `initialScope` prop (no longer needed — scope comes from `useScope()` inside the hook):

```typescript
// src/pages/cashflow.tsx — full replacement
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CashflowView } from '../components/cashflow/CashflowView';

export default function CashflowPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Fluxo de Caixa</h1>
      <CashflowView />
    </div>
  );
}
```

- [ ] **Step 5: Run cashflow tests**

```bash
npm run test:run -- src/components/cashflow/__tests__/CashflowView.test.tsx 2>&1 | tail -10
```

Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/cashflow/CashflowView.tsx src/components/cashflow/__tests__/CashflowView.test.tsx src/pages/cashflow.tsx
git commit -m "feat(ui): CashflowView timeline −30d/+90d + slider + 'Hoje' divider + needs_confirm badge (Unit 10)"
```

---

## Task 9: Refactor `reports.tsx` — Unified RPCs + Análise Anual Tab

**Files:**
- Modify: `src/pages/reports.tsx`

Key changes:
1. Replace `getFamilyKPIsRange()` call → `supabase.rpc('get_kpis', { scope_family_id, ... })`
2. Replace `getFamilyCategoryBreakdown()` → `supabase.rpc('get_category_breakdown', { scope_family_id, ... })`
3. Replace `familyId` from `familyData?.family?.id` → `scope.kind === 'family' ? scope.familyId : null` via `useScope()`
4. Add 5th tab "Análise Anual"

- [ ] **Step 1: Add `useScope` import and replace `familyId` source**

In `src/pages/reports.tsx`, find the line that gets `familyId`:
```typescript
const familyId = familyData?.family?.id as string | undefined;
```
Replace with:
```typescript
const { scope } = useScope();
const scopeFamilyId = scope.kind === 'family' ? (scope as any).familyId as string : null;
```
Add `import { useScope } from '@/features/scope';` at the top.

- [ ] **Step 2: Replace old KPI calls with `get_kpis`**

Find the block:
```typescript
const { data, error } = await getFamilyKPIsRange(familyId!, dateRange.start, dateRange.end, excludeTransfers);
```
Replace with:
```typescript
const { data, error } = await supabase.rpc('get_kpis', {
  scope_family_id: scopeFamilyId,
  date_start: dateRange.start,
  date_end: dateRange.end,
  exclude_transfers: excludeTransfers,
});
```
Add `import { supabase } from '@/lib/supabaseClient';` if not already imported.

- [ ] **Step 3: Replace `getFamilyCategoryBreakdown` calls**

Find calls like `getFamilyCategoryBreakdown(familyId!, ...)` and replace with:
```typescript
supabase.rpc('get_category_breakdown', {
  scope_family_id: scopeFamilyId,
  date_start: dateRange.start,
  date_end: dateRange.end,
  kind: 'expense', // or 'income'
})
```

- [ ] **Step 4: Add "Análise Anual" tab**

In the `<TabsList>` (currently `grid-cols-4`), change to `grid-cols-5` and add:
```tsx
<TabsTrigger value="annual">
  <Calendar className="h-4 w-4 mr-1" /> Análise Anual
</TabsTrigger>
```

Add tab content after the existing tabs:
```tsx
<TabsContent value="annual" className="space-y-4">
  <AnnualAnalysis scopeFamilyId={scopeFamilyId} />
</TabsContent>
```

Create `AnnualAnalysis` as a local component within `reports.tsx`:

```typescript
function AnnualAnalysis({ scopeFamilyId }: { scopeFamilyId: string | null }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState<Array<{
    month: string; income: number; expense: number; net: number;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    Promise.all(
      Array.from({ length: 12 }, (_, i) => {
        const m = String(i + 1).padStart(2, '0');
        const start = `${year}-${m}-01`;
        const lastDay = new Date(year, i + 1, 0).getDate();
        const end = `${year}-${m}-${lastDay}`;
        return supabase.rpc('get_kpis', {
          scope_family_id: scopeFamilyId,
          date_start: start,
          date_end: end,
          exclude_transfers: true,
        }).then(({ data }) => {
          const row = Array.isArray(data) ? data[0] : data;
          return {
            month: new Date(year, i).toLocaleString('pt-PT', { month: 'short' }),
            income:  Number(row?.income_cents  || 0) / 100,
            expense: Number(row?.expense_cents || 0) / 100,
            net:     Number(row?.net_cents     || 0) / 100,
          };
        });
      })
    ).then(setMonthlyData).finally(() => setIsLoading(false));
  }, [year, scopeFamilyId]);

  const cumSavings = monthlyData.reduce((acc, m) => {
    const last = acc[acc.length - 1] ?? 0;
    return [...acc, last + m.net];
  }, [] as number[]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Análise Anual</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setYear(y => y - 1)}>{'<'}</Button>
            <span className="text-sm font-semibold self-center">{year}</span>
            <Button size="sm" variant="outline" onClick={() => setYear(y => y + 1)}>{'>'}</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">A carregar...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-2">Mês</th>
                  <th className="text-right py-2">Receita</th>
                  <th className="text-right py-2">Despesa</th>
                  <th className="text-right py-2">Saldo</th>
                  <th className="text-right py-2">Poupança acum.</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((m, i) => (
                  <tr key={m.month} className="border-b last:border-0">
                    <td className="py-1.5 font-medium capitalize">{m.month}</td>
                    <td className="py-1.5 text-right text-green-600">{formatCurrency(m.income)}</td>
                    <td className="py-1.5 text-right text-red-600">{formatCurrency(m.expense)}</td>
                    <td className={`py-1.5 text-right font-semibold ${m.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(m.net)}
                    </td>
                    <td className={`py-1.5 text-right ${cumSavings[i] >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(cumSavings[i])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

You'll need `import { useState, useEffect } from 'react';` and `import { Calendar } from 'lucide-react';` at the top (check if already imported).

- [ ] **Step 5: Run full test suite**

```bash
npm run test:run -- --reporter=basic 2>&1 | tail -15
```

Expected: same number of passing tests as before (reports.tsx has no unit tests currently — no regressions).

- [ ] **Step 6: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/reports.tsx
git commit -m "feat(ui): reports uses get_kpis/get_category_breakdown + Análise Anual tab (Unit 10)"
```

---

## Task 10: ExportService Consolidation

**Files:**
- Modify: `src/services/exportService.ts`

The old service has `exportCashflowData(events: CashflowEvent[], ...)` using the old frontend type. Add a new `exportCashflow(events: CashflowTimelineEvent[])` function that produces CSV from the new RPC type.

- [ ] **Step 1: Add the new function**

At the bottom of `src/services/exportService.ts`, add:

```typescript
import type { CashflowTimelineEvent } from '@/hooks/useCashflowQuery';

/**
 * Export cashflow timeline events (from get_cashflow_timeline RPC) to CSV.
 * Replaces the old exportCashflowData/exportCashflowToCsv for new consumers.
 */
export function exportCashflow(events: CashflowTimelineEvent[]): string {
  const header = 'Data,Descrição,Direção,Tipo,Valor (EUR),Projetado,Por Confirmar\n';
  const rows = events.map(e => [
    e.eventDate,
    `"${e.description.replace(/"/g, '""')}"`,
    e.direction === 'in' ? 'Entrada' : 'Saída',
    e.sourceType,
    (e.amountCents / 100).toFixed(2),
    e.isProjected ? 'Sim' : 'Não',
    e.needsConfirm ? 'Sim' : 'Não',
  ].join(',')).join('\n');
  return header + rows;
}
```

- [ ] **Step 2: Add a test for `exportCashflow`**

Find `src/services/__tests__/exportService.test.ts` (or create it if it doesn't exist) and add:

```typescript
import { describe, it, expect } from 'vitest';
import { exportCashflow } from '../exportService';

describe('exportCashflow', () => {
  it('produces valid CSV with header and one row', () => {
    const csv = exportCashflow([{
      eventDate: '2026-05-10',
      amountCents: 5000,
      direction: 'out',
      sourceType: 'transaction',
      sourceId: 'id-1',
      description: 'Supermercado',
      isProjected: false,
      needsConfirm: false,
    }]);

    expect(csv).toContain('Data,Descrição');
    expect(csv).toContain('2026-05-10');
    expect(csv).toContain('Supermercado');
    expect(csv).toContain('50.00');
    expect(csv).toContain('Saída');
  });

  it('handles empty events', () => {
    const csv = exportCashflow([]);
    expect(csv).toContain('Data,Descrição');
    expect(csv.split('\n')).toHaveLength(1); // header only (no trailing newline rows)
  });
});
```

- [ ] **Step 3: Run the export test**

```bash
npm run test:run -- src/services/__tests__/exportService.test.ts 2>&1 | tail -10
```

Expected: new tests PASS (existing tests also pass).

- [ ] **Step 4: Commit**

```bash
git add src/services/exportService.ts src/services/__tests__/exportService.test.ts
git commit -m "feat(service): exportCashflow() for CashflowTimelineEvent type (Unit 10)"
```

---

## Task 11: Dead Code Cleanup

**Files:**
- Delete: `src/pages/Insights.tsx`
- Modify: `src/App.tsx` (remove `/personal/insights` route)
- Modify: `src/services/accounts.ts` (deprecate `getPersonalKPIs`)
- Modify: `src/services/family.ts` (deprecate `getFamilyKPIs*`, `getFamilyCategoryBreakdown`)

- [ ] **Step 1: Delete `src/pages/Insights.tsx`**

```bash
rm src/pages/Insights.tsx
```

- [ ] **Step 2: Remove the `/personal/insights` route from `src/App.tsx`**

Find in `src/App.tsx` (around line 123):
```typescript
<Route path="/personal/insights" element={<Navigate to="/app/reports" replace />} />
```
Delete that line entirely.

- [ ] **Step 3: Deprecate `getPersonalKPIs` in `src/services/accounts.ts`**

Find the function (around line 509) and add a deprecation comment:
```typescript
/** @deprecated Use supabase.rpc('get_kpis', { scope_family_id: null }) — Unit 10 */
export const getPersonalKPIs = async () => {
```

- [ ] **Step 4: Deprecate family KPI functions in `src/services/family.ts`**

Add `@deprecated` JSDoc comment above `getFamilyKPIs`, `getFamilyKPIsRange`, and `getFamilyCategoryBreakdown`:
```typescript
/** @deprecated Use supabase.rpc('get_kpis', { scope_family_id }) — Unit 10 */
export const getFamilyKPIs = ...

/** @deprecated Use supabase.rpc('get_kpis', { scope_family_id }) — Unit 10 */
export const getFamilyKPIsRange = ...

/** @deprecated Use supabase.rpc('get_category_breakdown', { scope_family_id }) — Unit 10 */
export const getFamilyCategoryBreakdown = ...
```

- [ ] **Step 5: Build to confirm no broken imports**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors (nothing imports `Insights.tsx` since it was dead code).

- [ ] **Step 6: Run full test suite**

```bash
npm run test:run -- --reporter=basic 2>&1 | tail -15
```

Expected: same passing/failing count as baseline (6 pre-existing failures, no new failures).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(cleanup): delete Insights.tsx dead code, deprecate old KPI RPCs, remove /personal/insights route (Unit 10)"
```

---

## Task 12: Final Validation

- [ ] **Step 1: Run full test suite**

```bash
npm run test:run -- --reporter=basic 2>&1 | tail -20
```

Expected: ≥476 tests pass (same pre-existing 6 failures as baseline — none related to Unit 10).

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 0 new errors.

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -10
```

Expected: `built in Xs` with no errors.

- [ ] **Step 4: Verify migration applied**

```bash
npx supabase db push --password '!CapitaoMat14' 2>&1 | tail -5
```

Expected: `No new migrations to apply` (already applied in Task 1).

- [ ] **Step 5: Final commit**

```bash
git add -A
git status
```

Only untracked `supabase/.temp/` files should show (safe to ignore). If nothing staged, skip commit.

```bash
git log --oneline -12
```

Expected log (newest first):
```
chore(cleanup): delete Insights.tsx dead code, deprecate old KPI RPCs...
feat(service): exportCashflow() for CashflowTimelineEvent type
feat(ui): reports uses get_kpis/get_category_breakdown + Análise Anual tab
feat(ui): CashflowView timeline −30d/+90d + slider + 'Hoje' divider...
feat(ui): Dashboard widgets MVP + inbox badge + scope-aware URLs
feat(ui): DashboardInsights component with insight cards
feat(hooks): useCashflowQuery wraps get_cashflow_timeline
feat(hooks): useInsightsQuery wraps get_dashboard_insights
feat(hooks): useDashboardQuery scope-aware — calls get_kpis
test(factories): add makeKpiResult, makeCashflowTimelineEvent, makeInsight
feat(db): unit10 — get_kpis, get_category_breakdown, get_dashboard_insights, get_cashflow_timeline RPCs
```
