-- supabase/migrations/20260420130000_phase2_drop_goal_allocations.sql
-- Phase 2c: atualizar RPCs para usar goal_ledger + drop goal_allocations

-- Nova função simplificada de alocação (escreve em goal_ledger)
-- allocate_to_goal_with_transaction continua a existir para compatibilidade retroativa
CREATE OR REPLACE FUNCTION public.allocate_to_goal(
  p_goal_id    uuid,
  p_account_id uuid,
  p_amount     numeric,
  p_user_id    uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cents bigint;
  v_entry_id uuid;
BEGIN
  v_cents := ROUND(p_amount * 100)::bigint;
  IF v_cents <= 0 THEN
    RAISE EXCEPTION 'Montante deve ser positivo';
  END IF;

  INSERT INTO public.goal_ledger(goal_id, account_id, tipo, amount_cents, signed, created_by)
  VALUES (p_goal_id, p_account_id, 'allocation', v_cents, 1, p_user_id)
  RETURNING id INTO v_entry_id;

  RETURN jsonb_build_object('id', v_entry_id, 'amount_cents', v_cents);
END;
$$;

-- deallocate_from_goal_with_transaction: return type muda json→jsonb; DROP antes de recriar
DROP FUNCTION IF EXISTS public.deallocate_from_goal_with_transaction(uuid, uuid, numeric, uuid);

CREATE FUNCTION public.deallocate_from_goal_with_transaction(
  goal_id_param    uuid,
  account_id_param uuid,
  amount_param     numeric,
  user_id_param    uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cents  bigint;
  v_entry_id uuid;
BEGIN
  v_cents := ROUND(amount_param * 100)::bigint;
  IF v_cents <= 0 THEN
    RAISE EXCEPTION 'Montante deve ser positivo';
  END IF;

  -- Verificar saldo disponível no ledger para esta conta
  IF (
    SELECT COALESCE(SUM(amount_cents * signed), 0)
    FROM public.goal_ledger
    WHERE goal_id = goal_id_param AND account_id = account_id_param
  ) < v_cents THEN
    RAISE EXCEPTION 'Saldo insuficiente no objetivo para esta conta';
  END IF;

  INSERT INTO public.goal_ledger(goal_id, account_id, tipo, amount_cents, signed, created_by)
  VALUES (goal_id_param, account_id_param, 'deallocation', v_cents, -1, user_id_param)
  RETURNING id INTO v_entry_id;

  RETURN jsonb_build_object('amount_released', amount_param, 'ledger_id', v_entry_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.deallocate_from_goal_with_transaction(uuid, uuid, numeric, uuid) TO authenticated;

-- account_reserved: recriar usando goal_ledger (CASCADE drop dependentes: account_balances_v1)
-- Nota: auto-reserve percentage removida intencionalmente nesta phase — será readicionada em Unit 8
DROP VIEW IF EXISTS public.account_reserved CASCADE;

CREATE VIEW public.account_reserved AS
SELECT
  gl.account_id,
  COALESCE(SUM(gl.amount_cents * gl.signed), 0)::numeric / 100.0 AS total_reservado
FROM public.goal_ledger gl
JOIN public.goals g ON g.id = gl.goal_id
WHERE g.status != 'completed'
GROUP BY gl.account_id;

GRANT SELECT ON public.account_reserved TO authenticated;
ALTER VIEW public.account_reserved SET (security_invoker = true);

-- Recriar account_balances_v1 (dropada em cascata acima)
CREATE VIEW public.account_balances_v1 AS
WITH account_transactions AS (
  SELECT
    t.account_id,
    COALESCE(SUM(
      CASE
        WHEN t.tipo = 'receita'       THEN t.valor
        WHEN t.tipo = 'despesa'       THEN -t.valor
        WHEN t.tipo = 'transferencia' THEN -t.valor
        ELSE 0
      END
    ), 0) AS saldo_atual
  FROM public.transactions t
  GROUP BY t.account_id
)
SELECT
  a.id AS account_id,
  a.nome,
  a.tipo,
  a.family_id,
  a.user_id,
  COALESCE(at.saldo_atual, 0) AS saldo_atual,
  COALESCE(ar.total_reservado, 0) AS reservado,
  CASE
    WHEN a.tipo = 'cartão de crédito' THEN 0
    ELSE COALESCE(ar.total_reservado, 0)
  END AS reservado_final,
  CASE
    WHEN a.tipo = 'cartão de crédito' THEN NULL
    ELSE GREATEST(COALESCE(at.saldo_atual, 0) - COALESCE(ar.total_reservado, 0), 0)
  END AS disponivel,
  CASE
    WHEN a.tipo = 'cartão de crédito' THEN COALESCE(at.saldo_atual, 0) < 0
    ELSE NULL
  END AS is_in_debt
FROM public.accounts a
LEFT JOIN account_transactions at ON a.id = at.account_id
LEFT JOIN public.account_reserved ar ON a.id = ar.account_id;

GRANT SELECT ON public.account_balances_v1 TO authenticated;
ALTER VIEW public.account_balances_v1 SET (security_invoker = true);

-- goal_progress: recriar usando goals_with_balance (goal_ledger como fonte de verdade)
DROP VIEW IF EXISTS public.goal_progress;

CREATE VIEW public.goal_progress AS
SELECT
  g.id,
  g.nome,
  g.valor_objetivo,
  (gwb.valor_atual_cents::numeric / 100.0) AS total_alocado_real,
  (gwb.valor_atual_cents::numeric / 100.0) AS total_alocado_historico,
  ROUND(
    (gwb.valor_atual_cents::numeric / 100.0 / NULLIF(g.valor_objetivo, 0)) * 100, 2
  ) AS progresso_percentual,
  CASE
    WHEN g.valor_objetivo <= 0 THEN 'indefinido'
    WHEN (gwb.valor_atual_cents::numeric / 100.0) >= g.valor_objetivo THEN 'completo'
    WHEN gwb.valor_atual_cents > 0 THEN 'em_progresso'
    ELSE 'nao_iniciado'
  END AS status_objetivo
FROM public.goals g
JOIN public.goals_with_balance gwb ON gwb.id = g.id;

GRANT SELECT ON public.goal_progress TO authenticated;
GRANT SELECT ON public.goal_progress TO service_role;
ALTER VIEW public.goal_progress SET (security_invoker = true);

-- Drop goal_allocations (dados migrados em Phase 2b; todas as dependências já recriadas acima)
DROP TABLE IF EXISTS public.goal_allocations CASCADE;
