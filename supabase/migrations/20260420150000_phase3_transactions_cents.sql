-- supabase/migrations/20260420150000_phase3_transactions_cents.sql
-- Phase 3b: transactions.valor (numeric) → amount_cents (bigint)

BEGIN;

-- Drop views that depend on transactions.valor
DROP VIEW IF EXISTS public.transactions_detailed CASCADE;
DROP VIEW IF EXISTS public.account_balances CASCADE;
DROP VIEW IF EXISTS public.budget_progress CASCADE;
DROP VIEW IF EXISTS public.account_balances_v1 CASCADE;

-- Adicionar colunas novas
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount_cents bigint;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS currency    text NOT NULL DEFAULT 'EUR';

-- Popular amount_cents a partir de valor
UPDATE public.transactions
SET amount_cents = ROUND(COALESCE(valor, 0) * 100)::bigint;

-- NOT NULL após populate
ALTER TABLE public.transactions ALTER COLUMN amount_cents SET NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN amount_cents SET DEFAULT 0;

-- Drop coluna antiga (dependentes já dropados acima)
ALTER TABLE public.transactions DROP COLUMN IF EXISTS valor;

-- Atualizar trigger: agora usa NEW.amount_cents em vez de NEW.valor
CREATE OR REPLACE FUNCTION public.handle_goal_funding_on_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_income  boolean;
  v_is_expense boolean;
  v_amount_cents bigint;
  v_currency   text := 'EUR';
  v_rule       record;
  v_roundup    bigint;
  v_contrib    bigint;
BEGIN
  v_is_income  := (COALESCE(NEW.tipo,'') = 'receita');
  v_is_expense := (COALESCE(NEW.tipo,'') = 'despesa');
  v_amount_cents := COALESCE(NEW.amount_cents, 0);
  IF v_amount_cents <= 0 THEN
    RETURN NEW;
  END IF;

  IF v_is_income THEN
    FOR v_rule IN
      SELECT r.* FROM public.goal_funding_rules r
      JOIN public.goals g ON g.id = r.goal_id
      WHERE r.enabled = true AND r.type = 'income_percent' AND r.currency = v_currency
        AND (g.user_id = NEW.user_id OR (g.family_id IS NOT NULL AND g.family_id = NEW.family_id))
        AND (r.category_id IS NULL OR r.category_id = NEW.categoria_id)
        AND (r.min_amount_cents IS NULL OR v_amount_cents >= r.min_amount_cents)
    LOOP
      IF COALESCE(v_rule.percent_bp,0) > 0 THEN
        v_contrib := FLOOR((v_amount_cents * v_rule.percent_bp) / 10000.0)::bigint;
        IF v_contrib > 0 THEN
          INSERT INTO public.goal_ledger(goal_id, tipo, amount_cents, signed, transaction_id, rule_id, data, created_by)
          VALUES (v_rule.goal_id, 'contribution', v_contrib, 1, NEW.id, v_rule.id, NEW.data::date, NEW.user_id)
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF v_is_expense THEN
    v_roundup := (100 - (v_amount_cents % 100)) % 100;
    IF v_roundup > 0 THEN
      FOR v_rule IN
        SELECT r.* FROM public.goal_funding_rules r
        JOIN public.goals g ON g.id = r.goal_id
        WHERE r.enabled = true AND r.type = 'roundup_expense' AND r.currency = v_currency
          AND (g.user_id = NEW.user_id OR (g.family_id IS NOT NULL AND g.family_id = NEW.family_id))
          AND (r.category_id IS NULL OR r.category_id = NEW.categoria_id)
          AND (r.min_amount_cents IS NULL OR v_amount_cents >= r.min_amount_cents)
      LOOP
        INSERT INTO public.goal_ledger(goal_id, tipo, amount_cents, signed, transaction_id, rule_id, data, created_by)
        VALUES (v_rule.goal_id, 'contribution', v_roundup, 1, NEW.id, v_rule.id, NEW.data::date, NEW.user_id)
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;$$;

-- Recriar account_balances (usa amount_cents / 100.0)
CREATE VIEW public.account_balances AS
SELECT
  a.id AS account_id,
  a.user_id,
  a.family_id,
  a.nome,
  a.tipo,
  (COALESCE(SUM(
    CASE
      WHEN t.tipo = 'receita' THEN t.amount_cents::numeric / 100.0
      WHEN t.tipo = 'despesa' THEN -(t.amount_cents::numeric / 100.0)
      ELSE 0::numeric
    END
  ), 0::numeric))::numeric(15,2) AS saldo_atual
FROM accounts a
LEFT JOIN transactions t ON t.account_id = a.id
GROUP BY a.id, a.user_id, a.family_id, a.nome, a.tipo;

