-- supabase/migrations/20260503121000_unit13_rpcs_fix.sql
-- Corrective patch for Unit 13 RPCs:
--   Fix 1: transfer_ownership — promote new owner BEFORE demoting caller
--           (prevents min-1-owner check from firing too early)
--   Fix 2: split_transaction_among_members — reject empty shares array early

BEGIN;

-- 1. transfer_ownership (fixed: promote-first order)
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

  UPDATE family_members SET role = 'owner'
    WHERE family_id = p_family_id AND user_id = p_new_owner_id;

  UPDATE family_members SET role = 'admin'
    WHERE family_id = p_family_id AND user_id = auth.uid();

  INSERT INTO family_audit_log (family_id, user_id, action, entity_type, entity_id)
    VALUES (p_family_id, auth.uid(), 'transfer_ownership', 'user', p_new_owner_id);
END;
$$;

-- 2. split_transaction_among_members (fixed: empty shares guard added)
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
  IF jsonb_array_length(p_shares) = 0 THEN
    RAISE EXCEPTION 'SHARES_EMPTY: cannot split with empty shares array';
  END IF;

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

COMMIT;
