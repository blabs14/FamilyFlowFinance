-- supabase/migrations/20260503120000_unit13_rpcs.sql
-- Unit 13: transfer_ownership, soft_remove_family_member, split_transaction_among_members,
--          settle_member_balance, register_family_event RPCs

BEGIN;

-- 1. transfer_ownership
CREATE OR REPLACE FUNCTION transfer_ownership(
  p_family_id      uuid,
  p_new_owner_id   uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role
  FROM family_members
  WHERE family_id = p_family_id AND user_id = auth.uid() AND status = 'active';

  IF v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = p_family_id AND user_id = p_new_owner_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'NEW_OWNER_NOT_MEMBER';
  END IF;

  UPDATE family_members SET role = 'admin'
    WHERE family_id = p_family_id AND user_id = auth.uid();

  UPDATE family_members SET role = 'owner'
    WHERE family_id = p_family_id AND user_id = p_new_owner_id;

  INSERT INTO family_audit_log (family_id, user_id, action, entity_type, entity_id)
    VALUES (p_family_id, auth.uid(), 'transfer_ownership', 'user', p_new_owner_id);
END;
$$;

-- 2. soft_remove_family_member
CREATE OR REPLACE FUNCTION soft_remove_family_member(
  p_family_id  uuid,
  p_user_id    uuid,
  p_reason     text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role
  FROM family_members
  WHERE family_id = p_family_id AND user_id = auth.uid() AND status = 'active';

  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = p_family_id AND user_id = p_user_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'CANNOT_REMOVE_OWNER';
  END IF;

  UPDATE family_members
    SET status       = 'removed',
        removed_at   = now(),
        removed_by   = auth.uid(),
        removed_reason = p_reason
    WHERE family_id = p_family_id AND user_id = p_user_id AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBER_NOT_FOUND';
  END IF;

  INSERT INTO family_audit_log (family_id, user_id, action, entity_type, entity_id, diff)
    VALUES (p_family_id, auth.uid(), 'remove_member', 'user', p_user_id,
            jsonb_build_object('reason', p_reason));
END;
$$;

-- 3. split_transaction_among_members
CREATE OR REPLACE FUNCTION split_transaction_among_members(
  p_transaction_id uuid,
  p_shares         jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_family_id     uuid;
  v_amount_cents  bigint;
  v_sum           bigint;
  v_share         jsonb;
BEGIN
  SELECT family_id, amount_cents
    INTO v_family_id, v_amount_cents
    FROM transactions WHERE id = p_transaction_id;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'TRANSACTION_NOT_IN_FAMILY';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = v_family_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  SELECT COALESCE(SUM((s->>'share_cents')::bigint), 0)
    INTO v_sum FROM jsonb_array_elements(p_shares) s;

  IF v_sum <> v_amount_cents THEN
    RAISE EXCEPTION 'SPLIT_SUM_MISMATCH: sum=% expected=%', v_sum, v_amount_cents;
  END IF;

  DELETE FROM expense_splits WHERE transaction_id = p_transaction_id;

  FOR v_share IN SELECT * FROM jsonb_array_elements(p_shares)
  LOOP
    INSERT INTO expense_splits (transaction_id, user_id, share_cents)
      VALUES (
        p_transaction_id,
        (v_share->>'user_id')::uuid,
        (v_share->>'share_cents')::bigint
      );
  END LOOP;
END;
$$;

-- 4. settle_member_balance
-- Creates a record of settlement; inserts a transactions row as a transfer note
CREATE OR REPLACE FUNCTION settle_member_balance(
  p_family_id    uuid,
  p_from_user_id uuid,
  p_to_user_id   uuid,
  p_amount_cents bigint,
  p_from_account_id uuid,
  p_to_account_id   uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_log_id uuid;
BEGIN
  IF auth.uid() <> p_from_user_id AND NOT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = p_family_id AND user_id = auth.uid()
      AND status = 'active' AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  -- Log settlement in audit log and return its id
  INSERT INTO family_audit_log (family_id, user_id, action, entity_type, diff)
    VALUES (p_family_id, auth.uid(), 'settle_balance', 'settlement',
            jsonb_build_object(
              'from', p_from_user_id,
              'to', p_to_user_id,
              'amount_cents', p_amount_cents,
              'from_account_id', p_from_account_id,
              'to_account_id', p_to_account_id
            ))
    RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- 5. register_family_event
CREATE OR REPLACE FUNCTION register_family_event(
  p_family_id   uuid,
  p_action      text,
  p_entity_type text DEFAULT NULL,
  p_entity_id   uuid DEFAULT NULL,
  p_diff        jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO family_audit_log (family_id, user_id, action, entity_type, entity_id, diff)
    VALUES (p_family_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_diff);
END;
$$;

COMMIT;
