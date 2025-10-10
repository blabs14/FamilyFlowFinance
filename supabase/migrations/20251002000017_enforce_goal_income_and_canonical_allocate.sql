-- Enforce integrity for goal income and canonize allocate_to_goal_with_transaction
-- This migration adds a trigger to require goal_id for income transactions in Goals accounts
-- and recreates the canonical allocate_to_goal_with_transaction function.

BEGIN;

-- 1) Trigger function: reject income in Goals accounts without goal_id
CREATE OR REPLACE FUNCTION public.enforce_goal_income_has_goal_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only enforce on income
  IF NEW.tipo = 'receita' THEN
    -- Check if the target account is a Goals account (by name)
    IF EXISTS (
      SELECT 1
      FROM public.accounts a
      WHERE a.id = NEW.account_id
        AND (a.nome ILIKE '%Objetivos%' OR a.nome ILIKE '%Goals%')
    ) THEN
      IF NEW.goal_id IS NULL THEN
        RAISE EXCEPTION 'Receita em conta de Objetivos requer goal_id (transaction %, account_id %)', NEW.id, NEW.account_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Create trigger on public.transactions
DROP TRIGGER IF EXISTS trg_enforce_goal_income_has_goal_id ON public.transactions;
CREATE TRIGGER trg_enforce_goal_income_has_goal_id
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE PROCEDURE public.enforce_goal_income_has_goal_id();

-- 3) Drop duplicate wrong allocate_to_goal_with_transaction signature (DECIMAL variant)
DROP FUNCTION IF EXISTS public.allocate_to_goal_with_transaction(uuid, uuid, decimal, uuid, text);

-- 4) Canonical allocate_to_goal_with_transaction
CREATE OR REPLACE FUNCTION public.allocate_to_goal_with_transaction(
  goal_id_param uuid,
  account_id_param uuid,
  amount_param numeric,
  user_id_param uuid,
  description_param text DEFAULT 'Alocação para objetivo'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_amount_requested numeric := ABS(amount_param);
  v_categoria_id uuid;
  v_objetivos_account_id uuid;
  v_family_id uuid;
  v_allocation_record record;
  v_transaction_out_id uuid;
  v_transaction_in_id uuid;
  v_origin_balance numeric;
BEGIN
  -- Validate input
  IF v_amount_requested <= 0 THEN
    RAISE EXCEPTION 'Montante deve ser positivo';
  END IF;

  -- Resolve family from goal
  SELECT family_id INTO v_family_id
  FROM public.goals 
  WHERE id = goal_id_param AND user_id = user_id_param;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Objetivo não encontrado';
  END IF;

  -- Ensure Goals account exists
  v_objetivos_account_id := ensure_goals_account(user_id_param, v_family_id);

  -- Check origin account and balance
  SELECT saldo INTO v_origin_balance
  FROM public.accounts
  WHERE id = account_id_param AND user_id = user_id_param;

  IF v_origin_balance IS NULL THEN
    RAISE EXCEPTION 'Conta de origem não encontrada';
  END IF;

  IF v_origin_balance < v_amount_requested THEN
    RAISE EXCEPTION 'Saldo insuficiente na conta de origem: %.2f€', v_origin_balance;
  END IF;

  -- Category "Objetivos"
  SELECT id INTO v_categoria_id
  FROM public.categories
  WHERE user_id = user_id_param AND nome = 'Objetivos'
  LIMIT 1;

  IF v_categoria_id IS NULL THEN
    INSERT INTO public.categories (nome, user_id, cor)
    VALUES ('Objetivos', user_id_param, '#3B82F6')
    RETURNING id INTO v_categoria_id;
  END IF;

  -- Atomic operations
  -- 1. Update accounts balances
  UPDATE public.accounts 
  SET saldo = saldo - v_amount_requested,
      updated_at = NOW()
  WHERE id = account_id_param;

  UPDATE public.accounts 
  SET saldo = saldo + v_amount_requested,
      updated_at = NOW()
  WHERE id = v_objetivos_account_id;

  -- 2. Create expense in origin account
  INSERT INTO public.transactions (
    account_id, categoria_id, valor, tipo, data, descricao, goal_id, user_id, family_id
  )
  SELECT
    account_id_param, v_categoria_id, v_amount_requested, 'despesa', NOW()::date,
    description_param || ' (para Objetivos)', goal_id_param, user_id_param, v_family_id
  RETURNING id INTO v_transaction_out_id;

  -- 3. Create income in Goals account (must have goal_id)
  INSERT INTO public.transactions (
    account_id, categoria_id, valor, tipo, data, descricao, goal_id, user_id, family_id
  )
  SELECT
    v_objetivos_account_id, v_categoria_id, v_amount_requested, 'receita', NOW()::date,
    description_param || ' (de ' || (SELECT nome FROM public.accounts WHERE id = account_id_param) || ')',
    goal_id_param, user_id_param, v_family_id
  RETURNING id INTO v_transaction_in_id;

  -- 4. Record allocation
  INSERT INTO public.goal_allocations (goal_id, account_id, valor, descricao, user_id, data_alocacao)
  VALUES (goal_id_param, account_id_param, v_amount_requested, description_param, user_id_param, NOW())
  RETURNING * INTO v_allocation_record;

  -- 5. Update goal current value
  UPDATE public.goals
  SET valor_atual = COALESCE(valor_atual, 0) + v_amount_requested,
      updated_at = NOW()
  WHERE id = goal_id_param;

  RETURN json_build_object(
    'success', true,
    'allocation', row_to_json(v_allocation_record),
    'transaction_out_id', v_transaction_out_id,
    'transaction_in_id', v_transaction_in_id,
    'amount_allocated', v_amount_requested,
    'goal_id', goal_id_param,
    'objetivos_account_id', v_objetivos_account_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.allocate_to_goal_with_transaction TO authenticated;

COMMIT;