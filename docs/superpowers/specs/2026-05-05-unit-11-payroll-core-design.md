# Unit 11 — Payroll Core: Design Spec

**Data:** 2026-05-05
**Unidade:** 11 — Payroll Core
**Status:** Aprovado para implementação

---

## Objectivo

Transformar o módulo de payroll existente (calculadora plana sem integração) num sistema integrado de processamento de vencimentos:
- Cálculo de IRS via brackets progressivos do DB (`tax_tables` com versionamento anual)
- Lançamento atómico de recibo → transacção líquida (goal funding automático via trigger existente)
- Modo simulação antes de posting (read-only)
- Contract versioning (soft-replace via RPC atómica)
- Period picker (lançar meses anteriores)
- Idempotência garantida via UNIQUE a nível DB

---

## Arquitectura — Opção Híbrida (C)

A lógica fiscal e de atomicidade vive no DB (RPCs SECURITY DEFINER). O TypeScript gere UI state, tipos, React Query e formatação. Sem lógica de negócio no cliente.

```
DB (Supabase)                               TypeScript (cliente)
──────────────────────────────────────────  ────────────────────────────────────
tax_tables (brackets 2026, versionados)     payroll.types.ts
payroll_contracts (+ account_id, status)    payrollCalculator.ts (formatação)
payroll_meal_allowance_configs (existente)  payroll.service.ts (chamadas RPC)
payroll_payslips (+ novas colunas Unit 11)  usePayrollContract.ts
transactions (amount_cents, tipo, etc.)     usePayslips.ts
payroll_holidays (para dias úteis)          usePayslipCalculation.ts
                                            PayrollModule.tsx (orquestrador)
calculate_payslip RPC (read-only)           ContractForm.tsx
post_payslip RPC (atómico)                  PayslipPreview.tsx
save_payroll_contract RPC (atómica)         PayslipHistory.tsx
trg_goal_funding_on_transaction (trigger)   ← dispara automaticamente no INSERT
```

---

## Camada DB

### Contexto: Tabelas Existentes Relevantes

**`transactions` (schema actual):**
```sql
account_id uuid NOT NULL
amount_cents bigint NOT NULL DEFAULT 0
categoria_id uuid NOT NULL
data date NOT NULL
descricao varchar(255)
tipo text CHECK (tipo IN ('receita','despesa','transferencia'))
user_id uuid NOT NULL
currency text DEFAULT 'EUR'
family_id uuid -- NULL para personal
```
O trigger `trg_goal_funding_on_transaction` dispara `AFTER INSERT` automaticamente — não é necessário chamar nenhuma função explícita.

**`payroll_contracts` (schema actual):**
```sql
id uuid PK
user_id uuid NOT NULL
name text NOT NULL
base_salary_cents integer NOT NULL
weekly_hours numeric
schedule_json jsonb
vacation_bonus_mode text
christmas_bonus_mode text
is_active boolean DEFAULT true
auto_deductions_enabled boolean DEFAULT false
currency text DEFAULT 'EUR'
created_at, updated_at timestamptz
```

**`payroll_meal_allowance_configs` (existente — NÃO alterar):**
```sql
id uuid PK
user_id uuid NOT NULL
contract_id uuid (FK payroll_contracts)
daily_amount_cents integer NOT NULL DEFAULT 0
excluded_months integer[] DEFAULT '{}'
payment_method text CHECK (payment_method IN ('cash','card'))  -- added 2025-01-23
duodecimos_enabled boolean
```

**`payroll_payslips` (schema actual):**
```sql
id uuid PK
user_id uuid NOT NULL
period_id uuid NOT NULL  -- FK payroll_periods (legacy)
gross_cents integer
irs_deduction_cents integer
ss_deduction_cents integer
meal_allowance_cents integer
net_cents integer
vacation_bonus_cents integer
christmas_bonus_cents integer
other_allowances_cents integer
other_deductions_cents integer
file_path text
notes text
family_id uuid
created_at, updated_at timestamptz
```

