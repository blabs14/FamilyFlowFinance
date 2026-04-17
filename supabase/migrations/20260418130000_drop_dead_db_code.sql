-- Remove tabela idempotent_operations (só tinha 2 rows de teste de Set/2025,
-- nenhum código de produção a usa) e funções de dashboard versões mortas.

DROP TABLE IF EXISTS public.idempotent_operations CASCADE;

DROP FUNCTION IF EXISTS public.get_dashboard_data_v2(user_id_param uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_data_v3(user_id_param uuid) CASCADE;
