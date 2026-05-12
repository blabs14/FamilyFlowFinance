-- supabase/migrations/20260512130000_unit14a_ingestion_files_columns.sql
BEGIN;

ALTER TABLE ingestion_files
  ADD COLUMN IF NOT EXISTS account_id           uuid REFERENCES accounts(id),
  ADD COLUMN IF NOT EXISTS detected_format      text CHECK (detected_format IN ('csv','ofx','unknown')),
  ADD COLUMN IF NOT EXISTS detected_bank        text,
  ADD COLUMN IF NOT EXISTS total_rows           integer,
  ADD COLUMN IF NOT EXISTS ok_rows              integer,
  ADD COLUMN IF NOT EXISTS error_rows           integer,
  ADD COLUMN IF NOT EXISTS duplicate_rows       integer,
  ADD COLUMN IF NOT EXISTS matched_recurring_rows integer,
  ADD COLUMN IF NOT EXISTS soft_deleted_at      timestamptz;

COMMIT;
