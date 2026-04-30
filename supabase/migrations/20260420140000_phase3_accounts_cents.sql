-- supabase/migrations/20260420140000_phase3_accounts_cents.sql
-- Phase 3a: accounts.saldo (numeric) → amount_cents (bigint) + currency
-- Drop is_goals (deferred desde Phase 2b — já não é referenciado por account_reserved)

BEGIN;

-- Adicionar novas colunas
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS amount_cents bigint;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS currency    text NOT NULL DEFAULT 'EUR';

-- Popular amount_cents a partir de saldo (saldo já zerado pela normalização de 2025-08)
UPDATE public.accounts
SET amount_cents = ROUND(COALESCE(saldo, 0) * 100)::bigint;

-- NOT NULL após populate
ALTER TABLE public.accounts ALTER COLUMN amount_cents SET NOT NULL;
ALTER TABLE public.accounts ALTER COLUMN amount_cents SET DEFAULT 0;

-- Drop colunas antigas
ALTER TABLE public.accounts DROP COLUMN IF EXISTS saldo;
ALTER TABLE public.accounts DROP COLUMN IF EXISTS is_goals;

COMMIT;
