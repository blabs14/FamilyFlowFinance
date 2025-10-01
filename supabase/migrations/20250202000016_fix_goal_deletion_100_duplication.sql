-- Migração: Corrigir duplicação de valor na eliminação de objetivos 100%
-- Data: 2025-02-02
-- Problema: Quando um objetivo está 100% alocado, a eliminação cria receita desnecessária na conta Objetivos,
--          duplicando o valor que já está lá como reservado.
-- Solução: Para objetivos 100%, apenas remover alocações (valor passa de reservado para disponível)
--          sem criar transações adicionais na conta Objetivos.

-- Remover função existente
DROP FUNCTION IF EXISTS public.fn_goal_delete_with_correct_logic;

-- Recriar função com lógica corrigida
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
  goal_record goals%ROWTYPE;
  v_total_allocated numeric := 0;
  v_goal_progress numeric := 0;
  v_destination_account_id uuid;
  v_objetivos_account_id uuid;
  v_categoria_id uuid;
  v_final_result json;
BEGIN
  -- 1. Verificar idempotência
  IF idempotency_key IS NOT NULL THEN
    SELECT result INTO v_final_result
    FROM idempotent_ops 
    WHERE key = idempotency_key 
      AND user_id = user_id_param 
      AND operation_type = 'goal_delete_correct';
    
    IF FOUND THEN
      RETURN v_final_result;
    END IF;
  END IF;

  -- 2. Obter informações do objetivo
  SELECT * INTO goal_record
  FROM goals 
  WHERE id = goal_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Objetivo não encontrado';
  END IF;

  -- 3. Calcular total alocado e progresso
  SELECT COALESCE(SUM(valor), 0) INTO v_total_allocated
  FROM goal_allocations 
  WHERE goal_id = goal_id_param;
  
  IF goal_record.valor_objetivo > 0 THEN
    v_goal_progress := (goal_record.valor_atual / goal_record.valor_objetivo) * 100;
  END IF;

  -- 4. Se não há alocações, apenas eliminar objetivo
  IF v_total_allocated = 0 THEN
    DELETE FROM goals WHERE id = goal_id_param;
    
    v_final_result := json_build_object(
      'success', true,
      'goal_deleted', true,
      'total_allocated', 0,
      'goal_progress', v_goal_progress,
      'restored_to_account', false,
      'transferred_to_objetivos', false,
      'message', 'Objetivo eliminado sem alocações'
    );
    
    -- Guardar resultado para idempotência
    IF idempotency_key IS NOT NULL THEN
      INSERT INTO idempotent_ops (key, user_id, operation_type, operation_data, result)
      VALUES (
        idempotency_key, 
        user_id_param, 
        'goal_delete_correct',
        json_build_object('goal_id', goal_id_param, 'total_allocated', 0),
        v_final_result
      );
    END IF;
    
    RETURN v_final_result;
  END IF;

  -- 5. Garantir que conta Objetivos existe
  SELECT id INTO v_objetivos_account_id
  FROM accounts 
  WHERE nome LIKE '%Objetivos%' 
    AND user_id = user_id_param
  LIMIT 1;
  
  IF v_objetivos_account_id IS NULL THEN
    RAISE EXCEPTION 'Conta Objetivos não encontrada para o utilizador';
  END IF;

  -- 6. Encontrar ou criar categoria Objetivos
  SELECT id INTO v_categoria_id
  FROM categories 
  WHERE nome = 'Objetivos' 
    AND user_id = user_id_param
  LIMIT 1;
  
  IF v_categoria_id IS NULL THEN
    INSERT INTO categories (nome, user_id, family_id)
    VALUES ('Objetivos', user_id_param, goal_record.family_id)
    RETURNING id INTO v_categoria_id;
  END IF;

  -- 7. Determinar conta de destino
  IF destination_account_id_param IS NOT NULL THEN
    v_destination_account_id := destination_account_id_param;
  ELSE
    -- Usar primeira conta de origem das alocações
    SELECT DISTINCT account_id INTO v_destination_account_id
    FROM goal_allocations 
    WHERE goal_id = goal_id_param
    LIMIT 1;
  END IF;

  -- 8. LÓGICA PRINCIPAL CORRIGIDA
  IF v_goal_progress < 100 THEN
    -- CASO <100%: Desalocação normal
    -- Valor volta para conta origem como disponível
    
    -- Remover alocações (liberta valor reservado)
    DELETE FROM goal_allocations WHERE goal_id = goal_id_param;
    
    -- Criar despesa na conta Objetivos (diminui saldo total da conta Objetivos)
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
      v_total_allocated,
      'despesa',
      NOW()::date,
      'Devolução de objetivo não atingido: ' || goal_record.nome,
      goal_id_param,
      user_id_param,
      goal_record.family_id
    );
    
  ELSE
    -- CASO =100%: Transferência definitiva
    -- Valor já está na conta Objetivos como reservado, apenas passa para disponível
    
    -- Remover alocações (liberta valor reservado na conta Objetivos)
    DELETE FROM goal_allocations WHERE goal_id = goal_id_param;
    
    -- Criar despesa na conta origem (diminui saldo total da conta origem)
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
      v_total_allocated,
      'despesa',
      NOW()::date,
      'Transferência definitiva para objetivos: ' || goal_record.nome,
      goal_id_param,
      user_id_param,
      goal_record.family_id
    );
    
    -- NÃO criar receita na conta Objetivos - o valor já lá está!
    -- A remoção das alocações já liberta o valor de reservado para disponível
    
  END IF;

  -- 9. Eliminar objetivo
  DELETE FROM goals WHERE id = goal_id_param;

  -- 10. Preparar resultado
  v_final_result := json_build_object(
    'success', true,
    'goal_deleted', true,
    'total_allocated', v_total_allocated,
    'goal_progress', v_goal_progress,
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
  
  -- 11. Guardar resultado para idempotência
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
COMMENT ON FUNCTION public.fn_goal_delete_with_correct_logic IS 'Elimina objetivo com lógica corrigida: <100% = desalocação normal, =100% = transferência definitiva SEM duplicação';

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
COMMENT ON FUNCTION public.delete_goal_with_restoration IS 'Wrapper para compatibilidade - usa fn_goal_delete_with_correct_logic internamente (sem duplicação)';