**`payroll_holidays`:**
```sql
id uuid PK
user_id uuid NOT NULL
date date NOT NULL
name text
holiday_type text ('national','regional','municipal','company','personal')
is_paid boolean
```

---

### Migration 1 — `tax_tables` com versionamento

```sql
ALTER TABLE public.tax_tables
  ADD COLUMN IF NOT EXISTS effective_year int NOT NULL DEFAULT 2026;

CREATE UNIQUE INDEX IF NOT EXISTS tax_tables_year_bracket_idx
  ON public.tax_tables(effective_year, min_income_cents);
```

Seed dos brackets 2026 (Despacho 233-A/2026) — retenção na fonte, método simplificado:

| effective_year | min_annual_cents | max_annual_cents | marginal_rate_bp |
|---------------|-----------------|-----------------|-----------------|
| 2026 | 0 | 770300 | 1300 (13%) |
| 2026 | 770300 | 1162300 | 1650 (16.5%) |
| 2026 | 1162300 | 1647200 | 2200 (22%) |
| 2026 | 1647200 | 2132100 | 2500 (25%) |
| 2026 | 2132100 | 2714600 | 3200 (32%) |
| 2026 | 2714600 | 3979100 | 3550 (35.5%) |
| 2026 | 3979100 | 5199700 | 4350 (43.5%) |
| 2026 | 5199700 | 8119900 | 4500 (45%) |
| 2026 | 8119900 | 2147483647 | 4800 (48%) |

*(rates em basis points: 1000 bp = 10%)*
*(mínimo de existência: €12 880/ano = 1 288 000 cents)*

---

### Migration 2 — `payroll_contracts` alterações

```sql
-- Adicionar account_id (conta que recebe o salário líquido)
ALTER TABLE public.payroll_contracts
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Adicionar status (soft-replace pattern)
ALTER TABLE public.payroll_contracts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive'));

-- Migrar is_active → status
UPDATE public.payroll_contracts
  SET status = CASE WHEN COALESCE(is_active, true) THEN 'active' ELSE 'inactive' END;

-- Unique parcial: max 1 activo por user
CREATE UNIQUE INDEX IF NOT EXISTS payroll_contracts_one_active_per_user_idx
  ON public.payroll_contracts(user_id) WHERE status = 'active';

-- Nota: is_active mantém-se por retrocompatibilidade; novas leituras usam status
```

---

### Migration 3 — `payroll_payslips` extensão

A tabela existente `payroll_payslips` é estendida para o novo fluxo integrado. A coluna `period_id` torna-se nullable para compatibilidade retroactiva.

```sql
-- Tornar period_id nullable (payslips novos não usam payroll_periods)
ALTER TABLE public.payroll_payslips
  ALTER COLUMN period_id DROP NOT NULL;

-- Adicionar colunas Unit 11
ALTER TABLE public.payroll_payslips
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.payroll_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS period text,                -- 'YYYY-MM'
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','posted','void')),
  ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS irs_cents integer,          -- alias de irs_deduction_cents para clareza
  ADD COLUMN IF NOT EXISTS ss_cents integer,           -- alias de ss_deduction_cents para clareza
  ADD COLUMN IF NOT EXISTS working_days integer,
  ADD COLUMN IF NOT EXISTS components jsonb;           -- breakdown completo para display

-- Idempotência: 1 payslip por contrato por período
CREATE UNIQUE INDEX IF NOT EXISTS payroll_payslips_unique_contract_period_idx
  ON public.payroll_payslips(contract_id, period)
  WHERE contract_id IS NOT NULL AND period IS NOT NULL;
```

---

### RPC `calculate_payslip` (read-only)

