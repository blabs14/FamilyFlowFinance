-- Corrigir problema RLS na desalocação
-- A transação de despesa na conta "Objetivos Pessoais" deve ser criada 
-- com o user_id do proprietário da conta, não de quem está a desalocar

CREATE OR REPLACE FUNCTION public.fn_goal_deallocate(
  goal_id_param uuid,
  destination_account_id_param uuid,
  amount_param numeric,
  user_id_param uuid,
  description_param text DEFAULT 'Desalocação de objetivo',
  force_param boolean DEFAULT NULL,
  transaction_date_param date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_goal_exists boolean := false;
  v_destination_balance numeric;
  v_family_id uuid;
  v_objetivos_account_id uuid;
  v_objetivos_account_owner_id uuid; -- NOVO: proprietário da conta Objetivos
  v_categoria_id uuid;
  v_allocation_record record;
  v_remaining numeric := amount_param;
  v_amount_released numeric := 0;
  v_current_value numeric;
BEGIN
  -- Verificar se o objetivo existe
  SELECT family_id INTO v_family_id
  FROM goals 
  WHERE id = goal_id_param AND user_id = user_id_param;
  
  IF NOT FOUND THEN
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
  
  -- NOVO: Obter o proprietário da conta Objetivos
  SELECT user_id INTO v_objetivos_account_owner_id
  FROM accounts
  WHERE id = v_objetivos_account_id;
  
  IF v_objetivos_account_owner_id IS NULL THEN
    RAISE EXCEPTION 'Proprietário da conta Objetivos não encontrado';
  END IF;
  
  -- Buscar ou criar a categoria "Objetivos" para o proprietário da conta
  SELECT id INTO v_categoria_id
  FROM categories
  WHERE user_id = v_objetivos_account_owner_id AND nome = 'Objetivos';
  
  IF v_categoria_id IS NULL THEN
    INSERT INTO categories (nome, user_id, cor)
    VALUES ('Objetivos', v_objetivos_account_owner_id, '#3B82F6')
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
      -- CORREÇÃO: usar o user_id do proprietário da conta Objetivos
      INSERT INTO transactions (
        account_id,
        categoria_id,
        valor,
        tipo,
        data,
        descricao,
        goal_id,
        user_id,
        family_id
      )
      VALUES (
        v_objetivos_account_id,
        v_categoria_id,
        v_amount_released, -- Valor positivo = despesa na conta Objetivos
        'despesa',
        COALESCE(transaction_date_param, NOW()::date),
        description_param,
        goal_id_param,
        v_objetivos_account_owner_id, -- CORREÇÃO: usar proprietário da conta
        v_family_id
      );
      
      -- 2. NÃO criar transação na conta origem
      -- O valor simplesmente passa de reservado para disponível
      -- O saldo total da conta origem permanece inalterado
      
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'Erro ao criar transação de desalocação: %', SQLERRM;
    END;
    
    -- 3. Reduzir o valor atual do objetivo
    UPDATE goals 
    SET valor_atual = GREATEST(0, valor_atual - v_amount_released),
        updated_at = NOW()
    WHERE id = goal_id_param;
    
    -- 4. Atualizar saldo da conta Objetivos
    UPDATE accounts 
    SET saldo = saldo - v_amount_released,
        updated_at = NOW()
    WHERE id = v_objetivos_account_id;
  END IF;
  
  -- Retornar resultado
  RETURN json_build_object(
    'success', true,
    'amount_deallocated', v_amount_released,
    'remaining_requested', v_remaining,
    'message', format('Desalocados €%.2f do objetivo', v_amount_released)
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro na desalocação: %', SQLERRM;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.fn_goal_deallocate TO authenticated;

-- Comentários
COMMENT ON FUNCTION public.fn_goal_deallocate IS 'Desaloca fundos de um objetivo movendo valor de reservado para disponível. CORREÇÃO RLS: transação criada com user_id do proprietário da conta Objetivos.';