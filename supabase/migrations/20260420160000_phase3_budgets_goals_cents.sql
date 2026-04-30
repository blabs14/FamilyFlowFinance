-- Phase 3c: budgets.valor → amount_cents, goals.valor_objetivo → target_cents
-- Also fixes all views and RPCs that depend on these columns.

BEGIN;

-- ============================================================
-- STEP 1: Drop views that depend on budgets.valor or goals.valor_objetivo
-- ============================================================
DROP VIEW IF EXISTS public.goal_progress CASCADE;
DROP VIEW IF EXISTS public.goals_with_balance CASCADE;
DROP VIEW IF EXISTS public.budget_progress CASCADE;

-- ============================================================
-- STEP 2: budgets — valor → amount_cents
-- ============================================================
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS amount_cents bigint;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';
UPDATE public.budgets SET amount_cents = ROUND(COALESCE(valor, 0) * 100)::bigint;
ALTER TABLE public.budgets ALTER COLUMN amount_cents SET NOT NULL;
ALTER TABLE public.budgets ALTER COLUMN amount_cents SET DEFAULT 0;
ALTER TABLE public.budgets DROP COLUMN IF EXISTS valor;

-- ============================================================
-- STEP 3: goals — valor_objetivo → target_cents
-- ============================================================
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS target_cents bigint;
UPDATE public.goals SET target_cents = ROUND(COALESCE(valor_objetivo, 0) * 100)::bigint;
ALTER TABLE public.goals ALTER COLUMN target_cents SET NOT NULL;
ALTER TABLE public.goals ALTER COLUMN target_cents SET DEFAULT 0;
ALTER TABLE public.goals DROP COLUMN IF EXISTS valor_objetivo;

-- ============================================================
-- STEP 4: Recreate goals_with_balance
--   • Exposes target_cents (new canonical field)
--   • Keeps valor_objetivo alias (numeric, in euros) for backward compat
-- ============================================================
CREATE OR REPLACE VIEW public.goals_with_balance AS
SELECT
    g.id,
    g.user_id,
    g.nome,
    g.valor_atual,
    g.prazo,
    g.created_at,
    g.updated_at,
    g.family_id,
    g.target_cents,
    g.ativa,
    g.status,
    g.valor_meta,
    g.account_id,
    g.target_cents::numeric / 100.0 AS valor_objetivo,
    COALESCE(SUM(gl.amount_cents * gl.signed), 0) AS valor_atual_cents
FROM public.goals g
LEFT JOIN public.goal_ledger gl ON gl.goal_id = g.id
GROUP BY g.id;

-- ============================================================
-- STEP 5: Recreate goal_progress
--   • Uses target_cents internally
--   • Keeps valor_objetivo alias for all downstream RPCs
--   • Adds user_id so get_user_goal_progress can filter by user
-- ============================================================
CREATE OR REPLACE VIEW public.goal_progress AS
SELECT
    g.id,
    g.user_id,
    g.nome,
    g.target_cents::numeric / 100.0                                      AS valor_objetivo,
    gwb.valor_atual_cents / 100.0                                         AS total_alocado_real,
    gwb.valor_atual_cents / 100.0                                         AS total_alocado_historico,
    ROUND(
        gwb.valor_atual_cents / 100.0
        / NULLIF(g.target_cents::numeric / 100.0, 0)
        * 100::numeric, 2
    )                                                                      AS progresso_percentual,
    CASE
        WHEN g.target_cents <= 0
            THEN 'indefinido'::text
        WHEN (gwb.valor_atual_cents / 100.0) >= g.target_cents::numeric / 100.0
            THEN 'completo'::text
        WHEN gwb.valor_atual_cents > 0
            THEN 'em_progresso'::text
        ELSE 'nao_iniciado'::text
    END AS status_objetivo
FROM public.goals g
JOIN public.goals_with_balance gwb ON gwb.id = g.id;

