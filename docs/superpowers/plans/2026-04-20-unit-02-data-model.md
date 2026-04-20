# Unit 2 — Data Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the data layer in 4 sequential phases: kill dead tables (fixed_expenses, goal_contributions, goal_allocations), introduce goal_ledger as unified source of truth for goal balance, migrate all monetary fields to `bigint amount_cents`, and add `categories.is_system`.

**Architecture:** Each phase is independently deployable. Phases 1–2 are pure DB + service changes with no visual impact. Phase 3 is mechanical (column rename × N tables) but must regenerate TypeScript types after each migration. Phase 4 is additive only.

**Tech Stack:** Supabase PostgreSQL migrations (`npx supabase db push`), TypeScript/React, Vitest, `npm run types:gen` for type regeneration.

---

## Deviações do Spec (documentadas)

O spec original descreve Phase 1 como incluindo `goal_contributions` e `accounts.is_goals`. Ambos foram diferidos:

- **`goal_contributions`** — o trigger `handle_goal_funding_on_transaction` escreve para esta tabela. Só pode ser dropada depois de o trigger ser atualizado para escrever para `goal_ledger` (Phase 2).
- **`accounts.is_goals`** — `ensure_goals_account()` usa esta coluna. Só pode ser dropada depois de a função ser eliminada/substituída em Phase 2.
- **`goal_deallocations`** — o spec refere-a mas a tabela nunca existiu (deallocation é feita via função sobre `goal_allocations`). Usar `DROP TABLE IF EXISTS` defensivamente.

---

## Estrutura de Ficheiros

### Criar
- `supabase/migrations/20260420100000_phase1_kill_dead_code.sql`
- `supabase/migrations/20260420110000_phase2_goal_ledger.sql`
- `supabase/migrations/20260420120000_phase2_migrate_and_cleanup.sql`
- `supabase/migrations/20260420130000_phase2_drop_goal_allocations.sql`
- `src/lib/money.ts`
- `src/lib/__tests__/money.test.ts`
- `supabase/migrations/20260420140000_phase3_accounts_cents.sql`
- `supabase/migrations/20260420150000_phase3_transactions_cents.sql`
- `supabase/migrations/20260420160000_phase3_budgets_goals_cents.sql`
- `supabase/migrations/20260420170000_phase4_categories_is_system.sql`

### Modificar
- `src/components/lazy/index.ts` — remover exports `LazyFixedExpensesForm`, `LazyFixedExpensesList`
- `src/services/goalAllocations.ts` — reescrever para usar `goals_with_balance` view + RPC
- `src/services/goalFunding.ts` — remover `listGoalContributions` + `GoalContribution` interface
- Componentes com `.saldo`, `.valor` (Tasks 7–9 identificam os exatos)

### Eliminar
- `src/services/fixed_expenses.ts`
- `src/components/FixedExpensesForm.tsx`
- `src/components/FixedExpensesList.tsx`
- `src/hooks/useFixedExpensesQuery.ts`
- `src/validation/fixedExpenseSchema.ts`
- `src/validation/__tests__/fixedExpenseSchema.test.ts`

---

## Task 1: Phase 1 — Migração DB: kill dead tables

**Ficheiros:**
- Criar: `supabase/migrations/20260420100000_phase1_kill_dead_code.sql`

- [ ] **Step 1.1: Escrever a migração**

```sql
-- supabase/migrations/20260420100000_phase1_kill_dead_code.sql
-- Phase 1: eliminar tabelas mortas
-- goal_deallocations nunca existiu como tabela (era função sobre goal_allocations)
-- goal_contributions e accounts.is_goals são diferidos para Phase 2

set local search_path = public;

-- Eliminar fixed_expenses (não referenciada por nenhuma FK)
DROP TABLE IF EXISTS public.fixed_expenses CASCADE;

-- Defensivo: goal_deallocations nunca existiu mas o spec menciona-a
DROP TABLE IF EXISTS public.goal_deallocations CASCADE;
```

- [ ] **Step 1.2: Aplicar migração**

```bash
npx supabase db push
```

Esperado: migração aplica sem erros.

- [ ] **Step 1.3: Verificar**

```bash
npx supabase db push --dry-run
```

Confirmar que `fixed_expenses` não aparece no schema.

- [ ] **Step 1.4: Commit**

```bash
git add supabase/migrations/20260420100000_phase1_kill_dead_code.sql
git commit -m "feat(db): phase 1 — drop fixed_expenses + goal_deallocations"
```

---

## Task 2: Phase 1 — Remover frontend dead code

**Ficheiros:**
- Eliminar: `src/services/fixed_expenses.ts`, `src/components/FixedExpensesForm.tsx`, `src/components/FixedExpensesList.tsx`, `src/hooks/useFixedExpensesQuery.ts`, `src/validation/fixedExpenseSchema.ts`, `src/validation/__tests__/fixedExpenseSchema.test.ts`
- Modificar: `src/components/lazy/index.ts`

- [ ] **Step 2.1: Verificar que não há imports ativos**

```bash
grep -r "fixed_expenses\|FixedExpenses\|fixedExpense\|LazyFixedExpenses" src/ --include="*.ts" --include="*.tsx" -l
```

Esperado: apenas os próprios ficheiros a eliminar + `lazy/index.ts`.

- [ ] **Step 2.2: Eliminar os ficheiros**

```bash
git rm src/services/fixed_expenses.ts \
       src/components/FixedExpensesForm.tsx \
       src/components/FixedExpensesList.tsx \
       src/hooks/useFixedExpensesQuery.ts \
       src/validation/fixedExpenseSchema.ts \
       "src/validation/__tests__/fixedExpenseSchema.test.ts"
```

- [ ] **Step 2.3: Ler lazy/index.ts e remover exports mortos**

Ler o ficheiro, encontrar as linhas com `LazyFixedExpensesForm` e `LazyFixedExpensesList` e removê-las.

- [ ] **Step 2.4: Verificar compilação TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros relacionados com fixed_expenses.

- [ ] **Step 2.5: Correr testes**

```bash
npm test
```

Esperado: todos os testes passam (o test de fixedExpenseSchema foi eliminado).

- [ ] **Step 2.6: Commit**

```bash
git add src/components/lazy/index.ts
git commit -m "feat(frontend): phase 1 — remove dead fixed_expenses code"
```

---

## Task 3: Phase 2a — Criar tabela goal_ledger

**Ficheiros:**
- Criar: `supabase/migrations/20260420110000_phase2_goal_ledger.sql`

- [ ] **Step 3.1: Escrever a migração**

