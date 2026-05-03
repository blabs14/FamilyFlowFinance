-- supabase/migrations/20260423100000_unit08_budgets_template.sql
-- Unit 8 Task 1: evoluir tabela budgets para modelo template/instance
-- Pressupostos: amount_cents já existe (Unit 2 Phase 3c); family_id já existe.
-- NOTE: currency already added in phase3_budgets_goals_cents.sql — IF NOT EXISTS is safe.

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
  DROP CONSTRAINT IF EXISTS chk_transfer_to_goal_requires_goal;

ALTER TABLE public.budgets
  ADD CONSTRAINT chk_transfer_to_goal_requires_goal
    CHECK (rollover_mode != 'transfer_to_goal' OR target_goal_id IS NOT NULL);

-- 5. Constraint: ON DELETE RESTRICT em categoria_id (se ainda não existir)
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
CREATE TABLE IF NOT EXISTS public.budget_personal_targets (
  budget_id    uuid   NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  user_id      uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_cents bigint NOT NULL CHECK (target_cents > 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (budget_id, user_id)
);

ALTER TABLE public.budget_personal_targets ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY bpt_insert ON public.budget_personal_targets
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY bpt_update ON public.budget_personal_targets
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY bpt_delete ON public.budget_personal_targets
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_personal_targets TO authenticated;

COMMIT;
