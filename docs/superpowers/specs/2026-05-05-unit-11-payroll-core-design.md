# Unit 11 — Payroll Core: Design Spec

**Data:** 2026-05-05
**Unidade:** 11 — Payroll Core
**Status:** Aprovado para implementação

---

## Objectivo

Transformar o módulo de payroll existente (calculadora plana sem integração) num sistema integrado de processamento de vencimentos:
- Cálculo de IRS via brackets do DB (`tax_tables` com versionamento anual)
- Lançamento atómico de recibo → transacção líquida → `run_funding_rules`
- Modo simulação antes de posting
- Contract versioning (histórico preservado)
- Period picker (lançar meses anteriores)
- Idempotência garantida a nível DB

---

## Arquitectura — Opção Híbrida (C)

A lógica fiscal e de atomicidade vive no DB (RPCs SECURITY DEFINER). O TypeScript gere UI state, tipos, React Query e formatação. Sem lógica de negócio no cliente.

```
DB (Supabase)                          TypeScript (cliente)
─────────────────────────────────────  ─────────────────────────────────
tax_tables (brackets 2026, versionados) payroll.types.ts
payroll_contracts (active/inactive)     payrollCalculator.ts (formatação)
payslips (draft/posted, UNIQUE period)  payroll.service.ts (chamadas RPC)
transactions (líquido, type='income')   usePayrollContract.ts
                                        usePayslips.ts
calculate_payslip RPC (read-only)       usePayslipCalculation.ts
post_payslip RPC (atómico)             PayrollModule.tsx (orquestrador)
                                        ContractForm.tsx
                                        PayslipPreview.tsx
                                        PayslipHistory.tsx
```

---

## Camada DB

### `tax_tables` — Versionamento Anual

```sql
ALTER TABLE tax_tables ADD COLUMN IF NOT EXISTS effective_year int NOT NULL DEFAULT 2026;
CREATE UNIQUE INDEX IF NOT EXISTS tax_tables_year_bracket_idx
  ON tax_tables(effective_year, min_income_cents);
```

Seed dos brackets 2026 (Despacho 233-A/2026):

| Escalão | Mínimo (€) | Máximo (€) | Taxa marginal |
|---------|-----------|-----------|--------------|
| 1       | 0         | 7 703     | 13,00%       |
| 2       | 7 703     | 11 623    | 16,50%       |
| 3       | 11 623    | 16 472    | 22,00%       |
| 4       | 16 472    | 21 321    | 25,00%       |
| 5       | 21 321    | 27 146    | 32,00%       |
| 6       | 27 146    | 39 791    | 35,50%       |
| 7       | 39 791    | 51 997    | 43,50%       |
| 8       | 51 997    | 81 199    | 45,00%       |
| 9       | 81 199    | ∞         | 48,00%       |

Mínimo existência: €12 880/ano (Despacho 233-A/2026).

### `payroll_contracts` — Contract Versioning

```sql
-- status: 'active' | 'inactive'
-- Quando se cria novo contrato: UPDATE SET status='inactive' WHERE user_id = auth.uid() AND status='active'
-- Payslips mantêm FK para contract_id (histórico correcto)
ALTER TABLE payroll_contracts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  ADD COLUMN IF NOT EXISTS meal_allowance_type text NOT NULL DEFAULT 'cash'
    CHECK (meal_allowance_type IN ('cash', 'card')),
  ADD COLUMN IF NOT EXISTS bonus_mode text NOT NULL DEFAULT 'full'
    CHECK (bonus_mode IN ('full', 'duodecimos'));

CREATE UNIQUE INDEX IF NOT EXISTS payroll_contracts_one_active_per_user
  ON payroll_contracts(user_id) WHERE status = 'active';
```

Valores de subsídio de refeição (2026):
- `cash`: €6,15/dia
- `card`: €10,46/dia

### `payslips` — Idempotência

```sql
ALTER TABLE payslips
  ADD COLUMN IF NOT EXISTS period text NOT NULL,  -- formato 'YYYY-MM'
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'posted', 'void')),
  ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES transactions(id);

CREATE UNIQUE INDEX IF NOT EXISTS payslips_unique_contract_period
  ON payslips(contract_id, period);
```

