-- supabase/migrations/20260424110000_unit07_goals_views_rpcs.sql
-- Unit 07: Update goals_with_balance view + add completion/query RPCs

BEGIN;

-- ============================================================
-- 1. goals_with_balance: enrich with computed fields
-- ============================================================
DROP VIEW IF EXISTS public.goals_with_balance CASCADE;

CREATE OR REPLACE VIEW public.goals_with_balance AS
SELECT
  g.id,
  g.user_id,
  g.nome,
  g.prazo,
  g.created_at,
  g.updated_at,
  g.family_id,
  g.target_cents,
  g.ativa,
  g.status,
  g.valor_atual,
  g.valor_meta,
  g.account_id,
  g.tipo,
  g.priority,
  g.order_index,
  g.target_account_id,
  -- legacy alias (euros)
  g.target_cents::numeric / 100.0  AS valor_objetivo,
  -- current balance from ledger
  COALESCE(SUM(gl.amount_cents * gl.signed), 0) AS valor_atual_cents,
  -- progress 0-100
  CASE
    WHEN g.target_cents > 0
    THEN ROUND(COALESCE(SUM(gl.amount_cents * gl.signed), 0)::numeric / g.target_cents * 100, 2)
    ELSE 0
  END AS progress_percent,
  -- months required from today to reach target, given current balance + deadline
  CASE
    WHEN g.prazo IS NOT NULL AND g.target_cents > 0
      AND g.prazo::date > current_date
    THEN GREATEST(
      CEIL(
        (g.target_cents - COALESCE(SUM(gl.amount_cents * gl.signed), 0))::numeric
        / NULLIF(
            (EXTRACT(YEAR FROM age(g.prazo::date::timestamp, current_timestamp))::numeric * 12
             + EXTRACT(MONTH FROM age(g.prazo::date::timestamp, current_timestamp))::numeric),
            0
        )
      )::bigint,
      0
    )
    ELSE NULL
  END AS required_monthly_cents,
  -- behind schedule: less than expected linear progress given deadline
  CASE
    WHEN g.prazo IS NOT NULL AND g.target_cents > 0
      AND g.prazo::date > current_date
    THEN
      COALESCE(SUM(gl.amount_cents * gl.signed), 0)::numeric <
      (
        g.target_cents::numeric
        * (current_date - g.created_at::date)::numeric
        / NULLIF((g.prazo::date - g.created_at::date)::numeric, 0)
      )
    ELSE false
  END AS is_behind_schedule
FROM public.goals g
LEFT JOIN public.goal_ledger gl ON gl.goal_id = g.id
GROUP BY
  g.id, g.user_id, g.nome, g.prazo, g.created_at, g.updated_at,
  g.family_id, g.target_cents, g.ativa, g.status, g.valor_atual,
  g.valor_meta, g.account_id, g.tipo, g.priority, g.order_index, g.target_account_id;

GRANT SELECT ON public.goals_with_balance TO authenticated;
ALTER VIEW public.goals_with_balance SET (security_invoker = true);

-- ============================================================
-- 2. goal_progress: recreate after cascade drop above
-- ============================================================
CREATE OR REPLACE VIEW public.goal_progress AS
SELECT
  g.id,
  g.user_id,
  g.nome,
  g.target_cents::numeric / 100.0             AS valor_objetivo,
  gwb.valor_atual_cents / 100.0               AS total_alocado_real,
  gwb.valor_atual_cents / 100.0               AS total_alocado_historico,
  gwb.progress_percent                        AS progresso_percentual,
  CASE
    WHEN g.target_cents <= 0                      THEN 'indefinido'
    WHEN gwb.valor_atual_cents >= g.target_cents  THEN 'completo'
    WHEN gwb.valor_atual_cents > 0                THEN 'em_progresso'
    ELSE 'nao_iniciado'
  END AS status_objetivo
FROM public.goals g
JOIN public.goals_with_balance gwb ON gwb.id = g.id;

GRANT SELECT ON public.goal_progress TO authenticated;
GRANT SELECT ON public.goal_progress TO service_role;
ALTER VIEW public.goal_progress SET (security_invoker = true);

