-- Migração: Ajustar trigger enforce_goal_income_has_goal_id para evitar erro em ON DELETE SET NULL
-- Data: 2025-10-08
-- Objetivo: 
--  - Usar accounts.is_goals = true em vez de nome ILIKE
--  - Aplicar apenas em BEFORE INSERT (remover UPDATE) para não bloquear FKs que fazem SET NULL ao eliminar objetivos

BEGIN;

-- Recriar função com verificação via is_goals
CREATE OR REPLACE FUNCTION public.enforce_goal_income_has_goal_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Apenas aplicar a receitas
  IF NEW.tipo = 'receita' THEN
    -- Verificar se a conta é de Objetivos através do flag is_goals
    IF EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = NEW.account_id
        AND a.is_goals = true
    ) THEN
      IF NEW.goal_id IS NULL THEN
        RAISE EXCEPTION 'Receita em conta de Objetivos requer goal_id (transaction %, account_id %)', NEW.id, NEW.account_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Recriar trigger apenas para INSERT
DROP TRIGGER IF EXISTS trg_enforce_goal_income_has_goal_id ON public.transactions;
CREATE TRIGGER trg_enforce_goal_income_has_goal_id
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE PROCEDURE public.enforce_goal_income_has_goal_id();

COMMIT;