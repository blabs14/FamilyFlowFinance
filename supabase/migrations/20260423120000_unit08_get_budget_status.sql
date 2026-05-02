-- supabase/migrations/20260423120000_unit08_get_budget_status.sql
-- Unit 8 Task 3: RPC get_budget_status(p_instance_id uuid) + get_budgets unified RPC

set local search_path = public;

CREATE OR REPLACE FUNCTION public.get_budget_status(p_instance_id uuid)
RETURNS TABLE (
  spent_cents        bigint,
  remaining_cents    bigint,
  projected_cents    bigint,
  percent_used       numeric,
  is_projected_over  boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bi            public.budget_instances%ROWTYPE;
  v_b             public.budgets%ROWTYPE;
  v_spent         bigint;
  v_days_elapsed  int;
  v_total_days    int;
  v_projected     bigint;
BEGIN
  -- Carregar instância e template
  SELECT * INTO v_bi FROM public.budget_instances WHERE id = p_instance_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'budget_instance % not found', p_instance_id;
  END IF;

  SELECT * INTO v_b FROM public.budgets WHERE id = v_bi.budget_id;

  -- Verificar acesso via RLS (segurança defensiva)
  IF NOT EXISTS (
    SELECT 1 FROM public.budgets b
    WHERE b.id = v_bi.budget_id
      AND (
        (b.family_id IS NULL AND b.user_id = auth.uid())
        OR (b.family_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.family_members fm
          WHERE fm.family_id = b.family_id AND fm.user_id = auth.uid()
        ))
      )
  ) THEN
    RAISE EXCEPTION 'Acesso negado ao budget_instance %', p_instance_id;
  END IF;

  -- Calcular gasto real a partir das transações do período
  -- Inclui transaction_splits quando existir (Unit 6); fallback para transactions.amount_cents
  SELECT COALESCE(SUM(
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = 'transaction_splits')
      THEN (
        -- Com splits: somar splits da categoria
        SELECT COALESCE(SUM(ts.amount_cents), 0)
        FROM public.transaction_splits ts
        WHERE ts.transaction_id = t.id
          AND ts.categoria_id = v_b.categoria_id
      )
      ELSE t.amount_cents
    END
  ), 0)
  INTO v_spent
  FROM public.transactions t
  WHERE t.tipo = 'despesa'
    AND t.categoria_id = v_b.categoria_id
    AND t.data >= v_bi.period_start
    AND t.data <= LEAST(v_bi.period_end, current_date)
    AND (
      (v_b.family_id IS NULL AND t.user_id = v_b.user_id)
      OR (v_b.family_id IS NOT NULL AND t.family_id = v_b.family_id)
    );

  -- Atualizar spent_cents na instância (idempotente)
  UPDATE public.budget_instances
  SET spent_cents = v_spent, updated_at = now()
  WHERE id = p_instance_id;

  -- Calcular dias para projeção linear
  v_days_elapsed := GREATEST(1, current_date - v_bi.period_start + 1);
  v_total_days   := v_bi.period_end - v_bi.period_start + 1;

  -- Projeção: ROUND((spent / days_elapsed) * total_days)
  v_projected := ROUND(
    (v_spent::numeric / NULLIF(v_days_elapsed, 0)) * v_total_days
  );

  -- Resultado
  spent_cents       := v_spent;
  remaining_cents   := v_bi.budget_cents - v_spent;
  projected_cents   := v_projected;
  percent_used      := CASE
                         WHEN v_bi.budget_cents > 0
                         THEN ROUND((v_spent::numeric / v_bi.budget_cents) * 100, 2)
                         ELSE 0
                       END;
  is_projected_over := v_projected > v_bi.budget_cents;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_budget_status(uuid) TO authenticated;

-- RPC auxiliar: get_budgets(scope, period_type, period_key)
-- Unifica get_personal_budgets + get_family_budgets
CREATE OR REPLACE FUNCTION public.get_budgets(
  p_family_id   uuid    DEFAULT NULL,   -- NULL = personal scope
  p_period_type text    DEFAULT NULL,   -- NULL = todos
  p_period_key  text    DEFAULT NULL    -- NULL = todos
)
RETURNS TABLE (
  instance_id          uuid,
  budget_id            uuid,
  categoria_id         uuid,
  categoria_nome       text,
  categoria_cor        text,
  period_type          text,
  period_key           text,
  period_start         date,
  period_end           date,
  budget_cents         bigint,
  spent_cents          bigint,
  remaining_cents      bigint,
  progresso_percentual numeric,
  rollover_mode        text,
  cap_type             text,
  parent_id            uuid,
  is_projected_over    boolean,
  status               text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    bi.id,
    b.id,
    b.categoria_id,
    c.nome,
    c.cor,
    b.period_type,
    bi.period_key,
    bi.period_start,
    bi.period_end,
    bi.budget_cents,
    bi.spent_cents,
    (bi.budget_cents - bi.spent_cents),
    CASE WHEN bi.budget_cents > 0
         THEN ROUND((bi.spent_cents::numeric / bi.budget_cents) * 100, 2)
         ELSE 0 END,
    b.rollover_mode,
    b.cap_type,
    b.parent_id,
    -- Projeção simplificada inline
    ROUND(
      (bi.spent_cents::numeric / NULLIF(GREATEST(1, current_date - bi.period_start + 1), 0))
      * (bi.period_end - bi.period_start + 1)
    ) > bi.budget_cents,
    bi.status
  FROM public.budget_instances bi
  JOIN public.budgets b ON b.id = bi.budget_id
  LEFT JOIN public.categories c ON c.id = b.categoria_id
  WHERE bi.status = 'active'
    AND (p_period_type IS NULL OR b.period_type = p_period_type)
    AND (p_period_key IS NULL OR bi.period_key = p_period_key)
    AND (
      -- Scope pessoal
      (p_family_id IS NULL AND b.family_id IS NULL AND b.user_id = auth.uid())
      OR
      -- Scope familiar
      (p_family_id IS NOT NULL AND b.family_id = p_family_id AND EXISTS (
        SELECT 1 FROM public.family_members fm
        WHERE fm.family_id = p_family_id AND fm.user_id = auth.uid()
      ))
    )
  ORDER BY b.categoria_id, bi.period_key DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_budgets(uuid, text, text) TO authenticated;
