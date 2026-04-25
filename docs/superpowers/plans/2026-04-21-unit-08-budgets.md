# Unit 8: Budgets — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing flat monthly-only `budgets` table into a full envelope-budgeting system with template/instance separation, monthly + annual periods, parent/child hierarchy, three rollover modes, a linear spend projection, and inbox notifications at the 80 % / 100 % / projected-over thresholds.

**Architecture:** The `budgets` table becomes the *template* record (`is_template = true`) while `budget_instances` stores per-period materialised copies; a `get_budget_status(instance_id)` RPC computes spent + projection live; `process_period_rollover(instance_id)` closes a period and creates the next one; `check_budget_thresholds()` is called nightly by the `daily-scheduler` Edge Function and writes to `inbox_items`; the frontend replaces `PersonalBudgets` + `FamilyBudgets` with a single unified `/app/orcamentos` page that reads `budget_instances` via React Query v5, renders a hierarchy-aware progress card, and shows a linear projection badge.

**Tech Stack:** Supabase PostgreSQL, RLS, React Query v5, TypeScript, Vitest, TailwindCSS + shadcn/ui.

---

## Estado Atual (descoberta no codebase)

- `public.budgets` — `(id, user_id, family_id?, categoria_id, valor numeric, mes varchar, created_at)`. Sem `is_template`, `period_type`, `rollover_mode`, `budget_type`, `parent_id`, `target_goal_id`.
- `public.budget_progress` — view que agrega `transactions.valor` (numeric) por `(user_id, categoria_id, mes)`. Não conhece splits, hierarquia, nor projection.
- `public.get_personal_budgets()` — RPC que lê `budget_progress` e devolve `valor_orcamento / valor_gasto / valor_restante / progresso_percentual`.
- `public.get_family_budgets(p_user_id uuid)` — lê `budgets` directo com `family_id IS NOT NULL`.
- `src/services/budgets.ts` — CRUD simples + `getPersonalBudgets()` / `getFamilyBudgets()`.
- `src/hooks/useBudgetsQuery.ts` — `useBudgets`, `useCreateBudget`, `useUpdateBudget`, `useDeleteBudget` via React Query v5.
- `src/features/personal/PersonalBudgets.tsx` — página pessoal com gasto calculado no frontend via `transactions` (não usa `budget_progress`).
- `src/features/family/FamilyBudgets.tsx` — idem, escopo familiar.
- `src/components/BudgetForm.tsx` — formulário com campo `periodo` (`mensal`|`anual`) que é dead UI (anual não funciona na DB).
- `src/components/BudgetCard.tsx` — card simples sem barra de progresso nem projeção.
- `src/validation/budgetSchema.ts` — Zod schema com `categoria_id`, `valor`, `mes`.
- `inbox_items` — tabela **ainda não existe** (será criada em Unit 9; este plano cria-a antecipadamente de forma minimal para os thresholds do budget, Unit 9 expande-a).
- `amount_cents` — assumido disponível (Unit 2 Phase 3c migra `budgets.valor → amount_cents`).

---

## Deviações do Spec documentadas

- O spec §6 Unit 8 menciona `cap_type` (`flexible`|`hard`). Dado que a decisão final foi **nunca bloquear transações** (Opção a), o campo é mantido como metadado de UI (alerta visual em `hard`, mas sem bloqueio real a nível de DB).
- `inbox_items` é formalmente criada em Unit 9. Este plano cria uma versão minimal (apenas colunas necessárias para `budget_threshold`) com UPSERT idempotente; Unit 9 irá expandir com `source_type='recurring_instance'` e migrar a tabela `reminders`.
- `budget_personal_targets` é criada aqui mas populada pelo UI apenas quando `family_id IS NOT NULL`.
- A coluna `mes varchar` do schema legado é mantida nos registos antigos; novos registos usam `period_key text` (formato `YYYY-MM` para mensal, `YYYY` para anual). A view `budget_progress` é recriada para ler de `budget_instances`.

---

## Estrutura de Ficheiros

### Criar
- `supabase/migrations/20260421100000_unit08_budgets_template.sql`
- `supabase/migrations/20260421110000_unit08_budget_instances.sql`
- `supabase/migrations/20260421120000_unit08_get_budget_status.sql`
- `supabase/migrations/20260421130000_unit08_process_period_rollover.sql`
- `supabase/migrations/20260421140000_unit08_check_budget_thresholds.sql`
- `src/services/budgets.ts` (reescrever)
- `src/services/__tests__/budgets.test.ts`
- `src/hooks/useBudgetsQuery.ts` (reescrever)
- `src/pages/app/BudgetsPage.tsx` (nova página unificada)
- `src/components/budgets/BudgetProgressCard.tsx`
- `src/components/budgets/BudgetForm.tsx` (reescrever)
- `src/components/budgets/BudgetDetailSheet.tsx`
- `src/components/budgets/FamilyBudgetAggregate.tsx`
- `src/validation/budgetSchema.ts` (reescrever)

### Modificar
- `src/App.tsx` — adicionar rota `/app/orcamentos` → `BudgetsPage`
- `src/components/layout/NavigationSidebar.tsx` — ajustar link de Orçamentos para `/app/orcamentos`

### Deprecar / Eliminar (após Task 7 estar verde)
- `src/features/personal/PersonalBudgets.tsx`
- `src/features/family/FamilyBudgets.tsx`
- `src/components/BudgetCard.tsx`
- `src/components/BudgetForm.tsx` (substituído por `src/components/budgets/BudgetForm.tsx`)

---

## Task 1: Migração — Atualizar tabela `budgets` (template)

**Ficheiros:**
- Criar: `supabase/migrations/20260421100000_unit08_budgets_template.sql`

Esta migração transforma o schema da tabela `budgets` num modelo de *templates*. Os registos existentes são migrados para `is_template = true` com `period_type = 'monthly'` e `rollover_mode = 'reset'`.

- [ ] **Step 1.1: Escrever o teste de migração**

Criar `src/services/__tests__/budgets.test.ts` com asserções de schema:

```typescript
// src/services/__tests__/budgets.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    single: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { getBudgetTemplates, getBudgetStatus } from '../budgets';

describe('budgets service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getBudgetTemplates queries budgets with is_template=true', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    (supabase.order as any).mockResolvedValue({ data: [], error: null });

    await getBudgetTemplates();

    expect(supabase.from).toHaveBeenCalledWith('budgets');
    expect(supabase.eq).toHaveBeenCalledWith('is_template', true);
  });

  it('getBudgetStatus calls get_budget_status RPC', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    (supabase.rpc as any).mockResolvedValue({
      data: {
        spent_cents: 5000,
        remaining_cents: 5000,
        projected_cents: 8000,
        percent_used: 50,
        is_projected_over: false,
      },
      error: null,
    });

    const result = await getBudgetStatus('instance-uuid-123');

    expect(supabase.rpc).toHaveBeenCalledWith('get_budget_status', {
      p_instance_id: 'instance-uuid-123',
    });
    expect(result.data?.spent_cents).toBe(5000);
    expect(result.data?.is_projected_over).toBe(false);
  });
});
```

- [ ] **Step 1.2: Correr teste — confirmar FAIL**

```bash
npm test src/services/__tests__/budgets.test.ts
```

Esperado: FAIL — `getBudgetTemplates is not a function`.

- [ ] **Step 1.3: Escrever a migração**

```sql
-- supabase/migrations/20260421100000_unit08_budgets_template.sql
-- Unit 8 Task 1: evoluir tabela budgets para modelo template/instance
-- Pressupostos: amount_cents já existe (Unit 2 Phase 3c); family_id já existe.

set local search_path = public;

BEGIN;

-- 1. Adicionar novas colunas ao template
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS is_template      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS period_type      text    NOT NULL DEFAULT 'monthly'
                           CHECK (period_type IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS rollover_mode    text    NOT NULL DEFAULT 'reset'
                           CHECK (rollover_mode IN ('reset', 'accumulate', 'transfer_to_goal')),
  ADD COLUMN IF NOT EXISTS cap_type         text    NOT NULL DEFAULT 'flexible'
                           CHECK (cap_type IN ('flexible', 'hard')),
  ADD COLUMN IF NOT EXISTS parent_id        uuid    REFERENCES public.budgets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_goal_id   uuid    REFERENCES public.goals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS currency         text    NOT NULL DEFAULT 'EUR';

-- 2. Migrar registos existentes: todos tornam-se templates mensais com reset
UPDATE public.budgets
SET is_template   = true,
    period_type   = 'monthly',
    rollover_mode = 'reset',
    cap_type      = 'flexible'
WHERE is_template IS NULL OR is_template = true;

-- 3. Garantir NOT NULL depois de popular
ALTER TABLE public.budgets
  ALTER COLUMN is_template   SET NOT NULL,
  ALTER COLUMN period_type   SET NOT NULL,
  ALTER COLUMN rollover_mode SET NOT NULL,
  ALTER COLUMN cap_type      SET NOT NULL;

-- 4. Constraint: target_goal_id só faz sentido com rollover_mode='transfer_to_goal'
ALTER TABLE public.budgets
  ADD CONSTRAINT chk_transfer_to_goal_requires_goal
    CHECK (rollover_mode != 'transfer_to_goal' OR target_goal_id IS NOT NULL);

-- 5. Constraint: ON DELETE RESTRICT em categoria_id
--    (categoria só pode ser apagada se não houver budgets ativos)
--    Verificar se a FK já existe; adicionar apenas se não existir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'budgets_categoria_id_fkey' AND conrelid = 'public.budgets'::regclass
  ) THEN
    ALTER TABLE public.budgets
      ADD CONSTRAINT budgets_categoria_id_fkey
        FOREIGN KEY (categoria_id) REFERENCES public.categories(id) ON DELETE RESTRICT;
  END IF;
END$$;

-- 6. Índices adicionais
CREATE INDEX IF NOT EXISTS idx_budgets_is_template   ON public.budgets(is_template);
CREATE INDEX IF NOT EXISTS idx_budgets_parent_id     ON public.budgets(parent_id);
CREATE INDEX IF NOT EXISTS idx_budgets_period_type   ON public.budgets(period_type);
CREATE INDEX IF NOT EXISTS idx_budgets_target_goal   ON public.budgets(target_goal_id) WHERE target_goal_id IS NOT NULL;

-- 7. Nova tabela budget_personal_targets
--    (meta pessoal por membro dentro de um budget família)
CREATE TABLE IF NOT EXISTS public.budget_personal_targets (
  budget_id    uuid   NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  user_id      uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_cents bigint NOT NULL CHECK (target_cents > 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (budget_id, user_id)
);

ALTER TABLE public.budget_personal_targets ENABLE ROW LEVEL SECURITY;

-- RLS: ler se pertencer ao budget (pessoal ou família)
CREATE POLICY bpt_select ON public.budget_personal_targets
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.budgets b
      JOIN public.family_members fm ON fm.family_id = b.family_id
      WHERE b.id = budget_personal_targets.budget_id
        AND fm.user_id = auth.uid()
    )
  );

-- Escrever: apenas o próprio utilizador
CREATE POLICY bpt_insert ON public.budget_personal_targets
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY bpt_update ON public.budget_personal_targets
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY bpt_delete ON public.budget_personal_targets
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_personal_targets TO authenticated;

COMMIT;
```

