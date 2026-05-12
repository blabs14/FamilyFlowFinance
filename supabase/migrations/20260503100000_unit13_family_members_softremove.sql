-- supabase/migrations/20260503100000_unit13_family_members_softremove.sql
-- Unit 13: family_members soft-remove, owner role, min-1-owner trigger, invite constraints

BEGIN;

-- 1. Extend role CHECK to include 'owner'
ALTER TABLE family_members
  DROP CONSTRAINT IF EXISTS family_members_role_check;

ALTER TABLE family_members
  ADD CONSTRAINT family_members_role_check
  CHECK (role IN ('owner', 'admin', 'member', 'viewer'));

-- 2. Add soft-remove columns
ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'removed')),
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS removed_reason text;

-- 3. Backfill: promote families.created_by to owner role
UPDATE family_members fm
  SET role = 'owner'
  FROM families f
  WHERE fm.family_id = f.id
    AND fm.user_id = f.created_by
    AND fm.role IN ('admin', 'member');

-- 4. Ensure at least one owner per family (use earliest member as fallback for orphan families)
UPDATE family_members fm
  SET role = 'owner'
  WHERE fm.id = (
    SELECT fm2.id FROM family_members fm2
    WHERE fm2.family_id = fm.family_id AND fm2.status = 'active'
    ORDER BY fm2.joined_at ASC LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM family_members fm3
    WHERE fm3.family_id = fm.family_id AND fm3.role = 'owner' AND fm3.status = 'active'
  );

-- 5. Trigger: block UPDATE/DELETE that would leave family without active owner
CREATE OR REPLACE FUNCTION fn_ensure_family_has_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.role = 'owner' AND NEW.role <> 'owner')
    OR (OLD.status = 'active' AND NEW.status = 'removed' AND OLD.role = 'owner') THEN
      IF NOT EXISTS (
        SELECT 1 FROM family_members
        WHERE family_id = NEW.family_id
          AND role = 'owner'
          AND status = 'active'
          AND id <> NEW.id
      ) THEN
        RAISE EXCEPTION 'A família precisa de pelo menos um owner ativo';
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'owner' THEN
      IF NOT EXISTS (
        SELECT 1 FROM family_members
        WHERE family_id = OLD.family_id
          AND role = 'owner'
          AND status = 'active'
          AND id <> OLD.id
      ) THEN
        RAISE EXCEPTION 'A família precisa de pelo menos um owner ativo';
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_family_has_owner ON family_members;
CREATE TRIGGER trg_ensure_family_has_owner
  BEFORE UPDATE OR DELETE ON family_members
  FOR EACH ROW EXECUTE FUNCTION fn_ensure_family_has_owner();

-- 6. family_invites: telemetry + unique pending constraint
ALTER TABLE family_invites
  ADD COLUMN IF NOT EXISTS invite_link_opened_at timestamptz;

DROP INDEX IF EXISTS idx_family_invites_pending_unique;
CREATE UNIQUE INDEX idx_family_invites_pending_unique
  ON family_invites (family_id, email)
  WHERE status = 'pending';

COMMIT;