### RPC `calculate_payslip`

```sql
CREATE OR REPLACE FUNCTION calculate_payslip(
  p_contract_id uuid,
  p_period text  -- 'YYYY-MM'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
-- Lê contrato, busca brackets do effective_year correcto,
-- calcula: gross, IRS (brackets), SS empregado (11%),
--          meal allowance (dias úteis × tipo), net
-- Devolve: { gross_cents, irs_cents, ss_employee_cents,
--             meal_cents, net_cents, working_days,
--             components: [...] }
-- Read-only — sem side-effects
$$;
```

### RPC `post_payslip`

```sql
CREATE OR REPLACE FUNCTION post_payslip(
  p_payslip_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
-- 1. Verifica payslip exists + status='draft' + pertence ao auth.uid()
-- 2. Idempotência: se já posted, devolve { transaction_id } sem erro
-- 3. BEGIN
--    INSERT INTO transactions (description='Ordenado líquido YYYY-MM',
--      amount_cents=net_cents, type='income', category_payroll)
--    UPDATE payslips SET status='posted', transaction_id=...
--    PERFORM run_funding_rules('salary_income', transaction_id)
--    COMMIT
-- 4. RETURN { transaction_id }
$$;
```

---

## Camada TypeScript

### `payroll.types.ts`

```typescript
export type ContractStatus = 'active' | 'inactive';
export type MealAllowanceType = 'cash' | 'card';
export type BonusMode = 'full' | 'duodecimos';
export type PayslipStatus = 'draft' | 'posted' | 'void';

export interface PayrollContract {
  id: string;
  userId: string;
  status: ContractStatus;
  grossSalaryCents: number;
  mealAllowanceType: MealAllowanceType;
  bonusMode: BonusMode;
  workingDaysPerMonth: number;
  startDate: string;
  createdAt: string;
}

export interface PayslipComponents {
  grossCents: number;
  irsCents: number;
  ssEmployeeCents: number;
  mealCents: number;
  netCents: number;
  workingDays: number;
  components: Array<{ label: string; amountCents: number; sign: '+' | '-' }>;
}

export interface Payslip {
  id: string;
  contractId: string;
  period: string; // 'YYYY-MM'
  status: PayslipStatus;
  transactionId: string | null;
  components: PayslipComponents;
  createdAt: string;
}
```

### `payrollCalculator.ts` (substituição de `calc.ts`)

Responsabilidade única: formatação e helpers de apresentação. Sem lógica de negócio.

```typescript
export const formatCents = (cents: number): string =>
  (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

export const periodLabel = (period: string): string => {
  const [year, month] = period.split('-');
  return new Date(+year, +month - 1).toLocaleString('pt-PT', { month: 'long', year: 'numeric' });
};

export const componentRows = (components: PayslipComponents['components']) =>
  components.map(c => ({
    ...c,
    formatted: formatCents(Math.abs(c.amountCents)),
    isDeduction: c.sign === '-',
  }));
```

### `payroll.service.ts`

```typescript
export const calculatePayslip = async (contractId: string, period: string): Promise<PayslipComponents> => {
  const { data, error } = await supabase.rpc('calculate_payslip', {
    p_contract_id: contractId,
    p_period: period,
  });
  if (error) throw error;
  return data as PayslipComponents;
};

export const postPayslip = async (payslipId: string): Promise<{ transactionId: string }> => {
  const { data, error } = await supabase.rpc('post_payslip', { p_payslip_id: payslipId });
  if (error) throw error;
  return data as { transactionId: string };
};

export const createPayslipDraft = async (contractId: string, period: string): Promise<Payslip> => { ... };
export const getActiveContract = async (): Promise<PayrollContract | null> => { ... };
export const saveContract = async (contract: Partial<PayrollContract>): Promise<PayrollContract> => {
  // soft-replace: marca activo anterior como inactive antes de inserir
};
```

---

## UI — Estrutura de Componentes

