-- Migration 1: tax_tables — fiscal rate store for Unit 12a
-- Creates the tax_tables table and seeds 2026 fiscal values

CREATE TABLE IF NOT EXISTS tax_tables (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_year  integer NOT NULL,
  type            text    NOT NULL,
  data            jsonb   NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (effective_year, type)
);

-- Enable RLS (read-only for authenticated users; writes via service role)
ALTER TABLE tax_tables ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  CREATE POLICY "authenticated read tax_tables"
    ON tax_tables FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2026 seed data ─────────────────────────────────────────────────────────────

-- OT rates (Lei 13/2023, duas escalas: até 100h / acima 100h)
INSERT INTO tax_tables (effective_year, type, data) VALUES
(2026, 'ot_rates', '{
  "up_to_100h": {
    "first_hour_pct": 0.25,
    "next_hours_pct": 0.375,
    "rest_day_pct":   0.50
  },
  "above_100h": {
    "first_hour_pct": 0.50,
    "next_hours_pct": 0.75,
    "rest_day_pct":   1.00
  },
  "night_work_pct": 0.25,
  "night_start": "22:00",
  "night_end":   "07:00"
}'::jsonb)
ON CONFLICT (effective_year, type) DO UPDATE SET data = EXCLUDED.data;

-- OT annual limits (hours)
INSERT INTO tax_tables (effective_year, type, data) VALUES
(2026, 'ot_annual_limits', '{
  "mpe_hours":       175,
  "others_hours":    150,
  "irct_max_hours":  200,
  "daily_max_hours": 2
}'::jsonb)
ON CONFLICT (effective_year, type) DO UPDATE SET data = EXCLUDED.data;

-- OT IRS withholding (IRS autónomo em OT desde 2025: 50% da taxa base)
INSERT INTO tax_tables (effective_year, type, data) VALUES
(2026, 'ot_irs_withholding', '{
  "autonomous_rate_of_base": 0.50,
  "since": "2025-01-01"
}'::jsonb)
ON CONFLICT (effective_year, type) DO UPDATE SET data = EXCLUDED.data;

-- Mileage caps (cap AT 2026: €0,40/km)
INSERT INTO tax_tables (effective_year, type, data) VALUES
(2026, 'mileage_caps', '{
  "cents_per_km": 40
}'::jsonb)
ON CONFLICT (effective_year, type) DO UPDATE SET data = EXCLUDED.data;

-- Travel allowance caps 2026 (PT law)
-- national_general: €65,89/day | national_admin: €72,65/day
-- foreign_general: €156,36/day | foreign_admin: €175,42/day
-- breakdown: lunch 25%, dinner 25%, sleep 50%
INSERT INTO tax_tables (effective_year, type, data) VALUES
(2026, 'travel_allowance_caps', '{
  "national_general_cents": 6589,
  "national_admin_cents":   7265,
  "foreign_general_cents":  15636,
  "foreign_admin_cents":    17542,
  "breakdown": {
    "lunch":  0.25,
    "dinner": 0.25,
    "sleep":  0.50
  }
}'::jsonb)
ON CONFLICT (effective_year, type) DO UPDATE SET data = EXCLUDED.data;
