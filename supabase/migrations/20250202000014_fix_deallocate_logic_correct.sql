-- Corrigir função de desalocação para NÃO alterar saldo total da conta origem
-- A desalocação deve apenas mover valor de reservado para disponível

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
  
  -- LÓGICA CORRETA: Desalocação apenas move de reservado para disponível
  -- NÃO altera o saldo total da conta origem
  IF v_amount_released > 0 THEN
    BEGIN
      -- 1. APENAS deduzir da conta Objetivos (reduz o valor reservado)
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
        reversal_of
      )
      VALUES (
        v_objetivos_account_id,
        v_categoria_id,
        v_amount_released, -- Valor positivo = despesa na conta Objetivos
        'despesa',
        NOW()::date,
        description_param,
        goal_id_param,
        user_id_param,
        v_family_id,
        reversal_of_param
      );
      
      -- 2. NÃO criar transação na conta origem
      -- O valor simplesmente passa de reservado para disponível
      -- O saldo total da conta origem permanece inalterado
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'Erro na desalocação: %', SQLERRM;
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
    'note', 'Desalocação correta: valor passou de reservado para disponível sem alterar saldo total'
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
COMMENT ON FUNCTION public.fn_goal_deallocate IS 'Desaloca fundos de um objetivo movendo valor de reservado para disponível (sem alterar saldo total da conta origem)';

-- Manter compatibilidade com a função antiga
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
BEGIN
  -- Chamar a nova função corrigida
  RETURN fn_goal_deallocate(
    goal_id_param, 
    account_id_param, 
    amount_param, 
    user_id_param, 
    'Desalocação de objetivo',
    NULL,
    NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.deallocate_from_goal_with_transaction TO authenticated;