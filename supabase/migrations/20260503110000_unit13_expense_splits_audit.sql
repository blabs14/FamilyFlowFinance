-- supabase/migrations/20260503110000_unit13_expense_splits_audit.sql
-- Unit 13: expense_splits table, family_audit_log, member_balances view

BEGIN;

-- 1. expense_splits
CREATE TABLE IF NOT EXISTS expense_splits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  share_cents   bigint NOT NULL CHECK (share_cents > 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transaction_id, user_id)
);

ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

DO $pol$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='expense_splits' AND policyname='expense_splits: family members can manage'
  ) THEN
    CREATE POLICY "expense_splits: family members can manage"
      ON expense_splits FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM transactions t
          JOIN family_members fm ON fm.family_id = t.family_id
          WHERE t.id = expense_splits.transaction_id
            AND fm.user_id = auth.uid()
            AND fm.status = 'active'
        )
      );
  END IF;
END $pol$;

-- 2. family_audit_log
CREATE TABLE IF NOT EXISTS family_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id),
  action      text NOT NULL,
  entity_type text,
  entity_id   uuid,
  diff        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE family_audit_log ENABLE ROW LEVEL SECURITY;

DO $pol2$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='family_audit_log' AND policyname='family_audit_log: admin and owner read'
  ) THEN
    CREATE POLICY "family_audit_log: admin and owner read"
      ON family_audit_log FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM family_members fm
          WHERE fm.family_id = family_audit_log.family_id
            AND fm.user_id = auth.uid()
            AND fm.status = 'active'
            AND fm.role IN ('owner', 'admin')
        )
      );
  END IF;
END $pol2$;

DO $pol3$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='family_audit_log' AND policyname='family_audit_log: service role insert'
  ) THEN
    CREATE POLICY "family_audit_log: service role insert"
      ON family_audit_log FOR INSERT
      WITH CHECK (true);
  END IF;
END $pol3$;

-- 3. member_balances view
CREATE OR REPLACE VIEW member_balances AS
SELECT
  fm.family_id,
  fm.user_id,
  COALESCE(paid.paid_cents, 0) AS paid_cents,
  COALESCE(owed.owed_cents, 0) AS owed_cents,
  COALESCE(paid.paid_cents, 0) - COALESCE(owed.owed_cents, 0) AS balance_cents
FROM family_members fm
LEFT JOIN (
  SELECT t.family_id, t.user_id, SUM(t.amount_cents)::bigint AS paid_cents
  FROM transactions t
  WHERE t.family_id IS NOT NULL
  GROUP BY t.family_id, t.user_id
) paid ON paid.family_id = fm.family_id AND paid.user_id = fm.user_id
LEFT JOIN (
  SELECT t.family_id, es.user_id, SUM(es.share_cents)::bigint AS owed_cents
  FROM expense_splits es
  JOIN transactions t ON t.id = es.transaction_id
  GROUP BY t.family_id, es.user_id
) owed ON owed.family_id = fm.family_id AND owed.user_id = fm.user_id
WHERE fm.status = 'active';

-- 4. Retention function for audit log (>180 days)
CREATE OR REPLACE FUNCTION fn_cleanup_family_audit_log()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM family_audit_log WHERE created_at < now() - interval '180 days';
$$;

-- Schedule daily cleanup at 04:00 UTC if pg_cron is available
DO $cron$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-family-audit-log',
      '0 4 * * *',
      $$SELECT fn_cleanup_family_audit_log()$$
    );
  END IF;
END $cron$;

COMMIT;