```sql
-- supabase/migrations/20260420110000_phase2_goal_ledger.sql
-- Phase 2a: criar goal_ledger como fonte da verdade para saldo de objetivos

set local search_path = public;

CREATE TABLE public.goal_ledger (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id       uuid        NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  account_id    uuid        REFERENCES public.accounts(id) ON DELETE SET NULL,
  tipo          text        NOT NULL CHECK (tipo IN ('allocation','deallocation','contribution','correction')),
  amount_cents  bigint      NOT NULL CHECK (amount_cents > 0),
  signed        smallint    NOT NULL CHECK (signed IN (1, -1)),
  transaction_id uuid       REFERENCES public.transactions(id) ON DELETE SET NULL,
  rule_id       uuid        REFERENCES public.goal_funding_rules(id) ON DELETE SET NULL,
  data          date        NOT NULL DEFAULT current_date,
  operation_id  uuid        NOT NULL DEFAULT gen_random_uuid(),
  created_by    uuid        REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_goal_ledger_goal   ON public.goal_ledger(goal_id);
CREATE INDEX idx_goal_ledger_account ON public.goal_ledger(account_id);
CREATE INDEX idx_goal_ledger_tx     ON public.goal_ledger(transaction_id);
CREATE INDEX idx_goal_ledger_rule   ON public.goal_ledger(rule_id);

-- RLS: leitura para quem vê o objetivo
ALTER TABLE public.goal_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY sel_goal_ledger ON public.goal_ledger
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_ledger.goal_id
        AND (
          g.user_id = auth.uid()
          OR (
            g.family_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.family_members fm
              WHERE fm.family_id = g.family_id AND fm.user_id = auth.uid()
            )
          )
        )
    )
  );

-- Escrita: apenas SECURITY DEFINER functions
CREATE POLICY deny_write_goal_ledger ON public.goal_ledger
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

GRANT SELECT ON public.goal_ledger TO authenticated;

-- View: saldo atual de cada objetivo a partir do ledger
CREATE OR REPLACE VIEW public.goals_with_balance AS
SELECT
  g.*,
  COALESCE(SUM(gl.amount_cents * gl.signed), 0) AS valor_atual_cents
FROM public.goals g
LEFT JOIN public.goal_ledger gl ON gl.goal_id = g.id
GROUP BY g.id;

GRANT SELECT ON public.goals_with_balance TO authenticated;
```

- [ ] **Step 3.2: Aplicar migração**

```bash
npx supabase db push
```

Esperado: sem erros.

- [ ] **Step 3.3: Verificar estrutura**

```bash
npx supabase db push --dry-run
```

Tabela `goal_ledger` e view `goals_with_balance` existem.

- [ ] **Step 3.4: Commit**

```bash
git add supabase/migrations/20260420110000_phase2_goal_ledger.sql
git commit -m "feat(db): phase 2a — create goal_ledger table + goals_with_balance view"
```

---

## Task 4: Phase 2b — Migrar dados e atualizar triggers

**Ficheiros:**
- Criar: `supabase/migrations/20260420120000_phase2_migrate_and_cleanup.sql`

Esta migração faz várias coisas em sequência dentro de uma transação:
1. Migra `goal_allocations` → `goal_ledger` (tipo `allocation`, `signed = 1`)
2. Migra `goal_contributions` → `goal_ledger` (tipo `contribution`, `signed = 1`)
3. Atualiza `handle_goal_funding_on_transaction` para escrever no `goal_ledger`
4. Atualiza `apply_fixed_monthly_contributions` para escrever no `goal_ledger`
5. Dropa `goal_contributions` (trigger já não escreve para lá)
6. Elimina `ensure_goals_account` (usava `accounts.is_goals`)
7. Dropa coluna `accounts.is_goals`
8. Dropa `goal_progress` view explicitamente (depende de `transactions.goal_id` — será recriada em Task 5 usando `goal_ledger`)
9. Dropa coluna `transactions.goal_id` (dead code — `goal_progress` já foi explicitamente removida)
10. Dropa coluna `goals.account_id` (substituída por `goal_ledger.account_id` — spec §6 Unit 2)

- [ ] **Step 4.1: Escrever a migração**