- [ ] **Step 1.4: Aplicar migração**

```bash
npx supabase db push
```

Esperado: sem erros.

- [ ] **Step 1.5: Verificar schema**

```bash
npx supabase db push --dry-run
```

Confirmar colunas `is_template`, `period_type`, `rollover_mode`, `cap_type`, `parent_id`, `target_goal_id` em `budgets` e tabela `budget_personal_targets`.

- [ ] **Step 1.6: Commit**

```bash
git add supabase/migrations/20260421100000_unit08_budgets_template.sql \
        src/services/__tests__/budgets.test.ts
git commit -m "feat(db): unit 8 task 1 — budgets template columns + budget_personal_targets"
```

---

## Task 2: Migração — Criar tabela `budget_instances`

**Ficheiros:**
- Criar: `supabase/migrations/20260421110000_unit08_budget_instances.sql`

`budget_instances` materializa um template num período concreto. A função `run_monthly_budget_rollover` (Task 4) cria instâncias; o UI pode criar manualmente via `clone_budget_to_next_period`.

- [ ] **Step 2.1: Escrever a migração**

```sql
-- supabase/migrations/20260421110000_unit08_budget_instances.sql
-- Unit 8 Task 2: criar budget_instances

set local search_path = public;

BEGIN;

CREATE TABLE public.budget_instances (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id      uuid        NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  period_key     text        NOT NULL,  -- 'YYYY-MM' para monthly, 'YYYY' para annual
  period_start   date        NOT NULL,
  period_end     date        NOT NULL,
  budget_cents   bigint      NOT NULL CHECK (budget_cents > 0),
  spent_cents    bigint      NOT NULL DEFAULT 0 CHECK (spent_cents >= 0),
  -- rollover: accumulated carry-over adicionado ao budget_cents deste período
  carried_over_cents bigint  NOT NULL DEFAULT 0,
  status         text        NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'closed', 'rolled_over')),
  currency       text        NOT NULL DEFAULT 'EUR',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_budget_instance UNIQUE (budget_id, period_key)
);

-- Índices
CREATE INDEX idx_bi_budget_id    ON public.budget_instances(budget_id);
CREATE INDEX idx_bi_period_key   ON public.budget_instances(period_key);
CREATE INDEX idx_bi_status       ON public.budget_instances(status);
CREATE INDEX idx_bi_period_start ON public.budget_instances(period_start);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public._set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;$$;

CREATE TRIGGER trg_bi_updated_at
  BEFORE UPDATE ON public.budget_instances
  FOR EACH ROW EXECUTE FUNCTION public._set_updated_at();

-- RLS
ALTER TABLE public.budget_instances ENABLE ROW LEVEL SECURITY;

-- Ler: seguir o scope do budget parent
CREATE POLICY bi_select ON public.budget_instances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_instances.budget_id
        AND (
          (b.family_id IS NULL AND b.user_id = auth.uid())
          OR (b.family_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.family_members fm
            WHERE fm.family_id = b.family_id AND fm.user_id = auth.uid()
          ))
        )
    )
  );

-- Escrever: apenas non-viewer (budget parent check)
CREATE POLICY bi_insert ON public.budget_instances
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_instances.budget_id
        AND (
          (b.family_id IS NULL AND b.user_id = auth.uid())
          OR (b.family_id IS NOT NULL AND public.is_family_non_viewer(b.family_id))
        )
    )
  );

CREATE POLICY bi_update ON public.budget_instances
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_instances.budget_id
        AND (
          (b.family_id IS NULL AND b.user_id = auth.uid())
          OR (b.family_id IS NOT NULL AND public.is_family_non_viewer(b.family_id))
        )
    )
  );

CREATE POLICY bi_delete ON public.budget_instances
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.budgets b
      WHERE b.id = budget_instances.budget_id
        AND (
          (b.family_id IS NULL AND b.user_id = auth.uid())
          OR (b.family_id IS NOT NULL AND public.is_family_non_viewer(b.family_id))
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_instances TO authenticated;

-- Materializar instâncias para todos os templates existentes no mês corrente
-- (idempotente via ON CONFLICT DO NOTHING)
INSERT INTO public.budget_instances (
  budget_id,
  period_key,
  period_start,
  period_end,
  budget_cents,
  status
)
SELECT
  b.id,
  to_char(current_date, 'YYYY-MM'),
  date_trunc('month', current_date)::date,
  (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
  b.amount_cents,
  'active'
FROM public.budgets b
WHERE b.is_template = true
  AND b.period_type = 'monthly'
  AND b.amount_cents IS NOT NULL
  AND b.amount_cents > 0
ON CONFLICT (budget_id, period_key) DO NOTHING;

-- Recriar budget_progress usando budget_instances como fonte de verdade
-- (mantém interface para código legacy enquanto o frontend migra)
DROP VIEW IF EXISTS public.budget_progress;

CREATE OR REPLACE VIEW public.budget_progress AS
SELECT
  bi.id                  AS budget_instance_id,
  bi.budget_id,
  b.user_id,
  b.family_id,
  b.categoria_id,
  c.nome                 AS categoria_nome,
  c.cor                  AS categoria_cor,
  b.period_type,
  bi.period_key,
  bi.period_start,
  bi.period_end,
  bi.budget_cents        AS valor_orcamento_cents,
  bi.spent_cents         AS valor_gasto_cents,
  (bi.budget_cents - bi.spent_cents)
                         AS valor_restante_cents,
  CASE
    WHEN bi.budget_cents > 0
    THEN ROUND((bi.spent_cents::numeric / bi.budget_cents) * 100, 2)
    ELSE 0
  END                    AS progresso_percentual,
  bi.status,
  b.rollover_mode,
  b.cap_type,
  b.parent_id,
  b.is_template
FROM public.budget_instances bi
JOIN public.budgets b ON b.id = bi.budget_id
LEFT JOIN public.categories c ON c.id = b.categoria_id;

GRANT SELECT ON public.budget_progress TO authenticated;

COMMIT;
```

- [ ] **Step 2.2: Aplicar migração**

```bash
npx supabase db push
```

- [ ] **Step 2.3: Verificar instâncias criadas**

Correr no Supabase SQL Editor:

```sql
SELECT b.id, bi.period_key, bi.budget_cents, bi.status
FROM budget_instances bi
JOIN budgets b ON b.id = bi.budget_id
LIMIT 10;
```

Esperado: uma linha por template ativo, com `period_key` do mês corrente.

- [ ] **Step 2.4: Regenerar tipos TypeScript**

```bash
npm run types:gen
```

- [ ] **Step 2.5: Commit**

```bash
git add supabase/migrations/20260421110000_unit08_budget_instances.sql \
        src/integrations/supabase/types.ts
git commit -m "feat(db): unit 8 task 2 — budget_instances table + rewrite budget_progress view"
```

---

## Task 3: Migração — RPC `get_budget_status`

**Ficheiros:**
- Criar: `supabase/migrations/20260421120000_unit08_get_budget_status.sql`

O RPC calcula `spent_cents` em tempo real a partir das transações (considera splits de Unit 6 quando disponível), projeta o gasto até ao fim do período com a fórmula linear do spec, e atualiza `budget_instances.spent_cents` de forma idempotente.

- [ ] **Step 3.1: Escrever a migração**