```
PayrollModule (orquestrador — scope check)
├── [scope = family]  → mensagem "Os recibos são geridos individualmente por cada membro"
├── [sem contrato]    → ContractForm (criar)
└── [com contrato]
    ├── ContractSummary + botão "Editar"
    │   └── ContractForm (modal/inline edit) → soft-replace
    ├── PayslipPreview
    │   ├── PeriodPicker (selector YYYY-MM, default = mês actual)
    │   ├── Tabela de componentes (bruto, IRS, SS, subsídio, líquido)
    │   ├── Estado: idle | calculating | ready | posting | posted | error
    │   └── Botão "Lançar Recibo" (disabled se posted ou posting)
    └── PayslipHistory (lista paginada de recibos posted)
        └── PayslipRow (expandível — mostra componentes + link para transacção)
```

**Estados do `PayslipPreview`:**

| Estado        | Trigger                          | UI                                      |
|---------------|----------------------------------|-----------------------------------------|
| `idle`        | Página carrega / período muda    | Chama `calculate_payslip` automaticamente |
| `calculating` | RPC em curso                     | Skeleton nos valores                    |
| `ready`       | Cálculo concluído, não posted    | Valores visíveis, botão "Lançar" activo |
| `posting`     | Botão clicado                    | Spinner, botão desactivado              |
| `posted`      | `post_payslip` concluído         | Toast sucesso, linha aparece no history |
| `error`       | Qualquer RPC falha               | Toast erro com mensagem                 |

---

## Period Picker

- Default: mês actual (`new Date().toISOString().slice(0, 7)`)
- Range: últimos 12 meses + mês actual (não permite futuros)
- Se o período já tem um payslip `posted`: mostra-o em read-only (sem botão "Lançar")
- Se o período tem payslip `draft`: carrega o draft existente

---

## Idempotência

- `UNIQUE(contract_id, period)` na tabela `payslips` — garantia ao nível DB
- `post_payslip` RPC: se `status='posted'` já existe para o payslip, devolve `transaction_id` sem criar duplicado
- Frontend: antes de criar draft, verifica se já existe payslip para o período

---

## Contract Versioning

- `payroll_contracts` tem `status: 'active' | 'inactive'`
- `UNIQUE INDEX` parcial: `WHERE status = 'active'` — garante máximo 1 activo por user
- `saveContract` (service): faz UPDATE do activo → `inactive` dentro da mesma transacção que INSERT do novo
- Payslips históricos mantêm `contract_id` original → cálculos históricos correctos

---

## Testes

### Unit (Vitest)

```typescript
// payrollCalculator.test.ts
describe('formatCents', () => {
  it('formata 92000 → "920,00 €"', ...)
  it('formata 0 → "0,00 €"', ...)
})

describe('periodLabel', () => {
  it('"2026-01" → "janeiro de 2026"', ...)
})
```

### Hook (Vitest + vi.mock)

```typescript
// usePayslipCalculation.test.ts
it('chama calculate_payslip com contractId e period correctos', ...)
it('expõe loading=true enquanto RPC está em curso', ...)
it('expõe error quando RPC falha', ...)
```

### Componente (Vitest + @testing-library)

```typescript
// PayslipPreview.test.tsx
it('mostra skeleton durante calculating', ...)
it('botão "Lançar" desactivado quando posted', ...)
it('invalida React Query após post bem-sucedido', ...)
it('mostra toast de erro quando post_payslip falha', ...)
```

### Cálculo (valores de referência 2026)

| Bruto/mês | IRS esperado | SS (11%) | Líquido aprox. |
|-----------|-------------|---------|----------------|
| €920      | €0          | €101,20 | ~€818,80       |
| €1 500    | ~€97        | €165,00 | ~€1 238        |
| €3 000    | ~€543       | €330,00 | ~€2 127        |

---

## Fora de Scope (Unit 11)

- Geração de PDF de recibos (Unit 12)
- Importação de recibos externos (Unit 12)
- Vista agregada de payroll em scope família (Unit 12+)
- Subsídio de férias / Natal como transacções separadas (duodécimos mostrados em label, não lançados individualmente no Core)
- Retroactive corrections / void de recibos posted

---

## Dependências

- Unit 9: `recurring_rules` + `run_funding_rules` (integração no `post_payslip`)
- Unit 10: React Query patterns, scope awareness, `useScope()`
- Supabase: `tax_tables`, `payroll_contracts`, `payslips`, `transactions`