-- ============================================================
-- 3. get_goals_with_balance RPC (scope-aware)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_goals_with_balance(
  p_family_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id                     uuid,
  user_id                uuid,
  nome                   text,
  prazo                  text,
  tipo                   text,
  priority               smallint,
  order_index            int,
  status                 text,
  ativa                  boolean,
  family_id              uuid,
  target_cents           bigint,
  valor_atual_cents      bigint,
  progress_percent       numeric,
  required_monthly_cents bigint,
  is_behind_schedule     boolean,
  target_account_id      uuid,
  created_at             timestamptz,
  updated_at             timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    id,
    user_id,
    nome,
    prazo::text,
    tipo,
    priority,
    order_index,
    status,
    COALESCE(ativa, true),
    family_id,
    target_cents,
    valor_atual_cents::bigint,
    progress_percent,
    required_monthly_cents::bigint,
    is_behind_schedule,
    target_account_id,
    created_at,
    updated_at
  FROM public.goals_with_balance
  WHERE
    CASE
      WHEN p_family_id IS NOT NULL THEN family_id = p_family_id
      ELSE user_id = auth.uid() AND family_id IS NULL
    END
    AND COALESCE(ativa, true) = true
  ORDER BY order_index ASC, priority ASC, created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_goals_with_balance(uuid) TO authenticated;

-- ============================================================
-- 4. get_goal_ledger RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_goal_ledger(
  p_goal_id uuid
)
RETURNS TABLE (
  id           uuid,
  goal_id      uuid,
  account_id   uuid,
  tipo         text,
  amount_cents bigint,
  signed       smallint,
  data         date,
  created_by   uuid,
  reversal_of  uuid,
  created_at   timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id, goal_id, account_id, tipo, amount_cents, signed, data,
         created_by, reversal_of, created_at
  FROM public.goal_ledger
  WHERE goal_id = p_goal_id
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_goal_ledger(uuid) TO authenticated;

-- ============================================================
-- 5. complete_goal RPC
-- action: 'transfer' | 'snowball' | 'spend' | 'keep'
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_goal(
  p_goal_id           uuid,
  p_action            text,
  p_target_account_id uuid DEFAULT NULL,
  p_other_goal_id     uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance_cents bigint;
  v_user_id       uuid;
  v_operation_id  uuid := gen_random_uuid();
BEGIN
  -- Verify ownership
  SELECT user_id INTO v_user_id
    FROM public.goals
   WHERE id = p_goal_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal not found or not owned by current user';
  END IF;

  -- Get current balance
  SELECT COALESCE(SUM(amount_cents * signed), 0)
    INTO v_balance_cents
    FROM public.goal_ledger
   WHERE goal_id = p_goal_id;

  IF p_action = 'keep' THEN
    UPDATE public.goals
       SET status = 'completed', ativa = false, updated_at = now()
     WHERE id = p_goal_id;
    RETURN jsonb_build_object('action', 'keep', 'balance_cents', v_balance_cents);

  ELSIF p_action = 'transfer' THEN
    IF p_target_account_id IS NULL THEN
      RAISE EXCEPTION 'target_account_id required for transfer action';
    END IF;
    INSERT INTO public.goal_ledger(goal_id, account_id, tipo, amount_cents, signed, operation_id, created_by)
    VALUES (p_goal_id, p_target_account_id, 'completion_transfer', v_balance_cents, -1, v_operation_id, auth.uid());
    UPDATE public.goals
       SET status = 'completed', ativa = false, updated_at = now()
     WHERE id = p_goal_id;
    RETURN jsonb_build_object('action', 'transfer', 'released_cents', v_balance_cents);

  ELSIF p_action = 'snowball' THEN
    IF p_other_goal_id IS NULL THEN
      RAISE EXCEPTION 'other_goal_id required for snowball action';
    END IF;
    INSERT INTO public.goal_ledger(goal_id, account_id, tipo, amount_cents, signed, operation_id, created_by)
    VALUES (p_goal_id, NULL, 'completion_snowball', v_balance_cents, -1, v_operation_id, auth.uid());
    INSERT INTO public.goal_ledger(goal_id, account_id, tipo, amount_cents, signed, operation_id, created_by)
    VALUES (p_other_goal_id, NULL, 'allocation', v_balance_cents, 1, v_operation_id, auth.uid());
    UPDATE public.goals
       SET status = 'completed', ativa = false, updated_at = now()
     WHERE id = p_goal_id;
    RETURN jsonb_build_object('action', 'snowball', 'moved_cents', v_balance_cents, 'target_goal_id', p_other_goal_id);

  ELSIF p_action = 'spend' THEN
    INSERT INTO public.goal_ledger(goal_id, account_id, tipo, amount_cents, signed, operation_id, created_by)
    VALUES (p_goal_id, NULL, 'completion_spend', v_balance_cents, -1, v_operation_id, auth.uid());
    UPDATE public.goals
       SET status = 'completed', ativa = false, updated_at = now()
     WHERE id = p_goal_id;
    RETURN jsonb_build_object('action', 'spend', 'released_cents', v_balance_cents);

  ELSE
    RAISE EXCEPTION 'Unknown action: %. Must be transfer|snowball|spend|keep', p_action;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_goal(uuid, text, uuid, uuid) TO authenticated;

COMMIT;