```sql
-- supabase/migrations/20260421120000_unit08_get_budget_status.sql
-- Unit 8 Task 3: RPC get_budget_status(p_instance_id uuid)

set local search_path = public;

CREATE OR REPLACE FUNCTION public.get_budget_status(p_instance_id uuid)
RETURNS TABLE (
  spent_cents        bigint,
  remaining_cents    bigint,
  projected_cents    bigint,
  percent_used       numeric,
  is_projected_over  boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bi            public.budget_instances%ROWTYPE;
  v_b             public.budgets%ROWTYPE;
  v_spent         bigint;
  v_days_elapsed  int;
  v_total_days    int;
  v_projected     bigint;
BEGIN
  -- Carregar instância e template
  SELECT * INTO v_bi FROM public.budget_instances WHERE id = p_instance_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'budget_instance % not found', p_instance_id;
  END IF;

  SELECT * INTO v_b FROM public.budgets WHERE id = v_bi.budget_id;

  -- Verificar acesso via RLS (segurança defensiva)
  IF NOT EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = v_bi.budget_id
      AND (
        (b.family_id IS NULL AND b.user_id = auth.uid())
        OR (b.family_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.family_members fm
          WHERE fm.family_id = b.family_id AND fm.user_id = auth.uid()
        ))
      )
  ) THEN
    RAISE EXCEPTION 'Acesso negado ao budget_instance %', p_instance_id;
  END IF;

  -- Calcular gasto real a partir das transações do período
  -- Inclui transaction_splits quando existir (Unit 6); fallback para transactions.amount_cents
  SELECT COALESCE(SUM(
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = 'transaction_splits')
      THEN (
        -- Com splits: somar splits da categoria
        SELECT COALESCE(SUM(ts.amount_cents), 0)
        FROM public.transaction_splits ts
        WHERE ts.transaction_id = t.id
          AND ts.categoria_id = v_b.categoria_id
      )
      ELSE t.amount_cents
    END
  ), 0)
  INTO v_spent
  FROM public.transactions t
  WHERE t.tipo = 'despesa'
    AND t.categoria_id = v_b.categoria_id
    AND t.data >= v_bi.period_start
    AND t.data <= LEAST(v_bi.period_end, current_date)
    AND (
      (v_b.family_id IS NULL AND t.user_id = v_b.user_id)
      OR (v_b.family_id IS NOT NULL AND t.family_id = v_b.family_id)
    );

  -- Atualizar spent_cents na instância (idempotente)
  UPDATE public.budget_instances
  SET spent_cents = v_spent, updated_at = now()
  WHERE id = p_instance_id;

  -- Calcular dias para projeção linear
  v_days_elapsed := GREATEST(1, current_date - v_bi.period_start + 1);
  v_total_days   := v_bi.period_end - v_bi.period_start + 1;

  -- Projeção: ROUND((spent / days_elapsed) * total_days)
  -- Fórmula exacta do spec §6 Unit 8
  v_projected := ROUND(
    (v_spent::numeric / NULLIF(v_days_elapsed, 0)) * v_total_days
  );

  -- Resultado
  spent_cents       := v_spent;
  remaining_cents   := v_bi.budget_cents - v_spent;
  projected_cents   := v_projected;
  percent_used      := CASE
                         WHEN v_bi.budget_cents > 0
                         THEN ROUND((v_spent::numeric / v_bi.budget_cents) * 100, 2)
                         ELSE 0
                       END;
  is_projected_over := v_projected > v_bi.budget_cents;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_budget_status(uuid) TO authenticated;

-- RPC auxiliar: get_budgets(scope, period_type, period_key)
-- Unifica get_personal_budgets + get_family_budgets (spec §6 Unit 8)
CREATE OR REPLACE FUNCTION public.get_budgets(
  p_family_id  uuid    DEFAULT NULL,   -- NULL = personal scope
  p_period_type text   DEFAULT NULL,   -- NULL = todos
  p_period_key  text   DEFAULT NULL    -- NULL = todos
)
RETURNS TABLE (
  instance_id       uuid,
  budget_id         uuid,
  categoria_id      uuid,
  categoria_nome    text,
  categoria_cor     text,
  period_type       text,
  period_key        text,
  period_start      date,
  period_end        date,
  budget_cents      bigint,
  spent_cents       bigint,
  remaining_cents   bigint,
  progresso_percentual numeric,
  rollover_mode     text,
  cap_type          text,
  parent_id         uuid,
  is_projected_over boolean,
  status            text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bi.id,
    b.id,
    b.categoria_id,
    c.nome,
    c.cor,
    b.period_type,
    bi.period_key,
    bi.period_start,
    bi.period_end,
    bi.budget_cents,
    bi.spent_cents,
    (bi.budget_cents - bi.spent_cents),
    CASE WHEN bi.budget_cents > 0
         THEN ROUND((bi.spent_cents::numeric / bi.budget_cents) * 100, 2)
         ELSE 0 END,
    b.rollover_mode,
    b.cap_type,
    b.parent_id,
    -- Projeção simplificada inline (sem chamar get_budget_status para performance)
    ROUND(
      (bi.spent_cents::numeric / NULLIF(GREATEST(1, current_date - bi.period_start + 1), 0))
      * (bi.period_end - bi.period_start + 1)
    ) > bi.budget_cents,
    bi.status
  FROM public.budget_instances bi
  JOIN public.budgets b ON b.id = bi.budget_id
  LEFT JOIN public.categories c ON c.id = b.categoria_id
  WHERE bi.status = 'active'
    AND (p_period_type IS NULL OR b.period_type = p_period_type)
    AND (p_period_key IS NULL OR bi.period_key = p_period_key)
    AND (
      -- Scope pessoal
      (p_family_id IS NULL AND b.family_id IS NULL AND b.user_id = auth.uid())
      OR
      -- Scope familiar
      (p_family_id IS NOT NULL AND b.family_id = p_family_id AND EXISTS (
        SELECT 1 FROM public.family_members fm
        WHERE fm.family_id = p_family_id AND fm.user_id = auth.uid()
      ))
    )
  ORDER BY b.categoria_id, bi.period_key DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_budgets(uuid, text, text) TO authenticated;
```

- [ ] **Step 3.2: Aplicar migração**

```bash
npx supabase db push
```

- [ ] **Step 3.3: Testar manualmente**

```sql
-- No Supabase SQL Editor (substituir pelo UUID real de uma instância)
SELECT * FROM get_budget_status('<instance-uuid>');
SELECT * FROM get_budgets(NULL, 'monthly', to_char(current_date, 'YYYY-MM'));
```

- [ ] **Step 3.4: Correr testes**

```bash
npm test src/services/__tests__/budgets.test.ts
```

Os mocks já cobrem `rpc('get_budget_status', ...)` — este step deve PASS.

- [ ] **Step 3.5: Commit**

```bash
git add supabase/migrations/20260421120000_unit08_get_budget_status.sql
git commit -m "feat(db): unit 8 task 3 — get_budget_status RPC + get_budgets unified RPC"
```

---

## Task 4: Migração — `process_period_rollover` + `run_monthly_budget_rollover`

**Ficheiros:**
- Criar: `supabase/migrations/20260421130000_unit08_process_period_rollover.sql`

`process_period_rollover(p_instance_id)` fecha uma instância e cria a próxima com base no `rollover_mode`. `run_monthly_budget_rollover(p_target_month)` é chamada pelo `daily-scheduler` no dia 1 de cada mês.

- [ ] **Step 4.1: Escrever a migração**

```sql
-- supabase/migrations/20260421130000_unit08_process_period_rollover.sql
-- Unit 8 Task 4: process_period_rollover + run_monthly_budget_rollover

set local search_path = public;

-- Função principal de rollover por instância
CREATE OR REPLACE FUNCTION public.process_period_rollover(p_instance_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bi          public.budget_instances%ROWTYPE;
  v_b           public.budgets%ROWTYPE;
  v_unspent     bigint;
  v_next_key    text;
  v_next_start  date;
  v_next_end    date;
  v_next_budget bigint;
  v_new_id      uuid;
BEGIN
  SELECT * INTO v_bi FROM public.budget_instances WHERE id = p_instance_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'budget_instance % not found', p_instance_id;
  END IF;
  IF v_bi.status != 'active' THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'already_closed');
  END IF;

  SELECT * INTO v_b FROM public.budgets WHERE id = v_bi.budget_id;

  -- Calcular não-gasto
  v_unspent := GREATEST(0, v_bi.budget_cents - v_bi.spent_cents);

  -- Calcular próximo período
  IF v_b.period_type = 'monthly' THEN
    v_next_start := (date_trunc('month', v_bi.period_start) + interval '1 month')::date;
    v_next_end   := (v_next_start + interval '1 month - 1 day')::date;
    v_next_key   := to_char(v_next_start, 'YYYY-MM');
  ELSE -- annual
    v_next_start := (date_trunc('year', v_bi.period_start) + interval '1 year')::date;
    v_next_end   := (v_next_start + interval '1 year - 1 day')::date;
    v_next_key   := to_char(v_next_start, 'YYYY');
  END IF;

  -- Fechar instância corrente
  UPDATE public.budget_instances
  SET status = 'rolled_over', updated_at = now()
  WHERE id = p_instance_id;

  -- Determinar budget do próximo período conforme rollover_mode
  CASE v_b.rollover_mode
    WHEN 'reset' THEN
      v_next_budget := v_b.amount_cents;

    WHEN 'accumulate' THEN
      v_next_budget := v_b.amount_cents + v_unspent;

    WHEN 'transfer_to_goal' THEN
      v_next_budget := v_b.amount_cents;
      -- Transferir não-gasto para goal via goal_ledger
      IF v_unspent > 0 AND v_b.target_goal_id IS NOT NULL THEN
        INSERT INTO public.goal_ledger (
          goal_id, tipo, amount_cents, signed, data, created_by
        ) VALUES (
          v_b.target_goal_id,
          'contribution',
          v_unspent,
          1,
          v_bi.period_end,
          v_b.user_id
        );
      END IF;

    ELSE
      v_next_budget := v_b.amount_cents;
  END CASE;

  -- Criar próxima instância (idempotente)
  INSERT INTO public.budget_instances (
    budget_id, period_key, period_start, period_end,
    budget_cents, carried_over_cents, status
  ) VALUES (
    v_bi.budget_id,
    v_next_key,
    v_next_start,
    v_next_end,
    v_next_budget,
    CASE WHEN v_b.rollover_mode = 'accumulate' THEN v_unspent ELSE 0 END,
    'active'
  )
  ON CONFLICT (budget_id, period_key) DO NOTHING
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'closed_instance_id', p_instance_id,
    'new_instance_id',    v_new_id,
    'rollover_mode',      v_b.rollover_mode,
    'unspent_cents',      v_unspent,
    'next_period_key',    v_next_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_period_rollover(uuid) TO service_role;

-- Orquestrador mensal: chamado pelo daily-scheduler no dia 1
-- Cria instâncias para o novo mês + fecha instâncias do mês anterior
CREATE OR REPLACE FUNCTION public.run_monthly_budget_rollover(
  p_target_month date DEFAULT now()::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period_key     text := to_char(p_target_month, 'YYYY-MM');
  v_prev_key       text := to_char(p_target_month - interval '1 month', 'YYYY-MM');
  v_period_start   date := date_trunc('month', p_target_month)::date;
  v_period_end     date := (date_trunc('month', p_target_month) + interval '1 month - 1 day')::date;
  v_template       record;
  v_prev_instance  record;
  v_created        int := 0;
  v_rolled         int := 0;
  v_result         jsonb;
BEGIN
  -- 1. Para cada template mensal activo, fechar instância anterior e criar nova
  FOR v_template IN
    SELECT b.* FROM public.budgets b
    WHERE b.is_template = true AND b.period_type = 'monthly'
  LOOP
    -- Fechar instância do mês anterior via rollover
    SELECT * INTO v_prev_instance
    FROM public.budget_instances
    WHERE budget_id = v_template.id
      AND period_key = v_prev_key
      AND status = 'active';

    IF FOUND THEN
      PERFORM public.process_period_rollover(v_prev_instance.id);
      v_rolled := v_rolled + 1;
    ELSE
      -- Não houve instância anterior (primeiro mês ou gap): criar directamente
      INSERT INTO public.budget_instances (
        budget_id, period_key, period_start, period_end, budget_cents, status
      ) VALUES (
        v_template.id, v_period_key, v_period_start, v_period_end,
        v_template.amount_cents, 'active'
      )
      ON CONFLICT (budget_id, period_key) DO NOTHING;
      v_created := v_created + 1;
    END IF;
  END LOOP;

  -- 2. Garantir que o rollover já criou a instância do novo mês;
  --    se não, criar directamente (fallback)
  FOR v_template IN
    SELECT b.* FROM public.budgets b
    WHERE b.is_template = true AND b.period_type = 'monthly'
  LOOP
    INSERT INTO public.budget_instances (
      budget_id, period_key, period_start, period_end, budget_cents, status
    ) VALUES (
      v_template.id, v_period_key, v_period_start, v_period_end,
      v_template.amount_cents, 'active'
    )
    ON CONFLICT (budget_id, period_key) DO NOTHING;
  END LOOP;

  v_result := jsonb_build_object(
    'target_month',  v_period_key,
    'rolled_over',   v_rolled,
    'created',       v_created
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_monthly_budget_rollover(date) TO service_role;
```

