-- Correção: Eliminar função duplicada delete_goal_with_restoration
-- 
-- PROBLEMA IDENTIFICADO:
-- Existiam duas versões da função delete_goal_with_restoration:
-- 1. delete_goal_with_restoration(goal_id_param uuid) - VERSÃO INCORRETA
-- 2. delete_goal_with_restoration(goal_id_param uuid, user_id_param uuid) - VERSÃO CORRETA
--
-- Quando o frontend chamava a função com 2 parâmetros, ambas as versões
-- podiam ser executadas, causando duplicação de valores devolvidos às contas.
--
-- SOLUÇÃO:
-- Eliminar a versão com apenas 1 parâmetro, mantendo apenas a versão correta.

-- Eliminar a versão incorreta da função (com 1 parâmetro)
DROP FUNCTION IF EXISTS public.delete_goal_with_restoration(uuid);

-- Verificar que só existe a versão correta
-- A função correta deve ter a assinatura:
-- delete_goal_with_restoration(goal_id_param uuid, user_id_param uuid)