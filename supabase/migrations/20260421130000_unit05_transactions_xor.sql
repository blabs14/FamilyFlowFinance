-- supabase/migrations/20260421130000_unit05_transactions_xor.sql
-- Unit 5 / Task 4:
--   1. Adicionar credit_card_id a transactions
--   2. Criar CHECK XOR (account_id IS NULL) <> (credit_card_id IS NULL)
--   3. Migrar linhas onde account_id aponta para conta tipo='cartão de crédito'
--      → mover cartões para credit_cards, atualizar transactions.credit_card_id
--   4. Remover billing_cycle_day de accounts (já migrado para credit_cards.closing_day)

set local search_path = public;

BEGIN;

-- 1. Adicionar FK credit_card_id em transactions (nullable)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS credit_card_id uuid REFERENCES public.credit_cards(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_transactions_credit_card_id
  ON public.transactions(credit_card_id)
  WHERE credit_card_id IS NOT NULL;

-- 2. Migrar contas tipo='cartão de crédito' para tabela credit_cards
-- Inserir uma linha em credit_cards por cada conta legacy de cartão
INSERT INTO public.credit_cards (
  id,            -- reusar o mesmo id para facilitar migração de FKs
  user_id,
  family_id,
  nome,
  credit_limit_cents,
  current_balance_cents,
  closing_day,
  currency,
  order_index,
  created_at,
  updated_at
)
SELECT
  a.id,
  a.user_id,
  a.family_id,
  a.nome,
  0,             -- credit_limit_cents: desconhecido (legacy hardcoded 0)
  0,             -- current_balance_cents: recalculado abaixo
  CASE
    WHEN a.billing_cycle_day IS NOT NULL
    THEN a.billing_cycle_day::smallint
    ELSE NULL
  END,
  COALESCE(a.currency, 'EUR'),
  a.order_index,
  COALESCE(a.created_at::timestamptz, now()),
  COALESCE(a.updated_at::timestamptz, now())
FROM public.accounts a
WHERE a.tipo = 'cartão de crédito'
  AND a.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Atualizar current_balance_cents dos cartões migrados com base nas transações
UPDATE public.credit_cards cc
SET current_balance_cents = COALESCE((
  SELECT SUM(
    CASE
      WHEN t.tipo = 'despesa' THEN t.amount_cents
      WHEN t.tipo = 'receita' THEN -t.amount_cents
      ELSE 0
    END
  )
  FROM public.transactions t
  WHERE t.account_id = cc.id
), 0)
WHERE EXISTS (
  SELECT 1 FROM public.accounts a
  WHERE a.id = cc.id AND a.tipo = 'cartão de crédito'
);

-- 4. Atualizar transactions: para linhas onde account_id = cartão, mover para credit_card_id
UPDATE public.transactions t
SET
  credit_card_id = t.account_id,
  account_id     = NULL
FROM public.accounts a
WHERE a.id = t.account_id
  AND a.tipo = 'cartão de crédito';

-- 5. Agora que as transações foram migradas, verificar que todas as linhas têm exatamente um preenchido
-- (account_id IS NULL) <> (credit_card_id IS NULL) ≡ exatamente um não-nulo
-- Antes de adicionar a constraint, verificar que não há violações:
DO $$
DECLARE
  v_violations int;
BEGIN
  SELECT COUNT(*) INTO v_violations
  FROM public.transactions
  WHERE NOT ((account_id IS NULL) <> (credit_card_id IS NULL));

  IF v_violations > 0 THEN
    RAISE EXCEPTION 'Existem % linhas em transactions que violam o CHECK XOR (account_id, credit_card_id). Investigar antes de aplicar constraint.', v_violations;
  END IF;
END $$;

-- 6. Adicionar CHECK constraint XOR
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_transactions_instrument_xor
  CHECK ((account_id IS NULL) <> (credit_card_id IS NULL));

-- 7. Soft-delete das contas legacy de cartão em accounts
-- (não hard-delete para preservar histórico e possível rollback)
UPDATE public.accounts
SET deleted_at = now()
WHERE tipo = 'cartão de crédito'
  AND deleted_at IS NULL;

-- 8. Remover billing_cycle_day de accounts (dados já em credit_cards.closing_day)
ALTER TABLE public.accounts
  DROP COLUMN IF EXISTS billing_cycle_day;

COMMIT;