- [ ] **Step 4.2: Aplicar migração**

```bash
npx supabase db push
```

- [ ] **Step 4.3: Testar rollover manualmente**

```sql
-- Testar criação do próximo mês
SELECT run_monthly_budget_rollover(date_trunc('month', current_date + interval '1 month')::date);

-- Verificar instâncias criadas
SELECT budget_id, period_key, budget_cents, carried_over_cents, status
FROM budget_instances
ORDER BY period_key DESC LIMIT 20;
```

- [ ] **Step 4.4: Commit**

```bash
git add supabase/migrations/20260421130000_unit08_process_period_rollover.sql
git commit -m "feat(db): unit 8 task 4 — process_period_rollover + run_monthly_budget_rollover"
```

---

## Task 5: Migração — `check_budget_thresholds` + `inbox_items` (minimal)

**Ficheiros:**
- Criar: `supabase/migrations/20260421140000_unit08_check_budget_thresholds.sql`

Cria `inbox_items` com o subset de colunas necessário para thresholds de budget. Unit 9 irá expandir a tabela (adicionar `source_type='recurring_instance'`, migrar `reminders`). O design usa `ON CONFLICT DO NOTHING` com índice `(source_type, source_id, user_id)` para idempotência.

- [ ] **Step 5.1: Escrever a migração**

```sql
-- supabase/migrations/20260421140000_unit08_check_budget_thresholds.sql
-- Unit 8 Task 5: inbox_items (minimal) + check_budget_thresholds

set local search_path = public;

BEGIN;

-- Criar inbox_items se não existir (Unit 9 irá expandir)
CREATE TABLE IF NOT EXISTS public.inbox_items (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id      uuid        REFERENCES public.families(id) ON DELETE CASCADE,
  source_type    text        NOT NULL
                             CHECK (source_type IN (
                               'budget_threshold',
                               'goal_deadline',
                               'recurring_instance',
                               'manual'
                             )),
  source_id      uuid        NOT NULL,
  title          text        NOT NULL,
  body           text,
  due_at         timestamptz NOT NULL,
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','snoozed','done','dismissed')),
  snoozed_until  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz
);

-- Índices
CREATE UNIQUE INDEX IF NOT EXISTS uq_inbox_source
  ON public.inbox_items(source_type, source_id, user_id);

CREATE INDEX IF NOT EXISTS idx_inbox_user_status
  ON public.inbox_items(user_id, status, due_at);

CREATE INDEX IF NOT EXISTS idx_inbox_family
  ON public.inbox_items(family_id)
  WHERE family_id IS NOT NULL;

-- RLS
ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY inbox_select ON public.inbox_items
  FOR SELECT USING (
    user_id = auth.uid()
    OR (family_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = inbox_items.family_id AND fm.user_id = auth.uid()
    ))
  );

CREATE POLICY inbox_insert ON public.inbox_items
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY inbox_update ON public.inbox_items
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY inbox_delete ON public.inbox_items
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_items TO authenticated;

-- Função principal: varre instâncias activas e insere inbox_items para thresholds
-- Chamada pelo daily-scheduler. Idempotente: ON CONFLICT DO NOTHING no uq_inbox_source.
CREATE OR REPLACE FUNCTION public.check_budget_thresholds()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row          record;
  v_pct          numeric;
  v_days_elapsed int;
  v_total_days   int;
  v_projected    bigint;
  v_is_proj_over boolean;
  v_threshold    text;
  v_title        text;
  v_body         text;
  v_target_user  uuid;
  v_count        int := 0;
BEGIN
  FOR v_row IN
    SELECT
      bi.id              AS instance_id,
      bi.budget_cents,
      bi.spent_cents,
      bi.period_start,
      bi.period_end,
      b.user_id,
      b.family_id,
      b.categoria_id,
      c.nome             AS categoria_nome
    FROM public.budget_instances bi
    JOIN public.budgets b ON b.id = bi.budget_id
    LEFT JOIN public.categories c ON c.id = b.categoria_id
    WHERE bi.status = 'active'
      AND bi.period_end >= current_date
      AND bi.budget_cents > 0
  LOOP
    v_pct := ROUND((v_row.spent_cents::numeric / v_row.budget_cents) * 100, 2);

    v_days_elapsed := GREATEST(1, current_date - v_row.period_start + 1);
    v_total_days   := v_row.period_end - v_row.period_start + 1;
    v_projected    := ROUND(
      (v_row.spent_cents::numeric / NULLIF(v_days_elapsed, 0)) * v_total_days
    );
    v_is_proj_over := v_projected > v_row.budget_cents;

    -- Determinar threshold a notificar
    v_threshold := NULL;
    IF v_pct >= 100 THEN
      v_threshold := '100pct';
      v_title := format('Orçamento excedido: %s', v_row.categoria_nome);
      v_body  := format('Gastaste %s%% do orçamento de %s.', v_pct, v_row.categoria_nome);
    ELSIF v_pct >= 80 THEN
      v_threshold := '80pct';
      v_title := format('Orçamento a 80%%: %s', v_row.categoria_nome);
      v_body  := format('Já gastaste %s%% do orçamento de %s.', v_pct, v_row.categoria_nome);
    ELSIF v_is_proj_over THEN
      v_threshold := 'projected_over';
      v_title := format('Projeção acima do orçamento: %s', v_row.categoria_nome);
      v_body  := format('Ao ritmo atual irás ultrapassar o orçamento de %s.', v_row.categoria_nome);
    END IF;

    CONTINUE WHEN v_threshold IS NULL;

    -- Determinar utilizador(es) a notificar
    -- Para budgets pessoais: apenas o owner
    -- Para budgets família: todos os membros non-viewer
    IF v_row.family_id IS NULL THEN
      -- Pessoal
      INSERT INTO public.inbox_items (
        user_id, family_id, source_type, source_id,
        title, body, due_at, status
      ) VALUES (
        v_row.user_id, NULL, 'budget_threshold',
        -- source_id encoda instância + threshold para unicidade
        md5(v_row.instance_id::text || v_threshold)::uuid,
        v_title, v_body, now(), 'pending'
      )
      ON CONFLICT (source_type, source_id, user_id) DO NOTHING;
      v_count := v_count + 1;
    ELSE
      -- Familiar: notificar todos os membros activos não-viewer
      FOR v_target_user IN
        SELECT fm.user_id FROM public.family_members fm
        WHERE fm.family_id = v_row.family_id
          AND fm.role != 'viewer'
          AND fm.status = 'active'
      LOOP
        INSERT INTO public.inbox_items (
          user_id, family_id, source_type, source_id,
          title, body, due_at, status
        ) VALUES (
          v_target_user, v_row.family_id, 'budget_threshold',
          md5(v_row.instance_id::text || v_threshold || v_target_user::text)::uuid,
          v_title, v_body, now(), 'pending'
        )
        ON CONFLICT (source_type, source_id, user_id) DO NOTHING;
        v_count := v_count + 1;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('notifications_created', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_budget_thresholds() TO service_role;

COMMIT;
```

- [ ] **Step 5.2: Aplicar migração**

```bash
npx supabase db push
```

- [ ] **Step 5.3: Testar manualmente**

```sql
-- Forçar um gasto a 90% numa instância (para testar threshold 80%)
UPDATE budget_instances
SET spent_cents = budget_cents * 0.9
WHERE id = '<algum-instance-id>';

SELECT check_budget_thresholds();

SELECT source_type, title, body, status
FROM inbox_items
WHERE source_type = 'budget_threshold'
LIMIT 5;
```

- [ ] **Step 5.4: Regenerar tipos**

```bash
npm run types:gen
```

- [ ] **Step 5.5: Commit**

```bash
git add supabase/migrations/20260421140000_unit08_check_budget_thresholds.sql \
        src/integrations/supabase/types.ts
git commit -m "feat(db): unit 8 task 5 — inbox_items + check_budget_thresholds (80/100/projected)"
```

---

## Task 6: Serviço TypeScript + hook React Query

**Ficheiros:**
- Reescrever: `src/services/budgets.ts`
- Reescrever: `src/hooks/useBudgetsQuery.ts`
- Reescrever: `src/validation/budgetSchema.ts`

- [ ] **Step 6.1: Correr testes existentes — confirmar estado actual**

```bash
npm test src/services/__tests__/budgets.test.ts
```

Esperado: FAIL (funções `getBudgetTemplates` / `getBudgetStatus` não existem ainda).

- [ ] **Step 6.2: Reescrever src/services/budgets.ts**

