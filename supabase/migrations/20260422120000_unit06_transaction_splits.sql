-- supabase/migrations/20260422120000_unit06_transaction_splits.sql
-- Unit 6 Task 3: transaction_splits — repartição de uma transação por múltiplas categorias

set local search_path = public;

CREATE TABLE public.transaction_splits (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid    NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  categoria_id   uuid    NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  amount_cents   bigint  NOT NULL CHECK (amount_cents > 0),
  description    text,
  order_index    smallint NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_tx_splits_transaction ON public.transaction_splits(transaction_id);
CREATE INDEX idx_tx_splits_categoria   ON public.transaction_splits(categoria_id);

-- Trigger: validar que SUM(splits.amount_cents) = transactions.amount_cents
-- Deferrable para permitir insert atómico de múltiplos splits
CREATE OR REPLACE FUNCTION public.validate_transaction_splits_sum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx_amount  bigint;
  v_split_sum  bigint;
BEGIN
  SELECT amount_cents INTO v_tx_amount
  FROM public.transactions
  WHERE id = NEW.transaction_id;

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_split_sum
  FROM public.transaction_splits
  WHERE transaction_id = NEW.transaction_id;

  IF v_split_sum > v_tx_amount THEN
    RAISE EXCEPTION
      'Soma dos splits (%) excede o valor da transação (%)',
      v_split_sum, v_tx_amount;
  END IF;

  RETURN NEW;
END;$$;

CREATE CONSTRAINT TRIGGER trg_validate_splits_sum
  AFTER INSERT OR UPDATE ON public.transaction_splits
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.validate_transaction_splits_sum();

-- RLS
ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

-- Leitura: ver splits se puder ver a transação
CREATE POLICY sel_tx_splits ON public.transaction_splits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_splits.transaction_id
        AND (
          t.user_id = auth.uid()
          OR (
            t.family_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.family_members fm
              WHERE fm.family_id = t.family_id
                AND fm.user_id = auth.uid()
                
            )
          )
        )
    )
  );

-- Insert/Update/Delete: apenas owner da transação
CREATE POLICY ins_tx_splits ON public.transaction_splits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_splits.transaction_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY upd_tx_splits ON public.transaction_splits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_splits.transaction_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY del_tx_splits ON public.transaction_splits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_splits.transaction_id
        AND t.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_splits TO authenticated;
