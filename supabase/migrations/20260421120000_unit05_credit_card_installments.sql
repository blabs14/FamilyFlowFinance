-- supabase/migrations/20260421120000_unit05_credit_card_installments.sql
-- Unit 5 / Task 3: tabelas auxiliares para parcelamentos e extratos de cartão
-- Lógica de cron/juros implementada em Unit 9 — estas tabelas são o schema preparado.

set local search_path = public;

BEGIN;

-- Parcelamentos: quando uma transação de cartão é parcelada
CREATE TABLE public.credit_card_installments (
  id                   uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_card_id       uuid      NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  -- transaction_id aponta para a transação original (credit_card_id preenchido)
  transaction_id       uuid      REFERENCES public.transactions(id) ON DELETE SET NULL,
  -- Valor total da compra em cêntimos
  total_cents          bigint    NOT NULL CHECK (total_cents > 0),
  -- Número de parcelas
  num_installments     smallint  NOT NULL CHECK (num_installments BETWEEN 2 AND 72),
  -- Parcela atual (começa em 1)
  current_installment  smallint  NOT NULL DEFAULT 1 CHECK (current_installment >= 1),
  -- Valor mensal de cada parcela em cêntimos (arredondado; última parcela absorve diferença)
  monthly_cents        bigint    NOT NULL CHECK (monthly_cents > 0),
  -- Data de início do parcelamento (primeiro mês)
  started_at           date      NOT NULL DEFAULT current_date,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cc_installments_card ON public.credit_card_installments(credit_card_id);
CREATE INDEX idx_cc_installments_tx   ON public.credit_card_installments(transaction_id);

ALTER TABLE public.credit_card_installments ENABLE ROW LEVEL SECURITY;

-- SELECT: quem tem acesso ao cartão tem acesso às suas parcelas
CREATE POLICY sel_cc_installments ON public.credit_card_installments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.credit_cards cc
      WHERE cc.id = credit_card_installments.credit_card_id
        AND cc.deleted_at IS NULL
        AND (
          cc.user_id = auth.uid()
          OR (
            cc.family_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.family_members fm
              WHERE fm.family_id = cc.family_id AND fm.user_id = auth.uid()
            )
          )
        )
    )
  );

-- INSERT/UPDATE/DELETE: apenas o dono do cartão via RPC (simplificado: user_id join)
CREATE POLICY ins_cc_installments ON public.credit_card_installments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.credit_cards cc
      WHERE cc.id = credit_card_installments.credit_card_id
        AND cc.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_card_installments TO authenticated;

-- Extratos mensais de cartão (gerados no closing_day — lógica em Unit 9)
CREATE TABLE public.credit_card_statements (
  id                uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_card_id    uuid      NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  -- statement_group para cartões consolidados (family-card na mesma fatura)
  parent_statement_id uuid    REFERENCES public.credit_card_statements(id) ON DELETE SET NULL,
  -- Data de fecho do extrato
  closing_date      date      NOT NULL,
  -- Data limite de pagamento
  due_date          date      NOT NULL,
  -- Total do extrato em cêntimos (soma das transações do ciclo)
  total_cents       bigint    NOT NULL DEFAULT 0,
  -- Total pago em cêntimos
  paid_cents        bigint    NOT NULL DEFAULT 0,
  -- Status: open | closed | paid | overdue
  status            text      NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','closed','paid','overdue')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (credit_card_id, closing_date)
);

CREATE INDEX idx_cc_statements_card   ON public.credit_card_statements(credit_card_id);
CREATE INDEX idx_cc_statements_status ON public.credit_card_statements(status);

CREATE TRIGGER trg_cc_statements_updated_at
  BEFORE UPDATE ON public.credit_card_statements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.credit_card_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY sel_cc_statements ON public.credit_card_statements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.credit_cards cc
      WHERE cc.id = credit_card_statements.credit_card_id
        AND cc.deleted_at IS NULL
        AND (
          cc.user_id = auth.uid()
          OR (
            cc.family_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.family_members fm
              WHERE fm.family_id = cc.family_id AND fm.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY ins_cc_statements ON public.credit_card_statements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.credit_cards cc
      WHERE cc.id = credit_card_statements.credit_card_id
        AND cc.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.credit_card_statements TO authenticated;

COMMIT;