-- ============================================================
-- STEP 6: Recreate budget_progress (uses amount_cents instead of valor)
-- ============================================================
CREATE OR REPLACE VIEW public.budget_progress AS
SELECT
    b.id AS budget_id,
    b.user_id,
    b.categoria_id,
    c.nome  AS categoria_nome,
    c.cor   AS categoria_cor,
    b.mes,
    b.amount_cents::numeric / 100.0 AS valor_orcamento,
    COALESCE(SUM(
        CASE WHEN t.tipo = 'despesa' THEN t.amount_cents::numeric / 100.0 ELSE 0 END
    ), 0) AS valor_gasto,
    b.amount_cents::numeric / 100.0
        - COALESCE(SUM(
            CASE WHEN t.tipo = 'despesa' THEN t.amount_cents::numeric / 100.0 ELSE 0 END
        ), 0) AS valor_restante,
    CASE
        WHEN b.amount_cents > 0 THEN
            ROUND(
                COALESCE(SUM(
                    CASE WHEN t.tipo = 'despesa' THEN t.amount_cents::numeric / 100.0 ELSE 0 END
                ), 0)
                / (b.amount_cents::numeric / 100.0) * 100::numeric, 2)
        ELSE 0
    END AS progresso_percentual
FROM public.budgets b
LEFT JOIN public.categories c ON c.id = b.categoria_id
LEFT JOIN public.transactions t ON
    t.user_id = b.user_id
    AND t.categoria_id = b.categoria_id
    AND DATE_TRUNC('month', t.data::timestamptz)
        = DATE_TRUNC('month', TO_DATE(b.mes || '-01', 'YYYY-MM-DD')::timestamptz)
WHERE b.family_id IS NULL
GROUP BY b.id, b.user_id, b.categoria_id, c.nome, c.cor, b.mes, b.amount_cents;

