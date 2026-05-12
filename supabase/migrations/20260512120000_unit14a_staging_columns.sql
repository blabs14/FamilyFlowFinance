-- supabase/migrations/20260512120000_unit14a_staging_columns.sql
BEGIN;

ALTER TABLE staging_transactions
  ADD COLUMN IF NOT EXISTS row_status text
    NOT NULL DEFAULT 'ok'
    CHECK (row_status IN ('ok','warning','error','duplicate','probable_duplicate','matches_recurring')),
  ADD COLUMN IF NOT EXISTS error_detail text,
  ADD COLUMN IF NOT EXISTS matched_recurring_instance_id uuid REFERENCES recurring_instances(id),
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id),
  ADD COLUMN IF NOT EXISTS applied_rule_id uuid REFERENCES import_categorization_rules(id);

COMMIT;
