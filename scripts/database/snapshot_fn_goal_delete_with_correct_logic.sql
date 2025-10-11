-- Snapshot rápido da função atual fn_goal_delete_with_correct_logic
-- Nota: este script reaplica a função conforme ela existe no momento na BD.
-- Para rollback exato para a versão "boa" conhecida, usa a migração:
-- supabase/migrations/202510100001_fix_goal_delete_restore_origins.sql

BEGIN;
DO $$
DECLARE
  v_def TEXT;
BEGIN
  -- Obtém o texto completo da função atual
  SELECT pg_get_functiondef('public.fn_goal_delete_with_correct_logic'::regproc) INTO v_def;

  -- Reaplica a função (CREATE OR REPLACE) com segurança
  EXECUTE v_def;
END;
$$;
COMMIT;