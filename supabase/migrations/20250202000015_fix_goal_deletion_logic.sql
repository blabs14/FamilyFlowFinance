-- Corrigir lógica de eliminação de objetivos
-- REGRA: Objetivo <100% = desalocação normal (valor fica na conta origem)
-- REGRA: Objetivo =100% = valor passa definitivamente para conta Objetivos

CREATE OR REPLACE FUNCTION public.fn_goal_delete_with_correct_logic(
  goal_id_param uuid,
  user_id_param uuid,
  destination_account_id_param uuid DEFAULT NULL,
  idempotency_key text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  goal_record record;
  v_total_allocated numeric := 0;
  v_goal_progress numeric := 0;
  v_destination_account_id uuid;
  v_objetivos_account_id uuid;
  v_categoria_id uuid;
  v_idempotency_result json;
  v_final_result json;
  allocation_record record;
BEGIN
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
  
  -- 1. Buscar informações do objetivo
  SELECT * INTO goal_record 
  FROM goals 
  WHERE id = goal_id_param AND user_id = user_id_param;
  
  IF goal_record IS NULL THEN
    RAISE EXCEPTION 'Objetivo não encontrado';
  END IF;
  
  -- 2. Calcular total alocado e progresso
  SELECT COALESCE(SUM(valor), 0) INTO v_total_allocated
  FROM goal_allocations 
  WHERE goal_id = goal_id_param AND user_id = user_id_param;
  
  IF goal_record.valor_objetivo > 0 THEN
    v_goal_progress := (v_total_allocated / goal_record.valor_objetivo) * 100;
  END IF;
  
  -- 3. Garantir que a conta "Objetivos" existe
  v_objetivos_account_id := ensure_goals_account(user_id_param, goal_record.family_id);
  
  -- 4. Buscar ou criar a categoria "Objetivos"
  SELECT id INTO v_categoria_id
  FROM categories
  WHERE user_id = user_id_param AND nome = 'Objetivos';
  
  IF v_categoria_id IS NULL THEN
    INSERT INTO categories (nome, user_id, cor)
    VALUES ('Objetivos', user_id_param, '#3B82F6')
    RETURNING id INTO v_categoria_id;
  END IF;
  
  -- 5. Determinar conta de destino
  IF destination_account_id_param IS NOT NULL THEN
    v_destination_account_id := destination_account_id_param;
  ELSE
    -- Buscar a conta de origem da primeira alocação
    SELECT ga.account_id INTO v_destination_account_id
    FROM goal_allocations ga
    WHERE ga.goal_id = goal_id_param 
      AND ga.user_id = user_id_param
    ORDER BY ga.data_alocacao ASC
    LIMIT 1;
    
    -- Se não encontrar, usar a primeira conta do utilizador
    IF v_destination_account_id IS NULL THEN
      SELECT id INTO v_destination_account_id
      FROM accounts
      WHERE user_id = user_id_param
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;
  END IF;
  
  IF v_destination_account_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma conta de destino encontrada';
  END IF;
  
  -- 6. LÓGICA PRINCIPAL: Comportamento baseado no progresso
  IF v_total_allocated > 0 THEN
    IF v_goal_progress < 100 THEN
      -- CASO 1: Objetivo <100% - Comporta-se como desalocação normal
      -- Apenas remove alocações (valor passa de reservado para disponível na mesma conta)
      -- NÃO altera saldo total da conta origem
      
      -- Remover todas as alocações
      DELETE FROM goal_allocations 
      WHERE goal_id = goal_id_param AND user_id = user_id_param;
      
      -- Criar apenas transação de despesa na conta Objetivos
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
        v_total_allocated, -- Valor positivo = despesa na conta Objetivos
        'despesa',
        NOW()::date,
        'Eliminação de objetivo incompleto: ' || goal_record.nome,
        goal_id_param,
        user_id_param,
        goal_record.family_id
      );
      
    ELSE
      -- CASO 2: Objetivo =100% - Valor passa definitivamente para conta Objetivos
      -- Saldo total da conta origem diminui, saldo total da conta Objetivos aumenta
      
      -- Remover todas as alocações
      DELETE FROM goal_allocations 
      WHERE goal_id = goal_id_param AND user_id = user_id_param;
      
      -- 1. Deduzir da conta origem (despesa = diminui saldo total)
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
        v_destination_account_id,
        v_categoria_id,
        v_total_allocated, -- Valor positivo = despesa na conta origem
        'despesa',
        NOW()::date,
        'Transferência definitiva para objetivos: ' || goal_record.nome,
        goal_id_param,
        user_id_param,
        goal_record.family_id
      );
      
      -- 2. Adicionar à conta Objetivos (receita = aumenta saldo total)
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
        v_total_allocated, -- Valor positivo = receita na conta Objetivos
        'receita',
        NOW()::date,
        'Objetivo atingido transferido: ' || goal_record.nome,
        goal_id_param,
        user_id_param,
        goal_record.family_id
      );
    END IF;
  END IF;
  
  -- 7. Eliminar o objetivo
  DELETE FROM goals WHERE id = goal_id_param AND user_id = user_id_param;
  
  -- 8. Preparar resultado
  v_final_result := json_build_object(
    'success', true,
    'goal_name', goal_record.nome,
    'total_allocated', v_total_allocated,
    'goal_progress', v_goal_progress,
    'destination_account_id', v_destination_account_id,
    'objetivos_account_id', v_objetivos_account_id,
    'restored_to_account', v_goal_progress < 100,
    'transferred_to_objetivos', v_goal_progress >= 100,
    'message', CASE 
      WHEN v_total_allocated = 0 THEN 
        'Objetivo eliminado sem alocações'
      WHEN v_goal_progress < 100 THEN 
        'Objetivo eliminado: ' || v_total_allocated || '€ devolvido como disponível na conta origem'
      ELSE 
        'Objetivo atingido eliminado: ' || v_total_allocated || '€ transferido definitivamente para conta Objetivos'
    END
  );
  
  -- 9. Guardar resultado para idempotência se key fornecida
  IF idempotency_key IS NOT NULL THEN
    INSERT INTO idempotent_ops (key, user_id, operation_type, operation_data, result)
    VALUES (
      idempotency_key, 
      user_id_param, 
      'goal_delete_correct',
      json_build_object(
        'goal_id', goal_id_param,
        'destination_account_id', v_destination_account_id,
        'total_allocated', v_total_allocated,
        'goal_progress', v_goal_progress
      ),
      v_final_result
    );
  END IF;
  
  RETURN v_final_result;
  
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Erro ao eliminar objetivo: %', SQLERRM;
END;
$$;

-- Dar permissões à função
GRANT EXECUTE ON FUNCTION public.fn_goal_delete_with_correct_logic TO authenticated;

-- Comentários
COMMENT ON FUNCTION public.fn_goal_delete_with_correct_logic IS 'Elimina objetivo com lógica correta: <100% = desalocação normal, =100% = transferência definitiva para conta Objetivos';

-- Atualizar a função de compatibilidade
CREATE OR REPLACE FUNCTION public.delete_goal_with_restoration(goal_id_param uuid, user_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Chamar a nova função com lógica correta
  RETURN fn_goal_delete_with_correct_logic(goal_id_param, user_id_param, NULL, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_goal_with_restoration TO authenticated;
COMMENT ON FUNCTION public.delete_goal_with_restoration IS 'Wrapper para compatibilidade - usa fn_goal_delete_with_correct_logic internamente';