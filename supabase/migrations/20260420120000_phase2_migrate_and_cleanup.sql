-- Phase 2b: migrar dados para goal_ledger + atualizar triggers + limpar colunas mortas

set local search_path = public;

BEGIN;

-- 1. Migrar goal_allocations -> goal_ledger
-- Cada alocação positiva vira uma entrada 'allocation' signed=1
INSERT INTO public.goal_ledger (
  goal_id, account_id, tipo, amount_cents, signed,
  data, operation_id, created_by, created_at
)
SELECT
  ga.goal_id,
  ga.account_id,
  'allocation',
  ROUND(ga.valor * 100)::bigint,
  1,
  COALESCE(ga.data_alocacao::date, ga.created_at::date, current_date),
  gen_random_uuid(),
  ga.user_id,
  COALESCE(ga.created_at, now())
FROM public.goal_allocations ga
WHERE ga.valor > 0;

-- 2. Migrar goal_contributions -> goal_ledger
-- Contribuicoes sao 'contribution' signed=1
INSERT INTO public.goal_ledger (
  goal_id, tipo, amount_cents, signed,
  transaction_id, rule_id, data, operation_id, created_at
)
SELECT
  gc.goal_id,
  'contribution',
  gc.amount_cents,
  1,
  gc.transaction_id,
  gc.rule_id,
  gc.created_at::date,
  gen_random_uuid(),
  gc.created_at
FROM public.goal_contributions gc
WHERE gc.amount_cents > 0;

-- 3. Atualizar trigger: escrever no goal_ledger em vez de goal_contributions
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
  -- Phase 2: ainda usa NEW.valor (decimal). Phase 3 atualiza para NEW.amount_cents.
  v_amount_cents := FLOOR(ABS(COALESCE(NEW.valor,0)) * 100)::bigint;
  IF v_amount_cents <= 0 THEN
    RETURN NEW;
  END IF;

  -- income_percent
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

  -- roundup_expense
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

-- 4. Atualizar apply_fixed_monthly_contributions
CREATE OR REPLACE FUNCTION public.apply_fixed_monthly_contributions(p_date date DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period    text := to_char(p_date, 'YYYY-MM');
  v_day       int  := EXTRACT(day FROM p_date);
  v_rule      record;
  v_count     int := 0;
  v_inserted  int;
BEGIN
  FOR v_rule IN
    SELECT r.* FROM public.goal_funding_rules r
    WHERE r.enabled = true AND r.type = 'fixed_monthly'
      AND COALESCE(r.day_of_month, 1) <= v_day
  LOOP
    IF COALESCE(v_rule.fixed_cents, 0) > 0 THEN
      -- Idempotencia via operation_id unico por rule+period
      INSERT INTO public.goal_ledger(goal_id, tipo, amount_cents, signed, rule_id, data, operation_id)
      VALUES (
        v_rule.goal_id, 'contribution', v_rule.fixed_cents, 1, v_rule.id,
        p_date,
        -- operation_id deterministico para idempotencia: rule_id XOR period
        uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid,
                         v_rule.id::text || v_period)
      )
      ON CONFLICT (operation_id) DO NOTHING;
      GET DIAGNOSTICS v_inserted = ROW_COUNT;
      v_count := v_count + v_inserted;
    END IF;
  END LOOP;
  RETURN v_count;
END;$$;

-- Nota: goal_ledger.operation_id nao tem UNIQUE ainda — adicionar constraint
ALTER TABLE public.goal_ledger ADD CONSTRAINT uq_goal_ledger_operation UNIQUE (operation_id);

-- 5. Drop goal_contributions (trigger ja nao escreve para la)
DROP TABLE public.goal_contributions CASCADE;

-- 6. Drops estruturais diferidos
-- accounts.is_goals continua a ser consumido por account_reserved/account_balances_v1
-- transactions.goal_id, goals.account_id e ensure_goals_account ficam para migration posterior
-- depois de reescrever as views e consumidores do modelo antigo.

COMMIT;