-- ============================================================
-- STEP 7: Fix get_personal_goals (g.valor_objetivo → target_cents alias)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_personal_goals(p_user_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(
    id uuid, nome text, valor_objetivo numeric, valor_atual numeric,
    total_alocado numeric, progresso_percentual numeric,
    prazo date, ativa boolean, user_id uuid,
    created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  SET search_path = public, pg_temp;
  DECLARE
    v_user_id UUID := COALESCE(p_user_id, auth.uid());
  BEGIN
    RETURN QUERY
    SELECT
      g.id,
      g.nome,
      g.target_cents::numeric / 100.0 AS valor_objetivo,
      g.valor_atual,
      COALESCE(gp.total_alocado_real, 0::numeric) AS total_alocado,
      COALESCE(gp.progresso_percentual, 0::numeric) AS progresso_percentual,
      g.prazo,
      g.ativa,
      g.user_id,
      g.created_at,
      g.updated_at
    FROM goals g
    LEFT JOIN goal_progress gp ON gp.id = g.id
    WHERE g.user_id = v_user_id AND g.family_id IS NULL
    ORDER BY g.created_at DESC;
  END;
END;
$function$;

-- ============================================================
-- STEP 8: Fix get_family_goals (g.valor_objetivo → target_cents alias)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_family_goals(p_user_id uuid)
RETURNS TABLE(
    id uuid, nome text, valor_objetivo numeric, valor_atual numeric,
    total_alocado numeric, progresso_percentual numeric,
    prazo date, ativa boolean, user_id uuid, family_id uuid,
    created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  SET search_path = public, pg_temp;
  RETURN QUERY
  SELECT
    g.id,
    g.nome,
    g.target_cents::numeric / 100.0 AS valor_objetivo,
    g.valor_atual,
    COALESCE(gp.total_alocado_real, 0::numeric) AS total_alocado,
    COALESCE(gp.progresso_percentual, 0::numeric) AS progresso_percentual,
    g.prazo,
    g.ativa,
    g.user_id,
    g.family_id,
    g.created_at,
    g.updated_at
  FROM goals g
  LEFT JOIN goal_progress gp ON gp.id = g.id
  WHERE g.family_id IN (
    SELECT fm.family_id FROM family_members fm WHERE fm.user_id = p_user_id
  )
  ORDER BY g.created_at DESC;
END;
$function$;

-- ============================================================
-- STEP 9: Fix get_personal_kpis
--   • SUM(valor_objetivo) → SUM(target_cents)/100
--   • valor_objetivo in NULLIF → target_cents/100
--   • SUM(b.valor) → SUM(b.amount_cents)/100
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_personal_kpis()
RETURNS TABLE(
    total_balance numeric, credit_card_debt numeric, top_goal_progress numeric,
    monthly_savings numeric, goals_account_balance numeric, total_goals_value numeric,
    goals_progress_percentage numeric, total_budget_spent numeric,
    total_budget_amount numeric, budget_spent_percentage numeric
)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid;
  current_month text;
  v_total_balance decimal(10,2) := 0;
  v_credit_card_debt decimal(10,2) := 0;
  v_goals_account_balance decimal(10,2) := 0;
  v_total_goals_value decimal(10,2) := 0;
  v_top_goal_progress decimal(5,2) := 0;
  v_monthly_savings decimal(10,2) := 0;
  v_budget_spent decimal(10,2) := 0;
  v_budget_amount decimal(10,2) := 0;
  v_budget_percentage decimal(5,2) := 0;
  v_goals_progress_percentage decimal(5,2) := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Utilizador não autenticado'; end if;
  current_month := to_char(current_date, 'YYYY-MM');

  SELECT
    COALESCE(SUM(CASE WHEN a.tipo != 'cartão de crédito' THEN ab.saldo_atual ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN a.tipo = 'cartão de crédito' AND ab.saldo_atual < 0 THEN ABS(ab.saldo_atual) ELSE 0 END), 0)
  INTO v_total_balance, v_credit_card_debt
  FROM public.accounts a
  LEFT JOIN public.account_balances ab ON ab.account_id = a.id
  WHERE a.user_id = v_user_id AND a.family_id IS NULL;

  SELECT
    COALESCE(SUM(target_cents::numeric / 100.0), 0),
    COALESCE((
      SELECT ab2.saldo_atual FROM public.accounts a2
      LEFT JOIN public.account_balances ab2 ON ab2.account_id = a2.id
      WHERE a2.user_id = v_user_id AND a2.family_id IS NULL
        AND (LOWER(a2.nome) LIKE '%objetivo%' OR LOWER(a2.tipo) LIKE '%objetivo%')
      LIMIT 1
    ), 0)
  INTO v_total_goals_value, v_goals_account_balance
  FROM public.goals WHERE user_id = v_user_id AND family_id IS NULL;

  IF v_total_goals_value > 0 THEN
    v_goals_progress_percentage := (v_goals_account_balance / v_total_goals_value) * 100;
  END IF;

  SELECT COALESCE(((valor_atual / NULLIF(target_cents::numeric / 100.0, 0)) * 100), 0)
  INTO v_top_goal_progress
  FROM public.goals WHERE user_id = v_user_id AND family_id IS NULL
  ORDER BY created_at ASC LIMIT 1;

  SELECT
    COALESCE(SUM(CASE WHEN t.tipo = 'receita' THEN t.amount_cents::numeric / 100.0 ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN t.tipo = 'despesa' THEN t.amount_cents::numeric / 100.0 ELSE 0 END), 0)
  INTO v_monthly_savings
  FROM public.transactions t
  WHERE t.user_id = v_user_id AND t.family_id IS NULL
    AND t.data::text LIKE current_month || '%';

  SELECT
    COALESCE(SUM(b.amount_cents::numeric / 100.0), 0),
    COALESCE(SUM(b.amount_cents::numeric / 100.0), 0)
  INTO v_budget_amount, v_budget_spent
  FROM public.budgets b
  WHERE b.user_id = v_user_id AND b.family_id IS NULL AND b.mes = current_month;

  IF v_budget_amount > 0 THEN
    v_budget_percentage := (v_budget_spent / v_budget_amount) * 100;
  END IF;

  RETURN QUERY SELECT
    v_total_balance, v_credit_card_debt, v_top_goal_progress,
    v_monthly_savings, v_goals_account_balance, v_total_goals_value,
    v_goals_progress_percentage, v_budget_spent, v_budget_amount, v_budget_percentage;
end;$function$;

-- ============================================================
-- STEP 10: Fix get_family_kpis (no-param overload)
--   • CTE goals: g.valor_objetivo → g.target_cents/100
--   • total_goals_value subquery: valor_objetivo → target_cents/100
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_family_kpis()
RETURNS TABLE(
    total_balance numeric, credit_card_debt numeric, top_goal_progress numeric,
    monthly_savings numeric, goals_account_balance numeric, total_goals_value numeric,
    goals_progress_percentage numeric, total_members integer, pending_invites integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  return query
  with my_families as (
    select fm.family_id from public.family_members fm where fm.user_id = auth.uid()
  ),
  fam_accounts as (
    select * from public.accounts a where a.family_id in (select family_id from my_families)
  ),
  balances as (
    select ab.* from public.account_balances ab join fam_accounts a on a.id = ab.account_id
  ),
  tx as (
    select t.* from public.transactions t join fam_accounts a on a.id = t.account_id
  ),
  tx_month as (
    select * from tx where date_trunc('month', data) = date_trunc('month', current_date)
  ),
  cat_transfer as (
    select id from public.categories where nome ilike 'transfer%'
  ),
  tx_stats as (
    select
      coalesce(sum(case when t.tipo='receita' and t.categoria_id not in (select id from cat_transfer)
                   then t.amount_cents::numeric / 100.0 else 0 end), 0) as receitas,
      coalesce(sum(case when t.tipo='despesa' and t.categoria_id not in (select id from cat_transfer)
                   then t.amount_cents::numeric / 100.0 else 0 end), 0) as despesas
    from tx_month t
  ),
  goals as (
    select g.*,
           least(
             case when g.target_cents > 0
               then (g.valor_atual / (g.target_cents::numeric / 100.0)) * 100
               else 0
             end, 100
           ) as progress
    from public.goals g where g.family_id in (select family_id from my_families)
  )
  select
    coalesce(sum(b.saldo_atual), 0)::numeric(15,2) as total_balance,
    coalesce(sum(case when a.tipo = 'cartão de crédito' then least(b.saldo_atual, 0) else 0 end) * -1, 0)::numeric(15,2) as credit_card_debt,
    coalesce(max(goals.progress), 0)::numeric(5,2) as top_goal_progress,
    (select (tx_stats.receitas - tx_stats.despesas) from tx_stats)::numeric(15,2) as monthly_savings,
    0::numeric(15,2) as goals_account_balance,
    coalesce(sum((select gg.target_cents::numeric / 100.0 from public.goals gg where gg.id = g.id)), 0)::numeric(15,2) as total_goals_value,
    coalesce(avg(goals.progress), 0)::numeric(5,2) as goals_progress_percentage,
    coalesce((select count(*) from public.family_members fm join my_families f on f.family_id = fm.family_id), 0)::int as total_members,
    0::int as pending_invites
  from balances b
  join fam_accounts a on a.id = b.account_id
  cross join (select * from goals limit 1) g;
end;$function$;

-- ============================================================
-- STEP 11: Fix get_family_kpis (4-param overload)
--   • Goals: g.valor_objetivo → g.target_cents/100
--   • Budget CTE: b.valor → b.amount_cents/100
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_family_kpis(
    p_family_id uuid,
    p_date_start date,
    p_date_end date,
    p_exclude_transfers boolean DEFAULT true
)
RETURNS TABLE(
    total_balance numeric, credit_card_debt numeric, monthly_savings numeric,
    goals_account_balance numeric, total_goals_value numeric,
    goals_progress_percentage numeric, top_goal_progress numeric,
    total_budget_spent numeric, total_budget_amount numeric,
    budget_spent_percentage numeric, prev_month_savings numeric,
    delta_vs_prev numeric, overspent_budgets_count integer,
    overspent_budget_ids uuid[], total_members integer, pending_invites integer
)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  month_str text := to_char(p_date_start, 'YYYY-MM');
  v_prev_start date := (date_trunc('month', p_date_start - interval '1 month'))::date;
  v_prev_end date := (date_trunc('month', p_date_start))::date - 1;
  v_spent numeric := 0;
  v_amount numeric := 0;
  v_overs_ids uuid[] := '{}';
  v_pending_invites integer := 0;
  v_total_members integer := 0;
  v_goals_total numeric := 0;
  v_goals_current numeric := 0;
  v_top_goal numeric := 0;
  v_cc_debt numeric := 0;
  v_total_balance numeric := 0;
  v_savings numeric := 0;
  v_prev_savings numeric := 0;
  v_budget_pct numeric := 0;
begin
  if not public.is_member_of_family(p_family_id, auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Balance from account_balances view
  SELECT
    coalesce(sum(ab.saldo_atual), 0),
    coalesce(sum(case when a.tipo = 'cartão de crédito' then least(ab.saldo_atual, 0) else 0 end), 0)
  INTO v_total_balance, v_cc_debt
  FROM public.accounts a
  LEFT JOIN public.account_balances ab ON ab.account_id = a.id
  WHERE a.family_id = p_family_id;

  -- Goals (target_cents instead of valor_objetivo)
  select
    coalesce(sum(g.target_cents::numeric / 100.0), 0),
    coalesce(sum(g.valor_atual), 0),
    coalesce(max(case when g.target_cents > 0
                      then (g.valor_atual / (g.target_cents::numeric / 100.0)) * 100
                      else 0 end), 0)
  into v_goals_total, v_goals_current, v_top_goal
  from public.goals g where g.family_id = p_family_id;

  -- Current month savings
  select
    coalesce(sum(case when t.tipo = 'receita' then t.amount_cents::numeric / 100.0 else 0 end), 0)
    - coalesce(sum(case when t.tipo = 'despesa' then t.amount_cents::numeric / 100.0 else 0 end), 0)
  into v_savings
  from public.transactions t
  where t.family_id = p_family_id
    and t.data between p_date_start and p_date_end
    and (not p_exclude_transfers or t.tipo <> 'transferencia');

  -- Previous month savings
  select
    coalesce(sum(case when t.tipo = 'receita' then t.amount_cents::numeric / 100.0 else 0 end), 0)
    - coalesce(sum(case when t.tipo = 'despesa' then t.amount_cents::numeric / 100.0 else 0 end), 0)
  into v_prev_savings
  from public.transactions t
  where t.family_id = p_family_id
    and t.data between v_prev_start and v_prev_end
    and (not p_exclude_transfers or t.tipo <> 'transferencia');

  -- Budgets (amount_cents instead of valor)
  with budget_rows as (
    select b.id, b.categoria_id, b.amount_cents::numeric / 100.0 as valor
    from public.budgets b
    where b.family_id = p_family_id and b.mes = month_str
  ),
  spent as (
    select t.categoria_id, coalesce(sum(t.amount_cents::numeric / 100.0), 0) as total
    from public.transactions t
    where t.family_id = p_family_id
      and t.tipo = 'despesa'
      and to_char(t.data, 'YYYY-MM') = month_str
    group by t.categoria_id
  ),
  joined as (
    select br.id, br.categoria_id, br.valor as budget_value, coalesce(s.total, 0) as spent
    from budget_rows br
    left join spent s on s.categoria_id = br.categoria_id
  )
  select
    coalesce(sum(j.spent), 0),
    coalesce(sum(j.budget_value), 0),
    coalesce(array_agg(j.id) filter (where j.spent > j.budget_value), '{}')
  into v_spent, v_amount, v_overs_ids
  from joined j;

  if v_amount > 0 then v_budget_pct := (v_spent / v_amount) * 100.0;
  else v_budget_pct := 0; end if;

  select count(*) into v_total_members from public.family_members fm where fm.family_id = p_family_id;

  if exists (select 1 from pg_catalog.pg_tables where schemaname = 'public' and tablename = 'family_invites') then
    execute 'select count(*) from public.family_invites where family_id = $1 and status = ''pending''' into v_pending_invites using p_family_id;
  else v_pending_invites := 0; end if;

  return query select
    v_total_balance, v_cc_debt, v_savings, v_goals_current, v_goals_total,
    case when v_goals_total > 0 then (v_goals_current / v_goals_total) * 100.0 else 0 end,
    v_top_goal, v_spent, v_amount, v_budget_pct,
    v_prev_savings, (v_savings - v_prev_savings),
    coalesce(array_length(v_overs_ids, 1), 0),
    v_overs_ids, v_total_members, v_pending_invites;
end$function$;

COMMIT;