```sql
-- supabase/migrations/20260420120000_phase2_migrate_and_cleanup.sql
-- Phase 2b: migrar dados para goal_ledger + atualizar triggers + limpar colunas mortas

set local search_path = public;

BEGIN;

-- 1. Migrar goal_allocations → goal_ledger
-- Cada alocação positiva vira uma entrada 'allocation' signed=1
INSERT INTO public.goal_ledger (
  goal_id, account_id, tipo, amount_cents, signed,
  data, operation_id, created_by, created_at
)
SELECT
  ga.goal_id,
  ga.account_id,
  'allocation',
  ROUND(ga.valor * 100)::bigint,
  1,
  COALESCE(ga.data_alocacao::date, ga.created_at::date, current_date),
  gen_random_uuid(),
  ga.user_id,
  COALESCE(ga.created_at, now())
FROM public.goal_allocations ga
WHERE ga.valor > 0;

-- 2. Migrar goal_contributions → goal_ledger
-- Contribuições são 'contribution' signed=1
INSERT INTO public.goal_ledger (
  goal_id, tipo, amount_cents, signed,
  transaction_id, rule_id, data, operation_id, created_at
)
SELECT
  gc.goal_id,
  'contribution',
  gc.amount_cents,
  1,
  gc.transaction_id,
  gc.rule_id,
  gc.created_at::date,
  gen_random_uuid(),
  gc.created_at
FROM public.goal_contributions gc
WHERE gc.amount_cents > 0;

-- 3. Atualizar trigger: escrever no goal_ledger em vez de goal_contributions
CREATE OR REPLACE FUNCTION public.handle_goal_funding_on_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_income  boolean;
  v_is_expense boolean;
  v_amount_cents bigint;
  v_currency   text := 'EUR';
  v_rule       record;
  v_roundup    bigint;
  v_contrib    bigint;
BEGIN
  v_is_income  := (COALESCE(NEW.tipo,'') = 'receita');
  v_is_expense := (COALESCE(NEW.tipo,'') = 'despesa');
  -- Phase 2: ainda usa NEW.valor (decimal). Phase 3 atualiza para NEW.amount_cents.
  v_amount_cents := FLOOR(ABS(COALESCE(NEW.valor,0)) * 100)::bigint;
  IF v_amount_cents <= 0 THEN
    RETURN NEW;
  END IF;

  -- income_percent
  IF v_is_income THEN
    FOR v_rule IN
      SELECT r.* FROM public.goal_funding_rules r
      JOIN public.goals g ON g.id = r.goal_id
      WHERE r.enabled = true AND r.type = 'income_percent' AND r.currency = v_currency
        AND (g.user_id = NEW.user_id OR (g.family_id IS NOT NULL AND g.family_id = NEW.family_id))
        AND (r.category_id IS NULL OR r.category_id = NEW.categoria_id)
        AND (r.min_amount_cents IS NULL OR v_amount_cents >= r.min_amount_cents)
    LOOP
      IF COALESCE(v_rule.percent_bp,0) > 0 THEN
        v_contrib := FLOOR((v_amount_cents * v_rule.percent_bp) / 10000.0)::bigint;
        IF v_contrib > 0 THEN
          INSERT INTO public.goal_ledger(goal_id, tipo, amount_cents, signed, transaction_id, rule_id, data, created_by)
          VALUES (v_rule.goal_id, 'contribution', v_contrib, 1, NEW.id, v_rule.id, NEW.data::date, NEW.user_id)
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- roundup_expense
  IF v_is_expense THEN
    v_roundup := (100 - (v_amount_cents % 100)) % 100;
    IF v_roundup > 0 THEN
      FOR v_rule IN
        SELECT r.* FROM public.goal_funding_rules r
        JOIN public.goals g ON g.id = r.goal_id
        WHERE r.enabled = true AND r.type = 'roundup_expense' AND r.currency = v_currency
          AND (g.user_id = NEW.user_id OR (g.family_id IS NOT NULL AND g.family_id = NEW.family_id))
          AND (r.category_id IS NULL OR r.category_id = NEW.categoria_id)
          AND (r.min_amount_cents IS NULL OR v_amount_cents >= r.min_amount_cents)
      LOOP
        INSERT INTO public.goal_ledger(goal_id, tipo, amount_cents, signed, transaction_id, rule_id, data, created_by)
        VALUES (v_rule.goal_id, 'contribution', v_roundup, 1, NEW.id, v_rule.id, NEW.data::date, NEW.user_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;$$;

-- 4. Atualizar apply_fixed_monthly_contributions
CREATE OR REPLACE FUNCTION public.apply_fixed_monthly_contributions(p_date date DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period    text := to_char(p_date, 'YYYY-MM');
  v_day       int  := EXTRACT(day FROM p_date);
  v_rule      record;
  v_count     int := 0;
  v_inserted  int;
BEGIN
  FOR v_rule IN
    SELECT r.* FROM public.goal_funding_rules r
    WHERE r.enabled = true AND r.type = 'fixed_monthly'
      AND COALESCE(r.day_of_month, 1) <= v_day
  LOOP
    IF COALESCE(v_rule.fixed_cents, 0) > 0 THEN
      -- Idempotência via operation_id único por rule+period
      INSERT INTO public.goal_ledger(goal_id, tipo, amount_cents, signed, rule_id, data, operation_id)
      VALUES (
        v_rule.goal_id, 'contribution', v_rule.fixed_cents, 1, v_rule.id,
        p_date,
        -- operation_id determinístico para idempotência: rule_id XOR period
        uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid,
                          v_rule.id::text || v_period)
      )
      ON CONFLICT (operation_id) DO NOTHING;
      GET DIAGNOSTICS v_inserted = ROW_COUNT;
      v_count := v_count + v_inserted;
    END IF;
  END LOOP;
  RETURN v_count;
END;$$;

-- Nota: goal_ledger.operation_id não tem UNIQUE ainda — adicionar constraint
ALTER TABLE public.goal_ledger ADD CONSTRAINT uq_goal_ledger_operation UNIQUE (operation_id);

-- 5. Drop goal_contributions (trigger já não escreve para lá)
DROP TABLE public.goal_contributions CASCADE;

-- 6. Eliminar ensure_goals_account (usa accounts.is_goals)
DROP FUNCTION IF EXISTS public.ensure_goals_account() CASCADE;

-- 7. Drop accounts.is_goals
ALTER TABLE public.accounts DROP COLUMN IF EXISTS is_goals;

-- 8. Drop goal_progress view explicitamente antes de dropar transactions.goal_id
-- (goal_progress usa transactions.goal_id e goal_allocations — ambos vão desaparecer)
DROP VIEW IF EXISTS public.goal_progress;

-- 9. Drop transactions.goal_id (goal_progress já foi explicitamente removida acima)
ALTER TABLE public.transactions DROP COLUMN IF EXISTS goal_id;

-- 10. Drop goals.account_id (substituída por goal_ledger.account_id — spec §6 Unit 2)
ALTER TABLE public.goals DROP COLUMN IF EXISTS account_id;

COMMIT;
```

- [ ] **Step 4.2: Aplicar migração**

```bash
npx supabase db push
```

Esperado: sem erros. Se houver erro no `uuid_generate_v5`, verificar se a extensão `uuid-ossp` está ativa:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```
e adicionar ao início da migração se necessário.

- [ ] **Step 4.3: Verificar dados migrados (correr no Supabase SQL Editor)**

```sql
-- Confirmar que goal_ledger tem dados migrados
SELECT tipo, COUNT(*), SUM(amount_cents) FROM goal_ledger GROUP BY tipo;

-- Confirmar que goals_with_balance tem saldos
SELECT id, nome, valor_atual_cents FROM goals_with_balance LIMIT 10;

-- Confirmar que goal_contributions não existe
SELECT to_regclass('public.goal_contributions');
-- Esperado: NULL
```

- [ ] **Step 4.4: Commit**

```bash
git add supabase/migrations/20260420120000_phase2_migrate_and_cleanup.sql
git commit -m "feat(db): phase 2b — migrate data to goal_ledger, update triggers, drop goal_contributions"
```

---

## Task 5: Phase 2c — Drop goal_allocations + atualizar serviços

**Ficheiros:**
- Criar: `supabase/migrations/20260420130000_phase2_drop_goal_allocations.sql`
- Modificar: `src/services/goalAllocations.ts`
- Modificar: `src/services/goalFunding.ts`

⚠️ Após esta task, `GoalAllocationModal.tsx` e `GoalDeallocationModal.tsx` ficam temporariamente sem suporte completo até Unit 7 reescrever o fluxo de alocação. Os componentes continuam a chamar o RPC `allocate_to_goal` / `deallocate_from_goal_with_transaction` — estes RPCs são migrados para usar `goal_ledger` nesta migração.

- [ ] **Step 5.1: Escrever o teste de regressão do serviço**

Criar `src/services/__tests__/goalAllocations.test.ts`:

```typescript
// src/services/__tests__/goalAllocations.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    rpc: vi.fn(),
  }
}));

import { getGoalBalance } from '../goalAllocations';

describe('goalAllocations service (post-ledger)', () => {
  it('getGoalBalance queries goals_with_balance view', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    (supabase.from as any).mockReturnThis();
    (supabase.select as any).mockReturnThis();
    (supabase.eq as any).mockReturnThis();
    (supabase.single as any).mockResolvedValue({
      data: { valor_atual_cents: 5000 },
      error: null,
    });

    const result = await getGoalBalance('goal-123');
    expect(result.data).toEqual({ valor_atual_cents: 5000 });
    expect(supabase.from).toHaveBeenCalledWith('goals_with_balance');
  });
});
```

- [ ] **Step 5.2: Correr teste — confirmar que falha**

```bash
npm test src/services/__tests__/goalAllocations.test.ts
```

Esperado: FAIL — `getGoalBalance is not a function`.

- [ ] **Step 5.3: Reescrever goalAllocations.ts**

```typescript
// src/services/goalAllocations.ts
// Após Phase 2: goal_allocations dropada. Saldo vem de goals_with_balance.
// Alocação/desalocação delegada nos RPCs existentes (Unit 7 reescreve o fluxo completo).
import { supabase } from '../lib/supabaseClient';
import { retryWithBackoff, withTimeout } from '../config/rpcConfig';

