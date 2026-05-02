-- supabase/migrations/20260422150000_unit06_transactions_operation_id_reversal.sql
-- Unit 6 Task 6: operation_id NOT NULL com DEFAULT, reversal_of FK, CHECK data <= current_date

set local search_path = public;

BEGIN;

-- 1. Popular operation_id onde NULL (registos históricos)
UPDATE public.transactions
SET operation_id = gen_random_uuid()
WHERE operation_id IS NULL;

-- 2. Tornar operation_id NOT NULL com DEFAULT
ALTER TABLE public.transactions
  ALTER COLUMN operation_id SET NOT NULL,
  ALTER COLUMN operation_id SET DEFAULT gen_random_uuid();

-- 3. Adicionar reversal_of (FK auto-referencial) se não existir
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS reversal_of uuid REFERENCES public.transactions(id) ON DELETE SET NULL;

-- 4. CHECK: sem datas futuras
-- Rows geradas pelo trigger de transfers já têm date validado na tabela transfers.
-- Aplicamos o constraint apenas em transações SEM transfer_id.
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_transactions_no_future_date
  CHECK (
    transfer_id IS NOT NULL  -- rows de transfers já validadas pela tabela transfers
    OR data <= current_date
  );

-- 5. Adicionar event_time se não existir
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS event_time timestamptz NOT NULL DEFAULT now();

-- 6. Índice em operation_id (idempotência em retries)
CREATE INDEX IF NOT EXISTS idx_transactions_operation_id
  ON public.transactions(operation_id);

-- 7. Índice em reversal_of
CREATE INDEX IF NOT EXISTS idx_transactions_reversal_of
  ON public.transactions(reversal_of)
  WHERE reversal_of IS NOT NULL;

COMMIT;

-- ---------------------------------------------------------------
-- RPC: reverse_transaction(tx_id uuid)
-- Cria transação contrária e liga via reversal_of
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reverse_transaction(p_tx_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx          record;
  v_new_id      uuid;
  v_new_op_id   uuid := gen_random_uuid();
  v_new_tipo    text;
BEGIN
  -- Carregar transação original
  SELECT * INTO v_tx FROM public.transactions WHERE id = p_tx_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação % não encontrada.', p_tx_id;
  END IF;

  -- Verificar que o caller é o owner ou membro da família
  IF v_tx.user_id != auth.uid() THEN
    IF v_tx.family_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.family_id = v_tx.family_id
        AND fm.user_id = auth.uid()
        
    ) THEN
      RAISE EXCEPTION 'Sem permissão para reverter esta transação.';
    END IF;
  END IF;

  -- Verificar que não foi já revertida
  IF EXISTS (
    SELECT 1 FROM public.transactions WHERE reversal_of = p_tx_id
  ) THEN
    RAISE EXCEPTION 'Esta transação já foi revertida.';
  END IF;

  -- Verificar que não é ela própria uma reversão (evitar reversão de reversão)
  IF v_tx.reversal_of IS NOT NULL THEN
    RAISE EXCEPTION 'Não é possível reverter uma transação que já é uma reversão.';
  END IF;

  -- Determinar tipo contrário
  v_new_tipo := CASE v_tx.tipo
    WHEN 'receita'  THEN 'despesa'
    WHEN 'despesa'  THEN 'receita'
    ELSE v_tx.tipo -- transferencia: não deveria chegar aqui
  END;

  -- Inserir transação inversa
  INSERT INTO public.transactions (
    user_id, family_id, account_id, credit_card_id,
    amount_cents, currency, tipo, data, descricao,
    categoria_id, operation_id, reversal_of, event_time, created_by
  ) VALUES (
    v_tx.user_id, v_tx.family_id, v_tx.account_id, v_tx.credit_card_id,
    v_tx.amount_cents, v_tx.currency, v_new_tipo, current_date,
    '[Reversão] ' || COALESCE(v_tx.descricao, ''),
    v_tx.categoria_id, v_new_op_id, p_tx_id, now(), auth.uid()
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'reversal_id', v_new_id,
    'original_id', p_tx_id,
    'operation_id', v_new_op_id
  );
END;$$;

REVOKE EXECUTE ON FUNCTION public.reverse_transaction FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_transaction TO authenticated;
