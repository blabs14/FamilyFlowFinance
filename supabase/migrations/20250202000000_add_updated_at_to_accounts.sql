-- Adicionar coluna updated_at à tabela accounts
-- Esta coluna é necessária para a função ensure_goals_account

-- Adicionar a coluna updated_at se não existir
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Atualizar registos existentes para ter o valor de created_at como updated_at inicial
UPDATE public.accounts 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Tornar a coluna NOT NULL após ter valores
ALTER TABLE public.accounts 
ALTER COLUMN updated_at SET NOT NULL;

-- Adicionar trigger para atualizar automaticamente updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Comentário
COMMENT ON COLUMN public.accounts.updated_at IS 'Timestamp da última atualização do registo';
COMMENT ON TRIGGER update_accounts_updated_at ON public.accounts IS 'Atualiza automaticamente updated_at quando o registo é modificado';