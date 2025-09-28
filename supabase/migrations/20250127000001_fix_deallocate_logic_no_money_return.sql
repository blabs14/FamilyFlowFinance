-- Corrigir função deallocate_from_goal_with_transaction para implementar a lógica correta
-- Quando desalocamos valor de um objetivo, esse valor deve desaparecer completamente do sistema
-- NÃO deve voltar para a conta de origem nem ficar disponível na conta Objetivos

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
  v_goal_exists boolean := false;
  v_result json;
BEGIN
  -- Validar parâmetros
  IF v_amount_requested <= 0 THEN
    RAISE EXCEPTION 'Montante deve ser positivo';
  END IF;
  
  -- Verificar se o objetivo existe e buscar family_id (pode ser NULL para objetivos pessoais)
  SELECT family_id, true INTO v_family_id, v_goal_exists
  FROM goals 
  WHERE id = goal_id_param AND user_id = user_id_param;
  
  IF NOT v_goal_exists THEN
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
  
  -- LÓGICA CORRETA: Quando desalocamos, o valor desaparece completamente do sistema
  -- Apenas deduzir da conta Objetivos (o valor não volta para a conta de origem)
  IF v_amount_released > 0 THEN
    -- Deduzir da conta Objetivos
    UPDATE accounts 
    SET saldo = saldo - v_amount_released
    WHERE id = v_objetivos_account_id;
    
    -- NÃO devolver à conta de origem - o valor desaparece do sistema
    -- Isto é diferente da eliminação de objetivos, onde as regras são outras
  END IF;
  
  -- Retornar resultado
  v_result := json_build_object(
    'success', true,
    'amount_requested', v_amount_requested,
    'amount_released', v_amount_released,
    'remaining_requested', v_remaining,
    'account_id', account_id_param,
    'objetivos_account_id', v_objetivos_account_id,
    'family_id', v_family_id,
    'note', 'Valor desalocado foi removido do sistema (não devolvido à conta de origem)'
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
COMMENT ON FUNCTION public.deallocate_from_goal_with_transaction(uuid, uuid, numeric, uuid) IS 'Desaloca fundos de um objetivo removendo o valor do sistema (não devolve à conta de origem)';