export const getGoalBalance = async (goalId: string): Promise<{ data: { valor_atual_cents: number } | null; error: unknown }> => {
  const { data, error } = await supabase
    .from('goals_with_balance')
    .select('valor_atual_cents')
    .eq('id', goalId)
    .single();
  return { data: data || null, error };
};

export const deallocateFromGoal = async (
  goalId: string,
  accountId: string,
  amount: number,
  userId: string
): Promise<number> => {
  const payload = {
    goal_id_param: goalId,
    account_id_param: accountId,
    amount_param: typeof amount === 'string' ? parseFloat(amount) : amount,
    user_id_param: userId,
  };

  const result = await retryWithBackoff(async () => {
    const rpcCall = supabase.rpc('deallocate_from_goal_with_transaction', payload);
    const { data, error } = await withTimeout(rpcCall);
    if (error) throw new Error(`Erro RPC: ${(error as any).message}`);
    return data;
  });

  const data = result as { amount_released: number } | null;
  return data?.amount_released || 0;
};
```

- [ ] **Step 5.4: Correr teste — confirmar que passa**

```bash
npm test src/services/__tests__/goalAllocations.test.ts
```

Esperado: PASS.

- [ ] **Step 5.5: Atualizar goalFunding.ts — remover listGoalContributions**

Ler o ficheiro atual (`src/services/goalFunding.ts`) e remover:
- Interface `GoalContribution` (linhas 34–45)
- Função `listGoalContributions` (linhas 79–86)

As funções `listFundingRules`, `createFundingRule`, `updateFundingRule`, `deleteFundingRule` mantêm-se inalteradas.

- [ ] **Step 5.6: Verificar que nenhum componente usa listGoalContributions ou GoalContribution**

```bash
grep -r "listGoalContributions\|GoalContribution" src/ --include="*.ts" --include="*.tsx"
```

Esperado: sem resultados (ou apenas o próprio ficheiro, que acabou de ser atualizado).

- [ ] **Step 5.7: Escrever a migração de drop + atualizar RPCs**

```sql
-- supabase/migrations/20260420130000_phase2_drop_goal_allocations.sql
-- Phase 2c: atualizar RPCs para usar goal_ledger + drop goal_allocations

set local search_path = public;