```sql
CREATE OR REPLACE FUNCTION public.calculate_payslip(
  p_contract_id uuid,
  p_period      text   -- formato 'YYYY-MM'
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
  v_min_existencia  bigint := 1288000; -- €12 880 em cents (2026)
  v_taxable_annual  bigint;
  v_irs_annual      bigint := 0;
  v_ss_cents        bigint;
  v_meal_cap        integer;
  v_meal_cents      bigint;
  v_net_cents       bigint;
  v_working_days    integer;
  v_period_start    date;
  v_period_end      date;
  v_bracket         record;
  v_prev_max        bigint := 0;
  v_components      jsonb := '[]'::jsonb;
BEGIN
  -- Verificar ownership
  SELECT * INTO v_contract
    FROM public.payroll_contracts
    WHERE id = p_contract_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONTRACT_NOT_FOUND';
  END IF;

  -- Datas do período
  v_period_start := to_date(p_period || '-01', 'YYYY-MM-DD');
  v_period_end   := (date_trunc('month', v_period_start) + INTERVAL '1 month - 1 day')::date;

  -- Dias úteis = Mon–Sex no calendário menos feriados do user no período
  SELECT COUNT(*)::integer INTO v_working_days
    FROM generate_series(v_period_start, v_period_end, INTERVAL '1 day') AS d
    WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5
      AND NOT EXISTS (
        SELECT 1 FROM public.payroll_holidays h
        WHERE h.user_id = auth.uid()
          AND h.date = d::date
      );

  -- Configuração de subsídio de refeição
  SELECT * INTO v_meal_config
    FROM public.payroll_meal_allowance_configs
    WHERE contract_id = p_contract_id
    LIMIT 1;

  v_meal_cap := CASE
    WHEN v_meal_config.payment_method = 'card' THEN 1046  -- €10.46 em cents
    ELSE 615                                               -- €6.15 em cents (default)
  END;
  v_meal_cents := v_working_days * LEAST(COALESCE(v_meal_config.daily_amount_cents, 0), v_meal_cap);

  -- IRS progressivo (projecção anual)
  v_gross_annual := v_contract.base_salary_cents * 12;
  -- Mínimo de existência: se rendimento anual ≤ €12 880, IRS = 0
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
      IF v_taxable_annual <= v_bracket.min_annual_cents THEN
        EXIT;
      END IF;
      v_irs_annual := v_irs_annual
        + (LEAST(v_taxable_annual, v_bracket.max_annual_cents) - v_bracket.min_annual_cents)
          * v_bracket.marginal_rate_bp / 10000;
      v_prev_max := v_bracket.max_annual_cents;
    END LOOP;
  END IF;

  -- Segurança Social (empregado): 11%
  v_ss_cents := ROUND(v_contract.base_salary_cents * 0.11)::bigint;

  -- Líquido mensal
  v_net_cents := v_contract.base_salary_cents
    - ROUND(v_irs_annual / 12.0)::bigint
    - v_ss_cents
    + v_meal_cents;

  -- Components para display
  v_components := jsonb_build_array(
    jsonb_build_object('label','Vencimento Base','amount_cents', v_contract.base_salary_cents,'sign','+'),
    jsonb_build_object('label','IRS (retenção)','amount_cents', ROUND(v_irs_annual/12.0)::bigint,'sign','-'),
    jsonb_build_object('label','Segurança Social (11%)','amount_cents', v_ss_cents,'sign','-'),
    jsonb_build_object('label','Subsídio de Refeição','amount_cents', v_meal_cents,'sign','+')
  );

  RETURN jsonb_build_object(
    'gross_cents',    v_contract.base_salary_cents,
    'irs_cents',      ROUND(v_irs_annual / 12.0)::bigint,
    'ss_cents',       v_ss_cents,
    'meal_cents',     v_meal_cents,
    'net_cents',      v_net_cents,
    'working_days',   v_working_days,
    'components',     v_components
  );
END;
$$;
```

**Algoritmo IRS resumido:**
1. Calcular salário anual = mensal × 12
2. Se anual ≤ €12 880 → IRS = 0 (mínimo de existência)
3. Caso contrário: aplicar brackets progressivos (cada taxa marginal só sobre a fatia dentro desse escalão)
4. IRS mensal = IRS anual / 12

---

