-- supabase/migrations/20260422110000_unit06_transfer_trigger.sql
-- Unit 6 Task 2: trigger que materializa 2 rows em transactions para cada transfer

set local search_path = public;

-- ---------------------------------------------------------------
-- Tornar categoria_id nullable em transactions
-- (rows materializadas por transferências não têm categoria)
-- ---------------------------------------------------------------
ALTER TABLE public.transactions
  ALTER COLUMN categoria_id DROP NOT NULL;

-- ---------------------------------------------------------------
-- Adicionar coluna transfer_id a transactions (se não existir)
-- Permite ligar as rows materializadas à sua transfer origem
-- ---------------------------------------------------------------
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transfer_id uuid REFERENCES public.transfers(id) ON DELETE CASCADE;

-- Adicionar coluna created_by a transactions (se não existir)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Remover coluna transfer_group_id (substituída por transfer_id — 0 rows em produção)
ALTER TABLE public.transactions
  DROP COLUMN IF EXISTS transfer_group_id;

-- Índice para lookup por transfer_id
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_id
  ON public.transactions(transfer_id)
  WHERE transfer_id IS NOT NULL;

-- ---------------------------------------------------------------
-- Função principal do trigger
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_transfer_transactions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_description text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Apagar as 2 rows materializadas ligadas a este transfer
    DELETE FROM public.transactions
    WHERE transfer_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Para UPDATE: apagar as rows antigas e recriar
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.transactions
    WHERE transfer_id = NEW.id;
  END IF;

  -- INSERT ou UPDATE (recria)
  v_description := COALESCE(
    NEW.description,
    'Transferência ' || to_char(NEW.date, 'DD/MM/YYYY')
  );

  -- Row 1: Débito na conta/cartão de origem
  INSERT INTO public.transactions (
    user_id,
    family_id,
    account_id,
    credit_card_id,
    amount_cents,
    currency,
    tipo,
    data,
    descricao,
    operation_id,
    transfer_id,
    event_time,
    created_by
  ) VALUES (
    NEW.user_id,
    NEW.family_id,
    NEW.from_account_id,
    NEW.from_credit_card_id,
    NEW.amount_cents,
    NEW.currency,
    'despesa',
    NEW.date,
    v_description,
    NEW.operation_id,
    NEW.id,
    NEW.event_time,
    NEW.user_id
  );

  -- Row 2: Crédito na conta/cartão de destino
  INSERT INTO public.transactions (
    user_id,
    family_id,
    account_id,
    credit_card_id,
    amount_cents,
    currency,
    tipo,
    data,
    descricao,
    operation_id,
    transfer_id,
    event_time,
    created_by
  ) VALUES (
    NEW.user_id,
    NEW.family_id,
    NEW.to_account_id,
    NEW.to_credit_card_id,
    NEW.amount_cents,
    NEW.currency,
    'receita',
    NEW.date,
    v_description,
    NEW.operation_id,
    NEW.id,
    NEW.event_time,
    NEW.user_id
  );

  RETURN NEW;
END;$$;

-- ---------------------------------------------------------------
-- Trigger: dispara AFTER INSERT OR UPDATE OR DELETE em transfers
-- ---------------------------------------------------------------
CREATE TRIGGER trigger_transfer_materialize
  AFTER INSERT OR UPDATE OR DELETE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.create_transfer_transactions();
