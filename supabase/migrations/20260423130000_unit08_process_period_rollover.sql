-- supabase/migrations/20260423130000_unit08_process_period_rollover.sql
-- Unit 8 Task 4: process_period_rollover + run_monthly_budget_rollover

set local search_path = public;

-- Função principal de rollover por instância
CREATE OR REPLACE FUNCTION public.process_period_rollover(p_instance_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bi          public.budget_instances%ROWTYPE;
  v_b           public.budgets%ROWTYPE;
  v_unspent     bigint;
  v_next_key    text;
  v_next_start  date;
  v_next_end    date;
  v_next_budget bigint;
  v_new_id      uuid;
BEGIN
  SELECT * INTO v_bi FROM public.budget_instances WHERE id = p_instance_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'budget_instance % not found', p_instance_id;
  END IF;
  IF v_bi.status != 'active' THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'already_closed');
  END IF;

  SELECT * INTO v_b FROM public.budgets WHERE id = v_bi.budget_id;

  -- Calcular não-gasto
  v_unspent := GREATEST(0, v_bi.budget_cents - v_bi.spent_cents);

  -- Calcular próximo período
  IF v_b.period_type = 'monthly' THEN
    v_next_start := (date_trunc('month', v_bi.period_start) + interval '1 month')::date;
    v_next_end   := (v_next_start + interval '1 month - 1 day')::date;
    v_next_key   := to_char(v_next_start, 'YYYY-MM');
  ELSE -- annual
    v_next_start := (date_trunc('year', v_bi.period_start) + interval '1 year')::date;
    v_next_end   := (v_next_start + interval '1 year - 1 day')::date;
    v_next_key   := to_char(v_next_start, 'YYYY');
  END IF;

  -- Fechar instância corrente
  UPDATE public.budget_instances
  SET status = 'rolled_over', updated_at = now()
  WHERE id = p_instance_id;

  -- Determinar budget do próximo período conforme rollover_mode
  CASE v_b.rollover_mode
    WHEN 'reset' THEN
      v_next_budget := v_b.amount_cents;

    WHEN 'accumulate' THEN
      v_next_budget := v_b.amount_cents + v_unspent;

    WHEN 'transfer_to_goal' THEN
      v_next_budget := v_b.amount_cents;
      -- Transferir não-gasto para goal via goal_ledger
      IF v_unspent > 0 AND v_b.target_goal_id IS NOT NULL THEN
        INSERT INTO public.goal_ledger (
          goal_id, tipo, amount_cents, signed, data, created_by
        ) VALUES (
          v_b.target_goal_id,
          'contribution',
          v_unspent,
          1,
          v_bi.period_end,
          v_b.user_id
        );
      END IF;

    ELSE
      v_next_budget := v_b.amount_cents;
  END CASE;

  -- Criar próxima instância (idempotente)
  INSERT INTO public.budget_instances (
    budget_id, period_key, period_start, period_end,
    budget_cents, carried_over_cents, status
  ) VALUES (
    v_bi.budget_id,
    v_next_key,
    v_next_start,
    v_next_end,
    v_next_budget,
    CASE WHEN v_b.rollover_mode = 'accumulate' THEN v_unspent ELSE 0 END,
    'active'
  )
  ON CONFLICT (budget_id, period_key) DO NOTHING
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'closed_instance_id', p_instance_id,
    'new_instance_id',    v_new_id,
    'rollover_mode',      v_b.rollover_mode,
    'unspent_cents',      v_unspent,
    'next_period_key',    v_next_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_period_rollover(uuid) TO service_role;

-- Orquestrador mensal: chamado pelo daily-scheduler no dia 1
CREATE OR REPLACE FUNCTION public.run_monthly_budget_rollover(
  p_target_month date DEFAULT now()::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period_key     text := to_char(p_target_month, 'YYYY-MM');
  v_prev_key       text := to_char(p_target_month - interval '1 month', 'YYYY-MM');
  v_period_start   date := date_trunc('month', p_target_month)::date;
  v_period_end     date := (date_trunc('month', p_target_month) + interval '1 month - 1 day')::date;
  v_template       record;
  v_prev_instance  record;
  v_created        int := 0;
  v_rolled         int := 0;
  v_result         jsonb;
BEGIN
  -- 1. Para cada template mensal activo, fechar instância anterior e criar nova
  FOR v_template IN
    SELECT b.* FROM public.budgets b
    WHERE b.is_template = true AND b.period_type = 'monthly'
  LOOP
    -- Fechar instância do mês anterior via rollover
    SELECT * INTO v_prev_instance
    FROM public.budget_instances
    WHERE budget_id = v_template.id
      AND period_key = v_prev_key
      AND status = 'active';

    IF FOUND THEN
      PERFORM public.process_period_rollover(v_prev_instance.id);
      v_rolled := v_rolled + 1;
    ELSE
      -- Não houve instância anterior (primeiro mês ou gap): criar directamente
      INSERT INTO public.budget_instances (
        budget_id, period_key, period_start, period_end, budget_cents, status
      ) VALUES (
        v_template.id, v_period_key, v_period_start, v_period_end,
        v_template.amount_cents, 'active'
      )
      ON CONFLICT (budget_id, period_key) DO NOTHING;
      v_created := v_created + 1;
    END IF;
  END LOOP;

  -- 2. Garantir que o rollover já criou a instância do novo mês;
  --    se não, criar directamente (fallback)
  FOR v_template IN
    SELECT b.* FROM public.budgets b
    WHERE b.is_template = true AND b.period_type = 'monthly'
  LOOP
    INSERT INTO public.budget_instances (
      budget_id, period_key, period_start, period_end, budget_cents, status
    ) VALUES (
      v_template.id, v_period_key, v_period_start, v_period_end,
      v_template.amount_cents, 'active'
    )
    ON CONFLICT (budget_id, period_key) DO NOTHING;
  END LOOP;

  v_result := jsonb_build_object(
    'target_month',  v_period_key,
    'rolled_over',   v_rolled,
    'created',       v_created
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_monthly_budget_rollover(date) TO service_role;