### RPC `post_payslip` (atómica)

```sql
CREATE OR REPLACE FUNCTION public.post_payslip(
  p_payslip_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payslip    record;
  v_contract   record;
  v_cat_id     uuid;
  v_tx_id      uuid;
  v_period_str text;
BEGIN
  -- Verificar ownership e status
  SELECT ps.*, pc.account_id AS contract_account_id, pc.user_id AS contract_user_id
    INTO v_payslip
    FROM public.payroll_payslips ps
    JOIN public.payroll_contracts pc ON pc.id = ps.contract_id
    WHERE ps.id = p_payslip_id AND pc.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYSLIP_NOT_FOUND';
  END IF;

  -- Idempotência: se já posted, devolver transaction_id existente
  IF v_payslip.status = 'posted' THEN
    RETURN jsonb_build_object('transaction_id', v_payslip.transaction_id, 'idempotent', true);
  END IF;

  IF v_payslip.status = 'void' THEN
    RAISE EXCEPTION 'PAYSLIP_VOID';
  END IF;

  IF v_payslip.account_id IS NULL AND v_payslip.contract_account_id IS NULL THEN
    RAISE EXCEPTION 'NO_ACCOUNT_CONFIGURED';
  END IF;

  -- Resolver categoria 'Salário' (cria se não existir)
  v_cat_id := public.ensure_category_for_user(auth.uid(), 'Salário', '#4CAF50');

  v_period_str := v_payslip.period;

  -- Inserir transacção (o trigger trg_goal_funding_on_transaction dispara automaticamente)
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
    COALESCE(v_payslip.contract_account_id, v_payslip.account_id),
    v_cat_id,
    v_payslip.net_cents,
    'receita',
    to_date(v_period_str || '-01', 'YYYY-MM-DD'),
    'Ordenado líquido ' || v_period_str,
    'EUR',
    NULL   -- payroll é sempre pessoal
  )
  RETURNING id INTO v_tx_id;

  -- Marcar payslip como posted
  UPDATE public.payroll_payslips
    SET status         = 'posted',
        transaction_id = v_tx_id,
        updated_at     = now()
    WHERE id = p_payslip_id;

  -- Nota: goal funding (income_percent rules) dispara via trg_goal_funding_on_transaction
  --       automaticamente no INSERT acima. Não é necessária chamada explícita.

  RETURN jsonb_build_object('transaction_id', v_tx_id, 'idempotent', false);
END;
$$;
```

---

### RPC `save_payroll_contract` (soft-replace atómica)

```sql
CREATE OR REPLACE FUNCTION public.save_payroll_contract(
  p_name                text,
  p_base_salary_cents   integer,
  p_weekly_hours        numeric,
  p_schedule_json       jsonb,
  p_vacation_bonus_mode text,
  p_christmas_bonus_mode text,
  p_account_id          uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_id uuid;
BEGIN
  -- Soft-replace: marcar contrato activo como inactivo
  UPDATE public.payroll_contracts
    SET status    = 'inactive',
        is_active = false,
        updated_at = now()
    WHERE user_id = auth.uid() AND status = 'active';

  -- Inserir novo contrato
  INSERT INTO public.payroll_contracts (
    user_id, name, base_salary_cents, weekly_hours, schedule_json,
    vacation_bonus_mode, christmas_bonus_mode, account_id,
    status, is_active, currency
  ) VALUES (
    auth.uid(), p_name, p_base_salary_cents, p_weekly_hours, p_schedule_json,
    p_vacation_bonus_mode, p_christmas_bonus_mode, p_account_id,
    'active', true, 'EUR'
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
```

---

### RPC `create_payslip_draft`

