-- Corrigir a função delete_goal_with_restoration para implementar a lógica correta
CREATE OR REPLACE FUNCTION public.delete_goal_with_restoration(goal_id_param uuid, user_id_param uuid)
RETURNS json
LANGUAGE plpgsql
AS $function$
DECLARE
  goal_record record;
  allocation_record record;
  total_allocated numeric := 0;
  goal_progress numeric := 0;
  account_id uuid;
  objetivos_account_id uuid;
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
  
  -- 5. Ajustar saldos baseado no progresso
  IF goal_progress < 100 AND account_id IS NOT NULL THEN
    -- Objetivo < 100%: Valor volta para conta de origem
    -- Restaurar o valor na conta origem
    UPDATE accounts 
    SET saldo = saldo + total_allocated
    WHERE id = account_id;
    
    -- Deduzir da conta objetivos
    UPDATE accounts 
    SET saldo = saldo - total_allocated
    WHERE id = objetivos_account_id;
    
  ELSIF goal_progress >= 100 THEN
    -- Objetivo >= 100%: Valor mantém-se na conta Objetivos mas deixa de estar reservado
    -- Não fazer alterações nos saldos - o valor fica disponível na conta Objetivos
    -- A view account_reserved já não contará este valor como reservado
  END IF;
  
  -- 6. Eliminar todas as alocações do objetivo
  DELETE FROM goal_allocations WHERE goal_id = goal_id_param;
  
  -- 7. Eliminar o objetivo
  DELETE FROM goals WHERE id = goal_id_param AND user_id = user_id_param;
  
  -- 8. Retornar resultado
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

-- Função para marcar um objetivo como atingido (quando progresso >= 100%)
CREATE OR REPLACE FUNCTION handle_goal_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_allocated numeric := 0;
  v_goal_progress numeric := 0;
  v_objetivos_account_id uuid;
BEGIN
  -- Calcular progresso atual do objetivo
  SELECT COALESCE(SUM(valor), 0) INTO v_total_allocated
  FROM goal_allocations 
  WHERE goal_id = NEW.goal_id;
  
  -- Calcular percentagem de progresso
  SELECT valor_objetivo INTO v_goal_progress
  FROM goals 
  WHERE id = NEW.goal_id;
  
  IF v_goal_progress > 0 THEN
    v_goal_progress := (v_total_allocated / v_goal_progress) * 100;
  END IF;
  
  -- Se o objetivo foi atingido (>= 100%), garantir que a conta Objetivos existe
  IF v_goal_progress >= 100 THEN
    SELECT user_id, family_id INTO v_objetivos_account_id, v_objetivos_account_id
    FROM goals 
    WHERE id = NEW.goal_id;
    
    -- Garantir que a conta Objetivos existe
    PERFORM ensure_goals_account(
      (SELECT user_id FROM goals WHERE id = NEW.goal_id),
      (SELECT family_id FROM goals WHERE id = NEW.goal_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para quando uma alocação é criada/atualizada
DROP TRIGGER IF EXISTS on_goal_allocation_changed ON goal_allocations;
CREATE TRIGGER on_goal_allocation_changed
  AFTER INSERT OR UPDATE ON goal_allocations
  FOR EACH ROW
  EXECUTE FUNCTION handle_goal_completion();

-- Comentários
COMMENT ON FUNCTION handle_goal_completion() IS 'Trigger que verifica se um objetivo foi atingido e garante que a conta Objetivos existe';