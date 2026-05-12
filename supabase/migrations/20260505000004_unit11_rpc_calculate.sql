-- supabase/migrations/20260505000004_unit11_rpc_calculate.sql
-- calculate_payslip: read-only RPC, simulates net pay for a contract+period.
-- Uses progressive IRS brackets from tax_tables (Despacho 233-A/2026).
-- Returns jsonb with gross, irs, ss, meal, net, working_days, components.

BEGIN;

SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.calculate_payslip(
  p_contract_id uuid,
  p_period      text   -- 'YYYY-MM'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract        record;
  v_meal_config     record;
  v_gross_annual    bigint;
  v_min_existencia  bigint := 1288000;  -- €12 880 × 100
  v_irs_annual      bigint := 0;
  v_taxable_annual  bigint;
  v_ss_cents        bigint;
  v_meal_cap        integer;
  v_meal_cents      bigint;
  v_net_cents       bigint;
  v_working_days    integer;
  v_period_start    date;
  v_period_end      date;
  v_bracket         record;
  v_components      jsonb := '[]'::jsonb;
BEGIN
  -- Ownership check
  SELECT * INTO v_contract
    FROM public.payroll_contracts
    WHERE id = p_contract_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONTRACT_NOT_FOUND';
  END IF;

  -- Period bounds
  v_period_start := to_date(p_period || '-01', 'YYYY-MM-DD');
  v_period_end   := (date_trunc('month', v_period_start) + INTERVAL '1 month - 1 day')::date;

  -- Working days = Mon–Fri in calendar month minus user holidays in period
  SELECT COUNT(*)::integer INTO v_working_days
    FROM generate_series(v_period_start, v_period_end, INTERVAL '1 day') AS d
    WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5
      AND NOT EXISTS (
        SELECT 1 FROM public.payroll_holidays h
        WHERE h.user_id = auth.uid()
          AND h.date = d::date
      );

  -- Meal allowance config
  SELECT * INTO v_meal_config
    FROM public.payroll_meal_allowance_configs
    WHERE contract_id = p_contract_id
    LIMIT 1;

  v_meal_cap := CASE
    WHEN v_meal_config.payment_method = 'card' THEN 1046  -- €10.46
    ELSE 615                                               -- €6.15 (default cash)
  END;
  v_meal_cents := v_working_days * LEAST(COALESCE(v_meal_config.daily_amount_cents, 0), v_meal_cap);

  -- IRS progressive brackets (projected annual income)
  v_gross_annual := v_contract.base_salary_cents * 12;

  IF v_gross_annual <= v_min_existencia THEN
    v_irs_annual := 0;
  ELSE
    v_taxable_annual := v_gross_annual;
    FOR v_bracket IN
      SELECT min_annual_cents, max_annual_cents, marginal_rate_bp
        FROM public.tax_tables
        WHERE effective_year = EXTRACT(YEAR FROM v_period_start)::int
        ORDER BY min_annual_cents ASC
    LOOP
      IF v_taxable_annual <= v_bracket.min_annual_cents THEN EXIT; END IF;
      v_irs_annual := v_irs_annual
        + (LEAST(v_taxable_annual, v_bracket.max_annual_cents) - v_bracket.min_annual_cents)
          * v_bracket.marginal_rate_bp / 10000;
    END LOOP;
  END IF;

  -- SS: 11% of gross
  v_ss_cents := ROUND(v_contract.base_salary_cents * 0.11)::bigint;

  -- Net
  v_net_cents := v_contract.base_salary_cents
    - ROUND(v_irs_annual / 12.0)::bigint
    - v_ss_cents
    + v_meal_cents;

  -- Components array for display
  v_components := jsonb_build_array(
    jsonb_build_object('label', 'Vencimento Base',        'amount_cents', v_contract.base_salary_cents,             'sign', '+'),
    jsonb_build_object('label', 'IRS (retenção)',         'amount_cents', ROUND(v_irs_annual/12.0)::bigint,         'sign', '-'),
    jsonb_build_object('label', 'Segurança Social (11%)', 'amount_cents', v_ss_cents,                              'sign', '-'),
    jsonb_build_object('label', 'Subsídio de Refeição',   'amount_cents', v_meal_cents,                            'sign', '+')
  );

  RETURN jsonb_build_object(
    'gross_cents',  v_contract.base_salary_cents,
    'irs_cents',    ROUND(v_irs_annual / 12.0)::bigint,
    'ss_cents',     v_ss_cents,
    'meal_cents',   v_meal_cents,
    'net_cents',    v_net_cents,
    'working_days', v_working_days,
    'components',   v_components
  );
END;
$$;

-- Grant to authenticated users (SECURITY DEFINER enforces ownership inside)
GRANT EXECUTE ON FUNCTION public.calculate_payslip(uuid, text) TO authenticated;

COMMIT;