```sql
CREATE OR REPLACE FUNCTION public.create_payslip_draft(
  p_contract_id uuid,
  p_period      text  -- 'YYYY-MM'
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
  -- Verificar ownership
  PERFORM 1 FROM public.payroll_contracts
    WHERE id = p_contract_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTRACT_NOT_FOUND'; END IF;

  -- Idempotência: se já existe draft/posted para este período, devolver o existente
  SELECT id INTO v_slip_id
    FROM public.payroll_payslips
    WHERE contract_id = p_contract_id AND period = p_period;
  IF FOUND THEN RETURN v_slip_id; END IF;

  -- Calcular componentes
  v_calc := public.calculate_payslip(p_contract_id, p_period);

  -- Inserir draft
  INSERT INTO public.payroll_payslips (
    user_id, contract_id, period, status,
    gross_cents, irs_deduction_cents, ss_deduction_cents, meal_allowance_cents, net_cents,
    irs_cents, ss_cents, working_days, components
  ) VALUES (
    auth.uid(), p_contract_id, p_period, 'draft',
    (v_calc->>'gross_cents')::integer,
    (v_calc->>'irs_cents')::integer,
    (v_calc->>'ss_cents')::integer,
    (v_calc->>'meal_cents')::integer,
    (v_calc->>'net_cents')::integer,
    (v_calc->>'irs_cents')::integer,
    (v_calc->>'ss_cents')::integer,
    (v_calc->>'working_days')::integer,
    v_calc->'components'
  )
  RETURNING id INTO v_slip_id;

  RETURN v_slip_id;
END;
$$;
```

**Nota:** `create_payslip_draft` é chamado no início do fluxo de posting (botão "Lançar Recibo" clicado). Se o draft já existe (idempotente), devolve o id existente. O draft é criado apenas quando o utilizador decide lançar — não automaticamente ao navegar no period picker.

---

## Camada TypeScript

### `payroll.types.ts` (novos tipos Unit 11 — não substituem `src/features/payroll/types/index.ts`)

Os tipos Unit 11 são adicionados em `src/features/payroll/types/payroll-core.types.ts` para evitar conflito com os tipos existentes em `index.ts`.

```typescript
// src/features/payroll/types/payroll-core.types.ts

export type PayslipStatus = 'draft' | 'posted' | 'void';

/** Componente individual do recibo (para display) */
export interface PayslipComponent {
  label: string;
  amount_cents: number;
  sign: '+' | '-';
}

/** Resultado do RPC calculate_payslip */
export interface PayslipCalculation {
  gross_cents: number;
  irs_cents: number;
  ss_cents: number;
  meal_cents: number;
  net_cents: number;
  working_days: number;
  components: PayslipComponent[];
}

/** Recibo lançado (payroll_payslips com campos Unit 11) */
export interface PayslipRecord {
  id: string;
  contractId: string;
  period: string;           // 'YYYY-MM'
  status: PayslipStatus;
  transactionId: string | null;
  gross_cents: number;
  irs_cents: number;
  ss_cents: number;
  meal_cents: number;
  net_cents: number;
  working_days: number;
  components: PayslipComponent[];
  createdAt: string;
}

/** Contrato activo (campos necessários para Unit 11) */
export interface ActiveContract {
  id: string;
  name: string;
  base_salary_cents: number;
  account_id: string | null;
  status: string;
  vacation_bonus_mode: string;
  christmas_bonus_mode: string;
}
```

### `payrollCalculator.ts` (substituição de `calc.ts` — só formatação)

O ficheiro `src/features/payroll/calc.ts` (676 linhas) é substituído por `src/features/payroll/services/payrollCalculator.ts` com responsabilidade única: formatação e helpers de apresentação. **Sem lógica de negócio.**

```typescript
// src/features/payroll/services/payrollCalculator.ts

import type { PayslipComponent } from '../types/payroll-core.types';

export const formatCents = (cents: number): string =>
  (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

export const periodLabel = (period: string): string => {
  const [year, month] = period.split('-');
  return new Date(+year, +month - 1).toLocaleString('pt-PT', {
    month: 'long',
    year: 'numeric',
  });
};

export const availablePeriods = (monthsBack = 12): string[] => {
  const periods: string[] = [];
  const now = new Date();
  for (let i = 0; i <= monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return periods;
};

export const currentPeriod = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const enrichComponents = (components: PayslipComponent[]) =>
  components.map(c => ({
    ...c,
    formatted: formatCents(Math.abs(c.amount_cents)),
    isDeduction: c.sign === '-',
  }));
```