-- Atualizar RPC allocate_to_goal para escrever em goal_ledger
-- (o RPC existente escreve em goal_allocations — reescrever)
CREATE OR REPLACE FUNCTION public.allocate_to_goal(
  p_goal_id    uuid,
  p_account_id uuid,
  p_amount     numeric,
  p_user_id    uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cents bigint;
  v_entry_id uuid;
BEGIN
  v_cents := ROUND(p_amount * 100)::bigint;
  IF v_cents <= 0 THEN
    RAISE EXCEPTION 'Montante deve ser positivo';
  END IF;

  INSERT INTO public.goal_ledger(goal_id, account_id, tipo, amount_cents, signed, created_by)
  VALUES (p_goal_id, p_account_id, 'allocation', v_cents, 1, p_user_id)
  RETURNING id INTO v_entry_id;

  RETURN jsonb_build_object('id', v_entry_id, 'amount_cents', v_cents);
END;
$$;

-- Atualizar RPC deallocate_from_goal_with_transaction para usar goal_ledger
-- Ler definição atual antes — este bloco é uma reimplementação mínima
CREATE OR REPLACE FUNCTION public.deallocate_from_goal_with_transaction(
  goal_id_param    uuid,
  account_id_param uuid,
  amount_param     numeric,
  user_id_param    uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cents  bigint;
  v_entry_id uuid;
BEGIN
  v_cents := ROUND(amount_param * 100)::bigint;
  IF v_cents <= 0 THEN
    RAISE EXCEPTION 'Montante deve ser positivo';
  END IF;

  -- Verificar saldo disponível no ledger para esta conta
  IF (
    SELECT COALESCE(SUM(amount_cents * signed), 0)
    FROM public.goal_ledger
    WHERE goal_id = goal_id_param AND account_id = account_id_param
  ) < v_cents THEN
    RAISE EXCEPTION 'Saldo insuficiente no objetivo para esta conta';
  END IF;

  INSERT INTO public.goal_ledger(goal_id, account_id, tipo, amount_cents, signed, created_by)
  VALUES (goal_id_param, account_id_param, 'deallocation', v_cents, -1, user_id_param)
  RETURNING id INTO v_entry_id;

  RETURN jsonb_build_object('amount_released', amount_param, 'ledger_id', v_entry_id);
END;
$$;

-- Atualizar account_reserved view para usar goal_ledger em vez de goal_allocations
DROP VIEW IF EXISTS public.account_reserved;

CREATE VIEW public.account_reserved AS
WITH goal_reserved AS (
  SELECT
    gl.account_id,
    COALESCE(SUM(gl.amount_cents * gl.signed), 0) AS total_alocado_cents
  FROM public.goal_ledger gl
  JOIN public.goals g ON g.id = gl.goal_id
  WHERE g.status != 'completed'
  GROUP BY gl.account_id
),
account_balances_calc AS (
  SELECT
    a.id AS account_id,
    a.user_id,
    COALESCE(SUM(
      CASE
        WHEN t.tipo = 'receita' THEN t.valor
        WHEN t.tipo = 'despesa' THEN -t.valor
        ELSE 0
      END
    ), 0) AS saldo_atual
  FROM public.accounts a
  LEFT JOIN public.transactions t ON a.id = t.account_id
  GROUP BY a.id, a.user_id
),
automatic_reserves AS (
  SELECT
    abc.account_id,
    abc.user_id,
    abc.saldo_atual,
    abc.saldo_atual - COALESCE(gr.total_alocado_cents / 100.0, 0) AS saldo_disponivel,
    COALESCE(get_account_reserve_percentage(abc.account_id, abc.user_id), 0) AS auto_percent_bp,
    CASE
      WHEN COALESCE(get_account_reserve_percentage(abc.account_id, abc.user_id), 0) > 0
      THEN GREATEST(0, (abc.saldo_atual - COALESCE(gr.total_alocado_cents / 100.0, 0))
             * COALESCE(get_account_reserve_percentage(abc.account_id, abc.user_id), 0) / 10000.0)
      ELSE 0
    END AS auto_reserve_amount
  FROM account_balances_calc abc
  LEFT JOIN goal_reserved gr ON abc.account_id = gr.account_id
)
SELECT
  ar.account_id,
  ar.user_id,
  COALESCE(gr.total_alocado_cents / 100.0, 0) + ar.auto_reserve_amount AS total_reservado,
  COALESCE(gr.total_alocado_cents / 100.0, 0) AS reservado_objetivos,
  ar.auto_reserve_amount AS reservado_automatico,
  ar.auto_percent_bp AS percentagem_automatica_bp,
  ar.saldo_disponivel,
  ar.saldo_atual
FROM automatic_reserves ar
LEFT JOIN goal_reserved gr ON ar.account_id = gr.account_id;

GRANT SELECT ON public.account_reserved TO authenticated;

-- Recriar goal_progress usando goals_with_balance (goal_ledger como fonte de verdade)
-- Interface mantida para compatibilidade com get_user_goal_progress RPC
-- Nota: esta view usa goals_with_balance que é um view sobre goal_ledger.
-- goal_progress fazia SELECT de goal_allocations (total_alocado_historico) — agora ambos
-- os campos vêm do ledger. Coluna valor_objetivo ainda existe; será target_cents em Phase 3c.
DROP VIEW IF EXISTS public.goal_progress;

CREATE VIEW public.goal_progress AS
SELECT
  g.id,
  g.nome,
  g.valor_objetivo,
  -- total_alocado_real: saldo do ledger em euros para manter interface do RPC
  (gwb.valor_atual_cents::numeric / 100.0) AS total_alocado_real,
  (gwb.valor_atual_cents::numeric / 100.0) AS total_alocado_historico,
  ROUND(
    (gwb.valor_atual_cents::numeric / 100.0 / NULLIF(g.valor_objetivo, 0)) * 100, 2
  ) AS progresso_percentual,
  CASE
    WHEN g.valor_objetivo <= 0 THEN 'indefinido'
    WHEN (gwb.valor_atual_cents::numeric / 100.0) >= g.valor_objetivo THEN 'completo'
    WHEN gwb.valor_atual_cents > 0 THEN 'em_progresso'
    ELSE 'nao_iniciado'
  END AS status_objetivo
FROM public.goals g
JOIN public.goals_with_balance gwb ON gwb.id = g.id
WHERE g.ativo = true;

GRANT SELECT ON public.goal_progress TO authenticated;
GRANT SELECT ON public.goal_progress TO service_role;

-- Drop goal_allocations (dados já migrados em Task 4; goal_progress já recriada acima)
DROP TABLE public.goal_allocations CASCADE;
```

- [ ] **Step 5.8: Aplicar migração**

```bash
npx supabase db push
```

Esperado: sem erros.

- [ ] **Step 5.9: Regenerar tipos TypeScript**

```bash
npm run types:gen
```

- [ ] **Step 5.10: Verificar compilação**

```bash
npx tsc --noEmit
```

Corrigir quaisquer erros de tipo causados pela remoção de `GoalAllocation`, `GoalAllocationInsert`, `GoalAllocationUpdate` dos tipos gerados. A view `goal_progress` foi recriada com as mesmas colunas, por isso o RPC `get_user_goal_progress` mantém-se funcional sem alterações TypeScript.

- [ ] **Step 5.11: Correr todos os testes**

```bash
npm test
```

Esperado: todos os testes passam.

- [ ] **Step 5.12: Commit**

```bash
git add supabase/migrations/20260420130000_phase2_drop_goal_allocations.sql \
        src/services/goalAllocations.ts \
        src/services/goalFunding.ts \
        src/services/__tests__/goalAllocations.test.ts \
        src/integrations/supabase/types.ts
git commit -m "feat: phase 2c — drop goal_allocations, update RPCs, update services"
```

---

## Task 6: Criar src/lib/money.ts (helper de conversão monetária)

**Ficheiros:**
- Criar: `src/lib/money.ts`
- Criar: `src/lib/__tests__/money.test.ts`

Esta task é independente e pode ser feita antes de qualquer migração Phase 3.

- [ ] **Step 6.1: Escrever o teste**

```typescript
// src/lib/__tests__/money.test.ts
import { describe, it, expect } from 'vitest';
import { euroToCents, centsToEuro, formatMoney, parseMoney } from '../money';

describe('money helpers', () => {
  describe('euroToCents', () => {
    it('converte euros inteiros', () => expect(euroToCents(10)).toBe(1000));
    it('arredonda meio cêntimo para cima', () => expect(euroToCents(10.005)).toBe(1001));
    it('preserva 2 casas decimais', () => expect(euroToCents(9.99)).toBe(999));
    it('funciona com zero', () => expect(euroToCents(0)).toBe(0));
    it('funciona com valores negativos', () => expect(euroToCents(-5.50)).toBe(-550));
  });

  describe('centsToEuro', () => {
    it('converte cêntimos para euros', () => expect(centsToEuro(1000)).toBe(10));
    it('preserva decimais', () => expect(centsToEuro(999)).toBeCloseTo(9.99));
    it('funciona com zero', () => expect(centsToEuro(0)).toBe(0));
  });

  describe('formatMoney', () => {
    it('formata em euros PT', () => {
      expect(formatMoney(1000)).toMatch(/10/);
    });
    it('retorna string não vazia para zero', () => {
      expect(formatMoney(0)).toBeTruthy();
    });
  });

  describe('parseMoney', () => {
    it('faz parse de string com vírgula PT', () => expect(parseMoney('9,99')).toBeCloseTo(9.99));
    it('faz parse de string com ponto EN', () => expect(parseMoney('9.99')).toBeCloseTo(9.99));
    it('retorna null para string inválida', () => expect(parseMoney('abc')).toBeNull());
    it('ignora símbolo de euro', () => expect(parseMoney('€ 5,00')).toBeCloseTo(5.0));
  });
});
```

- [ ] **Step 6.2: Correr testes — confirmar que falham**

```bash
npm test src/lib/__tests__/money.test.ts
```

Esperado: FAIL — `Cannot find module '../money'`.

- [ ] **Step 6.3: Implementar money.ts**

```typescript
// src/lib/money.ts
export const euroToCents = (euro: number): number => Math.round(euro * 100);

export const centsToEuro = (cents: number): number => cents / 100;

export const formatMoney = (cents: number, currency = 'EUR', locale = 'pt-PT'): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);

export const parseMoney = (input: string): number | null => {
  const cleaned = input.replace(/[€$£\s]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
};
```

- [ ] **Step 6.4: Correr testes — confirmar que passam**

```bash
npm test src/lib/__tests__/money.test.ts
```

Esperado: todos os testes PASS.

- [ ] **Step 6.5: Commit**

```bash
git add src/lib/money.ts src/lib/__tests__/money.test.ts
git commit -m "feat(lib): add money.ts helpers (euroToCents, centsToEuro, formatMoney, parseMoney)"
```

---

## Task 7: Phase 3a — Migrar accounts: saldo → amount_cents

**Ficheiros:**
- Criar: `supabase/migrations/20260420140000_phase3_accounts_cents.sql`
- Verificar/Modificar: `src/services/accounts.ts` e componentes que acedam a `.saldo` / `.saldoAtual`

- [ ] **Step 7.1: Ler src/services/accounts.ts antes de editar**

```bash
cat src/services/accounts.ts
```

Identificar todas as referências a `saldo`, `saldo_atual`, `saldo_disponivel`.

- [ ] **Step 7.2: Escrever a migração**

```sql
-- supabase/migrations/20260420140000_phase3_accounts_cents.sql
-- Phase 3a: accounts.saldo (numeric) → amount_cents (bigint)

set local search_path = public;

BEGIN;

-- Adicionar nova coluna
ALTER TABLE public.accounts ADD COLUMN amount_cents bigint;
ALTER TABLE public.accounts ADD COLUMN currency    text NOT NULL DEFAULT 'EUR';

-- Popular com dados existentes (multiplicar por 100, arredondar)
UPDATE public.accounts
SET amount_cents = ROUND(COALESCE(saldo, 0) * 100)::bigint;

-- NOT NULL após populate
ALTER TABLE public.accounts ALTER COLUMN amount_cents SET NOT NULL;
ALTER TABLE public.accounts ALTER COLUMN amount_cents SET DEFAULT 0;

-- Eliminar coluna antiga
ALTER TABLE public.accounts DROP COLUMN IF EXISTS saldo;
ALTER TABLE public.accounts DROP COLUMN IF EXISTS saldo_atual; -- se existir como coluna separada

COMMIT;
```

- [ ] **Step 7.3: Aplicar migração**

```bash
npx supabase db push
```

- [ ] **Step 7.4: Regenerar tipos**

```bash
npm run types:gen
```

- [ ] **Step 7.5: Atualizar src/services/accounts.ts**

Substituir todas as referências a `.saldo` por `.amount_cents`. Usar `centsToEuro` do `money.ts` para display. Verificar RPCs `get_user_accounts_with_balances` e `get_family_accounts_with_balances` — estes retornam `saldo_disponivel` como numeric (calculado na view). Atualizar conforme necessário.

- [ ] **Step 7.6: Atualizar componentes**

Grep para encontrar todos os acessos:

```bash
grep -r "\.saldo\b\|\.saldoAtual\|\.saldo_atual\|\.saldo_disponivel" src/ --include="*.tsx" --include="*.ts" -n
```

Para cada ocorrência, importar `centsToEuro` ou `formatMoney` do `money.ts` e adaptar. Componentes principais esperados:
- `src/components/AccountForm.tsx` — `.saldo` → `.amount_cents`
- `src/components/AccountList.tsx` — `.saldo` → display via `formatMoney`
- `src/features/family/FamilyAccounts.tsx` — `.saldo_atual`, `.saldo_disponivel`

- [ ] **Step 7.7: Verificar compilação**

```bash
npx tsc --noEmit
```

Sem erros.

- [ ] **Step 7.8: Correr todos os testes**

```bash
npm test
```

- [ ] **Step 7.9: Commit**

```bash
git add supabase/migrations/20260420140000_phase3_accounts_cents.sql \
        src/integrations/supabase/types.ts \
        src/services/accounts.ts
git add src/components/AccountForm.tsx src/components/AccountList.tsx
git add src/features/family/FamilyAccounts.tsx
git commit -m "feat(db): phase 3a — accounts.saldo → amount_cents bigint"
```

---

## Task 8: Phase 3b — Migrar transactions: valor → amount_cents

**Ficheiros:**
- Criar: `supabase/migrations/20260420150000_phase3_transactions_cents.sql`
- Verificar/Modificar: `src/services/transactions.ts` e componentes que acedam a `.valor`

- [ ] **Step 8.1: Ler src/services/transactions.ts antes de editar**

```bash
cat src/services/transactions.ts
```

Identificar referências a `valor`.

- [ ] **Step 8.2: Escrever a migração**

```sql
-- supabase/migrations/20260420150000_phase3_transactions_cents.sql
-- Phase 3b: transactions.valor (numeric) → amount_cents (bigint)

set local search_path = public;

BEGIN;

-- Adicionar coluna nova
ALTER TABLE public.transactions ADD COLUMN amount_cents bigint;
ALTER TABLE public.transactions ADD COLUMN currency    text NOT NULL DEFAULT 'EUR';

-- Popular
UPDATE public.transactions
SET amount_cents = ROUND(COALESCE(valor, 0) * 100)::bigint;

-- NOT NULL
ALTER TABLE public.transactions ALTER COLUMN amount_cents SET NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN amount_cents SET DEFAULT 0;

-- Drop coluna antiga
ALTER TABLE public.transactions DROP COLUMN IF EXISTS valor;

-- Atualizar trigger: agora usa NEW.amount_cents em vez de NEW.valor
CREATE OR REPLACE FUNCTION public.handle_goal_funding_on_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_income  boolean;
  v_is_expense boolean;
  v_amount_cents bigint;
  v_currency   text := 'EUR';
  v_rule       record;
  v_roundup    bigint;
  v_contrib    bigint;
BEGIN
  v_is_income  := (COALESCE(NEW.tipo,'') = 'receita');
  v_is_expense := (COALESCE(NEW.tipo,'') = 'despesa');
  -- Phase 3: usa NEW.amount_cents diretamente
  v_amount_cents := COALESCE(NEW.amount_cents, 0);
  IF v_amount_cents <= 0 THEN
    RETURN NEW;
  END IF;

  IF v_is_income THEN
    FOR v_rule IN
      SELECT r.* FROM public.goal_funding_rules r
      JOIN public.goals g ON g.id = r.goal_id
      WHERE r.enabled = true AND r.type = 'income_percent' AND r.currency = v_currency
        AND (g.user_id = NEW.user_id OR (g.family_id IS NOT NULL AND g.family_id = NEW.family_id))
        AND (r.category_id IS NULL OR r.category_id = NEW.categoria_id)
        AND (r.min_amount_cents IS NULL OR v_amount_cents >= r.min_amount_cents)
    LOOP
      IF COALESCE(v_rule.percent_bp,0) > 0 THEN
        v_contrib := FLOOR((v_amount_cents * v_rule.percent_bp) / 10000.0)::bigint;
        IF v_contrib > 0 THEN
          INSERT INTO public.goal_ledger(goal_id, tipo, amount_cents, signed, transaction_id, rule_id, data, created_by)
          VALUES (v_rule.goal_id, 'contribution', v_contrib, 1, NEW.id, v_rule.id, NEW.data::date, NEW.user_id)
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF v_is_expense THEN
    v_roundup := (100 - (v_amount_cents % 100)) % 100;
    IF v_roundup > 0 THEN
      FOR v_rule IN
        SELECT r.* FROM public.goal_funding_rules r
        JOIN public.goals g ON g.id = r.goal_id
        WHERE r.enabled = true AND r.type = 'roundup_expense' AND r.currency = v_currency
          AND (g.user_id = NEW.user_id OR (g.family_id IS NOT NULL AND g.family_id = NEW.family_id))
          AND (r.category_id IS NULL OR r.category_id = NEW.categoria_id)
          AND (r.min_amount_cents IS NULL OR v_amount_cents >= r.min_amount_cents)
      LOOP
        INSERT INTO public.goal_ledger(goal_id, tipo, amount_cents, signed, transaction_id, rule_id, data, created_by)
        VALUES (v_rule.goal_id, 'contribution', v_roundup, 1, NEW.id, v_rule.id, NEW.data::date, NEW.user_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;$$;

-- Atualizar account_reserved view: trocar t.valor por t.amount_cents / 100.0
DROP VIEW IF EXISTS public.account_reserved;

CREATE VIEW public.account_reserved AS
WITH goal_reserved AS (
  SELECT
    gl.account_id,
    COALESCE(SUM(gl.amount_cents * gl.signed), 0) AS total_alocado_cents
  FROM public.goal_ledger gl
  JOIN public.goals g ON g.id = gl.goal_id
  WHERE g.status != 'completed'
  GROUP BY gl.account_id
),
account_balances_calc AS (
  SELECT
    a.id AS account_id,
    a.user_id,
    COALESCE(SUM(
      CASE
        WHEN t.tipo = 'receita' THEN t.amount_cents
        WHEN t.tipo = 'despesa' THEN -t.amount_cents
        ELSE 0
      END
    ), 0) AS saldo_atual_cents
  FROM public.accounts a
  LEFT JOIN public.transactions t ON a.id = t.account_id
  GROUP BY a.id, a.user_id
),
automatic_reserves AS (
  SELECT
    abc.account_id,
    abc.user_id,
    abc.saldo_atual_cents,
    abc.saldo_atual_cents - COALESCE(gr.total_alocado_cents, 0) AS saldo_disponivel_cents,
    COALESCE(get_account_reserve_percentage(abc.account_id, abc.user_id), 0) AS auto_percent_bp,
    CASE
      WHEN COALESCE(get_account_reserve_percentage(abc.account_id, abc.user_id), 0) > 0
      THEN GREATEST(0, (abc.saldo_atual_cents - COALESCE(gr.total_alocado_cents, 0))
             * COALESCE(get_account_reserve_percentage(abc.account_id, abc.user_id), 0) / 10000)
      ELSE 0
    END AS auto_reserve_cents
  FROM account_balances_calc abc
  LEFT JOIN goal_reserved gr ON abc.account_id = gr.account_id
)
SELECT
  ar.account_id,
  ar.user_id,
  COALESCE(gr.total_alocado_cents, 0) + ar.auto_reserve_cents AS total_reservado_cents,
  COALESCE(gr.total_alocado_cents, 0) AS reservado_objetivos_cents,
  ar.auto_reserve_cents AS reservado_automatico_cents,
  ar.auto_percent_bp AS percentagem_automatica_bp,
  ar.saldo_disponivel_cents,
  ar.saldo_atual_cents
FROM automatic_reserves ar
LEFT JOIN goal_reserved gr ON ar.account_id = gr.account_id;

GRANT SELECT ON public.account_reserved TO authenticated;

COMMIT;
```

- [ ] **Step 8.3: Aplicar migração**

```bash
npx supabase db push
```

- [ ] **Step 8.4: Regenerar tipos**

```bash
npm run types:gen
```

- [ ] **Step 8.5: Atualizar src/services/transactions.ts**

Substituir `.valor` por `.amount_cents`. Usar `euroToCents` ao criar transações, `centsToEuro` / `formatMoney` ao ler.

- [ ] **Step 8.6: Atualizar componentes**

```bash
grep -r "\.valor\b" src/ --include="*.tsx" --include="*.ts" -n
```

Componentes principais esperados:
- `src/components/BudgetForm.tsx`
- `src/components/BudgetTable.tsx`
- `src/components/GoalDeallocationModal.tsx`
- `src/features/family/FamilyBudgets.tsx`

Para cada: usar `formatMoney(row.amount_cents)` para display, `euroToCents(input)` ao submeter.

- [ ] **Step 8.7: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 8.8: Correr todos os testes**

```bash
npm test
```

- [ ] **Step 8.9: Commit**

```bash
git add supabase/migrations/20260420150000_phase3_transactions_cents.sql \
        src/integrations/supabase/types.ts \
        src/services/transactions.ts
# git add todos os componentes modificados
git commit -m "feat(db): phase 3b — transactions.valor → amount_cents bigint, update trigger"
```

---

## Task 9: Phase 3c — Migrar budgets e goals: monetary fields → cents

**Ficheiros:**
- Criar: `supabase/migrations/20260420160000_phase3_budgets_goals_cents.sql`
- Verificar/Modificar: serviços e componentes de budgets e goals

- [ ] **Step 9.1: Ler serviços antes de editar**

```bash
cat src/services/budgets.ts
cat src/services/goals.ts
```

- [ ] **Step 9.2: Escrever a migração**

```sql
-- supabase/migrations/20260420160000_phase3_budgets_goals_cents.sql
-- Phase 3c: budgets.valor → amount_cents; goals.valor_objetivo → target_cents
-- Nota: goals.valor_atual é calculado pelo goals_with_balance view (não é coluna)
-- e será removido em Unit 7. Não tocar em goals.valor_atual aqui.

set local search_path = public;

BEGIN;

-- Budgets: valor → amount_cents
ALTER TABLE public.budgets ADD COLUMN amount_cents bigint;
ALTER TABLE public.budgets ADD COLUMN currency    text NOT NULL DEFAULT 'EUR';

UPDATE public.budgets
SET amount_cents = ROUND(COALESCE(valor, 0) * 100)::bigint;

ALTER TABLE public.budgets ALTER COLUMN amount_cents SET NOT NULL;
ALTER TABLE public.budgets ALTER COLUMN amount_cents SET DEFAULT 0;
ALTER TABLE public.budgets DROP COLUMN IF EXISTS valor;

-- Goals: valor_objetivo → target_cents
ALTER TABLE public.goals ADD COLUMN target_cents bigint;

UPDATE public.goals
SET target_cents = ROUND(COALESCE(valor_objetivo, 0) * 100)::bigint;

ALTER TABLE public.goals ALTER COLUMN target_cents SET NOT NULL;
ALTER TABLE public.goals ALTER COLUMN target_cents SET DEFAULT 0;
ALTER TABLE public.goals DROP COLUMN IF EXISTS valor_objetivo;

-- Atualizar goals_with_balance view para incluir target_cents
-- (g.* agora inclui target_cents em vez de valor_objetivo após os ALTERs acima)
CREATE OR REPLACE VIEW public.goals_with_balance AS
SELECT
  g.*,
  COALESCE(SUM(gl.amount_cents * gl.signed), 0) AS valor_atual_cents
FROM public.goals g
LEFT JOIN public.goal_ledger gl ON gl.goal_id = g.id
GROUP BY g.id;

GRANT SELECT ON public.goals_with_balance TO authenticated;

-- Atualizar goal_progress: valor_objetivo foi dropado — usar target_cents
-- (goal_progress foi criada em Task 5 usando valor_objetivo; agora usa target_cents)
DROP VIEW IF EXISTS public.goal_progress;

CREATE VIEW public.goal_progress AS
SELECT
  g.id,
  g.nome,
  -- Expor target_cents em euros para manter interface do RPC get_user_goal_progress
  (g.target_cents::numeric / 100.0) AS valor_objetivo,
  (gwb.valor_atual_cents::numeric / 100.0) AS total_alocado_real,
  (gwb.valor_atual_cents::numeric / 100.0) AS total_alocado_historico,
  ROUND(
    (gwb.valor_atual_cents::numeric / 100.0 / NULLIF(g.target_cents::numeric / 100.0, 0)) * 100, 2
  ) AS progresso_percentual,
  CASE
    WHEN g.target_cents <= 0 THEN 'indefinido'
    WHEN gwb.valor_atual_cents >= g.target_cents THEN 'completo'
    WHEN gwb.valor_atual_cents > 0 THEN 'em_progresso'
    ELSE 'nao_iniciado'
  END AS status_objetivo
FROM public.goals g
JOIN public.goals_with_balance gwb ON gwb.id = g.id
WHERE g.ativo = true;

GRANT SELECT ON public.goal_progress TO authenticated;
GRANT SELECT ON public.goal_progress TO service_role;

COMMIT;
```

- [ ] **Step 9.3: Aplicar migração**

```bash
npx supabase db push
```

- [ ] **Step 9.4: Regenerar tipos**

```bash
npm run types:gen
```

- [ ] **Step 9.5: Atualizar serviços e componentes de budgets**

```bash
grep -r "\.valor\b" src/ --include="*.tsx" --include="*.ts" -n
```

Componentes esperados:
- `src/features/family/FamilyBudgets.tsx` — `.valor` → `formatMoney(.amount_cents)`

- [ ] **Step 9.6: Atualizar serviços e componentes de goals**

```bash
grep -r "valor_objetivo\|valor_atual\b" src/ --include="*.tsx" --include="*.ts" -n
```

Componentes esperados:
- `src/features/personal/PersonalGoals.tsx` — `.valor_atual` → `.valor_atual_cents` (de `goals_with_balance`); `.valor_objetivo` → `.target_cents`
- `src/components/GoalAllocationModal.tsx` — `.saldo_disponivel` (da view `account_reserved`, agora `saldo_disponivel_cents`)

- [ ] **Step 9.7: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 9.8: Correr todos os testes**

```bash
npm test
```

- [ ] **Step 9.9: Commit**

```bash
git add supabase/migrations/20260420160000_phase3_budgets_goals_cents.sql \
        src/integrations/supabase/types.ts
# git add componentes modificados
git commit -m "feat(db): phase 3c — budgets.valor → amount_cents, goals.valor_objetivo → target_cents"
```

---

## Task 10: Phase 4 — Adicionar categories.is_system

**Ficheiros:**
- Criar: `supabase/migrations/20260420170000_phase4_categories_is_system.sql`
- Modificar: `src/services/categories.ts`

- [ ] **Step 10.1: Escrever o teste**

```typescript
// src/services/__tests__/categories.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
}));

