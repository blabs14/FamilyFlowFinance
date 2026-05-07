-- Migration 2: add fiscal columns to existing payroll tables

-- 1. payroll_ot_policies: add ot_hours_ytd (running YTD hour counter)
ALTER TABLE payroll_ot_policies
  ADD COLUMN IF NOT EXISTS ot_hours_ytd numeric(6,2) DEFAULT 0;

-- 2. payroll_mileage_policies: add use_tax_table_rate flag
ALTER TABLE payroll_mileage_policies
  ADD COLUMN IF NOT EXISTS use_tax_table_rate boolean DEFAULT true;

-- 3. payroll_leaves: add employer_days + affects_subsidy
ALTER TABLE payroll_leaves
  ADD COLUMN IF NOT EXISTS employer_days    integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS affects_subsidy  boolean DEFAULT false;

-- 4. Fix payroll_leaves CHECK constraint to include 'vacation'
--    (existing constraint may not include vacation)
DO $$
BEGIN
  -- Drop old constraint if it exists
  ALTER TABLE payroll_leaves DROP CONSTRAINT IF EXISTS payroll_leaves_leave_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE payroll_leaves
  ADD CONSTRAINT payroll_leaves_leave_type_check
  CHECK (leave_type IN ('sick', 'vacation', 'maternity', 'paternity', 'unpaid', 'other'));
