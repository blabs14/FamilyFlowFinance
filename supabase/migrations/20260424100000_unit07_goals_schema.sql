-- supabase/migrations/20260424100000_unit07_goals_schema.sql
-- Unit 07: Add tipo, priority, order_index, target_account_id to goals
--          Add reversal_of to goal_ledger
--          Create goal_contributors table

BEGIN;

-- ============================================================
-- 1. goals: new columns
-- ============================================================
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS tipo           text      NOT NULL DEFAULT 'savings'
    CHECK (tipo IN ('savings','amortization')),
  ADD COLUMN IF NOT EXISTS priority       smallint  NOT NULL DEFAULT 3
    CHECK (priority BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS order_index    int       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_account_id uuid   REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Back-fill: all existing goals are savings
UPDATE public.goals SET tipo = 'savings' WHERE tipo IS NULL;

-- ============================================================
-- 2. goal_ledger: add reversal_of self-FK
-- ============================================================
ALTER TABLE public.goal_ledger
  ADD COLUMN IF NOT EXISTS reversal_of uuid
    REFERENCES public.goal_ledger(id) ON DELETE SET NULL;

-- Extend tipo check to include completion entry types
ALTER TABLE public.goal_ledger
  DROP CONSTRAINT IF EXISTS goal_ledger_tipo_check;
ALTER TABLE public.goal_ledger
  ADD CONSTRAINT goal_ledger_tipo_check
    CHECK (tipo IN (
      'allocation','deallocation','contribution','correction',
      'completion_transfer','completion_spend','completion_snowball'
    ));

-- ============================================================
-- 3. goal_contributors: per-user optional target within family goal
-- ============================================================
CREATE TABLE IF NOT EXISTS public.goal_contributors (
  goal_id      uuid      NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id      uuid      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_cents bigint,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (goal_id, user_id)
);

ALTER TABLE public.goal_contributors ENABLE ROW LEVEL SECURITY;

CREATE POLICY gc_select ON public.goal_contributors FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.goals g
    WHERE g.id = goal_contributors.goal_id
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

CREATE POLICY gc_insert ON public.goal_contributors FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY gc_update ON public.goal_contributors FOR UPDATE USING (
  user_id = auth.uid()
);

CREATE POLICY gc_delete ON public.goal_contributors FOR DELETE USING (
  user_id = auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_contributors TO authenticated;

COMMIT;