### `payroll.service.ts` (novos métodos — adicionar ao existente `payrollService.ts`)

```typescript
// Adicionar a src/features/payroll/services/payrollService.ts

import type { PayslipCalculation, PayslipRecord } from '../types/payroll-core.types';

export const calculatePayslip = async (
  contractId: string,
  period: string,
): Promise<PayslipCalculation> => {
  const { data, error } = await supabase.rpc('calculate_payslip', {
    p_contract_id: contractId,
    p_period: period,
  });
  if (error) throw error;
  return data as PayslipCalculation;
};

export const createPayslipDraft = async (
  contractId: string,
  period: string,
): Promise<string> => {
  const { data, error } = await supabase.rpc('create_payslip_draft', {
    p_contract_id: contractId,
    p_period: period,
  });
  if (error) throw error;
  return data as string; // payslip_id
};

export const postPayslip = async (
  payslipId: string,
): Promise<{ transactionId: string; idempotent: boolean }> => {
  const { data, error } = await supabase.rpc('post_payslip', {
    p_payslip_id: payslipId,
  });
  if (error) throw error;
  return data as { transactionId: string; idempotent: boolean };
};

export const savePayrollContractCore = async (params: {
  name: string;
  baseSalaryCents: number;
  weeklyHours: number;
  scheduleJson: Record<string, unknown>;
  vacationBonusMode: string;
  christmasBonusMode: string;
  accountId: string;
}): Promise<string> => {
  const { data, error } = await supabase.rpc('save_payroll_contract', {
    p_name:                  params.name,
    p_base_salary_cents:     params.baseSalaryCents,
    p_weekly_hours:          params.weeklyHours,
    p_schedule_json:         params.scheduleJson,
    p_vacation_bonus_mode:   params.vacationBonusMode,
    p_christmas_bonus_mode:  params.christmasBonusMode,
    p_account_id:            params.accountId,
  });
  if (error) throw error;
  return data as string; // new contract_id
};

export const getPostedPayslips = async (contractId: string): Promise<PayslipRecord[]> => {
  const { data, error } = await supabase
    .from('payroll_payslips')
    .select('id,contract_id,period,status,transaction_id,gross_cents,irs_cents,ss_cents,meal_allowance_cents,net_cents,working_days,components,created_at')
    .eq('contract_id', contractId)
    .in('status', ['posted'])
    .order('period', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => ({
    id: r.id,
    contractId: r.contract_id,
    period: r.period,
    status: r.status as PayslipRecord['status'],
    transactionId: r.transaction_id,
    gross_cents: r.gross_cents ?? 0,
    irs_cents: r.irs_cents ?? 0,
    ss_cents: r.ss_cents ?? 0,
    meal_cents: r.meal_allowance_cents ?? 0,
    net_cents: r.net_cents ?? 0,
    working_days: r.working_days ?? 0,
    components: (r.components as any) ?? [],
    createdAt: r.created_at ?? '',
  }));
};
```

---

## UI — Estrutura de Componentes

```
PayrollModule (orquestrador)
├── [scope = family]  → Banner "Os recibos são geridos individualmente por cada membro."
├── [sem contrato activo] → ContractForm (criar) → chama save_payroll_contract
└── [com contrato activo]
    ├── ContractSummary + botão "Editar"
    │   └── ContractForm (modo edição) → chama save_payroll_contract (soft-replace)
    ├── PayslipPreview
    │   ├── PeriodPicker (selector YYYY-MM, range: últimos 12m + actual)
    │   ├── [se período já posted] → vista read-only dos componentes + link transacção
    │   ├── [se período não posted] → tabela de componentes + botão "Lançar Recibo"
    │   └── Estado: idle | calculating | ready | posting | posted | error
    └── PayslipHistory (lista paginada dos recibos posted, 10/página)
        └── PayslipRow (expandível — mostra componentes + link para transacção)
```

