-- Reescrever fn_goal_allocate com dupla-entrada, idempotência e transfer_group_id
-- Esta versão corrige os problemas de duplicação e adiciona rastreabilidade

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
AS $$
DECLARE
  v_amount_requested numeric := ABS(amount_param);
  v_categoria_id uuid;
  v_objetivos_account_id uuid;
  v_family_id uuid;
  v_allocation_record record;
  v_transaction_out_record record;
  v_transaction_in_record record;
  v_account_balance numeric;
  v_transfer_group_id uuid;
  v_idempotency_result json;
  v_final_result json;
BEGIN
  -- Validar parâmetros
  IF v_amount_requested <= 0 THEN
    RAISE EXCEPTION 'Montante deve ser positivo';
  END IF;
  
  -- Verificar idempotência se key fornecida
  IF idempotency_key IS NOT NULL THEN
    SELECT result INTO v_idempotency_result
    FROM idempotent_ops 
    WHERE key = idempotency_key AND user_id = user_id_param;
    
    IF v_idempotency_result IS NOT NULL THEN
      -- Operação já executada, retornar resultado anterior
      RETURN v_idempotency_result;
    END IF;
  END IF;
  
  -- Buscar family_id do objetivo
  SELECT family_id INTO v_family_id
  FROM goals 
  WHERE id = goal_id_param AND user_id = user_id_param;
  
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Objetivo não encontrado';
  END IF;
  
  -- Verificar se a conta de origem tem saldo suficiente
  SELECT saldo INTO v_account_balance
  FROM accounts
  WHERE id = account_id_param AND user_id = user_id_param;
  
  IF v_account_balance IS NULL THEN
    RAISE EXCEPTION 'Conta de origem não encontrada';
  END IF;
  
  IF v_account_balance < v_amount_requested THEN
    RAISE EXCEPTION 'Saldo insuficiente na conta de origem. Saldo disponível: %.2f€', v_account_balance;
  END IF;
  
  -- Garantir que a conta "Objetivos" existe
  v_objetivos_account_id := ensure_goals_account(user_id_param, v_family_id);
  
  -- Buscar ou criar a categoria "Objetivos"
  SELECT id INTO v_categoria_id
  FROM categories
  WHERE user_id = user_id_param AND nome = 'Objetivos';
  
  IF v_categoria_id IS NULL THEN
    INSERT INTO categories (nome, user_id, cor)
    VALUES ('Objetivos', user_id_param, '#3B82F6')
    RETURNING id INTO v_categoria_id;
  END IF;
  
  -- Gerar UUID para agrupar as transações relacionadas
  v_transfer_group_id := gen_random_uuid();
  
  -- Iniciar transação
  BEGIN
    -- 1. Deduzir valor da conta de origem
    UPDATE accounts 
    SET saldo = saldo - v_amount_requested,
        updated_at = NOW()
    WHERE id = account_id_param;
    
    -- 2. Adicionar valor à conta "Objetivos"
    UPDATE accounts 
    SET saldo = saldo + v_amount_requested,
        updated_at = NOW()
    WHERE id = v_objetivos_account_id;
    
    -- 3. Criar a alocação (mantém para histórico/UI)
    INSERT INTO goal_allocations (
      goal_id,
      account_id,
      valor,
      descricao,
      user_id,
      data_alocacao
    )
    VALUES (
      goal_id_param,
      account_id_param,
      v_amount_requested,
      description_param,
      user_id_param,
      NOW()
    )
    RETURNING * INTO v_allocation_record;
    
    -- 4. Criar a transação de transferência na conta de origem (SAÍDA)
    INSERT INTO transactions (
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
    )
    VALUES (
      account_id_param,
      v_categoria_id,
      -v_amount_requested, -- Valor negativo para indicar saída
      'transferencia',
      NOW()::date,
      description_param || ' (para Objetivos)',
      goal_id_param,
      user_id_param,
      v_family_id,
      v_transfer_group_id
    )
    RETURNING * INTO v_transaction_out_record;
    
    -- 5. Criar a transação de entrada na conta Objetivos (ENTRADA)
    INSERT INTO transactions (
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
    )
    VALUES (
      v_objetivos_account_id,
      v_categoria_id,
      v_amount_requested, -- Valor positivo para indicar entrada
      'transferencia',
      NOW()::date,
      description_param || ' (de ' || (SELECT nome FROM accounts WHERE id = account_id_param) || ')',
      goal_id_param,
      user_id_param,
      v_family_id,
      v_transfer_group_id
    )
    RETURNING * INTO v_transaction_in_record;
    
    -- Preparar resultado de sucesso
    v_final_result := json_build_object(
      'success', true,
      'allocation', row_to_json(v_allocation_record),
      'transaction_out', row_to_json(v_transaction_out_record),
      'transaction_in', row_to_json(v_transaction_in_record),
      'amount_allocated', v_amount_requested,
      'objetivos_account_id', v_objetivos_account_id,
      'transfer_group_id', v_transfer_group_id
    );
    
    -- Guardar resultado para idempotência se key fornecida
    IF idempotency_key IS NOT NULL THEN
      INSERT INTO idempotent_ops (key, user_id, operation_type, operation_data, result)
      VALUES (
        idempotency_key, 
        user_id_param, 
        'goal_allocate',
        json_build_object(
          'goal_id', goal_id_param,
          'account_id', account_id_param,
          'amount', v_amount_requested,
          'description', description_param
        ),
        v_final_result
      );
    END IF;
    
    -- Retornar resultado de sucesso
    RETURN v_final_result;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback automático em caso de erro
      RAISE EXCEPTION 'Erro na alocação: %', SQLERRM;
  END;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.fn_goal_allocate TO authenticated;

-- Comentário
COMMENT ON FUNCTION public.fn_goal_allocate IS 'Aloca fundos de uma conta para um objetivo com dupla-entrada, idempotência e rastreabilidade via transfer_group_id';

-- Manter compatibilidade com nome antigo (wrapper)
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
AS $$
BEGIN
  -- Chamar a nova função sem idempotency_key
  RETURN fn_goal_allocate(goal_id_param, account_id_param, amount_param, user_id_param, description_param, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.allocate_to_goal_with_transaction TO authenticated;