import { getSystemCategories } from '../categories';

describe('categories service', () => {
  it('getSystemCategories filtra por is_system = true', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    await getSystemCategories();
    expect(supabase.from).toHaveBeenCalledWith('categories');
    expect(supabase.eq).toHaveBeenCalledWith('is_system', true);
  });
});
```

- [ ] **Step 10.2: Correr teste — confirmar que falha**

```bash
npm test src/services/__tests__/categories.test.ts
```

Esperado: FAIL — `getSystemCategories is not a function`.

- [ ] **Step 10.3: Escrever a migração**

```sql
-- supabase/migrations/20260420170000_phase4_categories_is_system.sql
-- Phase 4: adicionar categories.is_system boolean

set local search_path = public;

BEGIN;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- Marcar categorias de sistema existentes
-- (padrão anterior: user_id IS NULL AND family_id IS NULL)
UPDATE public.categories
SET is_system = true
WHERE user_id IS NULL AND family_id IS NULL;

-- Índice para queries de categorias de sistema
CREATE INDEX IF NOT EXISTS idx_categories_is_system
  ON public.categories(is_system)
  WHERE is_system = true;

COMMIT;
```

- [ ] **Step 10.4: Aplicar migração**

```bash
npx supabase db push
```

- [ ] **Step 10.5: Regenerar tipos**

```bash
npm run types:gen
```

- [ ] **Step 10.6: Adicionar getSystemCategories ao serviço de categorias**

Ler `src/services/categories.ts`, adicionar a função:

```typescript
export const getSystemCategories = async () => {
  return supabase
    .from('categories')
    .select('*')
    .eq('is_system', true)
    .order('nome');
};
```

- [ ] **Step 10.7: Correr teste — confirmar que passa**

```bash
npm test src/services/__tests__/categories.test.ts
```

Esperado: PASS.

- [ ] **Step 10.8: Verificar compilação + todos os testes**

```bash
npx tsc --noEmit && npm test
```

- [ ] **Step 10.9: Commit**

```bash
git add supabase/migrations/20260420170000_phase4_categories_is_system.sql \
        src/integrations/supabase/types.ts \
        src/services/categories.ts \
        src/services/__tests__/categories.test.ts
git commit -m "feat(db): phase 4 — add categories.is_system boolean"
```

---

## Verificação Final

Após todas as tasks:

```bash
# Compilação limpa
npx tsc --noEmit

# Todos os testes passam
npm test

# Grep para referências a tabelas/colunas dropadas
grep -r "fixed_expenses\|goal_allocations\|goal_contributions\|\.saldo\b\|\.valor\b\|valor_objetivo\|is_goals\|goals\.account_id\|transactions\.goal_id\|\.saldo_disponivel\b" \
     src/ --include="*.ts" --include="*.tsx" -l

# Confirmar que goal_progress foi recriada e get_user_goal_progress ainda funciona
grep -r "goal_progress\|get_user_goal_progress" \
     src/ --include="*.ts" --include="*.tsx" -l
```

Esperado: apenas falsos positivos no primeiro grep. No segundo, o código que usa `get_user_goal_progress` continua intacto (o RPC e a view foram recriados com a mesma interface).
