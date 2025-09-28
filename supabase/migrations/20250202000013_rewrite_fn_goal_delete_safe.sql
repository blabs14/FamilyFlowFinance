-- Reescrever fn_goal_delete_safe para calcular saldo real do cofre e desalocar antes de eliminar
-- Esta versão corrige o problema da duplicação usando transações como fonte de verdade

CREATE OR REPLACE FUNCTION public.fn_goal_delete_safe(
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
  v_real_goal_balance numeric := 0;
  v_goal_progress numeric := 0;
  v_destination_account_id uuid;
  v_objetivos_account_id uuid;
  v_idempotency_result json;
  v_deallocate_result json;
  v_final_result json;
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
  
  -- 2. Garantir que a conta "Objetivos" existe
  v_objetivos_account_id := ensure_goals_account(user_id_param, goal_record.family_id);
  
  -- 3. FONTE DE VERDADE: Calcular saldo real do objetivo na conta Objetivos
  -- Soma todas as transações na conta Objetivos relacionadas com este objetivo
  SELECT COALESCE(SUM(valor), 0) INTO v_real_goal_balance
  FROM transactions 
  WHERE account_id = v_objetivos_account_id 
    AND goal_id = goal_id_param 
    AND user_id = user_id_param;
  
  -- 4. Calcular progresso baseado no saldo real
  IF goal_record.valor_objetivo > 0 THEN
    v_goal_progress := (v_real_goal_balance / goal_record.valor_objetivo) * 100;
  END IF;
  
  -- 5. Determinar conta de destino para eventual desalocação
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
    RAISE EXCEPTION 'Nenhuma conta de destino encontrada para devolver os fundos';
  END IF;
  
  -- 6. Se houver saldo real > 0, desalocar TUDO antes de eliminar
  IF v_real_goal_balance > 0 THEN
    -- Usar a nova função de desalocação que faz dupla-entrada
    SELECT fn_goal_deallocate(
      goal_id_param,
      v_destination_account_id,
      v_real_goal_balance,
      user_id_param,
      'Desalocação automática por eliminação do objetivo "' || goal_record.nome || '"',
      CASE WHEN idempotency_key IS NOT NULL THEN idempotency_key || '_deallocate' ELSE NULL END,
      NULL
    ) INTO v_deallocate_result;
    
    -- Verificar se a desalocação foi bem-sucedida
    IF NOT (v_deallocate_result->>'success')::boolean THEN
      RAISE EXCEPTION 'Erro na desalocação automática: %', v_deallocate_result->>'error';
    END IF;
  END IF;
  
  -- 7. Agora eliminar o objetivo (já sem saldo)
  -- Eliminar todas as alocações do objetivo
  DELETE FROM goal_allocations WHERE goal_id = goal_id_param AND user_id = user_id_param;
  
  -- Eliminar o objetivo
  DELETE FROM goals WHERE id = goal_id_param AND user_id = user_id_param;
  
  -- 8. Preparar resultado
  v_final_result := json_build_object(
    'success', true,
    'goal_name', goal_record.nome,
    'real_goal_balance', v_real_goal_balance,
    'goal_progress', v_goal_progress,
    'funds_returned', v_real_goal_balance > 0,
    'destination_account_id', v_destination_account_id,
    'objetivos_account_id', v_objetivos_account_id,
    'deallocate_result', v_deallocate_result,
    'note', CASE 
      WHEN v_real_goal_balance > 0 THEN 
        'Objetivo eliminado após desalocar ' || v_real_goal_balance || '€ para a conta de destino'
      ELSE 
        'Objetivo eliminado sem saldo a devolver'
    END
  );
  
  -- 9. Guardar resultado para idempotência se key fornecida
  IF idempotency_key IS NOT NULL THEN
    INSERT INTO idempotent_ops (key, user_id, operation_type, operation_data, result)
    VALUES (
      idempotency_key, 
      user_id_param, 
      'goal_delete_safe',
      json_build_object(
        'goal_id', goal_id_param,
        'destination_account_id', v_destination_account_id,
        'real_balance_found', v_real_goal_balance
      ),
      v_final_result
    );
  END IF;
  
  RETURN v_final_result;
  
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Erro ao eliminar objetivo de forma segura: %', SQLERRM;
END;
$$;

-- Dar permissões à função
GRANT EXECUTE ON FUNCTION public.fn_goal_delete_safe TO authenticated;

-- Comentários
COMMENT ON FUNCTION public.fn_goal_delete_safe IS 'Elimina objetivo de forma segura: calcula saldo real do cofre, desaloca fundos se necessário, depois elimina';

-- Substituir a função antiga com a nova lógica
CREATE OR REPLACE FUNCTION public.delete_goal_with_restoration(goal_id_param uuid, user_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Chamar a nova função segura
  RETURN fn_goal_delete_safe(goal_id_param, user_id_param, NULL, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_goal_with_restoration TO authenticated;

-- Comentário explicativo
COMMENT ON FUNCTION public.delete_goal_with_restoration IS 'Wrapper para compatibilidade - usa fn_goal_delete_safe internamente';