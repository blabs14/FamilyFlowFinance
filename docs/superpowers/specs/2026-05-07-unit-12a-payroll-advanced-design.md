# Unit 12a — Payroll Advanced (Motor Fiscal) Design Spec

**Data:** 2026-05-07
**Autor:** Pedro + Claude
**Estado:** aprovado (v3 — todos os bloqueantes e sugestões do revisor corrigidos)

---

## Objetivo

Estender o Payroll Core (Unit 11) com o motor fiscal completo para um trabalhador PT: OT com duas escalas legais, IRS autónomo em OT, mileage com cap tax-free AT, ajudas de custo com caps 2026, e leaves com tratamento fiscal correcto.

**Fora de scope (Unit 12b):** bonuses tipificados, retroativos, múltiplos contratos, PDF automático, refactor estrutural de componentes.

---

## Decisões de arquitectura

### Scope split (12a vs 12b)
12a cobre tudo o que afecta directamente os números do recibo (conformidade fiscal). 12b cobre enrichment: bonuses, retroativos, múltiplos contratos, PDF, refactor.

### Motor de cálculo — Híbrido TypeScript + DB
- **`tax_tables` (DB):** guarda todas as taxas e caps fiscais. Actualizações anuais são apenas `INSERT` sem deploy de código.
- **`src/features/payroll/lib/calc.ts` (TypeScript):** funções puras (`calcOtScaled`, `calcOtIrsWithholding`, `calcMileageCap`, `calcTravelAllowance`, `calcLeaveImpact`). Testáveis com Vitest sem mocks de DB.
- **SECURITY DEFINER RPCs (DB):** responsáveis exclusivamente por escritas financeiras (`create_payslip_draft`, `post_payslip`). Não mudam em 12a.
- **`calculatePayslip` service (TypeScript):** orquestra duas fases — chama o RPC base e depois as funções `calc.ts`. O resultado enriquecido é transparente para `usePayslipCalculation` e `PayslipPreview`.

