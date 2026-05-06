-- supabase/migrations/20260505110000_unit10_rpcs_fix.sql
-- Fix unit10 RPCs: budget_instances has no `mes` column (use period_key)
-- and no `is_projected_over` column (compute inline).

-- ============================================================
-- 1. get_kpis — fix bi.mes → bi.period_key, bi.is_projected_over → inline formula
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_kpis(
  scope_family_id       uuid    DEFAULT NULL,
  date_start            date    DEFAULT date_trunc('month', now())::date,
  date_end              date    DEFAULT now()::date,
  exclude_transfers     boolean DEFAULT true
)
RETURNS TABLE (
  total_balance_cents       bigint,
  income_cents              bigint,
  expense_cents             bigint,
  net_cents                 bigint,
  goals_progress_percentage numeric,
  budget_spent_percentage   numeric,
  budgets_at_risk           integer,
  reserved_cents            bigint,
  inbox_pending_count       integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mes text := to_char(date_start, 'YYYY-MM');
BEGIN
  IF scope_family_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = scope_family_id
        AND fm.user_id = v_uid
        AND fm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED';
    END IF;
  END IF;

  RETURN QUERY
  WITH
  acct AS (
    SELECT COALESCE(SUM(a.amount_cents), 0)::bigint AS total
    FROM public.accounts a
    WHERE
      CASE WHEN scope_family_id IS NULL
        THEN a.user_id = v_uid
        ELSE a.family_id = scope_family_id
      END
  ),
  tx AS (
    SELECT t.amount_cents, t.tipo
    FROM public.transactions t
    WHERE t.data BETWEEN date_start AND date_end
      AND (NOT exclude_transfers OR t.tipo <> 'transferencia')
      AND CASE WHEN scope_family_id IS NULL
        THEN t.user_id = v_uid
        ELSE t.family_id = scope_family_id
      END
  ),
  tx_agg AS (
    SELECT
      COALESCE(SUM(CASE WHEN tipo = 'receita' THEN amount_cents ELSE 0 END), 0)::bigint AS income,
      COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN amount_cents ELSE 0 END), 0)::bigint AS expense
    FROM tx
  ),
  gl_agg AS (
    SELECT gl.goal_id, SUM(gl.amount_cents * gl.signed) AS bal
    FROM public.goal_ledger gl
    JOIN public.goals g ON g.id = gl.goal_id
    WHERE g.ativa = true
      AND CASE WHEN scope_family_id IS NULL
        THEN g.user_id = v_uid
        ELSE g.family_id = scope_family_id
      END
    GROUP BY gl.goal_id
  ),
  goals_agg AS (
    SELECT
      COALESCE(
        CASE WHEN SUM(g.target_cents) = 0 THEN 0
          ELSE ROUND(SUM(GREATEST(COALESCE(gl.bal,0), 0))::numeric / NULLIF(SUM(g.target_cents),0) * 100, 2)
        END, 0)::numeric AS pct,
      COALESCE(SUM(GREATEST(COALESCE(gl.bal,0), 0)), 0)::bigint AS reserved
    FROM public.goals g
    LEFT JOIN gl_agg gl ON gl.goal_id = g.id
    WHERE g.ativa = true
      AND CASE WHEN scope_family_id IS NULL
        THEN g.user_id = v_uid
        ELSE g.family_id = scope_family_id
      END
  ),
  bud_agg AS (
    SELECT
      COALESCE(
        CASE WHEN SUM(bi.budget_cents) = 0 THEN 0
          ELSE ROUND(SUM(bi.spent_cents)::numeric / NULLIF(SUM(bi.budget_cents),0) * 100, 2)
        END, 0)::numeric AS spent_pct,
      COUNT(CASE WHEN (
                     ROUND(
                       (bi.spent_cents::numeric / NULLIF(GREATEST(1, current_date - bi.period_start + 1), 0))
                       * (bi.period_end - bi.period_start + 1)
                     ) > bi.budget_cents
                   )
                   OR (bi.budget_cents > 0 AND bi.spent_cents::numeric / bi.budget_cents >= 0.8)
                 THEN 1 END)::integer AS at_risk
    FROM public.budget_instances bi
    JOIN public.budgets b ON b.id = bi.budget_id
    WHERE bi.period_key = v_mes
      AND CASE WHEN scope_family_id IS NULL
        THEN b.user_id = v_uid
        ELSE b.family_id = scope_family_id
      END
  ),
  inbox_agg AS (
    SELECT COUNT(*)::integer AS cnt
    FROM public.inbox_items
    WHERE status = 'pending'
      AND CASE WHEN scope_family_id IS NULL
        THEN user_id = v_uid AND family_id IS NULL
        ELSE family_id = scope_family_id
      END
  )
  SELECT
    ac.total,
    ta.income,
    ta.expense,
    (ta.income - ta.expense)::bigint,
    ga.pct,
    ba.spent_pct,
    ba.at_risk,
    ga.reserved,
    ia.cnt
  FROM acct ac, tx_agg ta, goals_agg ga, bud_agg ba, inbox_agg ia;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_kpis(uuid,date,date,boolean) TO authenticated;

