-- Correção: desalocação de objetivo não deve reduzir o saldo total
-- Implementa lógica por conta (account_id_param) e regista dupla entrada como 'transferencia'
-- para que as views de saldo ignorem estes movimentos e apenas o reservado diminua.

CREATE OR REPLACE FUNCTION public.fn_goal_deallocate(
  goal_id_param uuid,
  destination_account_id_param uuid,
  amount_param numeric,
  user_id_param uuid,
  description_param text DEFAULT 'Desalocação de objetivo'::text,
  idempotency_key text DEFAULT NULL,
  reversal_of_param uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := COALESCE(user_id_param, auth.uid());
  v_amount_requested numeric := ABS(amount_param);
  v_remaining numeric := v_amount_requested;
  v_amount_released numeric := 0;
  v_allocation_record record;
  v_current_value numeric;
  v_objetivos_account_id uuid;
  v_family_id uuid;
  v_goal record;
  v_categoria_transfer_id uuid;
  v_transfer_group_id uuid := gen_random_uuid();
  v_idempotency_result json;
  v_final_result json;
  v_dest_account record;
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

  -- Objetivo e contexto (family)
  SELECT g.* INTO v_goal
  FROM public.goals g
  WHERE g.id = goal_id_param;
  IF v_goal.id IS NULL THEN
    RAISE EXCEPTION 'Objetivo não encontrado';
  END IF;

  -- Verificar permissões: pessoal ou membro da família
  IF v_goal.user_id IS DISTINCT FROM v_user_id THEN
    IF v_goal.family_id IS NULL THEN
      RAISE EXCEPTION 'Sem permissão para este objetivo';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = v_goal.family_id AND fm.user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'Sem permissão (família)';
    END IF;
  END IF;
  v_family_id := v_goal.family_id;

  -- Conta de destino deve existir e ser do utilizador ou família
  SELECT a.* INTO v_dest_account
  FROM public.accounts a
  WHERE a.id = destination_account_id_param;
  IF v_dest_account.id IS NULL THEN
    RAISE EXCEPTION 'Conta de destino não encontrada';
  END IF;
  IF NOT (
    v_dest_account.user_id = v_user_id OR 
    (v_dest_account.family_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.family_members fm WHERE fm.family_id = v_dest_account.family_id AND fm.user_id = v_user_id
    ))
  ) THEN
    RAISE EXCEPTION 'Conta de destino fora do âmbito do utilizador';
  END IF;

  -- Garantir conta Objetivos do mesmo âmbito
  v_objetivos_account_id := public.ensure_goals_account(v_goal.user_id, v_family_id);

  -- Categoria de Transferência (para painéis ignorarem corretamente)
  SELECT id INTO v_categoria_transfer_id
  FROM public.categories c
  WHERE c.user_id = v_goal.user_id AND c.nome ILIKE 'transfer%';
  IF v_categoria_transfer_id IS NULL THEN
    INSERT INTO public.categories (nome, user_id, cor)
    VALUES ('Transferências', v_goal.user_id, '#6B7280')
    RETURNING id INTO v_categoria_transfer_id;
  END IF;

  -- Processar apenas as alocações da CONTA indicada (escopo correto)
  FOR v_allocation_record IN 
    SELECT id, valor
    FROM public.goal_allocations
    WHERE goal_id = goal_id_param
      AND account_id = destination_account_id_param
      AND user_id = v_user_id
    ORDER BY data_alocacao DESC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_current_value := COALESCE(v_allocation_record.valor, 0);
    IF v_current_value <= 0 THEN CONTINUE; END IF;

    IF v_current_value <= v_remaining THEN
      DELETE FROM public.goal_allocations WHERE id = v_allocation_record.id;
      v_remaining := v_remaining - v_current_value;
      v_amount_released := v_amount_released + v_current_value;
    ELSE
      UPDATE public.goal_allocations 
      SET valor = v_current_value - v_remaining
      WHERE id = v_allocation_record.id;
      v_amount_released := v_amount_released + v_remaining;
      v_remaining := 0;
    END IF;
  END LOOP;

  IF v_amount_released = 0 THEN
    RAISE EXCEPTION 'Não há valor reservado suficiente nesta conta para desalocar';
  END IF;

  -- Registar dupla entrada como TRANSFERÊNCIA (não afeta saldo total nas views)
  BEGIN
    -- Saída da conta Objetivos (negativo)
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
      transfer_group_id,
      reversal_of
    ) VALUES (
      v_objetivos_account_id,
      v_categoria_transfer_id,
      -v_amount_released,
      'transferencia',
      NOW()::date,
      COALESCE(description_param, 'Desalocação de objetivo') || ' (para ' || v_dest_account.nome || ')',
      goal_id_param,
      v_user_id,
      v_family_id,
      v_transfer_group_id,
      reversal_of_param
    );

    -- Entrada na conta de destino (positivo)
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
      transfer_group_id,
      reversal_of
    ) VALUES (
      destination_account_id_param,
      v_categoria_transfer_id,
      v_amount_released,
      'transferencia',
      NOW()::date,
      COALESCE(description_param, 'Desalocação de objetivo') || ' (de Objetivos)',
      goal_id_param,
      v_user_id,
      v_family_id,
      v_transfer_group_id,
      reversal_of_param
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao registar transferência da desalocação: %', SQLERRM;
  END;

  -- Resultado e idempotência
  v_final_result := json_build_object(
    'success', true,
    'amount_requested', v_amount_requested,
    'amount_released', v_amount_released,
    'remaining_requested', v_remaining,
    'destination_account_id', destination_account_id_param,
    'objetivos_account_id', v_objetivos_account_id,
    'family_id', v_family_id,
    'transfer_group_id', v_transfer_group_id,
    'note', 'Desalocação moveu apenas de reservado para disponível via transferências (sem impacto no saldo total)'
  );

  IF idempotency_key IS NOT NULL THEN
    INSERT INTO public.idempotent_ops (key, user_id, operation_type, operation_data, result)
    VALUES (
      idempotency_key,
      v_user_id,
      'goal_deallocate',
      json_build_object(
        'goal_id', goal_id_param,
        'destination_account_id', destination_account_id_param,
        'amount', v_amount_requested,
        'description', description_param,
        'reversal_of', reversal_of_param
      ),
      v_final_result
    );
  END IF;

  RETURN v_final_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_goal_deallocate TO authenticated;
COMMENT ON FUNCTION public.fn_goal_deallocate IS 'Desaloca fundos por conta, removendo alocações dessa conta e registando transferências (sem afetar saldo total).';

-- Wrapper de compatibilidade
CREATE OR REPLACE FUNCTION public.deallocate_from_goal_with_transaction(
  goal_id_param uuid,
  account_id_param uuid,
  amount_param numeric,
  user_id_param uuid,
  description_param text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.fn_goal_deallocate(
    goal_id_param,
    account_id_param,
    amount_param,
    user_id_param,
    COALESCE(description_param, 'Desalocação de objetivo'),
    NULL,
    NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.deallocate_from_goal_with_transaction TO authenticated;