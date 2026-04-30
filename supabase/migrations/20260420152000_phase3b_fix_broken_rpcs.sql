-- supabase/migrations/20260420152000_phase3b_fix_broken_rpcs.sql
-- Fix all RPCs that referenced accounts.saldo (dropped Phase 3a) or transactions.valor (dropped Phase 3b)

BEGIN;

-- ============================================================
-- 1. update_account_balance (no-op stub — t.valor → amount_cents)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_account_balance(account_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
begin
  -- Balance is now computed via account_balances view (transaction-based).
  -- This stub exists for backwards compatibility with callers.
  return true;
end;$$;

-- ============================================================
-- 2. create_regular_transaction (valor → amount_cents, remove goal_allocations)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_regular_transaction(
  p_user_id    uuid,
  p_account_id uuid,
  p_categoria_id uuid,
  p_valor      numeric,
  p_descricao  text,
  p_data       date,
  p_tipo       text,
  p_goal_id    uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_tx_id uuid;
  v_is_owner boolean := false;
  v_tipo text;
begin
  select (a.user_id = p_user_id) or exists (
    select 1 from public.family_members fm where fm.user_id = p_user_id and fm.family_id = a.family_id
  ) into v_is_owner from public.accounts a where a.id = p_account_id;
  if not v_is_owner then
    return json_build_object('error', 'not_allowed');
  end if;

  v_tipo := case when p_tipo in ('receita','despesa') then p_tipo else 'despesa' end;

  insert into public.transactions (id, user_id, account_id, categoria_id, amount_cents, descricao, data, tipo)
  values (gen_random_uuid(), p_user_id, p_account_id, p_categoria_id,
          ROUND(abs(p_valor) * 100)::bigint,
          coalesce(p_descricao,'Movimento regular'), p_data, v_tipo)
  returning id into v_tx_id;

  return json_build_object('transaction_id', v_tx_id);
end;$$;

-- ============================================================
-- 3. create_transfer_transaction (valor → amount_cents)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_transfer_transaction(
  p_from_account_id uuid,
  p_to_account_id   uuid,
  p_amount          numeric,
  p_user_id         uuid,
  p_categoria_id    uuid,
  p_description     text,
  p_data            date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'Permission denied';
  end if;

  if coalesce(p_amount,0) <= 0 then
    return jsonb_build_object('error', 'Invalid amount');
  end if;

  insert into public.transactions (id, user_id, account_id, categoria_id, amount_cents, tipo, data, descricao)
  values (gen_random_uuid(), p_user_id, p_from_account_id, p_categoria_id,
          ROUND(p_amount * 100)::bigint, 'despesa',
          coalesce(p_data, current_date), coalesce(p_description, 'Transferência'));

  insert into public.transactions (id, user_id, account_id, categoria_id, amount_cents, tipo, data, descricao)
  values (gen_random_uuid(), p_user_id, p_to_account_id, p_categoria_id,
          ROUND(p_amount * 100)::bigint, 'receita',
          coalesce(p_data, current_date), coalesce(p_description, 'Transferência'));

  return jsonb_build_object('success', true);
end;$$;

-- ============================================================
-- 4. manage_credit_card_balance (INSERT valor → amount_cents)
-- ============================================================
CREATE OR REPLACE FUNCTION public.manage_credit_card_balance(
  p_user_id    uuid,
  p_account_id uuid,
  p_new_balance numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_curr numeric(15,2) := 0;
  v_diff numeric(15,2) := 0;
  v_cat  uuid;
  v_tx_id uuid;
  v_is_owner boolean := false;
  v_tipo text;
begin
  select (a.user_id = p_user_id) or exists (
    select 1 from public.family_members fm where fm.user_id = p_user_id and fm.family_id = a.family_id
  ) into v_is_owner from public.accounts a where a.id = p_account_id;
  if not v_is_owner then
    raise exception 'Not allowed';
  end if;

  select saldo_atual into v_curr from public.account_balances where account_id = p_account_id;
  v_diff := coalesce(p_new_balance,0) - coalesce(v_curr,0);
  if v_diff = 0 then return null; end if;

  v_cat := public.ensure_category_for_user(p_user_id, 'Ajuste', '#6B7280');
  v_tipo := case when v_diff > 0 then 'receita' else 'despesa' end;

  insert into public.transactions (id, user_id, account_id, categoria_id, amount_cents, descricao, data, tipo)
  values (gen_random_uuid(), p_user_id, p_account_id, v_cat,
          ROUND(abs(v_diff) * 100)::bigint,
          'Ajuste de saldo (cartão)', current_date, v_tipo)
  returning id into v_tx_id;

  return v_tx_id;
end;$$;

-- ============================================================
-- 5. pay_credit_card_from_account (INSERT valor → amount_cents)
-- ============================================================
CREATE OR REPLACE FUNCTION public.pay_credit_card_from_account(
  p_user_id        uuid,
  p_card_account_id uuid,
  p_bank_account_id uuid,
  p_amount         numeric,
  p_date           date,
  p_descricao      text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_is_owner boolean := false;
  v_cat uuid;
  v_desc text := coalesce(p_descricao, 'Pagamento de cartão por transferência');
begin
  if coalesce(p_amount,0) <= 0 then return false; end if;

  select (a.user_id = p_user_id) or exists (
    select 1 from public.family_members fm where fm.user_id = p_user_id and fm.family_id = a.family_id
  ) into v_is_owner from public.accounts a where a.id = p_card_account_id;
  if not v_is_owner then return false; end if;

  select (a.user_id = p_user_id) or exists (
    select 1 from public.family_members fm where fm.user_id = p_user_id and fm.family_id = a.family_id
  ) into v_is_owner from public.accounts a where a.id = p_bank_account_id;
  if not v_is_owner then return false; end if;

  v_cat := public.ensure_category_for_user(p_user_id, 'Transferência', '#3B82F6');

  insert into public.transactions (id, user_id, account_id, categoria_id, amount_cents, descricao, data, tipo)
  values (gen_random_uuid(), p_user_id, p_bank_account_id, v_cat,
          ROUND(p_amount * 100)::bigint, v_desc, p_date, 'despesa');

  insert into public.transactions (id, user_id, account_id, categoria_id, amount_cents, descricao, data, tipo)
  values (gen_random_uuid(), p_user_id, p_card_account_id, v_cat,
          ROUND(p_amount * 100)::bigint, v_desc, p_date, 'receita');

  return true;
end;$$;

-- ============================================================
-- 6. handle_credit_card_transaction overload 1 (called by cc_tx_v1)
--    Params: (p_user_id, p_account_id, p_valor, p_data, p_categoria_id, p_tipo, p_descricao, p_goal_id)
--    Drop first because we're rewriting it (previously referenced v_account.saldo)
-- ============================================================
DROP FUNCTION IF EXISTS public.handle_credit_card_transaction(uuid, uuid, numeric, date, uuid, text, text, uuid);

CREATE FUNCTION public.handle_credit_card_transaction(
  p_user_id      uuid,
  p_account_id   uuid,
  p_valor        numeric,
  p_data         date,
  p_categoria_id uuid,
  p_tipo         text,
  p_descricao    text DEFAULT NULL,
  p_goal_id      uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_transaction_id uuid;
  v_account record;
  v_tipo text;
begin
  select * into v_account from public.accounts where id = p_account_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Conta não encontrada');
  end if;

  if p_valor <= 0 then
    return jsonb_build_object('success', false, 'error', 'O valor deve ser maior que zero');
  end if;

  v_tipo := case when p_tipo in ('receita','despesa') then p_tipo else 'despesa' end;

  insert into public.transactions (
    user_id, account_id, amount_cents, data, categoria_id, tipo, descricao, goal_id
  ) values (
    p_user_id, p_account_id,
    ROUND(p_valor * 100)::bigint,
    p_data, p_categoria_id, v_tipo,
    coalesce(p_descricao, 'Transação em cartão de crédito'),
    p_goal_id
  ) returning id into v_transaction_id;

  return jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'transaction_type', v_tipo,
    'amount', p_valor
  );
end;$$;

GRANT EXECUTE ON FUNCTION public.handle_credit_card_transaction(uuid, uuid, numeric, date, uuid, text, text, uuid) TO authenticated;

-- ============================================================
-- 7. handle_credit_card_transaction overload 2
--    Params: (p_user_id, p_account_id, p_categoria_id, p_valor, p_descricao, p_data, p_tipo, p_goal_id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_credit_card_transaction(
  p_user_id      uuid,
  p_account_id   uuid,
  p_categoria_id uuid,
  p_valor        numeric,
  p_descricao    text,
  p_data         date,
  p_tipo         text,
  p_goal_id      uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_tx_id uuid;
  v_is_owner boolean := false;
  v_tipo text;
begin
  select (a.user_id = p_user_id) or exists (
    select 1 from public.family_members fm where fm.user_id = p_user_id and fm.family_id = a.family_id
  ) into v_is_owner from public.accounts a where a.id = p_account_id;
  if not v_is_owner then
    return json_build_object('error', 'not_allowed');
  end if;

  v_tipo := case when p_tipo in ('receita','despesa') then p_tipo else 'despesa' end;

  insert into public.transactions (id, user_id, account_id, categoria_id, amount_cents, descricao, data, tipo)
  values (gen_random_uuid(), p_user_id, p_account_id, p_categoria_id,
          ROUND(abs(p_valor) * 100)::bigint,
          coalesce(p_descricao,'Movimento cartão'), p_data, v_tipo)
  returning id into v_tx_id;

  return json_build_object('transaction_id', v_tx_id);
end;$$;

-- ============================================================
-- 8. get_credit_card_summary (single param: p_account_id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_credit_card_summary(p_account_id uuid)
RETURNS TABLE(saldo numeric, total_gastos numeric, total_pagamentos numeric, status text, ciclo_inicio text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_cycle_day int := 1;
  v_today date := current_date;
  v_cycle_start date;
begin
  select coalesce(billing_cycle_day, 1) into v_cycle_day from public.accounts where id = p_account_id;
  v_cycle_start := date_trunc('month', v_today) + ((v_cycle_day - 1) || ' days')::interval;
  if v_today < v_cycle_start then
    v_cycle_start := (date_trunc('month', v_today) - interval '1 month') + ((v_cycle_day - 1) || ' days')::interval;
  end if;

  return query
  with tx as (
    select * from public.transactions where account_id = p_account_id and data >= v_cycle_start::date
  )
  select
    (select saldo_atual from public.account_balances where account_id = p_account_id) as saldo,
    coalesce((select sum(amount_cents)::numeric / 100.0 from tx where tipo = 'despesa'), 0)::numeric(15,2) as total_gastos,
    coalesce((select sum(amount_cents)::numeric / 100.0 from tx where tipo = 'receita'), 0)::numeric(15,2) as total_pagamentos,
    case when (select saldo_atual from public.account_balances where account_id = p_account_id) <= 0
         then 'EM_DÍVIDA' else 'OK' end as status,
    to_char(v_cycle_start, 'YYYY-MM-DD') as ciclo_inicio;
end;$$;

-- ============================================================
-- 9. get_credit_card_summary (two params: p_user_id, p_account_id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_credit_card_summary(p_user_id uuid, p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_account record;
  v_total_expenses numeric := 0;
  v_total_payments numeric := 0;
  v_current_balance numeric := 0;
begin
  select * into v_account from public.accounts where id = p_account_id and user_id = p_user_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Conta não encontrada');
  end if;

  if v_account.tipo != 'cartão de crédito' then
    return jsonb_build_object('success', false, 'error', 'Esta função só se aplica a cartões de crédito');
  end if;

  select
    coalesce(sum(case when tipo = 'despesa' then amount_cents else 0 end), 0)::numeric / 100.0,
    coalesce(sum(case when tipo = 'receita' then amount_cents else 0 end), 0)::numeric / 100.0
  into v_total_expenses, v_total_payments
  from public.transactions where account_id = p_account_id;

  select saldo_atual into v_current_balance from public.account_balances where account_id = p_account_id;
  v_current_balance := coalesce(v_current_balance, 0);

  return jsonb_build_object(
    'success', true,
    'account_name', v_account.nome,
    'current_balance', v_current_balance,
    'total_expenses', v_total_expenses,
    'total_payments', v_total_payments,
    'available_credit', GREATEST(0, v_current_balance),
    'credit_limit', 0,
    'is_in_debt', v_current_balance < 0,
    'debt_amount', CASE WHEN v_current_balance < 0 THEN ABS(v_current_balance) ELSE 0 END,
    'summary', CASE
      WHEN v_current_balance < 0 THEN 'Dívida de ' || ABS(v_current_balance) || '€'
      WHEN v_current_balance = 0 THEN 'Saldo zerado'
      ELSE 'Crédito disponível de ' || v_current_balance || '€'
    END
  );
end;$$;

-- ============================================================
-- 10. set_credit_card_balance (rewrite — v_account.saldo + t.valor + UPDATE accounts.saldo all dropped)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_credit_card_balance(
  p_user_id    uuid,
  p_account_id uuid,
  p_new_balance numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_account record;
  v_current_balance numeric := 0;
  v_diff numeric := 0;
  v_category_id uuid;
  v_tipo text;
  v_target numeric;
begin
  select * into v_account from public.accounts where id = p_account_id and user_id = p_user_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Conta não encontrada');
  end if;
  if v_account.tipo != 'cartão de crédito' then
    return jsonb_build_object('success', false, 'error', 'Esta função só se aplica a cartões de crédito');
  end if;

  -- Normalize: credit cards have negative balance for debt
  v_target := case when p_new_balance > 0 then -p_new_balance else p_new_balance end;

  select saldo_atual into v_current_balance from public.account_balances where account_id = p_account_id;
  v_current_balance := coalesce(v_current_balance, 0);
  v_diff := v_target - v_current_balance;

  if v_diff = 0 then
    return jsonb_build_object('success', true, 'message', 'Saldo já está correto', 'new_balance', v_target);
  end if;

  select id into v_category_id from public.categories where nome = 'Ajuste' and user_id = p_user_id limit 1;
  if v_category_id is null then
    insert into public.categories (nome, user_id, cor) values ('Ajuste', p_user_id, '#6B7280') returning id into v_category_id;
  end if;

  v_tipo := case when v_diff > 0 then 'receita' else 'despesa' end;

  insert into public.transactions (user_id, account_id, categoria_id, amount_cents, tipo, data, descricao)
  values (p_user_id, p_account_id, v_category_id,
          ROUND(abs(v_diff) * 100)::bigint,
          v_tipo, current_date,
          'Ajuste de saldo: ' || v_target || '€');

  return jsonb_build_object(
    'success', true,
    'previous_balance', v_current_balance,
    'new_balance', v_target,
    'adjustment', v_diff
  );
end;$$;

-- ============================================================
-- 11. allocate_to_goal_with_transaction (delegate to allocate_to_goal — all saldo/goal_allocations refs removed)
-- ============================================================
CREATE OR REPLACE FUNCTION public.allocate_to_goal_with_transaction(
  goal_id_param   uuid,
  account_id_param uuid,
  amount_param    numeric,
  user_id_param   uuid,
  description_param text DEFAULT 'Alocação para objetivo'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_result jsonb;
begin
  -- Delegate to the Phase 2c allocate_to_goal which writes to goal_ledger
  v_result := public.allocate_to_goal(goal_id_param, account_id_param, amount_param, user_id_param);
  return v_result::json;
exception
  when others then
    return json_build_object('success', false, 'error', SQLERRM);
end;$$;

-- ============================================================
-- 12. get_user_accounts_with_balances (t.valor → amount_cents, goal_allocations → account_reserved)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_accounts_with_balances(p_user_id uuid)
RETURNS TABLE(account_id uuid, user_id uuid, family_id uuid, nome text, tipo text,
              saldo_atual numeric, total_reservado numeric, saldo_disponivel numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH a AS (
    SELECT id, user_id, family_id, nome, tipo
    FROM public.accounts
    WHERE user_id = p_user_id AND family_id IS NULL
  ),
  tx AS (
    SELECT t.account_id,
           COALESCE(SUM(CASE
             WHEN t.tipo = 'receita' THEN t.amount_cents::numeric / 100.0
             WHEN t.tipo = 'despesa' THEN -(t.amount_cents::numeric / 100.0)
             ELSE 0
           END), 0)::numeric(15,2) AS saldo_atual
    FROM public.transactions t
    WHERE t.user_id = p_user_id
    GROUP BY t.account_id
  ),
  ar AS (
    SELECT account_id,
           COALESCE(total_reservado, 0)::numeric(15,2) AS total_reservado
    FROM public.account_reserved
  )
  SELECT
    a.id AS account_id,
    a.user_id,
    a.family_id,
    a.nome,
    a.tipo,
    COALESCE(tx.saldo_atual, 0)::numeric(15,2) AS saldo_atual,
    COALESCE(ar.total_reservado, 0)::numeric(15,2) AS total_reservado,
    (COALESCE(tx.saldo_atual, 0) - COALESCE(ar.total_reservado, 0))::numeric(15,2) AS saldo_disponivel
  FROM a
  LEFT JOIN tx ON tx.account_id = a.id
  LEFT JOIN ar ON ar.account_id = a.id
  WHERE auth.uid() = p_user_id
  ORDER BY a.nome;
$$;

-- ============================================================
-- 13. get_personal_kpis (a.saldo → account_balances, t.valor → amount_cents)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_personal_kpis()
RETURNS TABLE(
  total_balance numeric, credit_card_debt numeric, top_goal_progress numeric,
  monthly_savings numeric, goals_account_balance numeric, total_goals_value numeric,
  goals_progress_percentage numeric, total_budget_spent numeric,
  total_budget_amount numeric, budget_spent_percentage numeric
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
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

  -- Balances from account_balances view (computed from transactions)
  SELECT
    COALESCE(SUM(CASE WHEN a.tipo != 'cartão de crédito' THEN ab.saldo_atual ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN a.tipo = 'cartão de crédito' AND ab.saldo_atual < 0 THEN ABS(ab.saldo_atual) ELSE 0 END), 0)
  INTO v_total_balance, v_credit_card_debt
  FROM public.accounts a
  LEFT JOIN public.account_balances ab ON ab.account_id = a.id
  WHERE a.user_id = v_user_id AND a.family_id IS NULL;

  SELECT
    COALESCE(SUM(valor_objetivo), 0),
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

  SELECT COALESCE(((valor_atual / NULLIF(valor_objetivo, 0)) * 100), 0)
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

  SELECT COALESCE(SUM(b.valor), 0), COALESCE(SUM(b.valor), 0)
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
end;$$;

-- ============================================================
-- 14. get_family_kpis no-param overload (t.valor → amount_cents)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_family_kpis()
RETURNS TABLE(
  total_balance numeric, credit_card_debt numeric, top_goal_progress numeric,
  monthly_savings numeric, goals_account_balance numeric, total_goals_value numeric,
  goals_progress_percentage numeric, total_members integer, pending_invites integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
    select g.*, least(case when g.valor_objetivo>0 then (g.valor_atual/g.valor_objetivo)*100 else 0 end, 100) as progress
    from public.goals g where g.family_id in (select family_id from my_families)
  )
  select
    coalesce(sum(b.saldo_atual), 0)::numeric(15,2) as total_balance,
    coalesce(sum(case when a.tipo = 'cartão de crédito' then least(b.saldo_atual, 0) else 0 end) * -1, 0)::numeric(15,2) as credit_card_debt,
    coalesce(max(goals.progress), 0)::numeric(5,2) as top_goal_progress,
    (select (tx_stats.receitas - tx_stats.despesas) from tx_stats)::numeric(15,2) as monthly_savings,
    0::numeric(15,2) as goals_account_balance,
    coalesce(sum((select valor_objetivo from public.goals gg where gg.id = g.id)), 0)::numeric(15,2) as total_goals_value,
    coalesce(avg(goals.progress), 0)::numeric(5,2) as goals_progress_percentage,
    coalesce((select count(*) from public.family_members fm join my_families f on f.family_id = fm.family_id), 0)::int as total_members,
    0::int as pending_invites
  from balances b
  join fam_accounts a on a.id = b.account_id
  cross join (select * from goals limit 1) g;
end;$$;

-- ============================================================
-- 15. get_family_kpis four-param overload (a.saldo + t.valor → fixed)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_family_kpis(
  p_family_id       uuid,
  p_date_start      date,
  p_date_end        date,
  p_exclude_transfers boolean DEFAULT true
)
RETURNS TABLE(
  total_balance numeric, credit_card_debt numeric, monthly_savings numeric,
  goals_account_balance numeric, total_goals_value numeric, goals_progress_percentage numeric,
  top_goal_progress numeric, total_budget_spent numeric, total_budget_amount numeric,
  budget_spent_percentage numeric, prev_month_savings numeric, delta_vs_prev numeric,
  overspent_budgets_count integer, overspent_budget_ids uuid[],
  total_members integer, pending_invites integer
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
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

  select coalesce(sum(g.valor_objetivo), 0), coalesce(sum(g.valor_atual), 0),
         coalesce(max(case when g.valor_objetivo > 0 then (g.valor_atual/g.valor_objetivo)*100 else 0 end), 0)
  into v_goals_total, v_goals_current, v_top_goal
  from public.goals g where g.family_id = p_family_id;

  select coalesce(sum(case when t.tipo = 'receita' then t.amount_cents::numeric / 100.0 else 0 end), 0)
       - coalesce(sum(case when t.tipo = 'despesa' then t.amount_cents::numeric / 100.0 else 0 end), 0)
  into v_savings
  from public.transactions t
  where t.family_id = p_family_id
    and t.data between p_date_start and p_date_end
    and (not p_exclude_transfers or t.tipo <> 'transferencia');

  select coalesce(sum(case when t.tipo = 'receita' then t.amount_cents::numeric / 100.0 else 0 end), 0)
       - coalesce(sum(case when t.tipo = 'despesa' then t.amount_cents::numeric / 100.0 else 0 end), 0)
  into v_prev_savings
  from public.transactions t
  where t.family_id = p_family_id
    and t.data between v_prev_start and v_prev_end
    and (not p_exclude_transfers or t.tipo <> 'transferencia');

  with budget_rows as (
    select b.id, b.categoria_id, b.valor
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
  select coalesce(sum(j.spent), 0), coalesce(sum(j.budget_value), 0),
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
end$$;

COMMIT;
