-- supabase/migrations/20260503130000_unit13_rls_triggers.sql
-- Unit 13: BEFORE INSERT/UPDATE triggers — validate family membership before any family write

BEGIN;

-- Generic validator function (reused by all table triggers)
CREATE OR REPLACE FUNCTION fn_validate_family_write()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Only validate if family_id is set on the incoming row
  IF NEW.family_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow service_role to bypass (Supabase migrations, Edge Functions, etc.)
  BEGIN
    IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN
      RETURN NEW;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- setting not available (e.g. migration context) — allow through
  END;

  -- Caller must be an active non-viewer family member
  IF NOT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = NEW.family_id
      AND user_id   = auth.uid()
      AND status    = 'active'
      AND role     <> 'viewer'
  ) THEN
    RAISE EXCEPTION 'FAMILY_WRITE_DENIED: user is not an active non-viewer member of family %',
      NEW.family_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Apply trigger to each table that has a family_id column
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accounts', 'transactions', 'budgets', 'goals',
    'recurring_rules', 'inbox_items', 'categories'
  ]
  LOOP
    -- Only add trigger if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_validate_family_write ON %I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_validate_family_write
         BEFORE INSERT OR UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION fn_validate_family_write()',
        t
      );
    END IF;
  END LOOP;
END;
$$;

COMMIT;
