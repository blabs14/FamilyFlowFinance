-- supabase/migrations/20260421140000_unit05_rpcs.sql
-- Unit 5 / Task 5: RPCs scope-aware para contas e cartões

set local search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- get_user_accounts: contas (não-cartões) visíveis pelo user (personal + family)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_accounts(
  p_user_id  uuid DEFAULT auth.uid(),
  p_family_id uuid DEFAULT NULL
)
RETURNS TABLE (
  account_id   uuid,
  nome         text,
  tipo         text,
  currency     text,
  order_index  int,
  family_id    uuid,
  amount_cents bigint,
  saldo_atual  numeric,    -- compatibilidade com UI existente (euros)
  saldo_disponivel numeric -- saldo - total reservado para goals
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    a.id                                               AS account_id,
    a.nome,
    a.tipo,
    a.currency,
    a.order_index,
    a.family_id,
    a.amount_cents,
    (a.amount_cents::numeric / 100.0)                 AS saldo_atual,
    -- saldo_disponivel = saldo_atual - reservado em goals ativos
    (a.amount_cents::numeric / 100.0)
      - COALESCE((
          SELECT SUM(gl.amount_cents * gl.signed)::numeric / 100.0
          FROM public.goal_ledger gl
          JOIN public.goals g ON g.id = gl.goal_id
          WHERE gl.account_id = a.id
            AND g.status IS DISTINCT FROM 'completed'
        ), 0)                                         AS saldo_disponivel
  FROM public.accounts a
  WHERE a.deleted_at IS NULL
    AND a.tipo != 'cartão de crédito'
    AND (
      a.user_id = p_user_id
      OR (
        p_family_id IS NOT NULL
        AND a.family_id = p_family_id
        AND EXISTS (
          SELECT 1 FROM public.family_members fm
          WHERE fm.family_id = p_family_id AND fm.user_id = p_user_id
        )
      )
    )
  ORDER BY a.order_index ASC NULLS LAST, a.nome;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_accounts(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- get_user_credit_cards: cartões de crédito visíveis pelo user
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_credit_cards(
  p_user_id   uuid DEFAULT auth.uid(),
  p_family_id uuid DEFAULT NULL
)
RETURNS TABLE (
  card_id               uuid,
  nome                  text,
  credit_limit_cents    bigint,
  current_balance_cents bigint,
  available_cents       bigint,   -- credit_limit_cents - current_balance_cents
  utilization_pct       numeric,  -- current_balance_cents / credit_limit_cents * 100
  closing_day           smallint,
  payment_day           smallint,
  apr                   numeric,
  annual_fee_cents      bigint,
  currency              text,
  order_index           int,
  family_id             uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    cc.id                                                  AS card_id,
    cc.nome,
    cc.credit_limit_cents,
    cc.current_balance_cents,
    GREATEST(0, cc.credit_limit_cents - cc.current_balance_cents) AS available_cents,
    CASE
      WHEN cc.credit_limit_cents = 0 THEN 0
      ELSE ROUND((cc.current_balance_cents::numeric / cc.credit_limit_cents::numeric) * 100, 2)
    END                                                    AS utilization_pct,
    cc.closing_day,
    cc.payment_day,
    cc.apr,
    cc.annual_fee_cents,
    cc.currency,
    cc.order_index,
    cc.family_id
  FROM public.credit_cards cc
  WHERE cc.deleted_at IS NULL
    AND (
      cc.user_id = p_user_id
      OR (
        p_family_id IS NOT NULL
        AND cc.family_id = p_family_id
        AND EXISTS (
          SELECT 1 FROM public.family_members fm
          WHERE fm.family_id = p_family_id AND fm.user_id = p_user_id
        )
      )
    )
  ORDER BY cc.order_index ASC NULLS LAST, cc.nome;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_credit_cards(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- soft_delete_account
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.soft_delete_account(
  p_account_id uuid,
  p_user_id    uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Verificar que é o dono
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_account_id AND user_id = p_user_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Conta não encontrada ou sem permissão (id: %)', p_account_id;
  END IF;

  -- Verificar se há transações na conta (aviso, não bloqueia)
  -- A conta pode ser archivada mesmo com histórico

  UPDATE public.accounts
  SET deleted_at = now()
  WHERE id = p_account_id AND user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'account_id', p_account_id);
END;$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_account(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- soft_delete_credit_card
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.soft_delete_credit_card(
  p_card_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.credit_cards
    WHERE id = p_card_id AND user_id = p_user_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cartão não encontrado ou sem permissão (id: %)', p_card_id;
  END IF;

  UPDATE public.credit_cards
  SET deleted_at = now()
  WHERE id = p_card_id AND user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'card_id', p_card_id);
END;$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_credit_card(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- reorder_accounts: atualiza order_index em batch
-- Input: array de jsonb [{id, order_index}]
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reorder_accounts(
  p_user_id uuid,
  p_items   jsonb  -- [{"id": "uuid", "order_index": N}, ...]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE public.accounts
    SET order_index = (v_item->>'order_index')::int
    WHERE id = (v_item->>'id')::uuid
      AND user_id = p_user_id
      AND deleted_at IS NULL;
  END LOOP;
END;$$;

GRANT EXECUTE ON FUNCTION public.reorder_accounts(uuid, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- reorder_credit_cards: atualiza order_index em batch para cartões
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reorder_credit_cards(
  p_user_id uuid,
  p_items   jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE public.credit_cards
    SET order_index = (v_item->>'order_index')::int
    WHERE id = (v_item->>'id')::uuid
      AND user_id = p_user_id
      AND deleted_at IS NULL;
  END LOOP;
END;$$;

GRANT EXECUTE ON FUNCTION public.reorder_credit_cards(uuid, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- pay_credit_card: pagar extrato de cartão a partir de conta bancária
-- Cria transação de saída na conta + atualiza current_balance_cents no cartão
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pay_credit_card(
  p_user_id        uuid,
  p_card_id        uuid,
  p_from_account_id uuid,
  p_amount_cents   bigint,
  p_date           date DEFAULT current_date,
  p_description    text DEFAULT 'Pagamento de cartão de crédito',
  p_operation_id   uuid DEFAULT gen_random_uuid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx_id uuid;
  v_categoria_id uuid;
BEGIN
  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Montante de pagamento deve ser positivo';
  END IF;

  -- Verificar que o cartão pertence ao user
  IF NOT EXISTS (
    SELECT 1 FROM public.credit_cards
    WHERE id = p_card_id AND user_id = p_user_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cartão não encontrado ou sem permissão';
  END IF;

  -- Verificar que a conta origem pertence ao user
  IF NOT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = p_from_account_id AND user_id = p_user_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Conta origem não encontrada ou sem permissão';
  END IF;

  -- Obter ou criar categoria 'Pagamento Cartão'
  SELECT id INTO v_categoria_id
  FROM public.categories
  WHERE nome = 'Pagamento Cartão' AND user_id = p_user_id
  LIMIT 1;

  IF v_categoria_id IS NULL THEN
    INSERT INTO public.categories (nome, user_id, cor)
    VALUES ('Pagamento Cartão', p_user_id, '#6366F1')
    RETURNING id INTO v_categoria_id;
  END IF;

  -- Criar transação de saída na conta bancária
  INSERT INTO public.transactions (
    account_id, categoria_id, user_id, amount_cents,
    tipo, data, descricao, operation_id
  )
  VALUES (
    p_from_account_id, v_categoria_id, p_user_id, p_amount_cents,
    'despesa', p_date, p_description, p_operation_id
  )
  RETURNING id INTO v_tx_id;

  -- Reduzir current_balance_cents do cartão
  UPDATE public.credit_cards
  SET current_balance_cents = GREATEST(0, current_balance_cents - p_amount_cents)
  WHERE id = p_card_id;

  RETURN jsonb_build_object(
    'success',      true,
    'transaction_id', v_tx_id,
    'card_id',      p_card_id,
    'amount_cents', p_amount_cents
  );
END;$$;

GRANT EXECUTE ON FUNCTION public.pay_credit_card(uuid, uuid, uuid, bigint, date, text, uuid) TO authenticated;
