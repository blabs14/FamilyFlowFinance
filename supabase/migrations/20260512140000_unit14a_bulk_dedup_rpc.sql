-- supabase/migrations/20260512140000_unit14a_bulk_dedup_rpc.sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION bulk_fuzzy_dedup(
  p_account_id  uuid,
  p_rows        jsonb
)
RETURNS TABLE (
  row_index                     integer,
  row_status                    text,
  matched_transaction_id        uuid,
  matched_recurring_instance_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r jsonb;
  v_date        date;
  v_amount      integer;
  v_description text;
  v_idx         integer;
  v_txn_id      uuid;
  v_rec_id      uuid;
  v_status      text;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_idx         := (r->>'row_index')::integer;
    v_date        := (r->>'date')::date;
    v_amount      := (r->>'amount_cents')::integer;
    v_description := r->>'description';
    v_txn_id      := NULL;
    v_rec_id      := NULL;
    v_status      := 'ok';

    -- Pass 1: exact duplicate against transactions
    SELECT id INTO v_txn_id
    FROM transactions
    WHERE account_id = p_account_id
      AND ABS(date - v_date) <= 2
      AND ABS(amount_cents - v_amount) <= 2
    LIMIT 1;

    IF v_txn_id IS NOT NULL THEN
      v_status := 'duplicate';
    ELSE
      -- Pass 1b: probable duplicate (same amount, similar description, ±5d)
      SELECT id INTO v_txn_id
      FROM transactions
      WHERE account_id = p_account_id
        AND ABS(date - v_date) <= 5
        AND amount_cents = v_amount
        AND similarity(description, v_description) >= 0.7
      LIMIT 1;

      IF v_txn_id IS NOT NULL THEN
        v_status := 'probable_duplicate';
      END IF;
    END IF;

    -- Pass 2: recurring instances (only if not already a hard duplicate)
    IF v_status <> 'duplicate' THEN
      SELECT id INTO v_rec_id
      FROM recurring_instances
      WHERE account_id = p_account_id
        AND status IN ('pending','confirmed')
        AND ABS(due_date - v_date) <= 2
        AND ABS(amount_cents - v_amount) <= 2
      LIMIT 1;

      IF v_rec_id IS NOT NULL THEN
        v_status := 'matches_recurring';
      END IF;
    END IF;

    row_index                     := v_idx;
    row_status                    := v_status;
    matched_transaction_id        := v_txn_id;
    matched_recurring_instance_id := v_rec_id;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION bulk_fuzzy_dedup(uuid, jsonb) TO authenticated;

COMMIT;