GRANT SELECT ON public.account_balances TO authenticated;
ALTER VIEW public.account_balances SET (security_invoker = true);

-- Recriar account_balances_v1
CREATE VIEW public.account_balances_v1 AS
WITH account_transactions AS (
  SELECT
    t.account_id,
    COALESCE(SUM(
      CASE
        WHEN t.tipo = 'receita'       THEN t.amount_cents::numeric / 100.0
        WHEN t.tipo = 'despesa'       THEN -(t.amount_cents::numeric / 100.0)
        WHEN t.tipo = 'transferencia' THEN -(t.amount_cents::numeric / 100.0)
        ELSE 0::numeric
      END
    ), 0::numeric) AS saldo_atual
  FROM public.transactions t
  GROUP BY t.account_id
)
SELECT
  a.id AS account_id,
  a.nome,
  a.tipo,
  a.family_id,
  a.user_id,
  COALESCE(at.saldo_atual, 0::numeric) AS saldo_atual,
  COALESCE(ar.total_reservado, 0::numeric) AS reservado,
  CASE
    WHEN a.tipo = 'cartão de crédito' THEN 0::numeric
    ELSE COALESCE(ar.total_reservado, 0::numeric)
  END AS reservado_final,
  CASE
    WHEN a.tipo = 'cartão de crédito' THEN NULL::numeric
    ELSE GREATEST(COALESCE(at.saldo_atual, 0::numeric) - COALESCE(ar.total_reservado, 0::numeric), 0::numeric)
  END AS disponivel,
  CASE
    WHEN a.tipo = 'cartão de crédito' THEN COALESCE(at.saldo_atual, 0::numeric) < 0
    ELSE NULL::boolean
  END AS is_in_debt
FROM public.accounts a
LEFT JOIN account_transactions at ON a.id = at.account_id
LEFT JOIN public.account_reserved ar ON a.id = ar.account_id;

GRANT SELECT ON public.account_balances_v1 TO authenticated;
ALTER VIEW public.account_balances_v1 SET (security_invoker = true);

-- Recriar budget_progress (t.valor → t.amount_cents/100, b.valor permanece — Phase 3c trata budgets)
CREATE VIEW public.budget_progress AS
SELECT
  b.id AS budget_id,
  b.user_id,
  b.categoria_id,
  c.nome AS categoria_nome,
  c.cor AS categoria_cor,
  b.mes,
  b.valor AS valor_orcamento,
  COALESCE(SUM(
    CASE WHEN t.tipo = 'despesa' THEN t.amount_cents::numeric / 100.0 ELSE 0::numeric END
  ), 0::numeric) AS valor_gasto,
  (b.valor - COALESCE(SUM(
    CASE WHEN t.tipo = 'despesa' THEN t.amount_cents::numeric / 100.0 ELSE 0::numeric END
  ), 0::numeric)) AS valor_restante,
  CASE
    WHEN b.valor > 0 THEN ROUND(
      (COALESCE(SUM(CASE WHEN t.tipo = 'despesa' THEN t.amount_cents::numeric / 100.0 ELSE 0::numeric END), 0::numeric) / b.valor) * 100, 2
    )
    ELSE 0::numeric
  END AS progresso_percentual
FROM budgets b
LEFT JOIN categories c ON c.id = b.categoria_id
LEFT JOIN transactions t ON t.user_id = b.user_id
  AND t.categoria_id = b.categoria_id
  AND date_trunc('month', t.data::timestamptz) = date_trunc('month', to_date(b.mes::text || '-01', 'YYYY-MM-DD')::timestamptz)
WHERE b.family_id IS NULL
GROUP BY b.id, b.user_id, b.categoria_id, c.nome, c.cor, b.mes, b.valor;

GRANT SELECT ON public.budget_progress TO authenticated;
ALTER VIEW public.budget_progress SET (security_invoker = true);

-- Recriar transactions_detailed (valor → amount_cents)
CREATE VIEW public.transactions_detailed AS
SELECT
  t.id,
  t.user_id,
  t.amount_cents,
  t.data,
  t.tipo,
  t.descricao,
  t.created_at,
  t.family_id,
  t.account_id,
  t.goal_id,
  a.nome AS account_nome,
  a.tipo AS account_tipo,
  c.nome AS categoria_nome,
  c.cor AS categoria_cor,
  g.nome AS goal_nome,
  f.nome AS family_nome
FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.categoria_id = c.id
LEFT JOIN goals g ON t.goal_id = g.id
LEFT JOIN families f ON t.family_id = f.id;

GRANT SELECT ON public.transactions_detailed TO authenticated;
ALTER VIEW public.transactions_detailed SET (security_invoker = true);

COMMIT;