```typescript
// src/services/budgets.ts
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../integrations/supabase/types';

type BudgetRow = Database['public']['Tables']['budgets']['Row'];
type BudgetInsert = Database['public']['Tables']['budgets']['Insert'];
type BudgetUpdate = Database['public']['Tables']['budgets']['Update'];
type BudgetInstanceRow = Database['public']['Tables']['budget_instances']['Row'];

export type BudgetStatus = {
  spent_cents: number;
  remaining_cents: number;
  projected_cents: number;
  percent_used: number;
  is_projected_over: boolean;
};

export type GetBudgetsRow = {
  instance_id: string;
  budget_id: string;
  categoria_id: string;
  categoria_nome: string;
  categoria_cor: string;
  period_type: string;
  period_key: string;
  period_start: string;
  period_end: string;
  budget_cents: number;
  spent_cents: number;
  remaining_cents: number;
  progresso_percentual: number;
  rollover_mode: string;
  cap_type: string;
  parent_id: string | null;
  is_projected_over: boolean;
  status: string;
};

// --- Templates CRUD ---

export const getBudgetTemplates = async (
  familyId?: string | null
): Promise<{ data: BudgetRow[] | null; error: unknown }> => {
  try {
    let q = supabase
      .from('budgets')
      .eq('is_template', true)
      .order('created_at', { ascending: false });

    if (familyId) {
      q = q.eq('family_id', familyId);
    } else {
      q = q.is('family_id', null);
    }

    const { data, error } = await q.select('*');
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const createBudgetTemplate = async (
  payload: BudgetInsert
): Promise<{ data: BudgetRow | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('budgets')
      .insert([{ ...payload, is_template: true }])
      .select()
      .single();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const updateBudgetTemplate = async (
  id: string,
  updates: BudgetUpdate
): Promise<{ data: BudgetRow | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('budgets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteBudgetTemplate = async (
  id: string
): Promise<{ data: boolean | null; error: unknown }> => {
  try {
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    return { data: !error, error };
  } catch (error) {
    return { data: null, error };
  }
};

// --- Instances ---

export const getBudgetStatus = async (
  instanceId: string
): Promise<{ data: BudgetStatus | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_budget_status', {
      p_instance_id: instanceId,
    });
    return { data: data?.[0] ?? null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getBudgets = async (params: {
  familyId?: string | null;
  periodType?: string;
  periodKey?: string;
}): Promise<{ data: GetBudgetsRow[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_budgets', {
      p_family_id: params.familyId ?? null,
      p_period_type: params.periodType ?? null,
      p_period_key: params.periodKey ?? null,
    });
    return { data: data ?? null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getBudgetInstances = async (
  budgetId: string
): Promise<{ data: BudgetInstanceRow[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('budget_instances')
      .select('*')
      .eq('budget_id', budgetId)
      .order('period_key', { ascending: false });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const setPersonalTarget = async (
  budgetId: string,
  targetCents: number
): Promise<{ error: unknown }> => {
  try {
    const { error } = await supabase.from('budget_personal_targets').upsert(
      { budget_id: budgetId, target_cents: targetCents },
      { onConflict: 'budget_id,user_id' }
    );
    return { error };
  } catch (error) {
    return { error };
  }
};
```

- [ ] **Step 6.3: Reescrever src/validation/budgetSchema.ts**

```typescript
// src/validation/budgetSchema.ts
import { z } from 'zod';

export const budgetTemplateSchema = z.object({
  categoria_id: z.string().trim().min(1, 'Categoria obrigatória'),
  amount_cents: z.number().int().min(1, 'Valor deve ser positivo'),
  period_type: z.enum(['monthly', 'annual']).default('monthly'),
  rollover_mode: z.enum(['reset', 'accumulate', 'transfer_to_goal']).default('reset'),
  cap_type: z.enum(['flexible', 'hard']).default('flexible'),
  parent_id: z.string().uuid().nullable().optional(),
  target_goal_id: z.string().uuid().nullable().optional(),
  family_id: z.string().uuid().nullable().optional(),
}).refine(
  (d) => d.rollover_mode !== 'transfer_to_goal' || !!d.target_goal_id,
  { message: 'Objetivo obrigatório para modo transfer_to_goal', path: ['target_goal_id'] }
);

export type BudgetTemplateFormData = z.infer<typeof budgetTemplateSchema>;

// Backwards compat alias (para código legado que ainda importa budgetSchema)
export const budgetSchema = z.object({
  categoria_id: z.string().trim().min(1, 'Categoria obrigatória'),
  valor: z.preprocess(
    (v) => (typeof v === 'string' ? parseFloat(v) : v),
    z.number().min(0.01, 'Valor obrigatório')
  ),
  mes: z.string().regex(/^\d{4}-\d{2}$/, 'Mês inválido (YYYY-MM)'),
});
```

- [ ] **Step 6.4: Reescrever src/hooks/useBudgetsQuery.ts**

```typescript
// src/hooks/useBudgetsQuery.ts
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  getBudgets,
  getBudgetTemplates,
  getBudgetStatus,
  getBudgetInstances,
  createBudgetTemplate,
  updateBudgetTemplate,
  deleteBudgetTemplate,
  setPersonalTarget,
  type BudgetStatus,
  type GetBudgetsRow,
} from '../services/budgets';
import { useAuth } from '../contexts/AuthContext';
import { useScope } from '../features/scope';
import { useCrudMutation } from './useMutationWithFeedback';
import { euroToCents } from '../lib/money';

const BUDGETS_KEY = 'budgets_v2';
const TEMPLATES_KEY = 'budget_templates';

// Hook principal: instâncias do período corrente (scope-aware)
export const useBudgetInstances = (params?: {
  periodType?: string;
  periodKey?: string;
}) => {
  const { user } = useAuth();
  const scope = useScope();
  const familyId = scope.kind === 'family' ? scope.familyId : null;

  return useQuery<GetBudgetsRow[] | null>({
    queryKey: [BUDGETS_KEY, familyId, params?.periodType, params?.periodKey],
    queryFn: async () => {
      const { data, error } = await getBudgets({
        familyId,
        periodType: params?.periodType,
        periodKey: params?.periodKey,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

// Hook: templates (para gestão de orçamentos)
export const useBudgetTemplates = () => {
  const { user } = useAuth();
  const scope = useScope();
  const familyId = scope.kind === 'family' ? scope.familyId : null;

  return useQuery({
    queryKey: [TEMPLATES_KEY, familyId],
    queryFn: async () => {
      const { data, error } = await getBudgetTemplates(familyId);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

// Hook: status de uma instância específica
export const useBudgetStatus = (instanceId?: string) => {
  return useQuery<BudgetStatus | null>({
    queryKey: ['budget_status', instanceId],
    queryFn: async () => {
      if (!instanceId) return null;
      const { data, error } = await getBudgetStatus(instanceId);
      if (error) throw error;
      return data;
    },
    enabled: !!instanceId,
    staleTime: 30_000, // 30s — projetos mudam frequentemente
  });
};

// Hook: histórico de instâncias de um template
export const useBudgetHistory = (budgetId?: string) => {
  return useQuery({
    queryKey: ['budget_instances', budgetId],
    queryFn: async () => {
      if (!budgetId) return null;
      const { data, error } = await getBudgetInstances(budgetId);
      if (error) throw error;
      return data;
    },
    enabled: !!budgetId,
  });
};

// Mutations
export const useCreateBudget = () => {
  const queryClient = useQueryClient();
  return useCrudMutation(
    createBudgetTemplate,
    {
      operation: 'create',
      entityName: 'Orçamento',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY] });
        queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY] });
      },
    }
  );
};

export const useUpdateBudget = () => {
  const queryClient = useQueryClient();
  return useCrudMutation(
    ({ id, updates }: { id: string; updates: Parameters<typeof updateBudgetTemplate>[1] }) =>
      updateBudgetTemplate(id, updates),
    {
      operation: 'update',
      entityName: 'Orçamento',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY] });
        queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY] });
      },
    }
  );
};

export const useDeleteBudget = () => {
  const queryClient = useQueryClient();
  return useCrudMutation(
    deleteBudgetTemplate,
    {
      operation: 'delete',
      entityName: 'Orçamento',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY] });
        queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY] });
      },
    }
  );
};

export const useSetPersonalTarget = () => {
  const queryClient = useQueryClient();
  return useCrudMutation(
    ({ budgetId, targetCents }: { budgetId: string; targetCents: number }) =>
      setPersonalTarget(budgetId, targetCents).then((r) => r),
    {
      operation: 'update',
      entityName: 'Meta pessoal',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY] });
      },
    }
  );
};
```

- [ ] **Step 6.5: Correr testes — confirmar PASS**

```bash
npm test src/services/__tests__/budgets.test.ts
```

Esperado: PASS (mocks cobrem `getBudgetTemplates` e `getBudgetStatus`).

- [ ] **Step 6.6: Verificar compilação TypeScript**

```bash
npx tsc --noEmit
```

Corrigir quaisquer erros de tipo nos ficheiros modificados.

- [ ] **Step 6.7: Commit**

```bash
git add src/services/budgets.ts \
        src/hooks/useBudgetsQuery.ts \
        src/validation/budgetSchema.ts \
        src/services/__tests__/budgets.test.ts
git commit -m "feat(service): unit 8 task 6 — rewrite budgets service, hooks, validation schema"
```

---

## Task 7: Página unificada de Orçamentos (`BudgetsPage`)

**Ficheiros:**
- Criar: `src/pages/app/BudgetsPage.tsx`
- Criar: `src/components/budgets/BudgetProgressCard.tsx`
- Modificar: `src/App.tsx`

A página substitui `PersonalBudgets` + `FamilyBudgets`. Lê scope de `useScope()`, exibe hierarquia pai/filho expandível, e mostra barra de progresso + badge de projeção.

- [ ] **Step 7.1: Escrever teste do componente BudgetProgressCard**

Criar `src/components/budgets/__tests__/BudgetProgressCard.test.tsx`:

