-- Correção: alocação para objetivo não deve reduzir saldo total da conta origem
-- Remove atualizações diretas em accounts.saldo e usa apenas transações 'transferencia'

CREATE OR REPLACE FUNCTION public.fn_goal_allocate(
  goal_id_param uuid,
  account_id_param uuid,
  amount_param numeric,
  user_id_param uuid,
  description_param text DEFAULT 'Alocação para objetivo'::text,
  idempotency_key text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := COALESCE(user_id_param, auth.uid());
  v_amount_requested numeric := ABS(amount_param);
  v_objetivos_account_id uuid;
  v_family_id uuid;
  v_categoria_transfer_id uuid;
  v_transfer_group_id uuid := gen_random_uuid();
  v_allocation_record record;
  v_transaction_out_record record;
  v_transaction_in_record record;
  v_idempotency_result json;
  v_final_result json;
  v_account record;
  v_reservado numeric := 0;
  v_saldo_atual numeric := 0;
  v_saldo_disponivel numeric := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilizador não autenticado';
  END IF;

  IF v_amount_requested <= 0 THEN
    RAISE EXCEPTION 'Montante deve ser positivo';
  END IF;

  -- Idempotência
  IF idempotency_key IS NOT NULL THEN
    SELECT result INTO v_idempotency_result
    FROM public.idempotent_ops 
    WHERE key = idempotency_key AND user_id = v_user_id;
    IF v_idempotency_result IS NOT NULL THEN
      RETURN v_idempotency_result;
    END IF;
  END IF;

  -- Obter objetivo
  SELECT g.family_id INTO v_family_id
  FROM public.goals g
  WHERE g.id = goal_id_param AND (g.user_id = v_user_id OR EXISTS (
    SELECT 1 FROM public.family_members fm WHERE fm.family_id = g.family_id AND fm.user_id = v_user_id
  ));
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Objetivo não encontrado ou sem permissão';
  END IF;

  -- Conta origem existente e no âmbito
  SELECT a.* INTO v_account FROM public.accounts a WHERE a.id = account_id_param;
  IF v_account.id IS NULL THEN
    RAISE EXCEPTION 'Conta de origem não encontrada';
  END IF;
  IF NOT (
    v_account.user_id = v_user_id OR 
    (v_account.family_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.family_members fm WHERE fm.family_id = v_account.family_id AND fm.user_id = v_user_id
    ))
  ) THEN
    RAISE EXCEPTION 'Conta de origem fora do âmbito do utilizador';
  END IF;

  -- Garantir conta Objetivos alinhada com âmbito
  v_objetivos_account_id := public.ensure_goals_account(v_account.user_id, v_family_id);

  -- Categoria Transferências
  SELECT id INTO v_categoria_transfer_id FROM public.categories c
  WHERE c.user_id = v_account.user_id AND c.nome ILIKE 'transfer%';
  IF v_categoria_transfer_id IS NULL THEN
    INSERT INTO public.categories (nome, user_id, cor)
    VALUES ('Transferências', v_account.user_id, '#6B7280')
    RETURNING id INTO v_categoria_transfer_id;
  END IF;

  -- Calcular saldo disponível: saldo atual - total reservado
  -- Preferir a view account_balances (se existir) senão fallback para accounts.saldo
  BEGIN
    SELECT ab.saldo_atual INTO v_saldo_atual
    FROM public.account_balances ab
    WHERE ab.account_id = account_id_param;
  EXCEPTION WHEN OTHERS THEN
    v_saldo_atual := COALESCE(v_account.saldo, 0);
  END;

  BEGIN
    SELECT COALESCE(ar.total_reservado, 0) INTO v_reservado
    FROM public.account_reserved ar
    WHERE ar.account_id = account_id_param;
  EXCEPTION WHEN OTHERS THEN
    v_reservado := 0;
  END;

  v_saldo_disponivel := GREATEST(0, v_saldo_atual - v_reservado);
  IF v_saldo_disponivel < v_amount_requested THEN
    RAISE EXCEPTION 'Saldo disponível insuficiente: disponível %.2f€, pedido %.2f€', v_saldo_disponivel, v_amount_requested;
  END IF;

  -- Inserir alocação e transações de transferência (sem tocar em accounts.saldo)
  BEGIN
    INSERT INTO public.goal_allocations (
      goal_id,
      account_id,
      valor,
      descricao,
      user_id,
      data_alocacao
    ) VALUES (
      goal_id_param,
      account_id_param,
      v_amount_requested,
      description_param,
      v_user_id,
      NOW()
    ) RETURNING * INTO v_allocation_record;

    -- Saída na conta origem
    INSERT INTO public.transactions (
      account_id,
      categoria_id,
      valor,
      tipo,
      data,
      descricao,
      goal_id,
      user_id,
      family_id,
      transfer_group_id
    ) VALUES (
      account_id_param,
      v_categoria_transfer_id,
      -v_amount_requested,
      'transferencia',
      NOW()::date,
      COALESCE(description_param, 'Alocação para objetivo') || ' (para Objetivos)',
      goal_id_param,
      v_user_id,
      v_family_id,
      v_transfer_group_id
    ) RETURNING * INTO v_transaction_out_record;

    -- Entrada na conta Objetivos
    INSERT INTO public.transactions (
      account_id,
      categoria_id,
      valor,
      tipo,
      data,
      descricao,
      goal_id,
      user_id,
      family_id,
      transfer_group_id
    ) VALUES (
      v_objetivos_account_id,
      v_categoria_transfer_id,
      v_amount_requested,
      'transferencia',
      NOW()::date,
      COALESCE(description_param, 'Alocação para objetivo') || ' (de ' || v_account.nome || ')',
      goal_id_param,
      v_user_id,
      v_family_id,
      v_transfer_group_id
    ) RETURNING * INTO v_transaction_in_record;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro na alocação (transferências): %', SQLERRM;
  END;

  v_final_result := json_build_object(
    'success', true,
    'allocation', row_to_json(v_allocation_record),
    'transaction_out', row_to_json(v_transaction_out_record),
    'transaction_in', row_to_json(v_transaction_in_record),
    'amount_allocated', v_amount_requested,
    'objetivos_account_id', v_objetivos_account_id,
    'transfer_group_id', v_transfer_group_id,
    'note', 'Alocação não altera saldo total; apenas reservado aumenta e disponível diminui.'
  );

  IF idempotency_key IS NOT NULL THEN
    INSERT INTO public.idempotent_ops (key, user_id, operation_type, operation_data, result)
    VALUES (
      idempotency_key,
      v_user_id,
      'goal_allocate',
      json_build_object('goal_id', goal_id_param, 'account_id', account_id_param, 'amount', v_amount_requested, 'description', description_param),
      v_final_result
    );
  END IF;

  RETURN v_final_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_goal_allocate TO authenticated;
COMMENT ON FUNCTION public.fn_goal_allocate IS 'Aloca fundos sem alterar saldo total; usa transações de transferência e atualiza apenas reservado.';

-- Wrapper antigo mantém-se
CREATE OR REPLACE FUNCTION public.allocate_to_goal_with_transaction(
  goal_id_param uuid,
  account_id_param uuid,
  amount_param numeric,
  user_id_param uuid,
  description_param text DEFAULT 'Alocação para objetivo'::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.fn_goal_allocate(goal_id_param, account_id_param, amount_param, user_id_param, description_param, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.allocate_to_goal_with_transaction TO authenticated;