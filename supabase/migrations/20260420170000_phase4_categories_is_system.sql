-- Phase 4: adicionar categories.is_system boolean
-- Marks built-in/system categories so the app can distinguish them from user-created ones.

BEGIN;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- Mark existing system categories
-- (convention: user_id IS NULL AND family_id IS NULL = system-owned)
UPDATE public.categories
SET is_system = true
WHERE user_id IS NULL AND family_id IS NULL;

-- Index for fast lookup of system categories
CREATE INDEX IF NOT EXISTS idx_categories_is_system
  ON public.categories(is_system)
  WHERE is_system = true;

COMMIT;
