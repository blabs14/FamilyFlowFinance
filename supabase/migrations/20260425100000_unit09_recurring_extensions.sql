-- supabase/migrations/20260425100000_unit09_recurring_extensions.sql
-- Unit 09: Add execution_mode, amount_mode, schedule_type to recurring_rules
--          Extend recurring_instances status + add metadata columns
--          Create inbox_items table
--          Add profiles.timezone
--          Migrate reminders → inbox_items + drop reminders

BEGIN;

-- ============================================================
-- 1. recurring_rules: new columns
-- ============================================================
ALTER TABLE public.recurring_rules
  ADD COLUMN IF NOT EXISTS execution_mode text NOT NULL DEFAULT 'confirm'
    CHECK (execution_mode IN ('auto', 'confirm')),
  ADD COLUMN IF NOT EXISTS amount_mode text NOT NULL DEFAULT 'fixed'
    CHECK (amount_mode IN ('fixed', 'variable', 'estimated')),
  ADD COLUMN IF NOT EXISTS schedule_type text NOT NULL DEFAULT 'monthly'
    CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'yearly', 'custom')),
  ADD COLUMN IF NOT EXISTS day_of_month int
    CHECK (day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31)),
  ADD COLUMN IF NOT EXISTS weekday_of_month int
    CHECK (weekday_of_month IS NULL OR (weekday_of_month BETWEEN 0 AND 6)),
  ADD COLUMN IF NOT EXISTS weekday_ordinal int
    CHECK (weekday_ordinal IS NULL OR (weekday_ordinal IN (-1, 1, 2, 3, 4))),
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'expense'
    CHECK (type IN ('expense', 'income', 'transfer'));

-- Back-fill schedule_type from interval_unit for existing rows
UPDATE public.recurring_rules SET schedule_type = CASE interval_unit
  WHEN 'day' THEN 'daily'
  WHEN 'week' THEN 'weekly'
  WHEN 'month' THEN 'monthly'
  WHEN 'year' THEN 'yearly'
  ELSE 'monthly'
END;

-- ============================================================
-- 2. recurring_instances: add metadata columns + expand status
-- ============================================================
ALTER TABLE public.recurring_instances
  ADD COLUMN IF NOT EXISTS transaction_id uuid
    REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operation_id uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz;

-- Expand status check to include 'pending' and 'confirmed'
ALTER TABLE public.recurring_instances
  DROP CONSTRAINT IF EXISTS recurring_instances_status_check;
ALTER TABLE public.recurring_instances
  ADD CONSTRAINT recurring_instances_status_check
    CHECK (status IN ('scheduled', 'posted', 'skipped', 'canceled', 'pending', 'confirmed', 'failed'));

-- ============================================================
-- 3. profiles.timezone
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Lisbon';

-- ============================================================
-- 4. inbox_items table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inbox_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id    uuid        REFERENCES public.families(id) ON DELETE CASCADE,
  source_type  text        NOT NULL
    CHECK (source_type IN ('recurring_instance', 'budget_threshold', 'goal_deadline', 'manual')),
  source_id    uuid,
  title        text        NOT NULL,
  body         text,
  due_at       timestamptz,
  status       text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'snoozed', 'done', 'dismissed')),
  snoozed_until timestamptz,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inbox_items_user_status_idx
  ON public.inbox_items (user_id, status, due_at);
CREATE INDEX IF NOT EXISTS inbox_items_source_idx
  ON public.inbox_items (source_type, source_id);

ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inbox_items' AND policyname = 'inbox_select'
  ) THEN
    CREATE POLICY inbox_select ON public.inbox_items FOR SELECT USING (
      user_id = auth.uid()
      OR (
        family_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.family_members fm
          WHERE fm.family_id = inbox_items.family_id AND fm.user_id = auth.uid()
        )
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inbox_items' AND policyname = 'inbox_insert'
  ) THEN
    CREATE POLICY inbox_insert ON public.inbox_items FOR INSERT WITH CHECK (
      user_id = auth.uid()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inbox_items' AND policyname = 'inbox_update'
  ) THEN
    CREATE POLICY inbox_update ON public.inbox_items FOR UPDATE USING (
      user_id = auth.uid()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'inbox_items' AND policyname = 'inbox_delete'
  ) THEN
    CREATE POLICY inbox_delete ON public.inbox_items FOR DELETE USING (
      user_id = auth.uid()
    );
  END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inbox_items TO service_role;

-- ============================================================
-- 5. Migrate reminders → inbox_items (source_type='manual')
-- ============================================================
INSERT INTO public.inbox_items (user_id, family_id, source_type, source_id, title, body, due_at, status)
SELECT
  user_id,
  family_id,
  'manual',
  id,           -- preserve original id as source_id for traceability
  title,
  description,
  date::timestamptz,
  'pending'
FROM public.reminders
ON CONFLICT DO NOTHING;

-- Drop reminders table
DROP TABLE IF EXISTS public.reminders CASCADE;

COMMIT;
