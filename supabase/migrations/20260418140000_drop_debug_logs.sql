-- Tabela debug_logs estava vazia (0 rows) e sem referências no código.
-- Nunca chegou a ser usada em produção.
DROP TABLE IF EXISTS public.debug_logs CASCADE;