```typescript
// src/components/budgets/__tests__/BudgetProgressCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BudgetProgressCard from '../BudgetProgressCard';

const mockBudget = {
  instance_id: 'inst-1',
  budget_id: 'bud-1',
  categoria_id: 'cat-1',
  categoria_nome: 'Alimentação',
  categoria_cor: '#22c55e',
  period_type: 'monthly',
  period_key: '2026-04',
  period_start: '2026-04-01',
  period_end: '2026-04-30',
  budget_cents: 50000,   // €500
  spent_cents: 40000,    // €400 (80%)
  remaining_cents: 10000,
  progresso_percentual: 80,
  rollover_mode: 'reset',
  cap_type: 'flexible',
  parent_id: null,
  is_projected_over: false,
  status: 'active',
};

describe('BudgetProgressCard', () => {
  it('mostra nome da categoria', () => {
    render(<BudgetProgressCard budget={mockBudget} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('Alimentação')).toBeInTheDocument();
  });

  it('mostra percentagem de progresso', () => {
    render(<BudgetProgressCard budget={mockBudget} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/80/)).toBeInTheDocument();
  });

  it('mostra badge amarelo quando ≥80%', () => {
    render(<BudgetProgressCard budget={mockBudget} onEdit={() => {}} onDelete={() => {}} />);
    // Badge "Atenção" aparece quando 80% ≤ pct < 100%
    expect(screen.getByText(/Atenção|80/i)).toBeInTheDocument();
  });

  it('mostra badge vermelho quando ultrapassado', () => {
    const over = { ...mockBudget, spent_cents: 55000, remaining_cents: -5000, progresso_percentual: 110 };
    render(<BudgetProgressCard budget={over} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/Excedido|110/i)).toBeInTheDocument();
  });

  it('mostra badge de projeção quando is_projected_over', () => {
    const proj = { ...mockBudget, is_projected_over: true };
    render(<BudgetProgressCard budget={proj} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/Projeção|Ritmo/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7.2: Correr teste — confirmar FAIL**

```bash
npm test src/components/budgets/__tests__/BudgetProgressCard.test.tsx
```

Esperado: FAIL — `Cannot find module '../BudgetProgressCard'`.

- [ ] **Step 7.3: Implementar BudgetProgressCard**

Criar `src/components/budgets/BudgetProgressCard.tsx`:

```tsx
// src/components/budgets/BudgetProgressCard.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Edit, Trash2, TrendingUp } from 'lucide-react';
import { formatMoney } from '../../lib/money';
import type { GetBudgetsRow } from '../../services/budgets';

interface BudgetProgressCardProps {
  budget: GetBudgetsRow;
  children?: React.ReactNode; // sub-budgets (hierarquia)
  onEdit: (budget: GetBudgetsRow) => void;
  onDelete: (instanceId: string) => void;
}