**Estado do `PayslipPreview`:**

| Estado | Trigger | UI |
|--------|---------|-----|
| `idle` | Período muda | Chama `calculate_payslip` automaticamente |
| `calculating` | RPC em curso | Skeleton nos valores |
| `ready` | Cálculo concluído, período não posted | Valores visíveis, botão "Lançar" activo |
| `posting` | Botão "Lançar" clicado | 1. `create_payslip_draft`; 2. `post_payslip`. Spinner, botão desactivado |
| `posted` | `post_payslip` concluído | Toast sucesso; React Query invalida; history actualiza |
| `error` | Qualquer RPC falha | Toast com mensagem do erro |

**Fluxo exacto ao clicar "Lançar Recibo":**
1. Estado → `posting` (botão desactivado)
2. `createPayslipDraft(contractId, period)` → obtém `payslipId`
3. `postPayslip(payslipId)` → obtém `transactionId`
4. Invalidar React Query: `['payroll-payslips', contractId]`, `['transactions']`, `['kpis']`
5. Estado → `posted`; toast sucesso

---

## Period Picker

- Default: mês actual (`currentPeriod()` de `payrollCalculator.ts`)
- Opções: `availablePeriods(12)` — últimos 12 meses + mês actual (sem futuros)
- Os RPCs (`calculate_payslip`, `create_payslip_draft`) não validam futuros — restrição é apenas no frontend
- Ao mudar período: estado → `idle` → `calculating` → `ready` (ou vista read-only se já posted)
- Para determinar se período já está posted: o hook `usePayslips` mantém lista cached; se `payslips.find(p => p.period === selectedPeriod && p.status === 'posted')` → render read-only

---

## Idempotência

- `UNIQUE INDEX payroll_payslips_unique_contract_period_idx` (contract_id, period) WHERE ambos NOT NULL
- `create_payslip_draft`: se já existe payslip para o par, devolve `id` existente sem erro
- `post_payslip`: se `status='posted'`, devolve `transaction_id` existente com `idempotent: true`
- Frontend: não gera estados de erro para respostas idempotentes

---

## Contract Versioning

- `payroll_contracts.status` ('active'/'inactive') + UNIQUE INDEX parcial garante máximo 1 activo
- `save_payroll_contract` RPC faz UPDATE + INSERT numa transacção DB — atomicidade garantida
- Payslips históricos mantêm `contract_id` original → cálculos históricos correctos
- `is_active` mantém-se sincronizado (= `status='active'`) para retrocompatibilidade com código existente

---

## Scope Awareness

- RPCs verificam `auth.uid()` explicitamente — payroll é sempre pessoal, sem excepções
- `PayrollModule`: se `useScope().kind === 'family'`, renderiza banner e não carrega dados
- Sem filtragem por `family_id` em nenhuma query de payroll

---

## Testes

### Unit (Vitest) — `payrollCalculator.test.ts`

```typescript
describe('formatCents', () => {
  it('formata 92000 → "920,00 €"', () => {
    expect(formatCents(92000)).toBe('920,00 €');
  });
  it('formata 0 → "0,00 €"', () => {
    expect(formatCents(0)).toBe('0,00 €');
  });
});

describe('periodLabel', () => {
  it('"2026-01" → "janeiro de 2026"', () => {
    expect(periodLabel('2026-01')).toBe('janeiro de 2026');
  });
});

describe('availablePeriods', () => {
  it('devolve 13 períodos (12 meses atrás + actual)', () => {
    expect(availablePeriods(12)).toHaveLength(13);
  });
  it('o primeiro período é o mês actual', () => {
    expect(availablePeriods(12)[0]).toBe(currentPeriod());
  });
});
```

### Hook (Vitest + vi.mock) — `usePayslipCalculation.test.ts`

