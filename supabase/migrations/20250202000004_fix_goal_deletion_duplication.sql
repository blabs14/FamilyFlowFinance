-- Corrigir duplicação na função delete_goal_with_restoration
-- PROBLEMA: A função estava a criar transações E a atualizar diretamente o saldo das contas
-- SOLUÇÃO: Remover as atualizações diretas do saldo, manter apenas as transações

CREATE OR REPLACE FUNCTION public.delete_goal_with_restoration(goal_id_param uuid, user_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  goal_record record;
  allocation_record record;
  total_allocated numeric := 0;
  goal_progress numeric := 0;
  account_id uuid;
  objetivos_account_id uuid;
  ajuste_category_id uuid;
  result json;
BEGIN
  -- 1. Buscar informações do objetivo
  SELECT * INTO goal_record 
  FROM goals 
  WHERE id = goal_id_param AND user_id = user_id_param;
  
  IF goal_record IS NULL THEN
    RAISE EXCEPTION 'Objetivo não encontrado';
  END IF;
  
  -- 2. Calcular progresso do objetivo
  SELECT COALESCE(SUM(valor), 0) INTO total_allocated
  FROM goal_allocations 
  WHERE goal_id = goal_id_param;
  
  IF goal_record.valor_objetivo > 0 THEN
    goal_progress := (total_allocated / goal_record.valor_objetivo) * 100;
  END IF;
  
  -- 3. Buscar a conta associada ao objetivo (primeira alocação)
  SELECT ga.account_id INTO account_id
  FROM goal_allocations ga
  WHERE ga.goal_id = goal_id_param 
  LIMIT 1;
  
  -- 4. Garantir que a conta "Objetivos" existe
  objetivos_account_id := ensure_goals_account(user_id_param, goal_record.family_id);
  
  -- 5. Buscar ou criar categoria "Ajuste"
  SELECT id INTO ajuste_category_id 
  FROM categories 
  WHERE nome = 'Ajuste' AND user_id = user_id_param
  LIMIT 1;
  
  IF ajuste_category_id IS NULL THEN
    INSERT INTO categories (nome, cor, user_id, family_id)
    VALUES ('Ajuste', '#6B7280', user_id_param, goal_record.family_id)
    ON CONFLICT (nome, user_id) WHERE (user_id IS NOT NULL) DO NOTHING
    RETURNING id INTO ajuste_category_id;
    
    -- Se ainda for NULL devido ao ON CONFLICT, buscar novamente
    IF ajuste_category_id IS NULL THEN
      SELECT id INTO ajuste_category_id 
      FROM categories 
      WHERE nome = 'Ajuste' AND user_id = user_id_param
      LIMIT 1;
    END IF;
  END IF;
  
  -- 6. Criar apenas transações (SEM atualizar diretamente o saldo das contas)
  IF goal_progress < 100 AND account_id IS NOT NULL AND total_allocated > 0 THEN
    -- Objetivo < 100%: Valor volta para conta de origem
    
    -- Criar transação de receita na conta origem (restauração)
    INSERT INTO transactions (
      tipo, valor, descricao, account_id, categoria_id, user_id, family_id, goal_id, data
    ) VALUES (
      'receita', 
      total_allocated, 
      'Restauração de valor por eliminação do objetivo "' || goal_record.nome || '"',
      account_id, 
      ajuste_category_id, 
      user_id_param, 
      goal_record.family_id,
      goal_id_param,
      CURRENT_DATE
    );
    
    -- Criar transação de despesa na conta objetivos (saída)
    INSERT INTO transactions (
      tipo, valor, descricao, account_id, categoria_id, user_id, family_id, goal_id, data
    ) VALUES (
      'despesa', 
      total_allocated, 
      'Dedução por eliminação do objetivo "' || goal_record.nome || '"',
      objetivos_account_id, 
      ajuste_category_id, 
      user_id_param, 
      goal_record.family_id,
      goal_id_param,
      CURRENT_DATE
    );
    
    -- REMOVIDO: Atualizações diretas do saldo das contas
    -- O saldo será calculado automaticamente pelas views baseado nas transações
    
  ELSIF goal_progress >= 100 THEN
    -- Objetivo >= 100%: Valor mantém-se na conta Objetivos mas deixa de estar reservado
    -- Criar apenas uma transação informativa na conta Objetivos
    INSERT INTO transactions (
      tipo, valor, descricao, account_id, categoria_id, user_id, family_id, goal_id, data
    ) VALUES (
      'receita', 
      0, 
      'Objetivo "' || goal_record.nome || '" atingido e eliminado - valor mantido na conta Objetivos',
      objetivos_account_id, 
      ajuste_category_id, 
      user_id_param, 
      goal_record.family_id,
      goal_id_param,
      CURRENT_DATE
    );
  END IF;
  
  -- 7. Eliminar todas as alocações do objetivo
  DELETE FROM goal_allocations WHERE goal_id = goal_id_param;
  
  -- 8. Eliminar o objetivo
  DELETE FROM goals WHERE id = goal_id_param AND user_id = user_id_param;
  
  -- 9. Retornar resultado
  result := json_build_object(
    'success', true,
    'goal_name', goal_record.nome,
    'total_allocated', total_allocated,
    'goal_progress', goal_progress,
    'restored_to_account', goal_progress < 100,
    'account_id', account_id,
    'objetivos_account_id', objetivos_account_id
  );
  
  RETURN result;
  
EXCEPTION
  WHEN OTHERS THEN 
    RAISE EXCEPTION 'Erro ao eliminar objetivo: %', SQLERRM;
END;
$function$;

-- Comentário explicativo
COMMENT ON FUNCTION public.delete_goal_with_restoration(uuid, uuid) IS 'Elimina objetivo e restaura fundos via transações (sem duplicação de saldo)';