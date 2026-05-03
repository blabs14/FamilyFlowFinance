-- supabase/migrations/20260425110000_unit09_inbox_scheduler_rpcs.sql
-- Unit 09: run_recurring_rules RPC + confirm/skip instance RPCs

BEGIN;

-- ============================================================
-- 1. run_recurring_rules(p_horizon_days)
-- Generates recurring_instances + inbox_items for confirm-mode rules
-- Called by daily-scheduler Edge Function
-- ============================================================
CREATE OR REPLACE FUNCTION public.run_recurring_rules(
  p_horizon_days int DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule       RECORD;
  v_instance_id uuid;
  v_count_created int := 0;
  v_count_inbox   int := 0;
  v_horizon       date := current_date + p_horizon_days;
BEGIN
  FOR v_rule IN
    SELECT r.*
    FROM public.recurring_rules r
    WHERE r.status = 'active'
      AND r.next_run_date::date <= v_horizon
      AND (r.end_date IS NULL OR r.end_date::date >= current_date)
    ORDER BY r.next_run_date
  LOOP
    -- Idempotent: skip if instance already exists for this due_date
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.recurring_instances ri
      WHERE ri.rule_id = v_rule.id
        AND ri.due_date = v_rule.next_run_date::date
    );

    -- Create instance: pending for confirm mode, posted for auto mode
    INSERT INTO public.recurring_instances (
      rule_id,
      due_date,
      period_key,
      status,
      amount_cents,
      currency
    ) VALUES (
      v_rule.id,
      v_rule.next_run_date::date,
      TO_CHAR(v_rule.next_run_date::date, 'YYYY-MM'),
      CASE WHEN v_rule.execution_mode = 'auto' THEN 'posted' ELSE 'pending' END,
      v_rule.amount_cents,
      v_rule.currency
    )
    RETURNING id INTO v_instance_id;

    v_count_created := v_count_created + 1;

    -- Create inbox_item for confirm mode (user needs to act)
    IF v_rule.execution_mode = 'confirm' THEN
      INSERT INTO public.inbox_items (
        user_id,
        family_id,
        source_type,
        source_id,
        title,
        due_at
      ) VALUES (
        v_rule.user_id,
        v_rule.family_id,
        'recurring_instance',
        v_instance_id,
        'Confirmar: ' || COALESCE(v_rule.payee, v_rule.description, 'Recorrente'),
        v_rule.next_run_date::timestamptz
      );
      v_count_inbox := v_count_inbox + 1;
    END IF;

    -- Advance next_run_date by interval
    UPDATE public.recurring_rules
    SET
      next_run_date = CASE v_rule.interval_unit
        WHEN 'day'   THEN (v_rule.next_run_date::date + (v_rule.interval_count || ' days')::interval)::date::text
        WHEN 'week'  THEN (v_rule.next_run_date::date + (v_rule.interval_count * 7 || ' days')::interval)::date::text
        WHEN 'month' THEN (v_rule.next_run_date::date + (v_rule.interval_count || ' months')::interval)::date::text
        WHEN 'year'  THEN (v_rule.next_run_date::date + (v_rule.interval_count || ' years')::interval)::date::text
        ELSE v_rule.next_run_date
      END,
      last_run_date = current_date::text,
      updated_at    = now()
    WHERE id = v_rule.id;

  END LOOP;

  RETURN jsonb_build_object(
    'instances_created',    v_count_created,
    'inbox_items_created',  v_count_inbox,
    'run_at',               now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_recurring_rules(int) TO service_role;

-- ============================================================
-- 2. confirm_recurring_instance(p_instance_id)
-- Marks instance as confirmed and dismisses its inbox_item
-- Returns instance data so UI can optionally create a transaction
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_recurring_instance(
  p_instance_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance RECORD;
BEGIN
  SELECT ri.id, ri.amount_cents, ri.due_date, ri.currency,
         rr.user_id AS rule_user_id
  INTO v_instance
  FROM public.recurring_instances ri
  JOIN public.recurring_rules rr ON rr.id = ri.rule_id
  WHERE ri.id = p_instance_id
    AND ri.status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Instance not found or not pending');
  END IF;

  -- Only the owner can confirm
  IF v_instance.rule_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  UPDATE public.recurring_instances
  SET status = 'confirmed', confirmed_at = now()
  WHERE id = p_instance_id;

  UPDATE public.inbox_items
  SET status = 'done', completed_at = now()
  WHERE source_type = 'recurring_instance' AND source_id = p_instance_id;

  RETURN jsonb_build_object(
    'ok',          true,
    'instance_id', p_instance_id,
    'amount_cents', v_instance.amount_cents,
    'due_date',    v_instance.due_date,
    'currency',    v_instance.currency
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_recurring_instance(uuid) TO authenticated;

-- ============================================================
-- 3. skip_recurring_instance(p_instance_id)
-- Marks instance as skipped and dismisses its inbox_item
-- ============================================================
CREATE OR REPLACE FUNCTION public.skip_recurring_instance(
  p_instance_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule_user_id uuid;
BEGIN
  SELECT rr.user_id INTO v_rule_user_id
  FROM public.recurring_instances ri
  JOIN public.recurring_rules rr ON rr.id = ri.rule_id
  WHERE ri.id = p_instance_id AND ri.status IN ('pending', 'scheduled');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Instance not found or already actioned');
  END IF;

  IF v_rule_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  UPDATE public.recurring_instances
  SET status = 'skipped'
  WHERE id = p_instance_id;

  UPDATE public.inbox_items
  SET status = 'dismissed', completed_at = now()
  WHERE source_type = 'recurring_instance' AND source_id = p_instance_id;

  RETURN jsonb_build_object('ok', true, 'instance_id', p_instance_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.skip_recurring_instance(uuid) TO authenticated;

COMMIT;