```typescript
vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }));

it('chama calculate_payslip com contractId e period correctos', async () => {
  const mockRpc = vi.fn().mockResolvedValue({ data: mockCalcResult, error: null });
  // verifica que rpc('calculate_payslip', { p_contract_id, p_period }) foi chamado
});
it('expõe isLoading=true enquanto RPC está em curso', ...);
it('expõe error quando RPC devolve error', ...);
```

### Componente (Vitest + @testing-library) — `PayslipPreview.test.tsx`

```typescript
it('mostra skeleton durante calculating', ...);
it('botão "Lançar" desactivado quando período já posted', ...);
it('chama createPayslipDraft depois postPayslip em sequência', ...);
it('invalida React Query após post bem-sucedido', ...);
it('mostra toast de erro quando post_payslip falha', ...);
it('mostra vista read-only para período já posted', ...);
```

### Valores de referência IRS 2026 (algoritmo progressivo + mínimo existência)

| Bruto/mês | Bruto anual | IRS anual (calculado) | IRS mensal | SS (11%) | Líquido aprox. |
|-----------|------------|----------------------|-----------|---------|----------------|
| €920      | €11 040    | €0 (≤ mín. existência €12 880) | **€0** | €101 | **~€819** |
| €1 500    | €18 000    | €18 000×0% até €7703 = €0; €(18000-7703)×0% até 11623... | | | |

**Exemplo completo para €1 500/mês:**
```
Anual: €18 000
Escalão 1: €7 703 × 13% = €1 001,39
Escalão 2: (€11 623 - €7 703) × 16,5% = €646,80
Escalão 3: (€16 472 - €11 623) × 22% = €1 066,78  ← max desta fatia
Escalão 4: (€18 000 - €16 472) × 25% = €382,00
IRS anual = €3 096,97  →  IRS mensal = €258,08  (cents: 25808)
SS mensal: €1 500 × 11% = €165 (cents: 16500)
Líquido: €1 500 - €258,08 - €165 + subsídio refeição
```

**Exemplo para €3 000/mês:**
```
Anual: €36 000
Escalão 1: €7 703 × 13%    = €1 001,39
Escalão 2: €3 920 × 16,5%  = €646,80
Escalão 3: €4 849 × 22%    = €1 066,78
Escalão 4: €4 849 × 25%    = €1 212,25
Escalão 5: €36 000 - €21 321) × 32% = €4 697,28
IRS anual = €8 624,50 → IRS mensal = €718,71 (cents: 71871)
SS mensal: €3 000 × 11% = €330 (cents: 33000)
Líquido: €3 000 - €718,71 - €330 + subsídio refeição
```

Os testes de integração SQL devem usar `SELECT calculate_payslip(...)` e verificar os valores exactos em cents acima.

---

## React Query — Invalidações

```typescript
// Após post_payslip com sucesso:
queryClient.invalidateQueries({ queryKey: ['payroll-payslips', contractId] });
queryClient.invalidateQueries({ queryKey: ['transactions'] });
queryClient.invalidateQueries({ queryKey: ['kpis'] });
// (não invalidar payroll-contract — não mudou)
```

---

## Fora de Scope (Unit 11)

- Geração de PDF de recibos (Unit 12)
- Importação de recibos externos (Unit 12)
- Vista agregada de payroll em scope família (Unit 12+)
- Lançamento separado de subsídio de férias/Natal como transacções (duodécimos mostrados como label informativo no ContractSummary)
- Retroactive corrections / void de recibos posted
- Regiões (Açores, Madeira) — apenas Continente em Core
- Tributação conjunta/separada para casados — apenas contribuinte único em Core

---

## Dependências

- Unit 9: `recurring_rules` padrão de referência; `trg_goal_funding_on_transaction` (trigger existente que dispara automaticamente)
- Unit 10: React Query patterns, scope awareness, `useScope()`
- Supabase existente: `payroll_contracts`, `payroll_payslips`, `payroll_meal_allowance_configs`, `payroll_holidays`, `transactions`, `ensure_category_for_user()`
