-- Migração: tornar idempotent_ops único por (user_id, operation_type, key)
-- Data: 2025-10-09
-- Objetivo: reduzir colisões e permitir reuso seguro de chaves por utilizador/operacao

BEGIN;

-- Remover PK anterior baseada apenas em key, se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'idempotent_ops' AND c.conname = 'idempotent_ops_pkey'
  ) THEN
    ALTER TABLE public.idempotent_ops DROP CONSTRAINT idempotent_ops_pkey;
  END IF;
END;
$$;

-- Adicionar coluna id se necessário para manter referência exclusiva opcional
ALTER TABLE public.idempotent_ops
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Definir chave única composta
ALTER TABLE public.idempotent_ops
  ADD CONSTRAINT idempotent_ops_unique_composite UNIQUE (user_id, operation_type, key);

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_idempotent_ops_user_type_key ON public.idempotent_ops(user_id, operation_type, key);

COMMIT;