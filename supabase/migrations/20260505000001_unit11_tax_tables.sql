-- supabase/migrations/20260505000001_unit11_tax_tables.sql
-- CREATE tax_tables (does not exist yet) and seed 2026 IRS progressive brackets.
-- Despacho 233-A/2026 (IRS retenção na fonte - Portugal 2026)
-- Rates in basis points (1000 bp = 10%), income values in cents (annual).

BEGIN;

SET search_path = public;

CREATE TABLE IF NOT EXISTS public.tax_tables (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_year  int  NOT NULL DEFAULT 2026,
  min_annual_cents bigint NOT NULL,
  max_annual_cents bigint NOT NULL,
  marginal_rate_bp int    NOT NULL,  -- basis points: 1300 = 13%
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_tables_year_bracket_key UNIQUE (effective_year, min_annual_cents)
);

ALTER TABLE public.tax_tables ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated users (data is not user-specific)
DROP POLICY IF EXISTS sel_tax_tables ON public.tax_tables;
CREATE POLICY sel_tax_tables ON public.tax_tables
  FOR SELECT TO authenticated USING (true);
-- No INSERT/UPDATE/DELETE policies: reference data is managed via migrations only.

-- Seed 2026 brackets (only if not already present)
INSERT INTO public.tax_tables (effective_year, min_annual_cents, max_annual_cents, marginal_rate_bp)
VALUES
  (2026,        0,   770300, 1300),
  (2026,   770300,  1162300, 1650),
  (2026,  1162300,  1647200, 2200),
  (2026,  1647200,  2132100, 2500),
  (2026,  2132100,  2714600, 3200),
  (2026,  2714600,  3979100, 3550),
  (2026,  3979100,  5199700, 4350),
  (2026,  5199700,  8119900, 4500),
  (2026,  8119900, 9223372036854775807, 4800)  -- top bracket: bigint max as open-ended sentinel
ON CONFLICT ON CONSTRAINT tax_tables_year_bracket_key DO NOTHING;

COMMIT;
