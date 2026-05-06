-- supabase/migrations/20260505000005_unit11_rpc_post_save.sql
-- Three RPCs for the Unit 11 payroll posting flow:
--   save_payroll_contract  — soft-replace active contract (versioning)
--   create_payslip_draft   — idempotent draft creation
--   post_payslip           — atomic: insert transaction + mark payslip posted

BEGIN;

SET search_path = public, pg_temp;

-- ─────────────────────────────────────────────
-- RPC: save_payroll_contract
-- Soft-replaces the active contract for the user.
-- Validates account ownership before insert.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_payroll_contract(
  p_name                 text,
  p_base_salary_cents    integer,
  p_weekly_hours         numeric,
  p_schedule_json        jsonb,
  p_vacation_bonus_mode  text,
  p_christmas_bonus_mode text,
  p_account_id           uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_id uuid;
BEGIN
  -- Verify account belongs to the calling user
  PERFORM 1 FROM public.accounts
    WHERE id = p_account_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND';
  END IF;

  -- Soft-replace: deactivate current active contract
  UPDATE public.payroll_contracts
    SET status    = 'inactive',
        is_active = false,
        updated_at = now()
    WHERE user_id = auth.uid() AND status = 'active';

  -- Insert new active contract
  INSERT INTO public.payroll_contracts (
    user_id, name, base_salary_cents, weekly_hours,
    schedule_json, vacation_bonus_mode, christmas_bonus_mode,
    account_id, status, is_active, currency, auto_deductions_enabled
  ) VALUES (
    auth.uid(), p_name, p_base_salary_cents, p_weekly_hours,
    p_schedule_json, p_vacation_bonus_mode, p_christmas_bonus_mode,
    p_account_id, 'active', true, 'EUR', false
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_payroll_contract(text,integer,numeric,jsonb,text,text,uuid) TO authenticated;

-- ─────────────────────────────────────────────
-- RPC: create_payslip_draft
-- Idempotent: returns existing draft id if already exists for period.
-- Calls calculate_payslip internally and stores snapshot.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_payslip_draft(
  p_contract_id uuid,
  p_period      text   -- 'YYYY-MM'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_calc    jsonb;
  v_slip_id uuid;
BEGIN
  -- Ownership check
  PERFORM 1 FROM public.payroll_contracts
    WHERE id = p_contract_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTRACT_NOT_FOUND'; END IF;

  -- Idempotency: return existing if already exists
  SELECT id INTO v_slip_id
    FROM public.payroll_payslips
    WHERE contract_id = p_contract_id AND period = p_period;
  IF FOUND THEN RETURN v_slip_id; END IF;

  -- Calculate components
  v_calc := public.calculate_payslip(p_contract_id, p_period);

  -- Insert draft (write both legacy and alias columns for compatibility)
  INSERT INTO public.payroll_payslips (
    user_id, contract_id, period, status,
    gross_cents,
    irs_deduction_cents, irs_cents,
    ss_deduction_cents,  ss_cents,
    meal_allowance_cents,
    net_cents, working_days, components
  ) VALUES (
    auth.uid(), p_contract_id, p_period, 'draft',
    (v_calc->>'gross_cents')::bigint,
    (v_calc->>'irs_cents')::bigint, (v_calc->>'irs_cents')::bigint,
    (v_calc->>'ss_cents')::bigint,  (v_calc->>'ss_cents')::bigint,
    (v_calc->>'meal_cents')::bigint,
    (v_calc->>'net_cents')::bigint,
    (v_calc->>'working_days')::integer,
    v_calc->'components'
  )
  RETURNING id INTO v_slip_id;

  RETURN v_slip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_payslip_draft(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────
-- RPC: post_payslip
-- Atomically: inserts income transaction → marks payslip posted.
-- Goal funding fires automatically via trg_goal_funding_on_transaction.
-- Idempotent: if already posted, returns existing transaction_id.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.post_payslip(
  p_payslip_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payslip         record;
  v_cat_id          uuid;
  v_tx_id           uuid;
BEGIN
  -- Load payslip + contract (verify ownership via contract)
  SELECT
    ps.id,
    ps.status,
    ps.transaction_id,
    ps.net_cents,
    ps.period,
    pc.account_id AS contract_account_id,
    pc.user_id    AS contract_user_id
  INTO v_payslip
    FROM public.payroll_payslips ps
    JOIN public.payroll_contracts pc ON pc.id = ps.contract_id
    WHERE ps.id = p_payslip_id
      AND pc.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYSLIP_NOT_FOUND';
  END IF;

  -- Idempotency: already posted → return existing
  IF v_payslip.status = 'posted' THEN
    RETURN jsonb_build_object('transaction_id', v_payslip.transaction_id, 'idempotent', true);
  END IF;

  IF v_payslip.status = 'void' THEN
    RAISE EXCEPTION 'PAYSLIP_VOID';
  END IF;

  -- Account configured?
  IF v_payslip.contract_account_id IS NULL THEN
    RAISE EXCEPTION 'NO_ACCOUNT_CONFIGURED';
  END IF;

  -- Resolve (or create) 'Salário' category
  v_cat_id := public.ensure_category_for_user(auth.uid(), 'Salário', '#4CAF50');

  -- Insert income transaction
  -- trg_goal_funding_on_transaction fires automatically on INSERT
  INSERT INTO public.transactions (
    user_id,
    account_id,
    categoria_id,
    amount_cents,
    tipo,
    data,
    descricao,
    currency,
    family_id
  ) VALUES (
    auth.uid(),
    v_payslip.contract_account_id,
    v_cat_id,
    v_payslip.net_cents,
    'receita',
    to_date(v_payslip.period || '-01', 'YYYY-MM-DD'),
    'Ordenado líquido ' || v_payslip.period,
    'EUR',
    NULL
  )
  RETURNING id INTO v_tx_id;

  -- Mark payslip as posted
  UPDATE public.payroll_payslips
    SET status         = 'posted',
        transaction_id = v_tx_id,
        updated_at     = now()
    WHERE id = p_payslip_id;

  RETURN jsonb_build_object('transaction_id', v_tx_id, 'idempotent', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_payslip(uuid) TO authenticated;

COMMIT;
