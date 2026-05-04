-- supabase/migrations/20260503140000_unit13_audit_rls_fix.sql
-- Fix: restrict family_audit_log INSERT to service_role only (deny direct client writes)

BEGIN;

-- Drop the open insert policy
DROP POLICY IF EXISTS "family_audit_log: service role insert" ON family_audit_log;

-- Replace with service_role-restricted policy
CREATE POLICY "family_audit_log: service role insert only"
  ON family_audit_log FOR INSERT
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role'
  );

-- Fix register_family_event: validate caller is active family member before logging
CREATE OR REPLACE FUNCTION register_family_event(
  p_family_id   uuid,
  p_action      text,
  p_entity_type text DEFAULT NULL,
  p_entity_id   uuid DEFAULT NULL,
  p_diff        jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verify caller is an active member of this family
  IF NOT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = p_family_id
      AND user_id   = auth.uid()
      AND status    = 'active'
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  INSERT INTO family_audit_log (family_id, user_id, action, entity_type, entity_id, diff)
    VALUES (p_family_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_diff);
END;
$$;

COMMIT;
