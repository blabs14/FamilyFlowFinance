-- supabase/migrations/20260512200000_unit15_user_preferences.sql
BEGIN;

-- 1. Ensure deletion_tokens table exists (may already exist in remote DB)
CREATE TABLE IF NOT EXISTS deletion_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text        NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE deletion_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "deletion_tokens_owner_select" ON deletion_tokens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "deletion_tokens_owner_insert" ON deletion_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "deletion_tokens_owner_delete" ON deletion_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- 2. Create deletion_audit table (audit trail for processed deletions)
CREATE TABLE IF NOT EXISTS deletion_audit (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL,          -- no FK: user is gone by the time this writes
  deleted_at   timestamptz NOT NULL DEFAULT now(),
  token        text        NOT NULL,
  error_detail text
);
ALTER TABLE deletion_audit ENABLE ROW LEVEL SECURITY;
-- Only service role can read (no user-facing policy: user is deleted)
COMMENT ON TABLE deletion_audit IS 'Audit trail of completed account deletions — written by process-account-deletion EF.';

-- 4. Create user_preferences table
CREATE TABLE user_preferences (
  user_id                              uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  language                             text        NOT NULL DEFAULT 'pt-PT'
                                                     CHECK (language IN ('pt-PT','en-US')),
  currency                             text        NOT NULL DEFAULT 'EUR',
  timezone                             text        NOT NULL DEFAULT 'Europe/Lisbon',
  theme                                text        NOT NULL DEFAULT 'system'
                                                     CHECK (theme IN ('light','dark','system')),
  compact_mode                         boolean     NOT NULL DEFAULT false,
  show_currency_symbol                 boolean     NOT NULL DEFAULT true,
  onboarding_completed_at              timestamptz,
  -- Notification matrix: 12 events × 2 channels (email + inapp)
  notif_goal_target_reached_email      boolean     NOT NULL DEFAULT true,
  notif_goal_target_reached_inapp      boolean     NOT NULL DEFAULT true,
  notif_goal_deadline_near_email       boolean     NOT NULL DEFAULT false,
  notif_goal_deadline_near_inapp       boolean     NOT NULL DEFAULT true,
  notif_budget_80pct_email             boolean     NOT NULL DEFAULT false,
  notif_budget_80pct_inapp             boolean     NOT NULL DEFAULT true,
  notif_budget_100pct_email            boolean     NOT NULL DEFAULT true,
  notif_budget_100pct_inapp            boolean     NOT NULL DEFAULT true,
  notif_recurring_needs_confirm_email  boolean     NOT NULL DEFAULT false,
  notif_recurring_needs_confirm_inapp  boolean     NOT NULL DEFAULT true,
  notif_recurring_posted_email         boolean     NOT NULL DEFAULT false,
  notif_recurring_posted_inapp         boolean     NOT NULL DEFAULT false,
  notif_card_statement_ready_email     boolean     NOT NULL DEFAULT true,
  notif_card_statement_ready_inapp     boolean     NOT NULL DEFAULT true,
  notif_family_invite_email            boolean     NOT NULL DEFAULT true,
  notif_family_invite_inapp            boolean     NOT NULL DEFAULT true,
  notif_family_audit_email             boolean     NOT NULL DEFAULT false,
  notif_family_audit_inapp             boolean     NOT NULL DEFAULT true,
  notif_large_inbound_email            boolean     NOT NULL DEFAULT false,
  notif_large_inbound_inapp            boolean     NOT NULL DEFAULT true,
  notif_large_outbound_email           boolean     NOT NULL DEFAULT false,
  notif_large_outbound_inapp           boolean     NOT NULL DEFAULT true,
  notif_import_completed_email         boolean     NOT NULL DEFAULT false,
  notif_import_completed_inapp         boolean     NOT NULL DEFAULT true,
  large_threshold_cents                bigint      NOT NULL DEFAULT 50000,
  updated_at                           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_owner"
  ON user_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast notification-channel queries from daily-scheduler
CREATE INDEX user_preferences_notif_budget_100pct_email_idx
  ON user_preferences (user_id)
  WHERE notif_budget_100pct_email = true;

-- 5. Trigger: auto-create row on signup
CREATE OR REPLACE FUNCTION create_user_preferences_on_signup()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_preferences ON auth.users;
CREATE TRIGGER on_auth_user_created_preferences
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_preferences_on_signup();

-- 6. Backfill existing users from profiles.personal_settings JSONB
INSERT INTO user_preferences (user_id, language, currency, theme, compact_mode, show_currency_symbol)
SELECT
  p.user_id,
  COALESCE(p.personal_settings->>'language', 'pt-PT'),
  COALESCE(p.personal_settings->>'currency', 'EUR'),
  COALESCE(
    p.personal_settings->'appearance'->>'theme',
    p.personal_settings->>'theme',
    'system'
  ),
  COALESCE((p.personal_settings->'appearance'->>'compact_mode')::boolean, false),
  COALESCE((p.personal_settings->'appearance'->>'show_currency_symbol')::boolean, true)
FROM profiles p
WHERE p.user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 7. Backfill users with no personal_settings at all
INSERT INTO user_preferences (user_id)
SELECT p.user_id FROM profiles p
WHERE p.user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 8. Drop personal_settings column (data migrated to user_preferences)
ALTER TABLE profiles DROP COLUMN IF EXISTS personal_settings;

COMMIT;