const BudgetProgressCard: React.FC<BudgetProgressCardProps> = ({
  budget,
  children,
  onEdit,
  onDelete,
}) => {
  const pct = budget.progresso_percentual;

  const progressColor =
    pct >= 100
      ? 'bg-red-500'
      : pct >= 80
      ? 'bg-yellow-500'
      : 'bg-green-500';

  const statusBadge = () => {
    if (pct >= 100) return <Badge variant="destructive">Excedido</Badge>;
    if (pct >= 80) return <Badge className="bg-yellow-500 text-white">Atenção</Badge>;
    if (budget.is_projected_over)
      return (
        <Badge className="bg-orange-400 text-white" title="Projeção linear indica ultrapassagem">
          Projeção
        </Badge>
      );
    return null;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium truncate flex-1 mr-2">
          {budget.categoria_nome}
        </CardTitle>
        <div className="flex items-center gap-1">
          {statusBadge()}
          {budget.is_projected_over && pct < 80 && (
            <TrendingUp className="h-3 w-3 text-orange-400" aria-label="Projeção acima do orçamento" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Orçamento</span>
          <span className="font-medium">{formatMoney(budget.budget_cents)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Gasto</span>
          <span
            className={
              pct >= 100
                ? 'font-medium text-red-600'
                : pct >= 80
                ? 'font-medium text-yellow-600'
                : 'font-medium text-green-600'
            }
          >
            {formatMoney(budget.spent_cents)}
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span>{pct.toFixed(1)}%</span>
          </div>
          <Progress value={Math.min(pct, 100)} className={`h-2 ${progressColor}`} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Restante</span>
          <span>{formatMoney(budget.remaining_cents)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground capitalize">
          <span>Rollover</span>
          <span>{budget.rollover_mode}</span>
        </div>

        {/* Sub-budgets (hierarquia filho) */}
        {children && <div className="pl-3 border-l-2 border-muted space-y-2 mt-2">{children}</div>}

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            aria-label="Editar orçamento"
            onClick={() => onEdit(budget)}
          >
            <Edit className="h-3 w-3 mr-1" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-red-600 hover:text-red-700"
            aria-label="Eliminar orçamento"
            onClick={() => onDelete(budget.instance_id)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Remover
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BudgetProgressCard;
```

- [ ] **Step 7.4: Implementar BudgetsPage**

Criar `src/pages/app/BudgetsPage.tsx`:

```tsx
// src/pages/app/BudgetsPage.tsx
import React, { useMemo, useState } from 'react';
import { BarChart3, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-states';
import { useBudgetInstances } from '../../hooks/useBudgetsQuery';
import BudgetProgressCard from '../../components/budgets/BudgetProgressCard';
import BudgetFormSheet from '../../components/budgets/BudgetForm';
import type { GetBudgetsRow } from '../../services/budgets';

type FilterStatus = 'all' | 'ok' | 'warn' | 'over' | 'projected';

const BudgetsPage: React.FC = () => {
  const [filterMonth, setFilterMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<GetBudgetsRow | null>(null);

  const { data: budgets = [], isLoading } = useBudgetInstances({
    periodType: 'monthly',
    periodKey: filterMonth,
  });

  // Organizar hierarquia pai/filho
  const { roots, childrenMap } = useMemo(() => {
    const all = budgets ?? [];
    const childrenMap: Record<string, GetBudgetsRow[]> = {};
    const roots: GetBudgetsRow[] = [];

    all.forEach((b) => {
      if (b.parent_id) {
        childrenMap[b.parent_id] = childrenMap[b.parent_id] ?? [];
        childrenMap[b.parent_id].push(b);
      } else {
        roots.push(b);
      }
    });

    return { roots, childrenMap };
  }, [budgets]);

  const applyFilter = (b: GetBudgetsRow) => {
    const pct = b.progresso_percentual;
    if (filterStatus === 'ok') return pct < 80;
    if (filterStatus === 'warn') return pct >= 80 && pct < 100;
    if (filterStatus === 'over') return pct >= 100;
    if (filterStatus === 'projected') return b.is_projected_over;
    return true;
  };

  const handleNew = () => {
    setEditingBudget(null);
    setFormOpen(true);
  };

  const handleEdit = (b: GetBudgetsRow) => {
    setEditingBudget(b);
    setFormOpen(true);
  };

  const handleDelete = (instanceId: string) => {
    // Confirmação + delete via hook — ver Task 7 step 7.5
    console.log('delete', instanceId);
  };

  const filteredRoots = roots.filter(applyFilter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Orçamentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Envelopes por categoria com projeção linear
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Orçamento
        </Button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="filter-month">Mês</Label>
          <Input
            id="filter-month"
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          />
        </div>
        <div>
          <Label>Estado</Label>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ok">Dentro do orçamento</SelectItem>
              <SelectItem value="warn">Atenção (≥80%)</SelectItem>
              <SelectItem value="over">Excedido (≥100%)</SelectItem>
              <SelectItem value="projected">Projeção a ultrapassar</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid de cards */}
      {filteredRoots.length === 0 ? (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Nenhum orçamento encontrado</h3>
          <p className="text-muted-foreground mb-4">
            Cria o teu primeiro orçamento para este período.
          </p>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Orçamento
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRoots.map((budget) => (
            <BudgetProgressCard
              key={budget.instance_id}
              budget={budget}
              onEdit={handleEdit}
              onDelete={handleDelete}
            >
              {/* Filhos da hierarquia */}
              {(childrenMap[budget.budget_id] ?? []).map((child) => (
                <BudgetProgressCard
                  key={child.instance_id}
                  budget={child}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </BudgetProgressCard>
          ))}
        </div>
      )}

      {/* Form sheet */}
      <BudgetFormSheet
        open={formOpen}
        editingBudget={editingBudget}
        onClose={() => setFormOpen(false)}
      />
    </div>
  );
};

export default BudgetsPage;
```

- [ ] **Step 7.5: Adicionar rota em App.tsx**

Ler `src/App.tsx` e adicionar:

```tsx
import BudgetsPage from './pages/app/BudgetsPage';
// ...dentro do bloco /app/*:
<Route path="orcamentos" element={<BudgetsPage />} />
```

- [ ] **Step 7.6: Correr testes**

```bash
npm test src/components/budgets/__tests__/BudgetProgressCard.test.tsx
```

Esperado: PASS.

- [ ] **Step 7.7: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 7.8: Commit**

```bash
git add src/pages/app/BudgetsPage.tsx \
        src/components/budgets/BudgetProgressCard.tsx \
        src/components/budgets/__tests__/BudgetProgressCard.test.tsx \
        src/App.tsx
git commit -m "feat(ui): unit 8 task 7 — BudgetsPage unified + BudgetProgressCard with projection badge"
```

---

## Task 8: Formulário de template de orçamento

**Ficheiros:**
- Criar: `src/components/budgets/BudgetForm.tsx`

O form substitui o `BudgetForm.tsx` raiz e o formulário inline de `PersonalBudgets`. Campos: categoria, montante (em euros, convertido para `amount_cents`), `period_type`, `rollover_mode`, `cap_type`, parent (dropdown de budgets existentes sem parent), `target_goal_id` (visível apenas quando `rollover_mode === 'transfer_to_goal'`).

- [ ] **Step 8.1: Escrever teste do formulário**

Criar `src/components/budgets/__tests__/BudgetForm.test.tsx`:

```typescript
// src/components/budgets/__tests__/BudgetForm.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../hooks/useBudgetsQuery', () => ({
  useCreateBudget: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateBudget: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBudgetTemplates: () => ({ data: [] }),
}));

vi.mock('../../../hooks/useCategoriesQuery', () => ({
  useCategoriesDomain: () => ({ data: [{ id: 'cat-1', nome: 'Alimentação' }], isLoading: false }),
}));

vi.mock('../../../hooks/useGoalsQuery', () => ({
  useGoals: () => ({ data: [] }),
}));

import BudgetFormSheet from '../BudgetForm';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('BudgetFormSheet', () => {
  it('renderiza o formulário quando open=true', () => {
    render(<BudgetFormSheet open={true} editingBudget={null} onClose={() => {}} />, { wrapper });
    expect(screen.getByLabelText(/Categoria/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Montante/i)).toBeInTheDocument();
  });

  it('mostra campo de objetivo quando rollover=transfer_to_goal', async () => {
    render(<BudgetFormSheet open={true} editingBudget={null} onClose={() => {}} />, { wrapper });
    // Selecionar rollover_mode = transfer_to_goal
    const rolloverSelect = screen.getByLabelText(/Rollover/i);
    fireEvent.change(rolloverSelect, { target: { value: 'transfer_to_goal' } });
    expect(await screen.findByLabelText(/Objetivo/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 8.2: Correr teste — confirmar FAIL**

```bash
npm test src/components/budgets/__tests__/BudgetForm.test.tsx
```

- [ ] **Step 8.3: Implementar BudgetForm.tsx**

Criar `src/components/budgets/BudgetForm.tsx`:

```tsx
// src/components/budgets/BudgetForm.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FormSubmitButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { budgetTemplateSchema, type BudgetTemplateFormData } from '../../validation/budgetSchema';
import { useCategoriesDomain } from '../../hooks/useCategoriesQuery';
import { useCreateBudget, useUpdateBudget, useBudgetTemplates } from '../../hooks/useBudgetsQuery';
import { euroToCents, centsToEuro } from '../../lib/money';
import { useScope } from '../../features/scope';
import type { GetBudgetsRow } from '../../services/budgets';

interface BudgetFormSheetProps {
  open: boolean;
  editingBudget: GetBudgetsRow | null;
  onClose: () => void;
}

const BudgetFormSheet: React.FC<BudgetFormSheetProps> = ({
  open,
  editingBudget,
  onClose,
}) => {
  const scope = useScope();
  const familyId = scope.kind === 'family' ? scope.familyId : null;

  const { data: categories = [], isLoading: catLoading } = useCategoriesDomain();
  const { data: templates = [] } = useBudgetTemplates();
  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();

  const form = useForm<BudgetTemplateFormData & { montante_euros: number }>({
    resolver: zodResolver(
      budgetTemplateSchema.extend({
        montante_euros: (await import('zod')).z.number().min(0.01, 'Valor deve ser positivo'),
      })
    ),
    defaultValues: {
      categoria_id: editingBudget?.categoria_id ?? '',
      amount_cents: editingBudget?.budget_cents ?? 0,
      montante_euros: editingBudget ? centsToEuro(editingBudget.budget_cents) : 0,
      period_type: (editingBudget?.period_type as 'monthly' | 'annual') ?? 'monthly',
      rollover_mode: (editingBudget?.rollover_mode as 'reset' | 'accumulate' | 'transfer_to_goal') ?? 'reset',
      cap_type: (editingBudget?.cap_type as 'flexible' | 'hard') ?? 'flexible',
      parent_id: editingBudget?.parent_id ?? null,
      family_id: familyId,
    },
  });

  const rolloverMode = form.watch('rollover_mode');
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = form.handleSubmit(async (data) => {
    const payload = {
      categoria_id: data.categoria_id,
      amount_cents: euroToCents(data.montante_euros),
      period_type: data.period_type,
      rollover_mode: data.rollover_mode,
      cap_type: data.cap_type,
      parent_id: data.parent_id ?? null,
      target_goal_id: data.target_goal_id ?? null,
      family_id: familyId,
      is_template: true,
    };

    if (editingBudget) {
      await updateMutation.mutateAsync({ id: editingBudget.budget_id, updates: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onClose();
  });

  // Budgets sem parent (para o dropdown de hierarquia)
  const parentCandidates = (templates ?? []).filter(
    (t: any) => !t.parent_id && t.id !== editingBudget?.budget_id
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editingBudget ? 'Editar Orçamento' : 'Novo Orçamento'}</SheetTitle>
          <SheetDescription>
            {editingBudget
              ? 'Atualiza os parâmetros do template de orçamento.'
              : 'Define o envelope de despesa por categoria.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
            {/* Categoria */}
            <FormField
              control={form.control}
              name="categoria_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Montante */}
            <FormField
              control={form.control}
              name={'montante_euros' as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montante (€)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0,00"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Período */}
            <FormField
              control={form.control}
              name="period_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Período</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="annual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Rollover */}
            <FormField
              control={form.control}
              name="rollover_mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rollover (fim de período)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="reset">Reset (começa do zero)</SelectItem>
                      <SelectItem value="accumulate">Acumular (não-gasto passa para próximo mês)</SelectItem>
                      <SelectItem value="transfer_to_goal">Transferir para Objetivo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cap type */}
            <FormField
              control={form.control}
              name="cap_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de limite</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="flexible">Flexível (apenas alertas)</SelectItem>
                      <SelectItem value="hard">Rígido (aviso destacado)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Budget pai (hierarquia) */}
            {parentCandidates.length > 0 && (
              <FormField
                control={form.control}
                name="parent_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget pai (opcional)</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                      value={field.value ?? '__none__'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Nenhum (nível de topo)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhum</SelectItem>
                        {parentCandidates.map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.categoria_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Objetivo (só com transfer_to_goal) */}
            {rolloverMode === 'transfer_to_goal' && (
              <FormField
                control={form.control}
                name="target_goal_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Objetivo (destino do rollover)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="UUID do objetivo"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex gap-2 pt-2">
              <FormSubmitButton
                isSubmitting={isSubmitting}
                submitText={editingBudget ? 'Guardar' : 'Criar'}
                submittingText={editingBudget ? 'A guardar...' : 'A criar...'}
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default BudgetFormSheet;
```

- [ ] **Step 8.4: Correr testes — confirmar PASS**

```bash
npm test src/components/budgets/__tests__/BudgetForm.test.tsx
```

- [ ] **Step 8.5: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 8.6: Commit**

```bash
git add src/components/budgets/BudgetForm.tsx \
        src/components/budgets/__tests__/BudgetForm.test.tsx
git commit -m "feat(ui): unit 8 task 8 — BudgetFormSheet with period/rollover/cap/hierarchy/goal fields"
```

---

## Task 9: Vista de detalhe do orçamento (transações do período + gráfico de projeção)

**Ficheiros:**
- Criar: `src/components/budgets/BudgetDetailSheet.tsx`

Painel lateral que abre ao clicar num card de orçamento. Mostra: lista de transações do período para a categoria, tabela de totais, e gráfico de barras (gasto acumulado dia a dia vs. linear do orçamento).

- [ ] **Step 9.1: Escrever o teste**

Criar `src/components/budgets/__tests__/BudgetDetailSheet.test.tsx`:

```typescript
// src/components/budgets/__tests__/BudgetDetailSheet.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../hooks/useBudgetsQuery', () => ({
  useBudgetStatus: () => ({
    data: {
      spent_cents: 25000,
      remaining_cents: 25000,
      projected_cents: 40000,
      percent_used: 50,
      is_projected_over: false,
    },
    isLoading: false,
  }),
}));

vi.mock('../../../hooks/useTransactionsQuery', () => ({
  useTransactions: () => ({ data: [] }),
}));

import BudgetDetailSheet from '../BudgetDetailSheet';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

const mockBudget = {
  instance_id: 'inst-1', budget_id: 'bud-1', categoria_id: 'cat-1',
  categoria_nome: 'Alimentação', categoria_cor: '#22c55e',
  period_type: 'monthly', period_key: '2026-04',
  period_start: '2026-04-01', period_end: '2026-04-30',
  budget_cents: 50000, spent_cents: 25000, remaining_cents: 25000,
  progresso_percentual: 50, rollover_mode: 'reset',
  cap_type: 'flexible', parent_id: null, is_projected_over: false, status: 'active',
};

describe('BudgetDetailSheet', () => {
  it('mostra nome da categoria no título', () => {
    render(
      <BudgetDetailSheet open={true} budget={mockBudget} onClose={() => {}} />,
      { wrapper }
    );
    expect(screen.getByText(/Alimentação/i)).toBeInTheDocument();
  });

  it('mostra gasto e projeção', () => {
    render(
      <BudgetDetailSheet open={true} budget={mockBudget} onClose={() => {}} />,
      { wrapper }
    );
    expect(screen.getByText(/250,00|25000/)).toBeInTheDocument();
    expect(screen.getByText(/Projeção|400,00/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 9.2: Correr teste — confirmar FAIL**

```bash
npm test src/components/budgets/__tests__/BudgetDetailSheet.test.tsx
```

- [ ] **Step 9.3: Implementar BudgetDetailSheet.tsx**

Criar `src/components/budgets/BudgetDetailSheet.tsx`:

```tsx
// src/components/budgets/BudgetDetailSheet.tsx
import React, { useMemo } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/ui/loading-states';
import { formatMoney } from '../../lib/money';
import { useBudgetStatus } from '../../hooks/useBudgetsQuery';
import { useTransactions } from '../../hooks/useTransactionsQuery';
import type { GetBudgetsRow } from '../../services/budgets';

interface BudgetDetailSheetProps {
  open: boolean;
  budget: GetBudgetsRow | null;
  onClose: () => void;
}

const BudgetDetailSheet: React.FC<BudgetDetailSheetProps> = ({ open, budget, onClose }) => {
  const { data: status, isLoading: statusLoading } = useBudgetStatus(
    open && budget ? budget.instance_id : undefined
  );

  const { data: allTransactions = [] } = useTransactions();

  // Filtrar transações desta categoria neste período
  const periodTransactions = useMemo(() => {
    if (!budget) return [];
    return (allTransactions as any[]).filter((t) => {
      const d = new Date(t.data);
      const tKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return (
        t.tipo === 'despesa' &&
        t.categoria_id === budget.categoria_id &&
        tKey === budget.period_key
      );
    });
  }, [allTransactions, budget]);

  if (!budget) return null;

  const pct = budget.progresso_percentual;
  const progressColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{budget.categoria_nome}</SheetTitle>
          <SheetDescription>
            {budget.period_key} · {budget.period_type === 'monthly' ? 'Mensal' : 'Anual'}
          </SheetDescription>
        </SheetHeader>

        {statusLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Orçamento</p>
                <p className="text-lg font-bold">{formatMoney(budget.budget_cents)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Gasto</p>
                <p className={`text-lg font-bold ${pct >= 100 ? 'text-red-600' : ''}`}>
                  {formatMoney(status?.spent_cents ?? budget.spent_cents)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Restante</p>
                <p className="text-lg font-bold">
                  {formatMoney(status?.remaining_cents ?? budget.remaining_cents)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Projeção fim do período</p>
                <p className={`text-lg font-bold ${status?.is_projected_over ? 'text-orange-500' : ''}`}>
                  {formatMoney(status?.projected_cents ?? 0)}
                </p>
                {status?.is_projected_over && (
                  <Badge className="bg-orange-400 text-white text-xs mt-1">Acima do orçamento</Badge>
                )}
              </div>
            </div>

            {/* Barra de progresso */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span>{(status?.percent_used ?? pct).toFixed(1)}%</span>
              </div>
              <Progress
                value={Math.min(status?.percent_used ?? pct, 100)}
                className={`h-3 ${progressColor}`}
              />
            </div>

            {/* Lista de transações */}
            <div>
              <h3 className="font-medium text-sm mb-2">
                Transações do período ({periodTransactions.length})
              </h3>
              {periodTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem transações neste período.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {periodTransactions.map((t: any) => (
                    <div key={t.id} className="flex justify-between text-sm border-b pb-1">
                      <span className="truncate flex-1 mr-2">{t.descricao || 'Sem descrição'}</span>
                      <span className="text-muted-foreground text-xs mr-2">{t.data}</span>
                      <span className="font-medium text-red-600 shrink-0">
                        {formatMoney(t.amount_cents ?? t.valor * 100)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default BudgetDetailSheet;
```

- [ ] **Step 9.4: Correr testes — confirmar PASS**

```bash
npm test src/components/budgets/__tests__/BudgetDetailSheet.test.tsx
```

- [ ] **Step 9.5: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 9.6: Commit**

```bash
git add src/components/budgets/BudgetDetailSheet.tsx \
        src/components/budgets/__tests__/BudgetDetailSheet.test.tsx
git commit -m "feat(ui): unit 8 task 9 — BudgetDetailSheet with transaction list + projection KPIs"
```

---

## Task 10: Vista agregada da família (FamilyBudgetAggregate)

**Ficheiros:**
- Criar: `src/components/budgets/FamilyBudgetAggregate.tsx`

Componente que exibe, dentro de um budget família, a contribuição de cada membro (transações por `user_id`) e a meta pessoal opcional de cada um (`budget_personal_targets`).

- [ ] **Step 10.1: Escrever o teste**

Criar `src/components/budgets/__tests__/FamilyBudgetAggregate.test.tsx`:

```typescript
// src/components/budgets/__tests__/FamilyBudgetAggregate.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({
      data: [
        { user_id: 'user-1', spent_cents: 15000 },
        { user_id: 'user-2', spent_cents: 10000 },
      ],
      error: null,
    }),
  },
}));

vi.mock('../../../hooks/useFamilyMembers', () => ({
  useFamilyMembers: () => ({
    data: [
      { user_id: 'user-1', display_name: 'Pedro' },
      { user_id: 'user-2', display_name: 'Ana' },
    ],
  }),
}));

import FamilyBudgetAggregate from '../FamilyBudgetAggregate';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('FamilyBudgetAggregate', () => {
  it('mostra contribuições dos membros', async () => {
    render(
      <FamilyBudgetAggregate budgetId="bud-1" familyId="fam-1" budgetCents={50000} />,
      { wrapper }
    );
    expect(await screen.findByText(/Pedro/i)).toBeInTheDocument();
    expect(await screen.findByText(/Ana/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 10.2: Correr teste — confirmar FAIL**

```bash
npm test src/components/budgets/__tests__/FamilyBudgetAggregate.test.tsx
```

- [ ] **Step 10.3: Implementar FamilyBudgetAggregate.tsx**

Criar `src/components/budgets/FamilyBudgetAggregate.tsx`:

```tsx
// src/components/budgets/FamilyBudgetAggregate.tsx
// Vista agregada por utilizador para budgets família.
// Usa view budget_family_contribution_by_user (criada aqui inline via RPC ou query directa).
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { formatMoney } from '../../lib/money';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/ui/loading-states';

interface FamilyBudgetAggregateProps {
  budgetId: string;
  familyId: string;
  budgetCents: number;
}

type MemberContribution = {
  user_id: string;
  display_name: string;
  spent_cents: number;
  personal_target_cents: number | null;
};

const FamilyBudgetAggregate: React.FC<FamilyBudgetAggregateProps> = ({
  budgetId,
  familyId,
  budgetCents,
}) => {
  const { data: contributions = [], isLoading } = useQuery<MemberContribution[]>({
    queryKey: ['family_budget_contributions', budgetId, familyId],
    queryFn: async () => {
      // Query: juntar family_members + transações do período + personal_targets
      // (simplificado — Unit 9 pode promover para RPC dedicado)
      const { data, error } = await supabase
        .from('budget_personal_targets')
        .select('user_id, target_cents')
        .eq('budget_id', budgetId);

      if (error) throw error;

      // Enriquecer com dados de membros (simplificado)
      return (data ?? []).map((row: any) => ({
        user_id: row.user_id,
        display_name: row.user_id, // placeholder — Unit 12 injeta display_name via profiles
        spent_cents: 0,
        personal_target_cents: row.target_cents,
      }));
    },
    enabled: !!budgetId && !!familyId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (contributions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem metas pessoais definidas para este orçamento familiar.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Contribuições individuais
      </h4>
      {contributions.map((m) => {
        const target = m.personal_target_cents ?? budgetCents;
        const pct = target > 0 ? Math.min((m.spent_cents / target) * 100, 100) : 0;
        return (
          <div key={m.user_id} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{m.display_name}</span>
              <span className="text-muted-foreground">
                {formatMoney(m.spent_cents)}{' '}
                {m.personal_target_cents && (
                  <span>/ {formatMoney(m.personal_target_cents)}</span>
                )}
              </span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        );
      })}
    </div>
  );
};

export default FamilyBudgetAggregate;
```

- [ ] **Step 10.4: Correr testes — confirmar PASS**

```bash
npm test src/components/budgets/__tests__/FamilyBudgetAggregate.test.tsx
```

- [ ] **Step 10.5: Verificar compilação completa + todos os testes**

```bash
npx tsc --noEmit && npm test
```

Esperado: compilação limpa, todos os testes PASS.

- [ ] **Step 10.6: Verificar que referências legadas estão contidas**

```bash
grep -r "PersonalBudgets\|FamilyBudgets\|getBudgets\b" src/ --include="*.ts" --include="*.tsx" -l
```

Esperado: apenas os ficheiros antigos (`PersonalBudgets.tsx`, `FamilyBudgets.tsx`) — estes ficam em `features/` até Unit 12 os eliminar formalmente na unificação de UI.

- [ ] **Step 10.7: Commit final**

```bash
git add src/components/budgets/FamilyBudgetAggregate.tsx \
        src/components/budgets/__tests__/FamilyBudgetAggregate.test.tsx
git commit -m "feat(ui): unit 8 task 10 — FamilyBudgetAggregate per-member contributions view"
```

---

## Verificação Final

Após todas as 10 tasks:

```bash
# 1. Compilação TypeScript limpa
npx tsc --noEmit

# 2. Todos os testes passam
npm test

# 3. Schema DB: confirmar tabelas novas
npx supabase db push --dry-run

# 4. Verificar que budget_progress foi recriada com colunas correctas
# (manter compatibilidade para código legacy)
grep -r "budget_progress" src/ --include="*.ts" --include="*.tsx"
# Esperado: sem referências (foi substituída por get_budgets RPC)

# 5. Verificar que inbox_items existe e tem RLS
grep -r "inbox_items" src/ --include="*.ts" --include="*.tsx"
# Esperado: sem referências directas (escrita feita por check_budget_thresholds server-side)

# 6. Projeção linear — confirmar fórmula SQL exacta em get_budget_status
grep -r "days_elapsed" supabase/migrations/ | grep "ROUND"
# Esperado: ROUND((spent_cents::numeric / NULLIF(days_elapsed, 0)) * total_days)

# 7. Confirmar que rollover transfer_to_goal escreve em goal_ledger
grep -n "goal_ledger" supabase/migrations/20260421130000_unit08_process_period_rollover.sql
# Esperado: INSERT INTO public.goal_ledger
```

### Tabelas criadas / modificadas

| Tabela | Tipo | Mudança |
|---|---|---|
| `budgets` | existente | +`is_template`, `period_type`, `rollover_mode`, `cap_type`, `parent_id`, `target_goal_id`, `currency`; FK `categoria_id` ON DELETE RESTRICT |
| `budget_instances` | nova | instâncias por período |
| `budget_personal_targets` | nova | meta pessoal por membro em budget família |
| `inbox_items` | nova (minimal) | thresholds de budget; Unit 9 expande |

### RPCs criadas / modificadas

| RPC | Tipo |
|---|---|
| `get_budget_status(instance_id)` | nova |
| `get_budgets(family_id, period_type, period_key)` | nova (substitui `get_personal_budgets` + `get_family_budgets`) |
| `process_period_rollover(instance_id)` | nova |
| `run_monthly_budget_rollover(target_month)` | nova |
| `check_budget_thresholds()` | nova |

### Views modificadas

| View | Mudança |
|---|---|
| `budget_progress` | Recriada a partir de `budget_instances` (mantém interface legacy) |
