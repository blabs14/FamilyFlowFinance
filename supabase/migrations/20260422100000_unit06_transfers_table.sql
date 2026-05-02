-- supabase/migrations/20260422100000_unit06_transfers_table.sql
-- Unit 6 Task 1: criar tabela transfers (fonte de verdade para transferências entre contas/cartões)

set local search_path = public;

CREATE TABLE public.transfers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id           uuid        REFERENCES public.families(id) ON DELETE SET NULL,
  -- Origem: conta bancária XOR cartão de crédito
  from_account_id     uuid        REFERENCES public.accounts(id) ON DELETE RESTRICT,
  from_credit_card_id uuid        REFERENCES public.credit_cards(id) ON DELETE RESTRICT,
  -- Destino: conta bancária XOR cartão de crédito
  to_account_id       uuid        REFERENCES public.accounts(id) ON DELETE RESTRICT,
  to_credit_card_id   uuid        REFERENCES public.credit_cards(id) ON DELETE RESTRICT,
  amount_cents        bigint      NOT NULL CHECK (amount_cents > 0),
  currency            text        NOT NULL DEFAULT 'EUR',
  date                date        NOT NULL CHECK (date <= current_date),
  description         text,
  operation_id        uuid        NOT NULL DEFAULT gen_random_uuid(),
  event_time          timestamptz NOT NULL DEFAULT now(),
  reversal_of         uuid        REFERENCES public.transfers(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Garantir que origem tem exatamente uma fonte preenchida
  CONSTRAINT chk_transfers_from_xor CHECK (
    (from_account_id IS NOT NULL)::int + (from_credit_card_id IS NOT NULL)::int = 1
  ),
  -- Garantir que destino tem exatamente uma fonte preenchida
  CONSTRAINT chk_transfers_to_xor CHECK (
    (to_account_id IS NOT NULL)::int + (to_credit_card_id IS NOT NULL)::int = 1
  ),
  -- Não permitir transferência para a mesma conta/cartão
  CONSTRAINT chk_transfers_not_self CHECK (
    NOT (from_account_id IS NOT NULL AND from_account_id = to_account_id)
    AND NOT (from_credit_card_id IS NOT NULL AND from_credit_card_id = to_credit_card_id)
  )
);

-- Índices
CREATE INDEX idx_transfers_user_id      ON public.transfers(user_id);
CREATE INDEX idx_transfers_family_id    ON public.transfers(family_id) WHERE family_id IS NOT NULL;
CREATE INDEX idx_transfers_from_account ON public.transfers(from_account_id) WHERE from_account_id IS NOT NULL;
CREATE INDEX idx_transfers_to_account   ON public.transfers(to_account_id) WHERE to_account_id IS NOT NULL;
CREATE INDEX idx_transfers_date         ON public.transfers(date DESC);
CREATE INDEX idx_transfers_operation_id ON public.transfers(operation_id);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_transfers_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_transfers_updated_at
  BEFORE UPDATE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_transfers_updated_at();

-- RLS
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- Leitura: próprio user ou membro da família
CREATE POLICY sel_transfers ON public.transfers
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      family_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.family_members fm
        WHERE fm.family_id = transfers.family_id
          AND fm.user_id = auth.uid()
      )
    )
  );

-- Insert: apenas o próprio user
CREATE POLICY ins_transfers ON public.transfers
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Update: apenas o próprio user
CREATE POLICY upd_transfers ON public.transfers
  FOR UPDATE USING (user_id = auth.uid());

-- Delete: apenas o próprio user
CREATE POLICY del_transfers ON public.transfers
  FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transfers TO authenticated;
