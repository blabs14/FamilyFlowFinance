-- Adicionar campos para agrupamento de transações e idempotência
-- Estes campos permitirão rastrear transações relacionadas e evitar duplicações

-- 1. Adicionar campos à tabela transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS transfer_group_id uuid,
ADD COLUMN IF NOT EXISTS reversal_of uuid;

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group_id 
ON public.transactions(transfer_group_id) 
WHERE transfer_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_reversal_of 
ON public.transactions(reversal_of) 
WHERE reversal_of IS NOT NULL;

-- 3. Criar tabela para operações idempotentes
CREATE TABLE IF NOT EXISTS public.idempotent_ops (
  key text PRIMARY KEY,
  created_at timestamp with time zone DEFAULT NOW(),
  user_id uuid REFERENCES auth.users(id),
  operation_type text NOT NULL,
  operation_data jsonb,
  result jsonb
);

-- 4. Criar índice para limpeza automática de operações antigas
CREATE INDEX IF NOT EXISTS idx_idempotent_ops_created_at 
ON public.idempotent_ops(created_at);

-- 5. Adicionar comentários explicativos
COMMENT ON COLUMN public.transactions.transfer_group_id IS 'UUID que agrupa transações relacionadas (ex: dupla-entrada)';
COMMENT ON COLUMN public.transactions.reversal_of IS 'UUID da transação que esta transação está a reverter/anular';
COMMENT ON TABLE public.idempotent_ops IS 'Tabela para garantir idempotência de operações críticas';

-- 6. RLS para idempotent_ops
ALTER TABLE public.idempotent_ops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own idempotent operations" 
ON public.idempotent_ops 
FOR ALL 
USING (auth.uid() = user_id);

-- 7. Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.idempotent_ops TO authenticated;