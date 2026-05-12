-- supabase/migrations/20260505000002_unit11_payroll_contracts.sql
-- Extend payroll_contracts with:
--   account_id: which bank account receives the net salary
--   status: 'active'|'inactive' (replaces is_active boolean pattern)
-- Contract versioning: UNIQUE partial index ensures max 1 active per user.

BEGIN;

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
  SET status = CASE WHEN COALESCE(is_active, true) THEN 'active' ELSE 'inactive' END;

-- Unique partial index: max 1 active contract per user
CREATE UNIQUE INDEX IF NOT EXISTS payroll_contracts_one_active_per_user_idx
  ON public.payroll_contracts(user_id)
  WHERE status = 'active';

COMMIT;
