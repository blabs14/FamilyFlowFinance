-- Reescrever fn_goal_deallocate para fazer dupla-entrada (cofre→destino) em vez de desaparecer
-- Esta versão corrige o problema do "buraco" no sistema

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
AS $$
DECLARE
  v_amount_requested numeric := ABS(amount_param);
  v_remaining numeric := v_amount_requested;
  v_amount_released numeric := 0;
  v_allocation_record record;
  v_current_value numeric;
  v_objetivos_account_id uuid;
  v_family_id uuid;
  v_goal_exists boolean := false;
  v_categoria_id uuid;
  v_transfer_group_id uuid;
  v_transaction_out_record record;
  v_transaction_in_record record;
  v_idempotency_result json;
  v_final_result json;
  v_destination_balance numeric;
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
  
  -- Verificar se o objetivo existe e buscar family_id
  SELECT family_id, true INTO v_family_id, v_goal_exists
  FROM goals 
  WHERE id = goal_id_param AND user_id = user_id_param;
  
  IF NOT v_goal_exists THEN
    RAISE EXCEPTION 'Objetivo não encontrado';
  END IF;
  
  -- Verificar se a conta de destino existe
  SELECT saldo INTO v_destination_balance
  FROM accounts
  WHERE id = destination_account_id_param AND user_id = user_id_param;
  
  IF v_destination_balance IS NULL THEN
    RAISE EXCEPTION 'Conta de destino não encontrada';
  END IF;
  
  -- Garantir que a conta Objetivos existe
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
  
  -- Processar alocações existentes (mais recentes primeiro)
  FOR v_allocation_record IN 
    SELECT id, valor
    FROM goal_allocations
    WHERE goal_id = goal_id_param 
      AND user_id = user_id_param
    ORDER BY data_alocacao DESC
  LOOP
    EXIT WHEN v_remaining <= 0;
    
    v_current_value := COALESCE(v_allocation_record.valor, 0);
    
    IF v_current_value <= 0 THEN
      CONTINUE;
    END IF;
    
    IF v_current_value <= v_remaining THEN
      -- Eliminar alocação completa
      DELETE FROM goal_allocations 
      WHERE id = v_allocation_record.id;
      
      v_remaining := v_remaining - v_current_value;
      v_amount_released := v_amount_released + v_current_value;
      
    ELSE
      -- Reduzir alocação parcialmente
      UPDATE goal_allocations 
      SET valor = v_current_value - v_remaining
      WHERE id = v_allocation_record.id;
      
      v_amount_released := v_amount_released + v_remaining;
      v_remaining := 0;
    END IF;
  END LOOP;
  
  -- NOVA LÓGICA: Fazer dupla-entrada (cofre → conta destino)
  IF v_amount_released > 0 THEN
    BEGIN
      -- 1. Deduzir da conta Objetivos
      UPDATE accounts 
      SET saldo = saldo - v_amount_released,
          updated_at = NOW()
      WHERE id = v_objetivos_account_id;
      
      -- 2. Adicionar à conta de destino
      UPDATE accounts 
      SET saldo = saldo + v_amount_released,
          updated_at = NOW()
      WHERE id = destination_account_id_param;
      
      -- 3. Criar transação de saída na conta Objetivos
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
        transfer_group_id,
        reversal_of
      )
      VALUES (
        v_objetivos_account_id,
        v_categoria_id,
        -v_amount_released, -- Valor negativo para indicar saída
        'transferencia',
        NOW()::date,
        description_param || ' (para ' || (SELECT nome FROM accounts WHERE id = destination_account_id_param) || ')',
        goal_id_param,
        user_id_param,
        v_family_id,
        v_transfer_group_id,
        reversal_of_param
      )
      RETURNING * INTO v_transaction_out_record;
      
      -- 4. Criar transação de entrada na conta de destino
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
        transfer_group_id,
        reversal_of
      )
      VALUES (
        destination_account_id_param,
        v_categoria_id,
        v_amount_released, -- Valor positivo para indicar entrada
        'transferencia',
        NOW()::date,
        description_param || ' (de Objetivos)',
        goal_id_param,
        user_id_param,
        v_family_id,
        v_transfer_group_id,
        reversal_of_param
      )
      RETURNING * INTO v_transaction_in_record;
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'Erro na dupla-entrada da desalocação: %', SQLERRM;
    END;
  END IF;
  
  -- Preparar resultado
  v_final_result := json_build_object(
    'success', true,
    'amount_requested', v_amount_requested,
    'amount_released', v_amount_released,
    'remaining_requested', v_remaining,
    'destination_account_id', destination_account_id_param,
    'objetivos_account_id', v_objetivos_account_id,
    'family_id', v_family_id,
    'transfer_group_id', v_transfer_group_id,
    'transaction_out', CASE WHEN v_amount_released > 0 THEN row_to_json(v_transaction_out_record) ELSE NULL END,
    'transaction_in', CASE WHEN v_amount_released > 0 THEN row_to_json(v_transaction_in_record) ELSE NULL END,
    'note', 'Valor desalocado foi transferido para a conta de destino via dupla-entrada'
  );
  
  -- Guardar resultado para idempotência se key fornecida
  IF idempotency_key IS NOT NULL THEN
    INSERT INTO idempotent_ops (key, user_id, operation_type, operation_data, result)
    VALUES (
      idempotency_key, 
      user_id_param, 
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
  
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Erro ao desalocar fundos: %', SQLERRM;
END;
$$;

-- Dar permissões à função
GRANT EXECUTE ON FUNCTION public.fn_goal_deallocate TO authenticated;

-- Comentários
COMMENT ON FUNCTION public.fn_goal_deallocate IS 'Desaloca fundos de um objetivo transferindo o valor para uma conta de destino via dupla-entrada';

-- Manter compatibilidade com nome antigo (wrapper)
-- NOTA: A função antiga não tinha conta de destino, vamos usar a primeira conta do user como padrão
CREATE OR REPLACE FUNCTION public.deallocate_from_goal_with_transaction(
  goal_id_param uuid,
  account_id_param uuid,
  amount_param numeric,
  user_id_param uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_destination_account_id uuid;
BEGIN
  -- Se account_id_param for fornecido, usar como destino
  -- Senão, usar a primeira conta do utilizador
  IF account_id_param IS NOT NULL THEN
    v_destination_account_id := account_id_param;
  ELSE
    SELECT id INTO v_destination_account_id
    FROM accounts
    WHERE user_id = user_id_param
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF v_destination_account_id IS NULL THEN
      RAISE EXCEPTION 'Nenhuma conta de destino encontrada para o utilizador';
    END IF;
  END IF;
  
  -- Chamar a nova função
  RETURN fn_goal_deallocate(
    goal_id_param, 
    v_destination_account_id, 
    amount_param, 
    user_id_param, 
    'Desalocação de objetivo (compatibilidade)',
    NULL,
    NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.deallocate_from_goal_with_transaction TO authenticated;