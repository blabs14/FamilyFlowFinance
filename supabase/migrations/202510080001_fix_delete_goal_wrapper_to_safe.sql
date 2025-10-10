-- Migração: Ajustar wrapper delete_goal_with_restoration para usar lógica segura sem debitar contas de origem
-- Data: 2025-10-08
-- Contexto: Na eliminação de objetivos a 100%, foi observado débito duplicado nas contas de origem.
-- Causa provável: Wrapper delete_goal_with_restoration apontava para fn_goal_delete_with_correct_logic,
--                 que inclui criação de despesa na conta de origem no ramo de 100%.
-- Correção: Fazer o wrapper chamar fn_goal_delete_safe, que por sua vez desaloca via fn_goal_deallocate
--           sem movimentar as contas de origem (apenas liberta reservas na conta "Objetivos").

-- Garantir que a função segura existe (não recriamos aqui, apenas usamos)
-- CREATE OR REPLACE FUNCTION public.fn_goal_delete_safe(...)
--   -- definida em migração anterior 20250202000013

CREATE OR REPLACE FUNCTION public.delete_goal_with_restoration(
  goal_id_param uuid,
  user_id_param uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Chamar a função segura que não debita contas de origem no caso de 100%
  RETURN public.fn_goal_delete_safe(goal_id_param, user_id_param, NULL, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_goal_with_restoration(uuid, uuid) TO authenticated;
COMMENT ON FUNCTION public.delete_goal_with_restoration(uuid, uuid) IS 'Wrapper para eliminação de objetivos que usa fn_goal_delete_safe (sem débito em contas de origem no caso 100%)';