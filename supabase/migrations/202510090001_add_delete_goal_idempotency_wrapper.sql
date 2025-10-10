-- Migração: Adicionar wrapper idempotente para eliminação de objetivos
-- Data: 2025-10-09
-- Objetivo: Permitir passagem de idempotency_key ao wrapper delete_goal_with_restoration,
--           encaminhando para a função corrigida fn_goal_delete_with_correct_logic.

BEGIN;

-- Criar variante com 3 parâmetros (mantém compatibilidade com versão de 2 parâmetros existente)
CREATE OR REPLACE FUNCTION public.delete_goal_with_restoration(
  goal_id_param uuid,
  user_id_param uuid,
  idempotency_key text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.fn_goal_delete_with_correct_logic(goal_id_param, user_id_param, NULL, idempotency_key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_goal_with_restoration(uuid, uuid, text) TO authenticated;
COMMENT ON FUNCTION public.delete_goal_with_restoration(uuid, uuid, text) IS 'Wrapper idempotente: chama fn_goal_delete_with_correct_logic com idempotency_key.';

COMMIT;