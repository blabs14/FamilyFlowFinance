-- supabase/migrations/20260505000003_unit11_payroll_payslips.sql
-- Extend payroll_payslips for the Unit 11 integrated posting flow.
-- The existing table keeps all legacy columns intact.
-- period_id becomes nullable (new payslips use period text directly).
-- New columns: contract_id, period, status, transaction_id, irs_cents, ss_cents, working_days, components.

BEGIN;

SET search_path = public;

-- Make period_id nullable (new payslips bypass payroll_periods)
-- Safe version: only drop NOT NULL if it is currently enforced
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payroll_payslips'
      AND column_name = 'period_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.payroll_payslips ALTER COLUMN period_id DROP NOT NULL;
  END IF;
END
$$;

-- New columns (ADD COLUMN IF NOT EXISTS for idempotency)
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

COMMIT;