### Dependência de Unit 11
`PayslipComponent`, `PayslipCalculation`, e `enrichComponents` são outputs de Unit 11 (PR #35, merged em main):
- `src/features/payroll/types/payroll-core.types.ts` — define `PayslipComponent` e `PayslipCalculation`
- `src/features/payroll/services/payrollCalculator.ts` — define `enrichComponents`
- `src/features/payroll/components/PayslipPreview.tsx` — usa ambos

Unit 12a assume que estes artefactos existem. O implementador deve verificar que a branch parte de main com Unit 11 merged.

### Tipo base do RPC `calculate_payslip`
O RPC devolve `PayslipCalculation` (definido em Unit 11):
```typescript
// De payroll-core.types.ts (Unit 11)
interface PayslipCalculation {
  gross_cents:   number;
  irs_cents:     number;
  ss_cents:      number;
  meal_cents:    number;
  net_cents:     number;
  working_days:  number;
  components:    PayslipComponent[];
}
```
`irsRateFraction` **não é devolvido pelo RPC** — é derivado no serviço: `irsRateFraction = base.irs_cents / base.gross_cents` (taxa efectiva de retenção). Se `gross_cents = 0`, o serviço usa `irsRateFraction = 0`.

---

## O que existe e o que muda

| Artefacto | Estado actual | Mudança em 12a |
|---|---|---|
| `src/features/payroll/lib/calc.ts` | OT flat multiplier, night work detection | + `buildOtDayEntries`, `calcOtScaled`, `calcOtIrsWithholding`, `calcMileageCap`, `calcTravelAllowance`, `calcLeaveImpact`, `mergeComponents` |
| `src/features/payroll/services/calculation.service.ts` | Usa calc.ts com multiplier flat | Actualiza para usar `calcOtScaled` + taxas de `tax_tables` |
| `payroll_ot_policies` | `threshold_hours`, `multiplier` (flat) | + `use_legal_defaults boolean DEFAULT true`, `ot_hours_ytd numeric DEFAULT 0` |
| `payroll_mileage_policies` | Taxa manual por km | + `use_tax_table_rate boolean DEFAULT true` |
| `payroll_leaves` | `leave_type`, `paid_days`, `unpaid_days` | + `employer_days smallint DEFAULT 3`, `affects_subsidy boolean DEFAULT false` |
| `PayrollMileagePage.tsx` | Total km + total valor | + split isento/tributável por viagem |
| `WeeklyTimesheetForm.tsx` | Horas por dia | + painel YTD OT com barras de progresso e alertas |
| `PayrollOvertimeDetailPage.tsx` | Lista de OT | + escala aplicada por bloco, IRS autónomo em OT |
| `PayrollVacationCalendarPage.tsx` | Calendário de férias | + campos `employer_days` e `affects_subsidy`, impacto fiscal por ausência |

O que **não existe** e é criado:
- `tax_tables` seed 2026: OT rates, OT limits, OT IRS withholding, mileage caps, travel allowance caps
- `payroll_travel_allowances` (nova tabela)
- `TravelAllowancesPage.tsx` (nova página — rota `/app/payroll/ajudas-custo`)
- `useTravelAllowances.ts` (novo hook)
- `useAdvancedPayslipInputs.ts` (novo hook de agregação)
- `src/features/payroll/types/payroll-advanced.types.ts` (novos tipos)
- `src/features/payroll/lib/__tests__/calc-advanced.test.ts`
- `src/features/payroll/services/__tests__/payrollAdvancedService.test.ts`
- `src/features/payroll/components/__tests__/TravelAllowancesPage.test.tsx`

---

## DB Layer

### Migração 1 — `tax_tables` seed 2026

Inserts na tabela existente com `effective_year = 2026`:

```sql
-- OT rates (Art. 268.º CT, Lei 13/2023)
INSERT INTO tax_tables (effective_year, type, data) VALUES
(2026, 'ot_rates', '{
  "up_to_100h":    {"first_hour_pct": 0.25, "next_hours_pct": 0.375, "rest_day_pct": 0.50},
  "above_100h":    {"first_hour_pct": 0.50, "next_hours_pct": 0.75,  "rest_day_pct": 1.00},
  "night_work_pct": 0.25,
  "night_start": "22:00",
  "night_end": "07:00"
}'),
-- Limites anuais (Art. 228.º CT)
(2026, 'ot_annual_limits', '{
  "mpe_hours": 175, "others_hours": 150,
  "irct_max_hours": 200, "daily_max_hours": 2
}'),
-- IRS autónomo em OT (desde 1/1/2025, Despacho SEAF)
(2026, 'ot_irs_withholding', '{
  "autonomous_rate_of_base": 0.50, "since": "2025-01-01"
}'),
-- Mileage AT (inalterado)
(2026, 'mileage_caps', '{"cents_per_km": 40}'),
-- Ajudas de custo (DL 106/98, actualização 2026)
(2026, 'travel_allowance_caps', '{
  "national_general_cents":  6589,
  "national_admin_cents":    7265,
  "foreign_general_cents":  15636,
  "foreign_admin_cents":    17542,
  "breakdown": {"lunch": 0.25, "dinner": 0.25, "sleep": 0.50}
}');
```

Os valores 2026 confirmados oficialmente:
- Ajudas nacionais: €65,89/dia (geral), €72,65/dia (administradores/gerentes)
- Ajudas estrangeiro: €156,36/dia (geral), €175,42/dia (administradores/gerentes)
- Mileage viatura própria: €0,40/km
- Limites OT anuais: 175h (MPE, <50 trabalhadores), 150h (≥50 trabalhadores), até 200h via IRCT
- IRS em OT: retenção autónoma a 50% da taxa IRS aplicável ao salário base (desde 1/1/2025)

### Migração 2 — Alterações a tabelas existentes

```sql
BEGIN;

-- payroll_ot_policies
ALTER TABLE payroll_ot_policies
  ADD COLUMN use_legal_defaults boolean NOT NULL DEFAULT true,
  ADD COLUMN ot_hours_ytd       numeric(6,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN payroll_ot_policies.use_legal_defaults IS
  'Se true, motor consulta tax_tables.ot_rates; se false, usa multiplier/threshold manuais';
COMMENT ON COLUMN payroll_ot_policies.ot_hours_ytd IS
  'Horas extra acumuladas no ano civil — determina passagem escala 1→2 nas 100h';

-- payroll_mileage_policies
ALTER TABLE payroll_mileage_policies
  ADD COLUMN use_tax_table_rate boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN payroll_mileage_policies.use_tax_table_rate IS
  'Se true, usa cap de tax_tables.mileage_caps em vez da taxa manual do campo rate_per_km';

-- payroll_leaves
ALTER TABLE payroll_leaves
  ADD COLUMN employer_days   smallint NOT NULL DEFAULT 3,
  ADD COLUMN affects_subsidy boolean  NOT NULL DEFAULT false;

COMMENT ON COLUMN payroll_leaves.employer_days IS
  'Dias de baixa a cargo do empregador (default 3 para sick; 0 para maternidade/paternidade)';
COMMENT ON COLUMN payroll_leaves.affects_subsidy IS
  'True para férias partidas que reduzem subsídio de férias pro-rata';

COMMIT;
```

### Migração 3 — `payroll_travel_allowances` (nova tabela)

```sql
BEGIN;

CREATE TABLE payroll_travel_allowances (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id          uuid        NOT NULL REFERENCES payroll_contracts(id) ON DELETE CASCADE,
  type                 text        NOT NULL CHECK (type IN (
                         'alojamento',
                         'deslocacao_nacional',
                         'deslocacao_estrangeiro',
                         'deslocacao_viatura_propria'
                       )),
  date_start           date        NOT NULL,
  date_end             date,
  days                 numeric(5,2),            -- suporta fracções (breakdown 25/25/50)
  km                   numeric(8,2),            -- só para deslocacao_viatura_propria
  role                 text        NOT NULL DEFAULT 'general'
                         CHECK (role IN ('general', 'admin')),
  declared_cents       bigint      NOT NULL,    -- valor declarado pelo utilizador
  taxable_excess_cents bigint      NOT NULL DEFAULT 0, -- calculado pelo motor em typescript
  receipt_file_path    text,
  operation_id         text        NOT NULL UNIQUE,  -- idempotency key, gerado no cliente
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_travel_allowances_operation_id_unique UNIQUE (operation_id)
);

ALTER TABLE payroll_travel_allowances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner access" ON payroll_travel_allowances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM payroll_contracts pc
      WHERE pc.id = contract_id AND pc.user_id = auth.uid()
    )
  );

CREATE INDEX ON payroll_travel_allowances (contract_id, date_start);

COMMIT;
```

**Nota de design:** `taxable_excess_cents` é calculado em TypeScript e gravado no momento do draft — não é GENERATED ALWAYS porque o cap pode mudar entre anos e o valor do momento de lançamento tem de ficar registado historicamente.

---

## Motor de Cálculo — `calc.ts` (novas funções)

Todas as funções são puras (sem side effects, sem chamadas de rede). Testáveis com Vitest isolado.

### Tipos de suporte (`payroll-advanced.types.ts`)

```typescript
export interface OtRates {
  up_to_100h: { first_hour_pct: number; next_hours_pct: number; rest_day_pct: number };
  above_100h: { first_hour_pct: number; next_hours_pct: number; rest_day_pct: number };
  night_work_pct: number;
  night_start: string; // 'HH:MM'
  night_end:   string; // 'HH:MM'
}

export interface OtAnnualLimits {
  mpe_hours: number;      // 175
  others_hours: number;   // 150
  irct_max_hours: number; // 200
  daily_max_hours: number; // 2
}

export interface TravelAllowanceCaps {
  national_general_cents: number;
  national_admin_cents:   number;
  foreign_general_cents:  number;
  foreign_admin_cents:    number;
  breakdown: { lunch: number; dinner: number; sleep: number };
}

export interface OtDayEntry {
  date: string;
  otMinutes: number;
  isRestDay: boolean;
  nightMinutes: number; // minutos dentro do período 22:00-07:00
}

export interface OtScaledResult {
  otPayCents: number;
  otHoursThisMonth: number;
  newYtdHours: number;
  nightBonusCents: number;
  dailyLimitWarning: boolean;
  annualLimitWarning: boolean;
  annualLimitExceeded: boolean;
  components: PayslipComponent[];
}

export interface LeaveRecord {
  leaveType: 'sick' | 'vacation' | 'unpaid' | 'maternity' | 'paternity' | 'other';
  totalDays: number;
  employerDays: number;  // default 3 para sick
  affectsSubsidy: boolean;
}

export interface LeaveImpact {
  unpaidDeductionCents: number;
  subsidyAdjustmentCents: number;
  components: PayslipComponent[];
}
```

### `calcOtScaled` — OT com duas escalas PT

```typescript
export function calcOtScaled(
  entries: OtDayEntry[],
  baseHourlyCents: number,    // gross_cents / (weekly_hours × avg_weeks_in_month)
  ytdHoursBefore: number,     // acumulado antes deste mês (de ot_policies.ot_hours_ytd)
  rates: OtRates,
  limits: OtAnnualLimits,
  isMPE: boolean              // true → limite 175h; false → 150h
): OtScaledResult
```

Lógica:
1. Itera `entries` mantendo `ytdRunning = ytdHoursBefore`
2. Para cada `entry.otMinutes`:
   - Divide em blocos se o bloco atravessa o limiar das 100h
   - `ytdRunning < 100h` → escala 1; `≥ 100h` → escala 2
   - `isRestDay` → usa `rest_day_pct` da escala activa
   - Ordem de cálculo: 1.ª hora ao rate `first_hour_pct`, restantes ao `next_hours_pct`
3. `entry.nightMinutes` → adiciona `night_work_pct × baseHourlyCents × nightHours` cumulativo
4. Verifica `daily_max_hours` por entrada; verifica limite anual no total

### `calcOtIrsWithholding` — IRS autónomo em OT

```typescript
export function calcOtIrsWithholding(
  otPayCents: number,
  baseIrsRateFraction: number,      // ex: 0.2858 para salário €1500/mês
  withholdingRateOfBase: number     // 0.50 de tax_tables.ot_irs_withholding
): number  // centavos a reter (arredondado para o inteiro mais próximo)
```

Fórmula: `Math.round(otPayCents × baseIrsRateFraction × withholdingRateOfBase)`

Fonte legal: Despacho SEAF, em vigor desde 1/1/2025. Taxa autónoma = 50% da taxa de retenção do salário base.

### `calcMileageCap` — Cap €0,40/km

```typescript
export function calcMileageCap(
  trips: { km: number; rateCentsPerKm: number }[],
  capCentsPerKm: number   // 40 de tax_tables.mileage_caps
): { exemptCents: number; taxableCents: number; totalCents: number }
```

Por viagem:
- `exempt = km × min(rateCentsPerKm, capCentsPerKm)`
- `taxable = km × max(0, rateCentsPerKm - capCentsPerKm)`

### `calcTravelAllowance` — Ajudas de custo

```typescript
export function calcTravelAllowance(
  allowance: {
    type: 'alojamento' | 'deslocacao_nacional' | 'deslocacao_estrangeiro' | 'deslocacao_viatura_propria';
    days: number;          // suporta fracções
    km?: number;           // só para deslocacao_viatura_propria
    role: 'general' | 'admin';
    declaredCents: number;
  },
  caps: TravelAllowanceCaps,
  mileageCapCentsPerKm: number
): { exemptCents: number; taxableExcessCents: number }
```

Lógica:
- `deslocacao_viatura_propria`: delega em `calcMileageCap` (usa `mileageCapCentsPerKm`, `km` obrigatório)
- Para os restantes tipos, o cap diário é determinado pelo mapeamento:

| `type` | `role = 'general'` | `role = 'admin'` |
|---|---|---|
| `deslocacao_nacional` | `caps.national_general_cents` | `caps.national_admin_cents` |
| `deslocacao_estrangeiro` | `caps.foreign_general_cents` | `caps.foreign_admin_cents` |
| `alojamento` | `caps.national_general_cents × caps.breakdown.sleep` | `caps.national_admin_cents × caps.breakdown.sleep` |

- `maxExempt = days × capDaily`; `exempt = min(declaredCents, maxExempt)`; `taxableExcessCents = max(0, declaredCents − maxExempt)`
- `breakdown.sleep = 0.50` (metade do dia nacional; `alojamento` não tem componente de refeição)

### `calcLeaveImpact` — Impacto fiscal de ausências

```typescript
export function calcLeaveImpact(
  leaves: LeaveRecord[],
  grossDailyCents: number  // gross_cents / working_days_in_month
): LeaveImpact
```

Regras PT por tipo:
- **`sick`, dias 1–`employerDays`**: empregador paga (sem dedução no payslip); componente informativo "Baixa (empregador)"
- **`sick`, dias `employerDays+1`+**: SS paga; componente informativo "Baixa (SS)"; sem dedução pelo empregador
- **`unpaid`**: `deduction = totalDays × grossDailyCents`
- **`maternity` / `paternity`**: SS paga integralmente; deduz `totalDays × grossDailyCents` do payslip (empregador não paga durante a licença)
- **`vacation` com `affectsSubsidy = true`**: `subsidyAdjustmentCents = days × grossDailyCents` (taxa = 100% salário diário — o subsídio de férias é pago à mesma taxa do salário; `subsidyRate` não existe como parâmetro separado)

### `mergeComponents` — agrega resultados no `PayslipCalculation` base

Helper puro em `calc.ts` que recebe o `PayslipCalculation` do RPC e os resultados das funções avançadas, devolvendo um `PayslipCalculation` enriquecido com os componentes extra e o `net_cents` recalculado.

```typescript
export function mergeComponents(
  base: PayslipCalculation,
  otResult: OtScaledResult,
  otIrsCents: number,
  mileage: { exemptCents: number; taxableCents: number; totalCents: number },
  allowances: { exemptCents: number; taxableExcessCents: number }[],
  leaveImpact: LeaveImpact
): PayslipCalculation {
  const extra: PayslipComponent[] = [
    ...otResult.components,
    ...(otIrsCents > 0
      ? [{ label: 'IRS s/ Horas Extra', amount_cents: otIrsCents, sign: '-' as const }]
      : []),
    ...(mileage.exemptCents > 0
      ? [{ label: 'Quilometragem (isento)', amount_cents: mileage.exemptCents, sign: '+' as const }]
      : []),
    ...(mileage.taxableCents > 0
      ? [{ label: 'Quilometragem (tributável)', amount_cents: mileage.taxableCents, sign: '+' as const }]
      : []),
    ...allowances.flatMap(a => [
      ...(a.exemptCents > 0
        ? [{ label: 'Ajudas Custo (isento)', amount_cents: a.exemptCents, sign: '+' as const }]
        : []),
      ...(a.taxableExcessCents > 0
        ? [{ label: 'Ajudas Custo (tributável)', amount_cents: a.taxableExcessCents, sign: '+' as const }]
        : []),
    ]),
    ...leaveImpact.components,
  ];
  const netDelta = extra.reduce(
    (acc, c) => acc + (c.sign === '+' ? c.amount_cents : -c.amount_cents),
    0
  );
  return {
    ...base,
    components: [...base.components, ...extra],
    net_cents: base.net_cents + netDelta,
  };
}
```

`mergeComponents` é a única ligação entre a camada de cálculo e o `PayslipCalculation` do RPC. Não tem efeitos secundários e é testável isoladamente.

---

## Serviços e Hooks

### `payrollService.ts` — `calculatePayslip` em duas fases

```typescript
// Fase 1: RPC base (inalterado — calcula base salary + IRS brackets + SS + meal)
// Fase 2: fetch paralelo + calc.ts + merge
export async function calculatePayslip(
  contractId: string,
  period: string
): Promise<PayslipCalculation> {
  const base = await supabase.rpc('calculate_payslip', { p_contract_id: contractId, p_period: period });

  const [otPolicy, rawTimeEntries, mileageTrips, travelAllowances, leaves, taxRates] =
    await Promise.all([
      fetchOtPolicy(contractId),
      fetchTimesheetEntries(contractId, period),
      fetchMileageTrips(contractId, period),
      fetchTravelAllowances(contractId, period),
      fetchLeaves(contractId, period),
      fetchTaxRates(new Date().getFullYear()),
    ]);

  // Converte PayrollTimeEntry[] → OtDayEntry[] (extrai otMinutes, isRestDay, nightMinutes)
  // usando buildOtDayEntries (nova função helper em calc.ts que usa isWorkDuringNightHours existente)
  const otEntries = buildOtDayEntries(rawTimeEntries, otPolicy.threshold_hours);

  // baseHourlyCents: aproximação gross/hora — gross_cents / (weekly_hours × 4.33 semanas × 60 min)
  // otPolicy.threshold_hours é horas diárias normais (ex: 8h)
  const baseHourlyCents = Math.round(base.gross_cents / (otPolicy.threshold_hours * 4.33 * 60));

  // irsRateFraction derivado do RPC (não devolvido explicitamente)
  const irsRateFraction = base.gross_cents > 0 ? base.irs_cents / base.gross_cents : 0;

  const otResult    = calcOtScaled(
    otEntries,
    baseHourlyCents,
    otPolicy.ot_hours_ytd,   // acumulado antes deste mês
    taxRates.otRates,
    taxRates.otLimits,
    otPolicy.isMPE ?? true
  );
  const otIrsCents  = calcOtIrsWithholding(
    otResult.otPayCents,
    irsRateFraction,
    taxRates.otIrsWithholding.autonomous_rate_of_base
  );
  const mileage     = calcMileageCap(mileageTrips, taxRates.mileageCaps.cents_per_km);
  const allowances  = travelAllowances.map(a =>
    calcTravelAllowance(a, taxRates.travelCaps, taxRates.mileageCaps.cents_per_km)
  );
  const grossDailyCents = base.working_days > 0
    ? Math.round(base.gross_cents / base.working_days)
    : 0;
  const leaveImpact = calcLeaveImpact(leaves, grossDailyCents);

  return mergeComponents(base, otResult, otIrsCents, mileage, allowances, leaveImpact);
}
```

`fetchTaxRates` usa cache em memória com TTL de 1h (as taxas não mudam durante uma sessão).

### Novas funções CRUD

| Função | Tabela | Descrição |
|---|---|---|
| `fetchTravelAllowances(contractId, period)` | `payroll_travel_allowances` | SELECT por `contract_id` + `date_start` no mês |
| `saveTravelAllowance(data)` | `payroll_travel_allowances` | INSERT com `operation_id` gerado no cliente |
| `deleteTravelAllowance(id)` | `payroll_travel_allowances` | DELETE com RLS |
| `updateOtYtd(contractId, newYtd)` | `payroll_ot_policies` | Chamado após posting bem-sucedido |
| `fetchTaxRates(year)` | `tax_tables` | SELECT rates do ano; cache 1h em memória |

### Novos hooks

**`useTravelAllowances.ts`**
```typescript
export const useTravelAllowances = (contractId: string | null, period: string) => {
  const query = useQuery<TravelAllowanceRecord[], Error>({
    queryKey: ['travel-allowances', contractId, period],
    queryFn: () => fetchTravelAllowances(contractId!, period),
    enabled: !!contractId,
    staleTime: 60_000,
  });
  const save   = useMutation({ onSuccess: () => qc.invalidateQueries(...) });
  const remove = useMutation({ onSuccess: () => qc.invalidateQueries(...) });
  return { allowances: query.data ?? [], save, remove, isLoading: query.isLoading };
};
```

**`useAdvancedPayslipInputs.ts`**
Agrega OT entries + mileage + allowances + leaves para um `contractId/period`. Invalida `['payslip-calculation', contractId, period]` após mutações — garante que `PayslipPreview` recalcula automaticamente quando o utilizador grava dados.

### Integração com posting

`create_payslip_draft` recebe os `components[]` já enriquecidos (incluindo OT e allowances). `taxable_excess_cents` é guardado no draft para que a base tributável fique correcta. Os RPCs `create_payslip_draft` e `post_payslip` não mudam.

Após posting bem-sucedido, o serviço chama `updateOtYtd(contractId, otResult.newYtdHours)` para actualizar o tracker anual.

---

## UI

### `WeeklyTimesheetForm.tsx` — painel OT tracker

Painel adicionado por baixo da grelha semanal existente:
- Horas extra este mês
- Barra YTD até 100h (switch de escala)
- Barra YTD até limite anual (175h MPE / 150h outros)
- Aviso quando `ytdRunning > 80%` do limite aplicável
- Erro quando limite ultrapassado

### `PayrollMileagePage.tsx` — split fiscal

Coluna "Isento / Tributável" adicionada à lista de viagens. Card de resumo com total isento + total tributável. Quando `use_tax_table_rate = true`, o campo de taxa na `PayrollMileagePolicyForm` fica desabilitado com tooltip "Cap AT 2026: €0,40/km".

### `PayrollOvertimeDetailPage.tsx` — duas escalas

Tabela por bloco de horas com colunas: Data, Horas, Escala (1/2), Multiplicador, Valor bruto, IRS autónomo, Líquido. Rodapé com totais e nota "IRS autónomo = 50% × taxa IRS base".

### `PayrollVacationCalendarPage.tsx` — impacto fiscal

Formulário de registo de ausência ganha:
- `employer_days` (visível apenas para `leave_type = 'sick'`, default 3)
- `affects_subsidy` checkbox (visível apenas para `leave_type = 'vacation'`)

Lista de ausências mostra impacto estimado no payslip.

### `TravelAllowancesPage.tsx` — nova página

Rota: `/app/payroll/ajudas-custo`

Formulário: tipo, período (date_start/date_end), dias (auto-calculado), perfil (geral/admin), valor declarado. Cálculo automático mostrando isento vs tributável em tempo real (React `useMemo` sobre os valores do form). Lista de ajudas do mês com totais.

`PayrollNavigation` ganha item "Ajudas de Custo" (ícone `Receipt`). `PayrollModule` ganha rota `ajudas-custo`.

### `PayslipPreview.tsx` — nenhuma alteração

Os componentes adicionais chegam já calculados em `components[]`. O `enrichComponents` existente formata-os automaticamente. O utilizador vê um recibo completo com OT, quilometragem e ajudas de custo discriminados.

---

## Testes

### `calc-advanced.test.ts` — casos PT reais (≥70% cobertura motor)

| Grupo | Casos |
|---|---|
| OT escala 1 | 1.ª hora +25%, seguintes +37,5%, dia de descanso +50% |
| OT escala 2 | 1.ª hora +50%, seguintes +75%, dia de descanso +100% |
| Transição 100h | bloco que atravessa o limiar a meio |
| Noturno | +25% cumulativo sobre OT diurno e OT de descanso |
| IRS autónomo OT | `otPay × baseRate × 0.50` arredondado |
| Limite diário | >2h/dia → `dailyLimitWarning` |
| Limite anual MPE | >175h → `annualLimitExceeded`; >150h para não-MPE |
| Mileage cap | taxa ≤ €0,40 → tudo isento; taxa > €0,40 → excesso tributável |
| Ajuda nacional geral | 3 dias × €65,89 = €197,67 isento |
| Ajuda nacional admin | 3 dias × €72,65 = €217,95 isento |
| Ajuda estrangeiro geral | 2 dias × €156,36 = €312,72 isento |
| Ajuda dias fraccionados | 1,5 dias usa breakdown 50%+25% |
| Baixa 3 dias | sem dedução; componente informativo |
| Baixa 4+ dias | nota SS; sem dedução empregador |
| Baixa não remunerada | dedução = `days × grossDailyCents` |
| Maternidade | deduz gross pro-rata; componente SS informativo |
| Férias partidas | `affects_subsidy=true` → `subsidyAdjustmentCents` correcto |

### `payrollAdvancedService.test.ts`

- `fetchTaxRates` — devolve taxas correctas + cache na 2.ª chamada (sem nova chamada Supabase)
- `saveTravelAllowance` — chama `from('payroll_travel_allowances').insert(...)`
- `deleteTravelAllowance` — chama `.delete().eq('id', ...)`
- `updateOtYtd` — chama `.update({ ot_hours_ytd }).eq('contract_id', ...)`
- `calculatePayslip` (enriched) — RPC base + calc functions + merge correcto

### `TravelAllowancesPage.test.tsx`

- Renderiza formulário com tipos correctos no Select
- Calcula automaticamente isento/tributável ao alterar valor declarado
- Chama `saveTravelAllowance` ao submeter
- Invalida `['payslip-calculation', contractId, period]` após save

---

## Dependências externas

Nenhuma nova biblioteca. Tudo assenta em:
- `@supabase/supabase-js` (já presente)
- `@tanstack/react-query` (já presente)
- `vitest` + `@testing-library/react` (já presente)

---

## Fontes legais

- Art. 268.º CT (Lei 13/2023) — OT duas escalas
- Art. 228.º CT — limites anuais de horas extra (175h MPE, 150h outros, 200h IRCT)
- Art. 266.º CT — trabalho noturno (+25%, 22:00-07:00)
- Despacho SEAF (2025) — IRS autónomo em OT a 50% da taxa base desde 1/1/2025
- DL 106/98 actualizado 2026 — ajudas de custo (valores nacionais e estrangeiro)
- AT circular 2026 — mileage €0,40/km (viatura própria)
