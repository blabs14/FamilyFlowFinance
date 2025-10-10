-- Migração: Restaurar fluxo anterior e corrigir apenas o erro na eliminação a 100%
-- Data: 2025-10-08
-- Objetivo: Voltar a usar fn_goal_delete_with_correct_logic como no procedimento anterior,
-- corrigindo exclusivamente o ramo de 100% (não debitar contas de origem; apenas libertar reservas na conta Objetivos).

BEGIN;

-- Recriar função com correção no ramo 100%
DROP FUNCTION IF EXISTS public.fn_goal_delete_with_correct_logic;
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
  -- 1. Idempotência (se existir registo anterior para a mesma key)
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

  -- 2. Obter objetivo
  SELECT * INTO goal_record
  FROM goals 
  WHERE id = goal_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Objetivo não encontrado';
  END IF;

  -- 3. Total alocado e progresso
  SELECT COALESCE(SUM(valor), 0) INTO v_total_allocated
  FROM goal_allocations 
  WHERE goal_id = goal_id_param;

  IF goal_record.valor_objetivo IS NULL OR goal_record.valor_objetivo = 0 THEN
    v_goal_progress := 0;
  ELSE
    v_goal_progress := ROUND(100 * v_total_allocated / goal_record.valor_objetivo);
  END IF;

  -- 4. Garantir conta Objetivos
  v_objetivos_account_id := ensure_goals_account(user_id_param, goal_record.family_id);
  IF v_objetivos_account_id IS NULL THEN
    RAISE EXCEPTION 'Conta Objetivos não encontrada para o utilizador';
  END IF;

  -- 5. Categoria "Objetivos"
  SELECT id INTO v_categoria_id
  FROM categories 
  WHERE nome = 'Objetivos' AND user_id = user_id_param
  LIMIT 1;
  IF v_categoria_id IS NULL THEN
    INSERT INTO categories (nome, user_id, family_id)
    VALUES ('Objetivos', user_id_param, goal_record.family_id)
    RETURNING id INTO v_categoria_id;
  END IF;

  -- 6. Determinar conta destino caso <100% (compatibilidade)
  IF destination_account_id_param IS NOT NULL THEN
    v_destination_account_id := destination_account_id_param;
  ELSE
    SELECT DISTINCT account_id INTO v_destination_account_id
    FROM goal_allocations WHERE goal_id = goal_id_param LIMIT 1;
  END IF;

  -- 7. Lógica principal
  IF v_goal_progress < 100 THEN
    -- Caso <100%: manter comportamento anterior
    -- Remover alocações (liberta reservado na conta Objetivos)
    DELETE FROM goal_allocations WHERE goal_id = goal_id_param;
    
    -- Criar despesa na conta Objetivos pelo total alocado
    INSERT INTO transactions (
      account_id, categoria_id, valor, tipo, data, descricao, goal_id, user_id, family_id
    ) VALUES (
      v_objetivos_account_id, v_categoria_id, v_total_allocated, 'despesa', NOW()::date,
      'Remoção de objetivo (<100%)', goal_id_param, user_id_param, goal_record.family_id
    );
  ELSE
    -- Caso =100%: CORREÇÃO — não debitar contas de origem; apenas libertar reserva
    DELETE FROM goal_allocations WHERE goal_id = goal_id_param;
    -- Não criar transações adicionais: o valor já está na conta Objetivos, apenas muda de reservado para disponível
  END IF;

  -- 8. Eliminar objetivo
  DELETE FROM goals WHERE id = goal_id_param;

  -- 9. Resultado
  v_final_result := json_build_object(
    'success', true,
    'goal_deleted', true,
    'total_allocated', v_total_allocated,
    'goal_progress', v_goal_progress,
    'message', CASE 
      WHEN v_total_allocated = 0 THEN 'Objetivo eliminado sem alocações'
      WHEN v_goal_progress < 100 THEN 'Objetivo eliminado: reservas removidas na conta Objetivos'
      ELSE 'Objetivo atingido eliminado: reservas libertadas (sem movimentar contas de origem)'
    END
  );

  -- 10. Idempotência
  IF idempotency_key IS NOT NULL THEN
    INSERT INTO idempotent_ops (key, user_id, operation_type, operation_data, result)
    VALUES (
      idempotency_key, user_id_param, 'goal_delete_correct',
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

GRANT EXECUTE ON FUNCTION public.fn_goal_delete_with_correct_logic TO authenticated;
COMMENT ON FUNCTION public.fn_goal_delete_with_correct_logic IS 'Elimina objetivo: <100% mantém comportamento anterior; =100% corrige duplicação (não debita contas de origem; só liberta reservas).';

-- Repor wrapper para usar a função de lógica correta
CREATE OR REPLACE FUNCTION public.delete_goal_with_restoration(
  goal_id_param uuid,
  user_id_param uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.fn_goal_delete_with_correct_logic(goal_id_param, user_id_param, NULL, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_goal_with_restoration(uuid, uuid) TO authenticated;
COMMENT ON FUNCTION public.delete_goal_with_restoration(uuid, uuid) IS 'Wrapper compatível que chama fn_goal_delete_with_correct_logic (corrigida para =100%).';

COMMIT;