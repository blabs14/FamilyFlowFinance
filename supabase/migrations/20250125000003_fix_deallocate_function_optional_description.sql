-- Corrigir função deallocate_from_goal_with_transaction para tornar description_param opcional
-- Criar sobrecarga da função sem description_param

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
  v_amount_requested numeric := ABS(amount_param);
  v_remaining numeric := v_amount_requested;
  v_amount_released numeric := 0;
  v_allocation_record record;
  v_current_value numeric;
  v_objetivos_account_id uuid;
  v_family_id uuid;
  v_result json;
BEGIN
  -- Validar parâmetros
  IF v_amount_requested <= 0 THEN
    RAISE EXCEPTION 'Montante deve ser positivo';
  END IF;
  
  -- Buscar family_id do objetivo
  SELECT family_id INTO v_family_id
  FROM goals 
  WHERE id = goal_id_param AND user_id = user_id_param;
  
  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Objetivo não encontrado';
  END IF;
  
  -- Garantir que a conta Objetivos existe
  v_objetivos_account_id := ensure_goals_account(user_id_param, v_family_id);
  
  -- Processar alocações existentes (mais recentes primeiro)
  FOR v_allocation_record IN 
    SELECT id, valor
    FROM goal_allocations
    WHERE goal_id = goal_id_param 
      AND account_id = account_id_param 
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
  
  -- Ajustar saldos das contas
  IF v_amount_released > 0 THEN
    -- Devolver montante à conta de origem
    UPDATE accounts 
    SET saldo = saldo + v_amount_released
    WHERE id = account_id_param;
    
    -- Deduzir da conta Objetivos
    UPDATE accounts 
    SET saldo = saldo - v_amount_released
    WHERE id = v_objetivos_account_id;
  END IF;
  
  -- Retornar resultado
  v_result := json_build_object(
    'success', true,
    'amount_requested', v_amount_requested,
    'amount_released', v_amount_released,
    'remaining_requested', v_remaining,
    'account_id', account_id_param,
    'objetivos_account_id', v_objetivos_account_id
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Erro ao desalocar fundos: %', SQLERRM;
END;
$$;

-- Dar permissões à função
GRANT EXECUTE ON FUNCTION public.deallocate_from_goal_with_transaction(uuid, uuid, numeric, uuid) TO authenticated;

-- Comentários
COMMENT ON FUNCTION public.deallocate_from_goal_with_transaction(uuid, uuid, numeric, uuid) IS 'Desaloca fundos de um objetivo e ajusta os saldos das contas envolvidas (versão sem description_param)';