-- supabase/migrations/20260421110000_unit05_credit_cards.sql
-- Unit 5 / Task 2: criar tabela credit_cards com RLS completa (personal + family)

set local search_path = public;

BEGIN;

CREATE TABLE public.credit_cards (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id             uuid        REFERENCES public.families(id) ON DELETE SET NULL,
  nome                  text        NOT NULL,
  -- Limite de crédito em cêntimos (ex: 5000 EUR = 500000)
  credit_limit_cents    bigint      NOT NULL DEFAULT 0 CHECK (credit_limit_cents >= 0),
  -- Saldo utilizado em cêntimos (calculado via RPCs; coluna denormalizada para performance)
  current_balance_cents bigint      NOT NULL DEFAULT 0,
  -- Dia de fecho do extrato (1-28)
  closing_day           smallint    CHECK (closing_day BETWEEN 1 AND 28),
  -- Dia de pagamento do extrato (1-28, após o fecho)
  payment_day           smallint    CHECK (payment_day BETWEEN 1 AND 28),
  -- APR: taxa de juro anual, ex: 0.1999 = 19.99%
  apr                   numeric(6,4) DEFAULT 0 CHECK (apr >= 0),
  -- Anuidade em cêntimos
  annual_fee_cents      bigint      NOT NULL DEFAULT 0 CHECK (annual_fee_cents >= 0),
  -- Moeda (ISO 4217)
  currency              text        NOT NULL DEFAULT 'EUR',
  -- Ordem de apresentação dentro do scope do user
  order_index           int,
  -- Soft-delete
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_credit_cards_user_id    ON public.credit_cards(user_id);
CREATE INDEX idx_credit_cards_family_id  ON public.credit_cards(family_id) WHERE family_id IS NOT NULL;
CREATE INDEX idx_credit_cards_deleted_at ON public.credit_cards(deleted_at) WHERE deleted_at IS NULL;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_credit_cards_updated_at
  BEFORE UPDATE ON public.credit_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

-- SELECT: personal scope + family scope; exclui soft-deleted
CREATE POLICY sel_credit_cards ON public.credit_cards
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()
      OR (
        family_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.family_members fm
          WHERE fm.family_id = credit_cards.family_id
            AND fm.user_id = auth.uid()
        )
      )
    )
  );

-- INSERT: apenas o próprio user
CREATE POLICY ins_credit_cards ON public.credit_cards
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: apenas o dono
CREATE POLICY upd_credit_cards ON public.credit_cards
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: apenas o dono (hard-delete de emergência; soft-delete via RPC)
CREATE POLICY del_credit_cards ON public.credit_cards
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_cards TO authenticated;

COMMIT;