-- ============================================================
-- 3. get_dashboard_insights — fix bi.mes → bi.period_key, bi.is_projected_over → inline formula
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_insights(
  scope_family_id uuid DEFAULT NULL
)
RETURNS TABLE (
  type    text,
  title   text,
  value   numeric,
  detail  jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_this_start date := date_trunc('month', now())::date;
  v_this_end   date := now()::date;
  v_prev_start date := date_trunc('month', now() - interval '1 month')::date;
  v_prev_end   date := (date_trunc('month', now()) - interval '1 day')::date;
BEGIN
  IF scope_family_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = scope_family_id AND fm.user_id = v_uid AND fm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED';
    END IF;
  END IF;

  -- Insight 1: month-over-month expense change
  RETURN QUERY
  WITH this_exp AS (
    SELECT COALESCE(SUM(amount_cents), 0)::numeric AS val
    FROM public.transactions
    WHERE tipo = 'despesa' AND data BETWEEN v_this_start AND v_this_end
      AND CASE WHEN scope_family_id IS NULL THEN user_id = v_uid ELSE family_id = scope_family_id END
  ),
  prev_exp AS (
    SELECT COALESCE(SUM(amount_cents), 0)::numeric AS val
    FROM public.transactions
    WHERE tipo = 'despesa' AND data BETWEEN v_prev_start AND v_prev_end
      AND CASE WHEN scope_family_id IS NULL THEN user_id = v_uid ELSE family_id = scope_family_id END
  )
  SELECT
    'mom_change'::text,
    'Despesas vs. mês anterior'::text,
    CASE WHEN p.val = 0 THEN 0
      ELSE ROUND((t.val - p.val) / p.val * 100, 1)
    END,
    jsonb_build_object('this_month_cents', t.val, 'prev_month_cents', p.val)
  FROM this_exp t, prev_exp p;

  -- Insight 2: top expense category this month
  RETURN QUERY
  SELECT
    'top_category'::text,
    'Categoria principal'::text,
    SUM(t.amount_cents)::numeric,
    jsonb_build_object('categoria_nome', c.nome)
  FROM public.transactions t
  LEFT JOIN public.categories c ON c.id = t.categoria_id
  WHERE t.tipo = 'despesa' AND t.data BETWEEN v_this_start AND v_this_end
    AND CASE WHEN scope_family_id IS NULL THEN t.user_id = v_uid ELSE t.family_id = scope_family_id END
  GROUP BY c.nome
  ORDER BY SUM(t.amount_cents) DESC
  LIMIT 1;

  -- Insight 3: budgets at risk (>=80%)
  RETURN QUERY
  SELECT
    'budget_risk'::text,
    'Orçamentos em risco'::text,
    COUNT(*)::numeric,
    jsonb_build_object()
  FROM public.budget_instances bi
  JOIN public.budgets b ON b.id = bi.budget_id
  WHERE bi.period_key = to_char(now(), 'YYYY-MM')
    AND bi.budget_cents > 0
    AND (
      ROUND(
        (bi.spent_cents::numeric / NULLIF(GREATEST(1, current_date - bi.period_start + 1), 0))
        * (bi.period_end - bi.period_start + 1)
      ) > bi.budget_cents
      OR bi.spent_cents::numeric / bi.budget_cents >= 0.8
    )
    AND CASE WHEN scope_family_id IS NULL THEN b.user_id = v_uid ELSE b.family_id = scope_family_id END
  HAVING COUNT(*) > 0;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_dashboard_insights(uuid) TO authenticated;
