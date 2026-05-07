# Unit 12a — Payroll Advanced (Motor Fiscal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the payroll module with the full Portuguese fiscal engine: OT two-scale (Lei 13/2023), autonomous IRS on OT, mileage with AT €0,40/km cap, travel allowances with 2026 caps, and leaves with correct PT fiscal treatment.

**Architecture:** TypeScript pure functions in `calc.ts` handle all fiscal calculations (testable without DB); `tax_tables` (new DB table) stores fiscal rates/caps updatable via INSERT; the existing `calculate_payslip` RPC stays unchanged; `calculatePayslip` in `payrollService.ts` becomes a two-phase orchestrator (RPC base → TypeScript fiscal engine → merge).

**Tech Stack:** TypeScript, Vitest, Supabase (PostgreSQL + RLS), React Query, React Testing Library, shadcn/ui, Lucide icons

**⚠️ Branch requirement:** Start from `unit-11-payroll-core` branch (NOT `main` — PR #35 not yet merged). Required Unit 11 artifacts: `PayslipCalculation`, `PayslipComponent` in `src/features/payroll/types/payroll-core.types.ts`; `calculatePayslip`, `createPayslipDraft`, `postPayslip` in `payrollService.ts`; `usePayslipCalculation` hook.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260507100000_unit12a_tax_tables.sql` | Create | `tax_tables` table + 2026 seed data |
| `supabase/migrations/20260507110000_unit12a_policy_columns.sql` | Create | Alter `payroll_ot_policies`, `payroll_mileage_policies`, `payroll_leaves` |
| `supabase/migrations/20260507120000_unit12a_travel_allowances.sql` | Create | `payroll_travel_allowances` table + RLS |
| `src/features/payroll/types/payroll-advanced.types.ts` | Create | `OtRates`, `OtAnnualLimits`, `TravelAllowanceCaps`, `OtDayEntry`, `OtScaledResult`, `LeaveRecord`, `LeaveImpact` |
| `src/features/payroll/lib/calc.ts` | Modify | Export `isWorkDuringNightHours`; add `buildOtDayEntries`, `calcOtScaled`, `calcOtIrsWithholding`, `calcMileageCap`, `calcTravelAllowance`, `calcLeaveImpact`, `mergeComponents` |
| `src/features/payroll/lib/__tests__/calc-advanced.test.ts` | Create | Unit tests for all new calc functions (PT legal cases) |
| `src/features/payroll/services/payrollAdvanced.service.ts` | Create | `fetchTaxRates` (1h cache), `fetchTravelAllowances`, `saveTravelAllowance`, `deleteTravelAllowance`, `updateOtYtd` |
| `src/features/payroll/services/payrollService.ts` | Modify | Update `calculatePayslip` to two-phase orchestration |
| `src/features/payroll/services/__tests__/payrollAdvancedService.test.ts` | Create | Unit tests for service layer |
| `src/features/payroll/hooks/useTravelAllowances.ts` | Create | React Query hook for travel allowances CRUD |
| `src/features/payroll/hooks/useAdvancedPayslipInputs.ts` | Create | Aggregates OT + mileage + allowances + leaves; invalidates payslip query on mutation |
| `src/features/payroll/pages/TravelAllowancesPage.tsx` | Create | New page at `/app/payroll/ajudas-custo` |
| `src/features/payroll/components/__tests__/TravelAllowancesPage.test.tsx` | Create | Render + form + save + invalidation tests |
| `src/features/payroll/components/PayrollNavigation.tsx` | Modify | Add "Ajudas de Custo" nav item |
| `src/features/payroll/components/PayrollModule.tsx` | Modify | Add `ajudas-custo` route |
| `src/features/payroll/pages/PayrollMileagePage.tsx` | Modify | Show isento/tributável split per trip + summary |
| `src/features/payroll/pages/PayrollOvertimeDetailPage.tsx` | Modify | Escala 1/2 column, IRS autónomo column |
| `src/features/payroll/pages/PayrollVacationCalendarPage.tsx` | Modify | `employer_days` and `affects_subsidy` fields |
| `src/features/payroll/components/WeeklyTimesheetForm.tsx` | Modify | OT YTD tracker panel below timesheet grid |

---

## Task 1: DB Migrations

**Files:**
- Create: `supabase/migrations/20260507100000_unit12a_tax_tables.sql`
- Create: `supabase/migrations/20260507110000_unit12a_policy_columns.sql`
- Create: `supabase/migrations/20260507120000_unit12a_travel_allowances.sql`

- [ ] **Step 1: Create Migration 1 — `tax_tables` table + 2026 seed**

```sql
-- supabase/migrations/20260507100000_unit12a_tax_tables.sql
BEGIN;

CREATE TABLE tax_tables (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_year smallint    NOT NULL,
  type           text        NOT NULL,
  data           jsonb       NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_tables_year_type_unique UNIQUE (effective_year, type)
);

ALTER TABLE tax_tables ENABLE ROW LEVEL SECURITY;

-- Tax tables are read-only for all authenticated users
CREATE POLICY "authenticated read" ON tax_tables
  FOR SELECT USING (auth.role() = 'authenticated');

-- OT rates (Art. 268.º CT, Lei 13/2023)
INSERT INTO tax_tables (effective_year, type, data) VALUES
(2026, 'ot_rates', '{
  "up_to_100h":    {"first_hour_pct": 0.25, "next_hours_pct": 0.375, "rest_day_pct": 0.50},
  "above_100h":    {"first_hour_pct": 0.50, "next_hours_pct": 0.75,  "rest_day_pct": 1.00},
  "night_work_pct": 0.25,
  "night_start": "22:00",
  "night_end": "07:00"
}'::jsonb),
-- Annual OT limits (Art. 228.º CT)
(2026, 'ot_annual_limits', '{
  "mpe_hours": 175,
  "others_hours": 150,
  "irct_max_hours": 200,
  "daily_max_hours": 2
}'::jsonb),
-- Autonomous IRS on OT (Despacho SEAF, since 2025-01-01)
(2026, 'ot_irs_withholding', '{
  "autonomous_rate_of_base": 0.50,
  "since": "2025-01-01"
}'::jsonb),
-- Mileage cap (AT 2026, unchanged)
(2026, 'mileage_caps', '{"cents_per_km": 40}'::jsonb),
-- Travel allowance caps (DL 106/98, 2026 values)
(2026, 'travel_allowance_caps', '{
  "national_general_cents":  6589,
  "national_admin_cents":    7265,
  "foreign_general_cents":  15636,
  "foreign_admin_cents":    17542,
  "breakdown": {"lunch": 0.25, "dinner": 0.25, "sleep": 0.50}
}'::jsonb);

COMMIT;
```

- [ ] **Step 2: Create Migration 2 — alter existing policy tables**

```sql
-- supabase/migrations/20260507110000_unit12a_policy_columns.sql
BEGIN;

-- payroll_ot_policies: legal defaults flag + YTD tracker
-- Note: threshold_hours stores DAILY hours (e.g. 8h/day), not weekly hours.
-- The service uses: baseHourlyCents = gross_cents / (threshold_hours × 4.33 × 60)
ALTER TABLE payroll_ot_policies
  ADD COLUMN IF NOT EXISTS use_legal_defaults boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ot_hours_ytd       numeric(6,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN payroll_ot_policies.use_legal_defaults IS
  'If true, engine reads from tax_tables.ot_rates; if false, uses flat multiplier/threshold';
COMMENT ON COLUMN payroll_ot_policies.ot_hours_ytd IS
  'Annual OT hours accumulated before this month — determines scale 1→2 at 100h';
COMMENT ON COLUMN payroll_ot_policies.threshold_hours IS
  'Daily working hours contract threshold (e.g. 8 means 8h/day). NOT weekly hours.';

-- payroll_mileage_policies: tax-table rate flag
ALTER TABLE payroll_mileage_policies
  ADD COLUMN IF NOT EXISTS use_tax_table_rate boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN payroll_mileage_policies.use_tax_table_rate IS
  'If true, uses AT cap from tax_tables.mileage_caps; if false, uses manual rate_per_km';

-- payroll_leaves: employer days + subsidy impact
-- Also add 'vacation' to leave_type CHECK for split-vacation fiscal tracking
ALTER TABLE payroll_leaves
  DROP CONSTRAINT IF EXISTS payroll_leaves_leave_type_check;

ALTER TABLE payroll_leaves
  ADD CONSTRAINT payroll_leaves_leave_type_check CHECK (leave_type IN (
    'maternity', 'paternity', 'parental', 'adoption', 'sick',
    'family_assistance', 'bereavement', 'marriage', 'study',
    'unpaid', 'vacation', 'other'
  )),
  ADD COLUMN IF NOT EXISTS employer_days   smallint NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS affects_subsidy boolean  NOT NULL DEFAULT false;

COMMENT ON COLUMN payroll_leaves.employer_days IS
  'Days employer pays (default 3 for sick; 0 for maternity/paternity)';
COMMENT ON COLUMN payroll_leaves.affects_subsidy IS
  'True for split vacations that reduce vacation bonus pro-rata';

COMMIT;
```

- [ ] **Step 3: Create Migration 3 — `payroll_travel_allowances` table**

```sql
-- supabase/migrations/20260507120000_unit12a_travel_allowances.sql
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
  days                 numeric(5,2),
  km                   numeric(8,2),            -- only for deslocacao_viatura_propria
  role                 text        NOT NULL DEFAULT 'general'
                         CHECK (role IN ('general', 'admin')),
  declared_cents       bigint      NOT NULL,
  taxable_excess_cents bigint      NOT NULL DEFAULT 0,
  receipt_file_path    text,
  operation_id         text        NOT NULL,
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

- [ ] **Step 4: Apply migrations via Supabase CLI**

```bash
npx supabase db push
```

If Supabase CLI is not linked, apply each SQL file manually via the Supabase Studio SQL editor (Project → SQL Editor).

- [ ] **Step 5: Verify tables exist**

```bash
npx supabase db diff --schema public 2>/dev/null | grep -E "tax_tables|travel_allowances|ot_hours_ytd"
```

Expected: shows new columns and tables.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add tax_tables, travel_allowances, OT YTD + mileage flags (Unit 12a)"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/features/payroll/types/payroll-advanced.types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/features/payroll/types/payroll-advanced.types.ts
import type { PayslipComponent } from './payroll-core.types';

export interface OtRates {
  up_to_100h: { first_hour_pct: number; next_hours_pct: number; rest_day_pct: number };
  above_100h:  { first_hour_pct: number; next_hours_pct: number; rest_day_pct: number };
  night_work_pct: number;
  night_start: string; // 'HH:MM'
  night_end:   string; // 'HH:MM'
}

export interface OtAnnualLimits {
  mpe_hours:        number; // 175
  others_hours:     number; // 150
  irct_max_hours:   number; // 200
  daily_max_hours:  number; // 2
}

export interface TravelAllowanceCaps {
  national_general_cents: number;
  national_admin_cents:   number;
  foreign_general_cents:  number;
  foreign_admin_cents:    number;
  breakdown: { lunch: number; dinner: number; sleep: number };
}

/** One day of overtime data extracted from a PayrollTimeEntry */
export interface OtDayEntry {
  date:         string;
  otMinutes:    number;
  isRestDay:    boolean;  // true for Sunday/holiday OT
  nightMinutes: number;   // OT minutes that fall in 22:00-07:00
}

export interface OtScaledResult {
  otPayCents:           number;
  otHoursThisMonth:     number;
  newYtdHours:          number;
  nightBonusCents:      number;
  dailyLimitWarning:    boolean;
  annualLimitWarning:   boolean;
  annualLimitExceeded:  boolean;
  components:           PayslipComponent[];
}

export interface LeaveRecord {
  leaveType:      'sick' | 'vacation' | 'unpaid' | 'maternity' | 'paternity' | 'other';
  totalDays:      number; // working days, not calendar days
  employerDays:   number; // default 3 for sick
  affectsSubsidy: boolean;
}

export interface LeaveImpact {
  unpaidDeductionCents:    number;
  subsidyAdjustmentCents:  number;
  components:              PayslipComponent[];
}

/** Returned by fetchTravelAllowances */
export interface TravelAllowanceRecord {
  id:                   string;
  contract_id:          string;
  type:                 'alojamento' | 'deslocacao_nacional' | 'deslocacao_estrangeiro' | 'deslocacao_viatura_propria';
  date_start:           string;
  date_end:             string | null;
  days:                 number | null;
  km:                   number | null;
  role:                 'general' | 'admin';
  declared_cents:       number;
  taxable_excess_cents: number;
  receipt_file_path:    string | null;
  operation_id:         string;
  created_at:           string;
}

/** Input to saveTravelAllowance */
export interface TravelAllowanceInput {
  contract_id:          string;
  type:                 TravelAllowanceRecord['type'];
  date_start:           string;
  date_end?:            string;
  days?:                number;
  km?:                  number;
  role:                 'general' | 'admin';
  declared_cents:       number;
  taxable_excess_cents: number;
  operation_id:         string;
  receipt_file_path?:   string;
}

/** Cached tax rates fetched from tax_tables */
export interface TaxRates {
  otRates:           OtRates;
  otLimits:          OtAnnualLimits;
  otIrsWithholding:  { autonomous_rate_of_base: number; since: string };
  mileageCaps:       { cents_per_km: number };
  travelCaps:        TravelAllowanceCaps;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors on the new file.

- [ ] **Step 3: Commit**

```bash
git add src/features/payroll/types/payroll-advanced.types.ts
git commit -m "feat(types): add payroll-advanced types for Unit 12a fiscal engine"
```

---

## Task 3: `buildOtDayEntries` — Extract OT data from timesheet entries

**Files:**
- Create: `src/features/payroll/lib/__tests__/calc-advanced.test.ts`
- Modify: `src/features/payroll/lib/calc.ts`

The existing `isWorkDuringNightHours` function in `calc.ts` is private (no `export`). This task exports it and adds `buildOtDayEntries`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/payroll/lib/__tests__/calc-advanced.test.ts
import { describe, it, expect } from 'vitest';
import { buildOtDayEntries } from '../calc';
import type { PayrollTimeEntry } from '../../types';

// Shared fixtures — reused across all describe blocks in this file
export const RATES_2026 = {
  up_to_100h:    { first_hour_pct: 0.25, next_hours_pct: 0.375, rest_day_pct: 0.50 },
  above_100h:    { first_hour_pct: 0.50, next_hours_pct: 0.75,  rest_day_pct: 1.00 },
  night_work_pct: 0.25,
  night_start: '22:00',
  night_end:   '07:00',
} as const;

export const LIMITS_2026 = {
  mpe_hours: 175, others_hours: 150, irct_max_hours: 200, daily_max_hours: 2,
} as const;

export const CAPS_2026 = {
  national_general_cents: 6589,
  national_admin_cents:   7265,
  foreign_general_cents:  15636,
  foreign_admin_cents:    17542,
  breakdown: { lunch: 0.25, dinner: 0.25, sleep: 0.50 },
} as const;

function makeEntry(overrides: Partial<PayrollTimeEntry> = {}): PayrollTimeEntry {
  return {
    id: 'e1', user_id: 'u1', contract_id: 'c1',
    date: '2026-01-06', // Tuesday
    start_time: '09:00', end_time: '18:00', break_minutes: 60,
    entry_type: 'regular',
    created_at: '', updated_at: '',
    ...overrides,
  };
}

describe('buildOtDayEntries', () => {
  it('returns empty array when no OT', () => {
    // 8h shift with 1h break = 7h work = no OT (threshold 8h)
    const entry = makeEntry({ start_time: '09:00', end_time: '17:00', break_minutes: 60 });
    const result = buildOtDayEntries([entry], 8);
    expect(result).toHaveLength(0);
  });

  it('extracts OT minutes for a 10h day (threshold 8h)', () => {
    // 10h - 1h break = 9h total; OT = 1h = 60 min
    const entry = makeEntry({ start_time: '08:00', end_time: '19:00', break_minutes: 60 });
    const result = buildOtDayEntries([entry], 8);
    expect(result).toHaveLength(1);
    expect(result[0].otMinutes).toBe(60);
    expect(result[0].isRestDay).toBe(false);
    expect(result[0].nightMinutes).toBe(0);
  });

  it('marks Sunday as rest day', () => {
    // 2026-01-04 is a Sunday
    const entry = makeEntry({ date: '2026-01-04', start_time: '08:00', end_time: '17:00', break_minutes: 0 });
    const result = buildOtDayEntries([entry], 8);
    expect(result[0].isRestDay).toBe(true);
  });

  it('counts night OT minutes (22:00-07:00)', () => {
    // 20:00-24:00 with 0 break = 4h; threshold 8h regular day, so if total > 8h this is OT
    // Simpler: use a long shift that has OT extending into night hours
    // 08:00-23:00 = 15h; threshold 8h; OT = 7h; night OT starts at 22:00 = 60min night
    const entry = makeEntry({ start_time: '08:00', end_time: '23:00', break_minutes: 0 });
    const result = buildOtDayEntries([entry], 8);
    expect(result[0].otMinutes).toBe(7 * 60); // 7h OT
    expect(result[0].nightMinutes).toBe(60);   // 22:00-23:00 = 60 min night
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/payroll/lib/__tests__/calc-advanced.test.ts
```

Expected: FAIL — `buildOtDayEntries is not exported from '../calc'`

- [ ] **Step 3: Implement**

At the top of `src/features/payroll/lib/calc.ts`, change `function isWorkDuringNightHours` to `export function isWorkDuringNightHours`.

Then append to the end of `calc.ts`:

```typescript
// ─── Unit 12a: Advanced Fiscal Engine ────────────────────────────────────────

import type {
  OtRates, OtAnnualLimits, TravelAllowanceCaps,
  OtDayEntry, OtScaledResult, LeaveRecord, LeaveImpact,
} from '../types/payroll-advanced.types';
import type { PayslipCalculation, PayslipComponent } from '../types/payroll-core.types';

/**
 * Converts raw PayrollTimeEntry[] → OtDayEntry[].
 * Only entries with OT minutes (total worked > thresholdHours) are included.
 * Night minutes = OT portion that falls within 22:00-07:00.
 */
export function buildOtDayEntries(
  entries: PayrollTimeEntry[],
  thresholdHours: number,
): OtDayEntry[] {
  const result: OtDayEntry[] = [];

  for (const entry of entries) {
    const start = new Date(`${entry.date}T${entry.start_time}`);
    let end = new Date(`${entry.date}T${entry.end_time}`);
    if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);

    const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60) - (entry.break_minutes ?? 0);
    const otMinutes = Math.max(0, totalMinutes - thresholdHours * 60);
    if (otMinutes === 0) continue;

    // OT starts at (start + break + thresholdHours)
    const otStart = new Date(start.getTime() + ((entry.break_minutes ?? 0) + thresholdHours * 60) * 60 * 1000);

    // Night minutes: portion of OT in 22:00-07:00
    let nightMinutes = 0;
    const nightStartH = 22, nightEndH = 7;
    let cur = new Date(otStart);
    while (cur < end) {
      const h = cur.getHours();
      if (h >= nightStartH || h < nightEndH) nightMinutes++;
      cur = new Date(cur.getTime() + 60 * 1000);
    }

    const date = new Date(entry.date);
    const dow = date.getDay();
    const isRestDay = dow === 0 || dow === 6; // Sunday=0, Saturday=6

    result.push({ date: entry.date, otMinutes, isRestDay, nightMinutes });
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/features/payroll/lib/__tests__/calc-advanced.test.ts
```

Expected: PASS (4/4 tests in `buildOtDayEntries` describe block)

- [ ] **Step 5: Commit**

```bash
git add src/features/payroll/lib/calc.ts src/features/payroll/lib/__tests__/calc-advanced.test.ts
git commit -m "feat(calc): export isWorkDuringNightHours + add buildOtDayEntries (Unit 12a)"
```

---

## Task 4: `calcOtScaled` — OT with two PT legal scales

**Files:**
- Modify: `src/features/payroll/lib/calc.ts`
- Modify: `src/features/payroll/lib/__tests__/calc-advanced.test.ts`

- [ ] **Step 1: Add tests to `calc-advanced.test.ts`**

Append to the file (after the `buildOtDayEntries` describe block):

```typescript
import { calcOtScaled } from '../calc';
// (add to existing imports at top of file)

describe('calcOtScaled', () => {
  // baseHourlyCents = 1000 (€10/h) for easy math
  const BASE = 1000;

  it('scale 1 — weekday 1st OT hour: +25%', () => {
    const entries: OtDayEntry[] = [{ date: '2026-01-06', otMinutes: 60, isRestDay: false, nightMinutes: 0 }];
    const r = calcOtScaled(entries, BASE, 0, RATES_2026, LIMITS_2026, true);
    // 1st hour at 25% → 1000 × 0.25 × 1 = 250 cents
    expect(r.otPayCents).toBe(250);
    expect(r.annualLimitWarning).toBe(false);
    expect(r.annualLimitExceeded).toBe(false);
  });

  it('scale 1 — weekday subsequent OT hours: +37.5%', () => {
    // 3h OT: 1st hour +25%, next 2h +37.5%
    const entries: OtDayEntry[] = [{ date: '2026-01-06', otMinutes: 180, isRestDay: false, nightMinutes: 0 }];
    const r = calcOtScaled(entries, BASE, 0, RATES_2026, LIMITS_2026, true);
    // 1st hour = 250; next 2h = 2 × 1000 × 0.375 = 750; total = 1000
    expect(r.otPayCents).toBe(1000);
  });

  it('scale 1 — rest day: +50%', () => {
    const entries: OtDayEntry[] = [{ date: '2026-01-04', otMinutes: 60, isRestDay: true, nightMinutes: 0 }];
    const r = calcOtScaled(entries, BASE, 0, RATES_2026, LIMITS_2026, true);
    // Rest day: 1000 × 0.50 = 500
    expect(r.otPayCents).toBe(500);
  });

  it('scale 2 — weekday 1st OT hour: +50%', () => {
    const entries: OtDayEntry[] = [{ date: '2026-01-06', otMinutes: 60, isRestDay: false, nightMinutes: 0 }];
    // ytdHoursBefore = 100 → already in scale 2
    const r = calcOtScaled(entries, BASE, 100, RATES_2026, LIMITS_2026, true);
    expect(r.otPayCents).toBe(500);
  });

  it('scale 2 — rest day: +100%', () => {
    const entries: OtDayEntry[] = [{ date: '2026-01-04', otMinutes: 60, isRestDay: true, nightMinutes: 0 }];
    const r = calcOtScaled(entries, BASE, 100, RATES_2026, LIMITS_2026, true);
    expect(r.otPayCents).toBe(1000);
  });

  it('scale transition: block crossing 100h threshold', () => {
    // ytdBefore=99h; entry=2h OT → 1st hour in scale 1, 2nd hour in scale 2
    const entries: OtDayEntry[] = [{ date: '2026-01-06', otMinutes: 120, isRestDay: false, nightMinutes: 0 }];
    const r = calcOtScaled(entries, BASE, 99, RATES_2026, LIMITS_2026, true);
    // 1st OT hour in scale 1 first_hour_pct=0.25: 250
    // 2nd OT hour in scale 2 next_hours_pct=0.75: 750
    expect(r.otPayCents).toBe(1000);
  });

  it('night bonus: +25% cumulative on OT', () => {
    const entries: OtDayEntry[] = [{ date: '2026-01-06', otMinutes: 60, isRestDay: false, nightMinutes: 60 }];
    const r = calcOtScaled(entries, BASE, 0, RATES_2026, LIMITS_2026, true);
    // 1h night OT: base pay = 250; night bonus = 1000 × 0.25 × 1 = 250
    expect(r.nightBonusCents).toBe(250);
    expect(r.otPayCents).toBe(500); // 250 + 250 night bonus
  });

  it('daily limit warning when OT > 2h in a day', () => {
    const entries: OtDayEntry[] = [{ date: '2026-01-06', otMinutes: 150, isRestDay: false, nightMinutes: 0 }];
    const r = calcOtScaled(entries, BASE, 0, RATES_2026, LIMITS_2026, true);
    expect(r.dailyLimitWarning).toBe(true);
  });

  it('annual limit exceeded for MPE at 176h', () => {
    const entries: OtDayEntry[] = [{ date: '2026-01-06', otMinutes: 60, isRestDay: false, nightMinutes: 0 }];
    const r = calcOtScaled(entries, BASE, 175, RATES_2026, LIMITS_2026, true); // isMPE=true
    expect(r.annualLimitExceeded).toBe(true);
  });

  it('annual limit warning at 80% of 150h for non-MPE', () => {
    const entries: OtDayEntry[] = [{ date: '2026-01-06', otMinutes: 60, isRestDay: false, nightMinutes: 0 }];
    const r = calcOtScaled(entries, BASE, 120, RATES_2026, LIMITS_2026, false); // isMPE=false
    // 120 + 1 = 121h; 121/150 = 80.7% → warning
    expect(r.annualLimitWarning).toBe(true);
    expect(r.annualLimitExceeded).toBe(false);
  });

  it('newYtdHours tracks accumulated hours', () => {
    const entries: OtDayEntry[] = [
      { date: '2026-01-06', otMinutes: 90, isRestDay: false, nightMinutes: 0 },
      { date: '2026-01-07', otMinutes: 60, isRestDay: false, nightMinutes: 0 },
    ];
    const r = calcOtScaled(entries, BASE, 50, RATES_2026, LIMITS_2026, true);
    expect(r.otHoursThisMonth).toBeCloseTo(2.5);
    expect(r.newYtdHours).toBeCloseTo(52.5);
  });

  it('produces PayslipComponent[] entries', () => {
    const entries: OtDayEntry[] = [{ date: '2026-01-06', otMinutes: 60, isRestDay: false, nightMinutes: 0 }];
    const r = calcOtScaled(entries, BASE, 0, RATES_2026, LIMITS_2026, true);
    expect(r.components.length).toBeGreaterThan(0);
    expect(r.components[0]).toMatchObject({ label: expect.any(String), amount_cents: expect.any(Number), sign: '+' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/payroll/lib/__tests__/calc-advanced.test.ts --reporter=verbose 2>&1 | grep -E "FAIL|calcOtScaled"
```

Expected: FAIL — `calcOtScaled is not a function`

- [ ] **Step 3: Implement `calcOtScaled` in `calc.ts`**

Append to the Unit 12a section in `calc.ts`:

```typescript
export function calcOtScaled(
  entries: OtDayEntry[],
  baseHourlyCents: number,
  ytdHoursBefore: number,
  rates: OtRates,
  limits: OtAnnualLimits,
  isMPE: boolean,
): OtScaledResult {
  const annualLimit = isMPE ? limits.mpe_hours : limits.others_hours;
  let ytdRunning = ytdHoursBefore;
  let otPayCents = 0;
  let nightBonusCents = 0;
  let otHoursThisMonth = 0;
  let dailyLimitWarning = false;
  const components: PayslipComponent[] = [];

  for (const entry of entries) {
    const otHoursEntry = entry.otMinutes / 60;
    if (otHoursEntry > limits.daily_max_hours) dailyLimitWarning = true;

    let remainingMinutes = entry.otMinutes;
    let firstOtHourDone = false;
    let entryPayCents = 0;

    while (remainingMinutes > 0) {
      const scale = ytdRunning < 100 ? rates.up_to_100h : rates.above_100h;
      // How many hours can we process at this scale?
      const hoursUntilScaleChange = ytdRunning < 100 ? (100 - ytdRunning) : Infinity;
      const minutesAtScale = Math.min(remainingMinutes, hoursUntilScaleChange * 60);

      if (entry.isRestDay) {
        // Rest day: all OT at rest_day_pct
        entryPayCents += Math.round(baseHourlyCents * scale.rest_day_pct * (minutesAtScale / 60));
      } else {
        // Weekday: 1st hour at first_hour_pct, rest at next_hours_pct
        let mins = minutesAtScale;
        if (!firstOtHourDone) {
          const firstHourMins = Math.min(mins, 60);
          entryPayCents += Math.round(baseHourlyCents * scale.first_hour_pct * (firstHourMins / 60));
          mins -= firstHourMins;
          firstOtHourDone = true;
        }
        if (mins > 0) {
          entryPayCents += Math.round(baseHourlyCents * scale.next_hours_pct * (mins / 60));
        }
      }

      ytdRunning += minutesAtScale / 60;
      otHoursThisMonth += minutesAtScale / 60;
      remainingMinutes -= minutesAtScale;
    }

    // Night bonus: cumulative +25% on the night OT minutes
    if (entry.nightMinutes > 0) {
      const nb = Math.round(baseHourlyCents * rates.night_work_pct * (entry.nightMinutes / 60));
      nightBonusCents += nb;
      entryPayCents += nb;
    }

    otPayCents += entryPayCents;

    if (entryPayCents > 0) {
      // Prefix label with scale indicator so the UI can detect it without extra state
      const scale = ytdRunning > 100 ? 'E2' : 'E1';
      const label = entry.isRestDay
        ? `OT Descanso ${scale} ${entry.date}`
        : `OT ${scale} ${entry.date}`;
      components.push({ label, amount_cents: entryPayCents, sign: '+' });
    }
  }

  const newYtdHours = ytdHoursBefore + otHoursThisMonth;
  const annualLimitExceeded = newYtdHours > annualLimit;
  const annualLimitWarning = !annualLimitExceeded && newYtdHours / annualLimit >= 0.80;

  return {
    otPayCents,
    otHoursThisMonth,
    newYtdHours,
    nightBonusCents,
    dailyLimitWarning,
    annualLimitWarning,
    annualLimitExceeded,
    components,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/payroll/lib/__tests__/calc-advanced.test.ts --reporter=verbose
```

Expected: all `calcOtScaled` tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/payroll/lib/calc.ts src/features/payroll/lib/__tests__/calc-advanced.test.ts
git commit -m "feat(calc): add calcOtScaled — two-scale PT OT engine (Unit 12a)"
```

---

## Task 5: Remaining calc functions

**Files:**
- Modify: `src/features/payroll/lib/calc.ts`
- Modify: `src/features/payroll/lib/__tests__/calc-advanced.test.ts`

- [ ] **Step 1: Add tests for the 5 remaining functions**

Append to `calc-advanced.test.ts`:

```typescript
import {
  calcOtIrsWithholding, calcMileageCap, calcTravelAllowance,
  calcLeaveImpact, mergeComponents,
} from '../calc';
import type { LeaveRecord } from '../../types/payroll-advanced.types';
import type { PayslipCalculation } from '../../types/payroll-core.types';

describe('calcOtIrsWithholding', () => {
  it('withholding = otPay × baseRate × 0.50', () => {
    // otPay=10000, baseRate=0.28, result=Math.round(10000×0.28×0.50)=1400
    expect(calcOtIrsWithholding(10000, 0.28, 0.50)).toBe(1400);
  });

  it('rounds to nearest cent', () => {
    expect(calcOtIrsWithholding(333, 0.28, 0.50)).toBe(47); // 333×0.28×0.50=46.62 → 47
  });

  it('returns 0 when baseRate is 0', () => {
    expect(calcOtIrsWithholding(5000, 0, 0.50)).toBe(0);
  });
});

describe('calcMileageCap', () => {
  it('rate <= cap: all exempt', () => {
    const r = calcMileageCap([{ km: 100, rateCentsPerKm: 40 }], 40);
    expect(r.exemptCents).toBe(4000);
    expect(r.taxableCents).toBe(0);
  });

  it('rate > cap: excess taxable', () => {
    const r = calcMileageCap([{ km: 100, rateCentsPerKm: 50 }], 40);
    expect(r.exemptCents).toBe(4000);
    expect(r.taxableCents).toBe(1000);
    expect(r.totalCents).toBe(5000);
  });

  it('multiple trips accumulated', () => {
    const r = calcMileageCap([
      { km: 50, rateCentsPerKm: 40 },
      { km: 50, rateCentsPerKm: 40 },
    ], 40);
    expect(r.exemptCents).toBe(4000);
    expect(r.taxableCents).toBe(0);
  });
});

describe('calcTravelAllowance', () => {
  it('deslocacao_nacional general — 3 days exactly at cap', () => {
    // 3 × 6589 = 19767 max; declared = 19767; taxable = 0
    const r = calcTravelAllowance(
      { type: 'deslocacao_nacional', days: 3, role: 'general', declaredCents: 19767 },
      CAPS_2026, 40,
    );
    expect(r.exemptCents).toBe(19767);
    expect(r.taxableExcessCents).toBe(0);
  });

  it('deslocacao_nacional admin — 3 days over cap', () => {
    // 3 × 7265 = 21795 max; declared = 25000; taxable = 3205
    const r = calcTravelAllowance(
      { type: 'deslocacao_nacional', days: 3, role: 'admin', declaredCents: 25000 },
      CAPS_2026, 40,
    );
    expect(r.exemptCents).toBe(21795);
    expect(r.taxableExcessCents).toBe(3205);
  });

  it('deslocacao_estrangeiro general — 2 days', () => {
    // 2 × 15636 = 31272 max; declared = 31272; taxable = 0
    const r = calcTravelAllowance(
      { type: 'deslocacao_estrangeiro', days: 2, role: 'general', declaredCents: 31272 },
      CAPS_2026, 40,
    );
    expect(r.exemptCents).toBe(31272);
    expect(r.taxableExcessCents).toBe(0);
  });

  it('alojamento — uses national × sleep fraction (50%)', () => {
    // 1 night; general cap = 6589 × 0.50 = 3295 (rounded); declared = 3295; taxable = 0
    const r = calcTravelAllowance(
      { type: 'alojamento', days: 1, role: 'general', declaredCents: 3295 },
      CAPS_2026, 40,
    );
    expect(r.exemptCents).toBe(3295);
    expect(r.taxableExcessCents).toBe(0);
  });

  it('deslocacao_viatura_propria — delegates to mileage cap', () => {
    const r = calcTravelAllowance(
      { type: 'deslocacao_viatura_propria', days: 1, km: 100, role: 'general', declaredCents: 4000 },
      CAPS_2026, 40,
    );
    expect(r.exemptCents).toBe(4000);
    expect(r.taxableExcessCents).toBe(0);
  });
});

describe('calcLeaveImpact', () => {
  const daily = 5000; // €50/day

  it('sick leave within employerDays — no deduction, informative component', () => {
    const leave: LeaveRecord = { leaveType: 'sick', totalDays: 2, employerDays: 3, affectsSubsidy: false };
    const r = calcLeaveImpact([leave], daily);
    expect(r.unpaidDeductionCents).toBe(0);
    expect(r.components.some(c => c.label.includes('Baixa') && c.label.includes('empregador'))).toBe(true);
  });

  it('sick leave beyond employerDays — SS pays, component note', () => {
    const leave: LeaveRecord = { leaveType: 'sick', totalDays: 5, employerDays: 3, affectsSubsidy: false };
    const r = calcLeaveImpact([leave], daily);
    expect(r.unpaidDeductionCents).toBe(0);
    expect(r.components.some(c => c.label.includes('SS'))).toBe(true);
  });

  it('unpaid leave — deducts totalDays × grossDailyCents', () => {
    const leave: LeaveRecord = { leaveType: 'unpaid', totalDays: 3, employerDays: 0, affectsSubsidy: false };
    const r = calcLeaveImpact([leave], daily);
    expect(r.unpaidDeductionCents).toBe(15000);
  });

  it('maternity — deducts totalDays × grossDailyCents', () => {
    const leave: LeaveRecord = { leaveType: 'maternity', totalDays: 10, employerDays: 0, affectsSubsidy: false };
    const r = calcLeaveImpact([leave], daily);
    expect(r.unpaidDeductionCents).toBe(50000);
  });

  it('vacation with affectsSubsidy — subsidyAdjustmentCents correct', () => {
    const leave: LeaveRecord = { leaveType: 'vacation', totalDays: 5, employerDays: 0, affectsSubsidy: true };
    const r = calcLeaveImpact([leave], daily);
    expect(r.subsidyAdjustmentCents).toBe(25000); // 5 × 5000
  });
});

describe('mergeComponents', () => {
  const base: PayslipCalculation = {
    gross_cents: 100000, irs_cents: 28000, ss_cents: 11000,
    meal_cents: 10200, net_cents: 61000, working_days: 22, components: [],
  };

  it('adds OT components and adjusts net_cents', () => {
    const otResult: OtScaledResult = {
      otPayCents: 5000, otHoursThisMonth: 2, newYtdHours: 2,
      nightBonusCents: 0, dailyLimitWarning: false,
      annualLimitWarning: false, annualLimitExceeded: false,
      components: [{ label: 'OT 2026-01-06', amount_cents: 5000, sign: '+' }],
    };
    const r = mergeComponents(base, otResult, 0,
      { exemptCents: 0, taxableCents: 0, totalCents: 0 }, [], { unpaidDeductionCents: 0, subsidyAdjustmentCents: 0, components: [] });
    expect(r.net_cents).toBe(base.net_cents + 5000);
    expect(r.components.some(c => c.label === 'OT 2026-01-06')).toBe(true);
  });

  it('subtracts IRS OT withholding from net', () => {
    const otResult: OtScaledResult = {
      otPayCents: 5000, otHoursThisMonth: 1, newYtdHours: 1,
      nightBonusCents: 0, dailyLimitWarning: false,
      annualLimitWarning: false, annualLimitExceeded: false,
      components: [{ label: 'OT 2026-01-06', amount_cents: 5000, sign: '+' }],
    };
    const r = mergeComponents(base, otResult, 700,
      { exemptCents: 0, taxableCents: 0, totalCents: 0 }, [], { unpaidDeductionCents: 0, subsidyAdjustmentCents: 0, components: [] });
    expect(r.net_cents).toBe(base.net_cents + 5000 - 700);
    expect(r.components.some(c => c.label === 'IRS s/ Horas Extra')).toBe(true);
  });

  it('does not mutate the base object', () => {
    const r = mergeComponents(base,
      { otPayCents: 0, otHoursThisMonth: 0, newYtdHours: 0, nightBonusCents: 0, dailyLimitWarning: false, annualLimitWarning: false, annualLimitExceeded: false, components: [] },
      0,
      { exemptCents: 0, taxableCents: 0, totalCents: 0 }, [], { unpaidDeductionCents: 0, subsidyAdjustmentCents: 0, components: [] });
    expect(base.net_cents).toBe(61000); // unchanged
    expect(r).not.toBe(base);
  });
});
```

- [ ] **Step 2: Run test to verify failures**

```bash
npx vitest run src/features/payroll/lib/__tests__/calc-advanced.test.ts 2>&1 | grep -E "FAIL|not a function"
```

Expected: multiple failures on the 5 new functions

- [ ] **Step 3: Implement `calcOtIrsWithholding` in `calc.ts`**

```typescript
export function calcOtIrsWithholding(
  otPayCents: number,
  baseIrsRateFraction: number,
  withholdingRateOfBase: number,
): number {
  return Math.round(otPayCents * baseIrsRateFraction * withholdingRateOfBase);
}
```

- [ ] **Step 4: Implement `calcMileageCap`**

```typescript
export function calcMileageCap(
  trips: { km: number; rateCentsPerKm: number }[],
  capCentsPerKm: number,
): { exemptCents: number; taxableCents: number; totalCents: number } {
  let exemptCents = 0;
  let taxableCents = 0;
  for (const trip of trips) {
    exemptCents  += Math.round(trip.km * Math.min(trip.rateCentsPerKm, capCentsPerKm));
    taxableCents += Math.round(trip.km * Math.max(0, trip.rateCentsPerKm - capCentsPerKm));
  }
  return { exemptCents, taxableCents, totalCents: exemptCents + taxableCents };
}
```

- [ ] **Step 5: Implement `calcTravelAllowance`**

```typescript
export function calcTravelAllowance(
  allowance: {
    type: 'alojamento' | 'deslocacao_nacional' | 'deslocacao_estrangeiro' | 'deslocacao_viatura_propria';
    days: number;
    km?: number;
    role: 'general' | 'admin';
    declaredCents: number;
  },
  caps: TravelAllowanceCaps,
  mileageCapCentsPerKm: number,
): { exemptCents: number; taxableExcessCents: number } {
  if (allowance.type === 'deslocacao_viatura_propria') {
    const km = allowance.km ?? 0;
    const r = calcMileageCap([{ km, rateCentsPerKm: allowance.declaredCents / km || 0 }], mileageCapCentsPerKm);
    return { exemptCents: r.exemptCents, taxableExcessCents: r.taxableCents };
  }

  const capMap: Record<string, number> = {
    deslocacao_nacional_general:   caps.national_general_cents,
    deslocacao_nacional_admin:     caps.national_admin_cents,
    deslocacao_estrangeiro_general: caps.foreign_general_cents,
    deslocacao_estrangeiro_admin:   caps.foreign_admin_cents,
    alojamento_general: Math.round(caps.national_general_cents * caps.breakdown.sleep),
    alojamento_admin:   Math.round(caps.national_admin_cents   * caps.breakdown.sleep),
  };

  const capDaily = capMap[`${allowance.type}_${allowance.role}`] ?? 0;
  const maxExempt = allowance.days * capDaily;
  const exemptCents = Math.min(allowance.declaredCents, maxExempt);
  return { exemptCents, taxableExcessCents: Math.max(0, allowance.declaredCents - exemptCents) };
}
```

- [ ] **Step 6: Implement `calcLeaveImpact`**

```typescript
export function calcLeaveImpact(
  leaves: LeaveRecord[],
  grossDailyCents: number,
): LeaveImpact {
  let unpaidDeductionCents = 0;
  let subsidyAdjustmentCents = 0;
  const components: PayslipComponent[] = [];

  for (const leave of leaves) {
    if (leave.leaveType === 'sick') {
      const employerDays = Math.min(leave.totalDays, leave.employerDays);
      if (employerDays > 0) {
        components.push({ label: `Baixa (empregador, ${employerDays}d)`, amount_cents: 0, sign: '+' });
      }
      if (leave.totalDays > leave.employerDays) {
        components.push({ label: `Baixa (SS, ${leave.totalDays - leave.employerDays}d)`, amount_cents: 0, sign: '+' });
      }
    } else if (leave.leaveType === 'unpaid') {
      const d = leave.totalDays * grossDailyCents;
      unpaidDeductionCents += d;
      components.push({ label: `Licença não remunerada (${leave.totalDays}d)`, amount_cents: d, sign: '-' });
    } else if (leave.leaveType === 'maternity' || leave.leaveType === 'paternity') {
      const d = leave.totalDays * grossDailyCents;
      unpaidDeductionCents += d;
      components.push({ label: `Licença parental (SS, ${leave.totalDays}d)`, amount_cents: d, sign: '-' });
    } else if (leave.leaveType === 'vacation' && leave.affectsSubsidy) {
      const d = leave.totalDays * grossDailyCents;
      subsidyAdjustmentCents += d;
      components.push({ label: `Subsídio férias pro-rata (${leave.totalDays}d)`, amount_cents: d, sign: '-' });
    }
  }

  return { unpaidDeductionCents, subsidyAdjustmentCents, components };
}
```

- [ ] **Step 7: Implement `mergeComponents`**

```typescript
export function mergeComponents(
  base: PayslipCalculation,
  otResult: OtScaledResult,
  otIrsCents: number,
  mileage: { exemptCents: number; taxableCents: number; totalCents: number },
  allowances: { exemptCents: number; taxableExcessCents: number }[],
  leaveImpact: LeaveImpact,
): PayslipCalculation {
  const extra: PayslipComponent[] = [
    ...otResult.components,
    ...(otIrsCents > 0 ? [{ label: 'IRS s/ Horas Extra', amount_cents: otIrsCents, sign: '-' as const }] : []),
    ...(mileage.exemptCents > 0 ? [{ label: 'Quilometragem (isento)', amount_cents: mileage.exemptCents, sign: '+' as const }] : []),
    ...(mileage.taxableCents > 0 ? [{ label: 'Quilometragem (tributável)', amount_cents: mileage.taxableCents, sign: '+' as const }] : []),
    ...allowances.flatMap(a => [
      ...(a.exemptCents > 0 ? [{ label: 'Ajudas Custo (isento)', amount_cents: a.exemptCents, sign: '+' as const }] : []),
      ...(a.taxableExcessCents > 0 ? [{ label: 'Ajudas Custo (tributável)', amount_cents: a.taxableExcessCents, sign: '+' as const }] : []),
    ]),
    ...leaveImpact.components,
  ];
  const netDelta = extra.reduce(
    (acc, c) => acc + (c.sign === '+' ? c.amount_cents : -c.amount_cents),
    0,
  );
  return { ...base, components: [...base.components, ...extra], net_cents: base.net_cents + netDelta };
}
```

- [ ] **Step 8: Run all calc tests**

```bash
npx vitest run src/features/payroll/lib/__tests__/calc-advanced.test.ts --reporter=verbose
```

Expected: all tests PASS (35+ tests)

- [ ] **Step 9: Run full test suite to check for regressions**

```bash
npx vitest run
```

Expected: no new failures (pre-existing failures on main are acceptable)

- [ ] **Step 10: Commit**

```bash
git add src/features/payroll/lib/calc.ts src/features/payroll/lib/__tests__/calc-advanced.test.ts
git commit -m "feat(calc): add calcOtIrs, calcMileageCap, calcTravelAllowance, calcLeaveImpact, mergeComponents"
```

---

## Task 6: Service Layer — `payrollAdvanced.service.ts`

**Files:**
- Create: `src/features/payroll/services/payrollAdvanced.service.ts`

- [ ] **Step 1: Create the service file**

```typescript
// src/features/payroll/services/payrollAdvanced.service.ts
import { supabase } from '../../../lib/supabaseClient';
import type { TaxRates, TravelAllowanceRecord, TravelAllowanceInput } from '../types/payroll-advanced.types';

// ── Tax rate cache (1h TTL) ────────────────────────────────────────────────────

const taxRateCache = new Map<number, { data: TaxRates; expiresAt: number }>();

export async function fetchTaxRates(year: number): Promise<TaxRates> {
  const cached = taxRateCache.get(year);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const { data, error } = await supabase
    .from('tax_tables')
    .select('type, data')
    .eq('effective_year', year);
  if (error) throw error;

  const byType = Object.fromEntries((data ?? []).map((r: any) => [r.type, r.data]));

  const rates: TaxRates = {
    otRates:          byType['ot_rates']          ?? (() => { throw new Error('Missing ot_rates'); })(),
    otLimits:         byType['ot_annual_limits']  ?? (() => { throw new Error('Missing ot_annual_limits'); })(),
    otIrsWithholding: byType['ot_irs_withholding']?? (() => { throw new Error('Missing ot_irs_withholding'); })(),
    mileageCaps:      byType['mileage_caps']       ?? (() => { throw new Error('Missing mileage_caps'); })(),
    travelCaps:       byType['travel_allowance_caps'] ?? (() => { throw new Error('Missing travel_allowance_caps'); })(),
  };

  taxRateCache.set(year, { data: rates, expiresAt: Date.now() + 60 * 60 * 1000 });
  return rates;
}

// Exported for testing only — clears the in-memory cache
export function _clearTaxRateCache() { taxRateCache.clear(); }

// ── Travel allowances CRUD ─────────────────────────────────────────────────────

/** Returns travel allowances for a contract where date_start falls within period (YYYY-MM). */
export async function fetchTravelAllowances(
  contractId: string,
  period: string, // 'YYYY-MM'
): Promise<TravelAllowanceRecord[]> {
  const [year, month] = period.split('-').map(Number);
  const dateStart = `${period}-01`;
  const dateEnd   = new Date(year, month, 0).toISOString().split('T')[0]; // last day

  const { data, error } = await supabase
    .from('payroll_travel_allowances')
    .select('*')
    .eq('contract_id', contractId)
    .gte('date_start', dateStart)
    .lte('date_start', dateEnd)
    .order('date_start', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TravelAllowanceRecord[];
}

export async function saveTravelAllowance(input: TravelAllowanceInput): Promise<TravelAllowanceRecord> {
  const { data, error } = await supabase
    .from('payroll_travel_allowances')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as TravelAllowanceRecord;
}

export async function deleteTravelAllowance(id: string): Promise<void> {
  const { error } = await supabase
    .from('payroll_travel_allowances')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── OT YTD tracker ────────────────────────────────────────────────────────────

export async function updateOtYtd(contractId: string, newYtdHours: number): Promise<void> {
  const { error } = await supabase
    .from('payroll_ot_policies')
    .update({ ot_hours_ytd: newYtdHours })
    .eq('contract_id', contractId);
  if (error) throw error;
}
```

- [ ] **Step 2: Update `calculatePayslip` in `payrollService.ts` to two-phase**

Find the existing `calculatePayslip` function (around line 1676) and replace it:

```typescript
// Replace existing calculatePayslip in payrollService.ts
export const calculatePayslip = async (
  contractId: string,
  period: string,
): Promise<PayslipCalculation> => {
  // ── Phase 1: RPC base calculation (IRS brackets, SS, meal) ──
  const { data: base, error } = await supabase.rpc('calculate_payslip', {
    p_contract_id: contractId,
    p_period: period,
  });
  if (error) throw error;
  const baseResult = base as PayslipCalculation;

  // ── Phase 2: fetch fiscal inputs + TypeScript calc engine ──
  const {
    fetchTaxRates, fetchTravelAllowances,
  } = await import('./payrollAdvanced.service');
  const {
    buildOtDayEntries, calcOtScaled, calcOtIrsWithholding,
    calcMileageCap, calcTravelAllowance, calcLeaveImpact, mergeComponents,
  } = await import('../lib/calc');

  const [year, month] = period.split('-').map(Number);

  // Fetch OT policy to get threshold_hours, ot_hours_ytd, isMPE flag
  const otPolicies = await getOTPoliciesByContract(contractId);
  const otPolicy = otPolicies[0] ?? null;
  if (!otPolicy || !otPolicy.use_legal_defaults) {
    // No legal-defaults policy: skip Phase 2 enhancement, return base
    return baseResult;
  }

  const firstDay = `${period}-01`;
  const lastDay = new Date(year, month, 0).toISOString().split('T')[0];

  const [rawTimeEntries, mileageTrips, travelAllowances, leaves, taxRates] = await Promise.all([
    getTimeEntriesByContract(null as any, contractId, firstDay, lastDay),
    getMileageTrips(null as any, firstDay, lastDay, contractId),
    fetchTravelAllowances(contractId, period),
    getLeaves(contractId, firstDay, lastDay),
    fetchTaxRates(new Date().getFullYear()),
  ]);

  const otEntries = buildOtDayEntries(rawTimeEntries, otPolicy.threshold_hours);
  const baseHourlyCents = otPolicy.threshold_hours > 0
    ? Math.round(baseResult.gross_cents / (otPolicy.threshold_hours * 4.33 * 60))
    : 0;
  const irsRateFraction = baseResult.gross_cents > 0
    ? baseResult.irs_cents / baseResult.gross_cents
    : 0;

  const otResult   = calcOtScaled(otEntries, baseHourlyCents, otPolicy.ot_hours_ytd ?? 0,
                       taxRates.otRates, taxRates.otLimits,
                       (otPolicy as any).isMPE ?? true); // TODO(12b): add isMPE column to payroll_ot_policies
  const otIrsCents = calcOtIrsWithholding(otResult.otPayCents, irsRateFraction,
                       taxRates.otIrsWithholding.autonomous_rate_of_base);
  const mileage    = calcMileageCap(
                       (mileageTrips ?? []).map(t => ({ km: t.km, rateCentsPerKm: t.rate_cents_per_km ?? 40 })),
                       taxRates.mileageCaps.cents_per_km);
  const allowances = travelAllowances.map(a => calcTravelAllowance(
                       { type: a.type, days: a.days ?? 1, km: a.km ?? undefined, role: a.role, declaredCents: a.declared_cents },
                       taxRates.travelCaps, taxRates.mileageCaps.cents_per_km));
  const grossDailyCents = baseResult.working_days > 0
    ? Math.round(baseResult.gross_cents / baseResult.working_days)
    : 0;
  const leaveImpact = calcLeaveImpact(
                       (leaves ?? []).map(l => ({
                         leaveType: l.leave_type as any,
                         totalDays: l.total_days,
                         employerDays: (l as any).employer_days ?? 3,
                         affectsSubsidy: (l as any).affects_subsidy ?? false,
                       })),
                       grossDailyCents);

  return mergeComponents(baseResult, otResult, otIrsCents, mileage, allowances, leaveImpact);
};
```

Note: You must also add `getLeaves` to the payrollService if it doesn't exist. Check: `grep -n "getLeaves\|payroll_leaves" src/features/payroll/services/payrollService.ts`. If missing, add:

```typescript
export async function getLeaves(contractId: string, startDate: string, endDate: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('payroll_leaves')
    .select('*')
    .eq('contract_id', contractId)
    .gte('start_date', startDate)
    .lte('end_date', endDate);
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 3: Check TypeScript compilation**

```bash
npx tsc --noEmit 2>&1 | grep -E "payrollAdvanced|payrollService" | head -10
```

Expected: no errors in these files

- [ ] **Step 4: Commit**

```bash
git add src/features/payroll/services/payrollAdvanced.service.ts src/features/payroll/services/payrollService.ts
git commit -m "feat(service): two-phase calculatePayslip + travel allowance CRUD + fetchTaxRates"
```

---

## Task 7: Service Tests

**Files:**
- Create: `src/features/payroll/services/__tests__/payrollAdvancedService.test.ts`

- [ ] **Step 1: Write the tests**

```typescript
// src/features/payroll/services/__tests__/payrollAdvancedService.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { fetchTaxRates, _clearTaxRateCache, fetchTravelAllowances, saveTravelAllowance, deleteTravelAllowance, updateOtYtd } from '../payrollAdvanced.service';

// Mock Supabase
vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '../../../../lib/supabaseClient';

const TAX_ROWS = [
  { type: 'ot_rates',          data: { up_to_100h: { first_hour_pct: 0.25, next_hours_pct: 0.375, rest_day_pct: 0.50 }, above_100h: { first_hour_pct: 0.50, next_hours_pct: 0.75, rest_day_pct: 1.00 }, night_work_pct: 0.25, night_start: '22:00', night_end: '07:00' } },
  { type: 'ot_annual_limits',  data: { mpe_hours: 175, others_hours: 150, irct_max_hours: 200, daily_max_hours: 2 } },
  { type: 'ot_irs_withholding',data: { autonomous_rate_of_base: 0.50, since: '2025-01-01' } },
  { type: 'mileage_caps',      data: { cents_per_km: 40 } },
  { type: 'travel_allowance_caps', data: { national_general_cents: 6589, national_admin_cents: 7265, foreign_general_cents: 15636, foreign_admin_cents: 17542, breakdown: { lunch: 0.25, dinner: 0.25, sleep: 0.50 } } },
];

function mockFrom(returnData: any, returnError: any = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
  };
  // Default terminal: resolves from order/eq/etc.
  chain.order.mockResolvedValue({ data: returnData, error: returnError });
  chain.eq.mockResolvedValue({ data: returnData, error: returnError });
  chain.select.mockResolvedValue({ data: returnData, error: returnError });
  (supabase.from as any).mockReturnValue(chain);
  return chain;
}

describe('fetchTaxRates', () => {
  beforeEach(() => _clearTaxRateCache());
  afterEach(() => vi.clearAllMocks());

  it('returns correct rates from DB', async () => {
    mockFrom(TAX_ROWS);
    const rates = await fetchTaxRates(2026);
    expect(rates.otRates.up_to_100h.first_hour_pct).toBe(0.25);
    expect(rates.mileageCaps.cents_per_km).toBe(40);
    expect(rates.travelCaps.national_general_cents).toBe(6589);
  });

  it('caches results — only one DB call on second fetch', async () => {
    mockFrom(TAX_ROWS);
    await fetchTaxRates(2026);
    await fetchTaxRates(2026);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
});

describe('saveTravelAllowance', () => {
  afterEach(() => vi.clearAllMocks());

  it('inserts into payroll_travel_allowances', async () => {
    const inserted = { id: 'id-1', contract_id: 'c1', type: 'deslocacao_nacional', date_start: '2026-01-10', days: 2, km: null, role: 'general', declared_cents: 13178, taxable_excess_cents: 0, operation_id: 'op-1', created_at: '' };
    const chain = mockFrom(inserted);
    const result = await saveTravelAllowance({
      contract_id: 'c1', type: 'deslocacao_nacional', date_start: '2026-01-10',
      days: 2, role: 'general', declared_cents: 13178, taxable_excess_cents: 0, operation_id: 'op-1',
    });
    expect(supabase.from).toHaveBeenCalledWith('payroll_travel_allowances');
    expect(result.id).toBe('id-1');
  });
});

describe('deleteTravelAllowance', () => {
  afterEach(() => vi.clearAllMocks());

  it('calls DELETE with correct id', async () => {
    const chain = mockFrom(null);
    await deleteTravelAllowance('id-1');
    expect(supabase.from).toHaveBeenCalledWith('payroll_travel_allowances');
    expect(chain.delete).toHaveBeenCalled();
  });
});

describe('updateOtYtd', () => {
  afterEach(() => vi.clearAllMocks());

  it('updates ot_hours_ytd on payroll_ot_policies', async () => {
    const chain = mockFrom(null);
    await updateOtYtd('c1', 52.5);
    expect(supabase.from).toHaveBeenCalledWith('payroll_ot_policies');
    expect(chain.update).toHaveBeenCalledWith({ ot_hours_ytd: 52.5 });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/features/payroll/services/__tests__/payrollAdvancedService.test.ts --reporter=verbose
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/payroll/services/__tests__/payrollAdvancedService.test.ts
git commit -m "test(service): payrollAdvancedService tests — tax cache, CRUD, OT YTD"
```

---

## Task 8: Hooks

**Files:**
- Create: `src/features/payroll/hooks/useTravelAllowances.ts`
- Create: `src/features/payroll/hooks/useAdvancedPayslipInputs.ts`

- [ ] **Step 1: Create `useTravelAllowances.ts`**

```typescript
// src/features/payroll/hooks/useTravelAllowances.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTravelAllowances, saveTravelAllowance, deleteTravelAllowance } from '../services/payrollAdvanced.service';
import type { TravelAllowanceInput, TravelAllowanceRecord } from '../types/payroll-advanced.types';

export function useTravelAllowances(contractId: string | null, period: string) {
  const qc = useQueryClient();
  const key = ['travel-allowances', contractId, period] as const;

  const query = useQuery<TravelAllowanceRecord[], Error>({
    queryKey: key,
    queryFn: () => fetchTravelAllowances(contractId!, period),
    enabled: !!contractId,
    staleTime: 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['payslip-calculation', contractId, period] });
  };

  const save = useMutation<TravelAllowanceRecord, Error, TravelAllowanceInput>({
    mutationFn: saveTravelAllowance,
    onSuccess: invalidate,
  });

  const remove = useMutation<void, Error, string>({
    mutationFn: deleteTravelAllowance,
    onSuccess: invalidate,
  });

  return {
    allowances: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    save,
    remove,
  };
}
```

- [ ] **Step 2: Create `useAdvancedPayslipInputs.ts`**

```typescript
// src/features/payroll/hooks/useAdvancedPayslipInputs.ts
/**
 * Aggregates all advanced payslip inputs (OT, mileage, allowances, leaves)
 * and invalidates ['payslip-calculation', contractId, period] after any mutation.
 *
 * This hook is a thin coordinator — actual data fetching is done by the
 * two-phase calculatePayslip orchestrator in payrollService.ts.
 * Components that need to trigger a payslip recalculation should import this
 * hook and call the relevant mutate methods.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useTravelAllowances } from './useTravelAllowances';

export function useAdvancedPayslipInputs(contractId: string | null, period: string) {
  const qc = useQueryClient();
  const travelAllowances = useTravelAllowances(contractId, period);

  /** Call after any mutation that should trigger payslip recalculation */
  const invalidatePayslip = () => {
    qc.invalidateQueries({ queryKey: ['payslip-calculation', contractId, period] });
  };

  return {
    travelAllowances,
    invalidatePayslip,
  };
}
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
npx tsc --noEmit 2>&1 | grep -E "useTravelAllowances|useAdvancedPayslip" | head -5
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/features/payroll/hooks/useTravelAllowances.ts src/features/payroll/hooks/useAdvancedPayslipInputs.ts
git commit -m "feat(hooks): add useTravelAllowances + useAdvancedPayslipInputs (Unit 12a)"
```

---

## Task 9: TravelAllowancesPage + nav + route

**Files:**
- Create: `src/features/payroll/pages/TravelAllowancesPage.tsx`
- Create: `src/features/payroll/components/__tests__/TravelAllowancesPage.test.tsx`
- Modify: `src/features/payroll/components/PayrollNavigation.tsx`
- Modify: `src/features/payroll/components/PayrollModule.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/payroll/components/__tests__/TravelAllowancesPage.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../hooks/useActiveContract', () => ({
  useActiveContract: () => ({ activeContract: { id: 'c1', name: 'Test' }, loading: false }),
}));
vi.mock('../../services/payrollAdvanced.service', () => ({
  fetchTravelAllowances: vi.fn().mockResolvedValue([]),
  saveTravelAllowance: vi.fn().mockResolvedValue({ id: 'new-id', operation_id: 'op-1' }),
  deleteTravelAllowance: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const { saveTravelAllowance } = await import('../../services/payrollAdvanced.service');

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {children}
    </QueryClientProvider>
  );
}

async function renderPage() {
  const { default: TravelAllowancesPage } = await import('../../pages/TravelAllowancesPage');
  return render(<TravelAllowancesPage />, { wrapper });
}

describe('TravelAllowancesPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders form with type selector', async () => {
    await renderPage();
    expect(screen.getByText(/ajudas de custo/i)).toBeInTheDocument();
    // Type select should be present
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows real-time exempt/taxable split when value is entered', async () => {
    await renderPage();
    // Enter declared amount for national allowance: 3 days × €65,89 = €197,67
    const amountInput = screen.getByLabelText(/valor declarado/i);
    fireEvent.change(amountInput, { target: { value: '197.67' } });
    await waitFor(() => {
      expect(screen.getByText(/isento/i)).toBeInTheDocument();
    });
  });

  it('calls saveTravelAllowance on form submit', async () => {
    await renderPage();
    // Fill minimum required fields and submit
    const submitBtn = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(saveTravelAllowance).toHaveBeenCalled();
    });
  });

  it('invalidates payslip-calculation query after save', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { default: TravelAllowancesPage } = await import('../../pages/TravelAllowancesPage');
    render(<TravelAllowancesPage />, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      ),
    });
    const submitBtn = screen.getByRole('button', { name: /guardar/i });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: expect.arrayContaining(['payslip-calculation']) })
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/features/payroll/components/__tests__/TravelAllowancesPage.test.tsx 2>&1 | grep "FAIL\|Cannot find module"
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `TravelAllowancesPage.tsx`**

```typescript
// src/features/payroll/pages/TravelAllowancesPage.tsx
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useActiveContract } from '../hooks/useActiveContract';
import { useTravelAllowances } from '../hooks/useTravelAllowances';
import { calcTravelAllowance } from '../lib/calc';
import { formatCurrency } from '@/lib/utils';
import type { TravelAllowanceRecord } from '../types/payroll-advanced.types';

// 2026 caps — loaded from DB in production; hardcoded here for client-side preview
const CAPS_2026 = {
  national_general_cents: 6589, national_admin_cents: 7265,
  foreign_general_cents: 15636, foreign_admin_cents: 17542,
  breakdown: { lunch: 0.25, dinner: 0.25, sleep: 0.50 },
} as const;

type AllowanceType = 'deslocacao_nacional' | 'deslocacao_estrangeiro' | 'deslocacao_viatura_propria' | 'alojamento';

const TYPE_LABELS: Record<AllowanceType, string> = {
  deslocacao_nacional:       'Deslocação Nacional',
  deslocacao_estrangeiro:    'Deslocação Estrangeiro',
  deslocacao_viatura_propria:'Viatura Própria (km)',
  alojamento:                'Alojamento',
};

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function TravelAllowancesPage() {
  const { toast } = useToast();
  const { activeContract } = useActiveContract();
  const period = currentPeriod();
  const { allowances, save, remove } = useTravelAllowances(activeContract?.id ?? null, period);

  const [type, setType] = useState<AllowanceType>('deslocacao_nacional');
  const [role, setRole] = useState<'general' | 'admin'>('general');
  const [dateStart, setDateStart] = useState('');
  const [days, setDays] = useState('');
  const [km, setKm] = useState('');
  const [declaredEuros, setDeclaredEuros] = useState('');

  const declaredCents = Math.round(parseFloat(declaredEuros || '0') * 100);
  const daysNum = parseFloat(days || '1');
  const kmNum = parseFloat(km || '0');

  const preview = useMemo(() => {
    if (declaredCents <= 0) return null;
    return calcTravelAllowance(
      { type, days: daysNum, km: type === 'deslocacao_viatura_propria' ? kmNum : undefined, role, declaredCents },
      CAPS_2026, 40,
    );
  }, [type, role, daysNum, kmNum, declaredCents]);

  const handleSave = async () => {
    if (!activeContract?.id) return;
    try {
      await save.mutateAsync({
        contract_id:          activeContract.id,
        type,
        date_start:           dateStart,
        days:                 type !== 'deslocacao_viatura_propria' ? daysNum : undefined,
        km:                   type === 'deslocacao_viatura_propria' ? kmNum : undefined,
        role,
        declared_cents:       declaredCents,
        taxable_excess_cents: preview?.taxableExcessCents ?? 0,
        operation_id:         `${activeContract.id}-${Date.now()}`,
      });
      toast({ title: 'Guardado', description: 'Ajuda de custo registada.' });
      setDeclaredEuros(''); setDays(''); setKm('');
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Ajudas de Custo</h1>

      <Card>
        <CardHeader><CardTitle>Registar ajuda de custo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as AllowanceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TYPE_LABELS) as [AllowanceType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Perfil</Label>
              <Select value={role} onValueChange={(v) => setRole(v as 'general' | 'admin')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Geral</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Data início</Label>
              <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} />
            </div>

            {type !== 'deslocacao_viatura_propria' ? (
              <div className="space-y-1">
                <Label>Dias</Label>
                <Input type="number" step="0.5" min="0.5" value={days} onChange={e => setDays(e.target.value)} placeholder="ex: 3" />
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Quilómetros</Label>
                <Input type="number" step="1" min="1" value={km} onChange={e => setKm(e.target.value)} placeholder="ex: 150" />
              </div>
            )}

            <div className="space-y-1 col-span-2">
              <Label htmlFor="valor-declarado">Valor declarado (€)</Label>
              <Input id="valor-declarado" type="number" step="0.01" value={declaredEuros} onChange={e => setDeclaredEuros(e.target.value)} placeholder="ex: 197.67" />
            </div>
          </div>

          {preview && (
            <div className="flex gap-4 p-3 bg-muted rounded-md text-sm">
              <span>Isento: <strong>{formatCurrency(preview.exemptCents / 100)}</strong></span>
              <span>Tributável: <strong>{formatCurrency(preview.taxableExcessCents / 100)}</strong></span>
            </div>
          )}

          <Button onClick={handleSave} disabled={save.isPending}>Guardar</Button>
        </CardContent>
      </Card>

      {allowances.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Ajudas do mês</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Tipo</th>
                  <th className="text-left py-2">Data</th>
                  <th className="text-right py-2">Declarado</th>
                  <th className="text-right py-2">Isento</th>
                  <th className="text-right py-2">Tributável</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {allowances.map((a: TravelAllowanceRecord) => (
                  <tr key={a.id} className="border-b">
                    <td className="py-2">{TYPE_LABELS[a.type as AllowanceType]}</td>
                    <td className="py-2">{a.date_start}</td>
                    <td className="text-right py-2">{formatCurrency(a.declared_cents / 100)}</td>
                    <td className="text-right py-2">{formatCurrency((a.declared_cents - a.taxable_excess_cents) / 100)}</td>
                    <td className="text-right py-2">
                      {a.taxable_excess_cents > 0 && (
                        <Badge variant="destructive">{formatCurrency(a.taxable_excess_cents / 100)}</Badge>
                      )}
                    </td>
                    <td className="py-2">
                      <Button variant="ghost" size="sm" onClick={() => remove.mutate(a.id)}>×</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add nav item to `PayrollNavigation.tsx`**

Add `Receipt` to the lucide-react import (it's already imported on the `unit-11-payroll-core` branch). Then add to the `navItems` array, after the Recibos item:

```typescript
{
  path: '/app/payroll/ajudas-custo',
  label: 'Ajudas Custo',
  icon: Receipt,
  description: 'Ajudas de custo e deslocações',
  isNew: true,
},
```

- [ ] **Step 5: Add route to `PayrollModule.tsx`**

Add import at the top:
```typescript
const TravelAllowancesPage = lazy(() => import('../pages/TravelAllowancesPage'));
```

Add inside `<Routes>`:
```typescript
<Route path="ajudas-custo" element={
  <Suspense fallback={<LoadingSpinner size="lg" />}>
    <TravelAllowancesPage />
  </Suspense>
} />
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/features/payroll/components/__tests__/TravelAllowancesPage.test.tsx --reporter=verbose
```

Expected: PASS (or fix any test assertion mismatches — the page renders, save is called, invalidation happens)

- [ ] **Step 7: Commit**

```bash
git add src/features/payroll/pages/TravelAllowancesPage.tsx \
        src/features/payroll/components/__tests__/TravelAllowancesPage.test.tsx \
        src/features/payroll/components/PayrollNavigation.tsx \
        src/features/payroll/components/PayrollModule.tsx
git commit -m "feat(ui): add TravelAllowancesPage + nav item + route (Unit 12a)"
```

---

## Task 10: PayrollMileagePage — fiscal split

**Files:**
- Modify: `src/features/payroll/pages/PayrollMileagePage.tsx`

The existing page shows a list of trips. Add an "Isento / Tributável" column using `calcMileageCap` on each trip's `rate_cents_per_km`.

- [ ] **Step 1: Add fiscal split computation to the trips table**

Find the section where trips are rendered in a table/list. Import `calcMileageCap` from `../lib/calc`. For each trip, compute the split:

```typescript
// Add import at the top of PayrollMileagePage.tsx
import { calcMileageCap } from '../lib/calc';

// Inside the trip render, compute per-trip split:
const tripSplit = (trip: PayrollMileageTrip) => {
  const ratePerKm = (trip as any).rate_cents_per_km ?? 40;
  return calcMileageCap([{ km: trip.km, rateCentsPerKm: ratePerKm }], 40);
};
```

- [ ] **Step 2: Add "Isento / Tributável" column to trips table**

In the table header row, add:
```tsx
<th className="text-right">Isento</th>
<th className="text-right">Tributável</th>
```

In each trip row, add:
```tsx
{(() => {
  const { exemptCents, taxableCents } = tripSplit(trip);
  return (
    <>
      <td className="text-right text-sm">{formatCurrency(exemptCents / 100)}</td>
      <td className="text-right text-sm">
        {taxableCents > 0
          ? <Badge variant="destructive">{formatCurrency(taxableCents / 100)}</Badge>
          : <span className="text-muted-foreground">—</span>}
      </td>
    </>
  );
})()}
```

- [ ] **Step 3: Add summary card for total exempt / taxable**

Below the trips table (or in a summary section):
```tsx
{trips.length > 0 && (() => {
  const totalSplit = calcMileageCap(
    trips.map(t => ({ km: t.km, rateCentsPerKm: (t as any).rate_cents_per_km ?? 40 })),
    40,
  );
  return (
    <div className="flex gap-6 p-3 bg-muted rounded-md text-sm mt-2">
      <span>Total isento: <strong>{formatCurrency(totalSplit.exemptCents / 100)}</strong></span>
      <span>Total tributável: <strong>{formatCurrency(totalSplit.taxableCents / 100)}</strong></span>
    </div>
  );
})()}
```

- [ ] **Step 4: If `use_tax_table_rate = true`, disable rate field in policy form**

Find `PayrollMileagePolicyForm` usage in `PayrollMileagePage`. If the active policy has `use_tax_table_rate: true` (check `policy.use_tax_table_rate`), add a tooltip to the rate input:

```tsx
{policy?.use_tax_table_rate && (
  <p className="text-xs text-muted-foreground mt-1">Cap AT 2026: €0,40/km (automático)</p>
)}
```

- [ ] **Step 5: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | grep "PayrollMileagePage" | head -5
```

- [ ] **Step 6: Commit**

```bash
git add src/features/payroll/pages/PayrollMileagePage.tsx
git commit -m "feat(ui): show isento/tributável split on mileage page (Unit 12a)"
```

---

## Task 11: PayrollOvertimeDetailPage — duas escalas

**Files:**
- Modify: `src/features/payroll/pages/PayrollOvertimeDetailPage.tsx`

The page currently shows OT by type. Add escala (scale 1/2) and IRS autónomo columns.

- [ ] **Step 1: Add imports**

```typescript
import { buildOtDayEntries, calcOtScaled, calcOtIrsWithholding } from '../lib/calc';
import { fetchTaxRates } from '../services/payrollAdvanced.service';
```

- [ ] **Step 2: Compute scaled OT in the load function**

In the data loading effect (after fetching `timesheetEntries`), add a computation block:

```typescript
// After loading overtimeData, compute scaled OT if policy has use_legal_defaults
const otPolicy = /* existing OT policy from state */;
if (otPolicy?.use_legal_defaults) {
  const taxRates = await fetchTaxRates(selectedYear);
  const otEntries = buildOtDayEntries(timesheetEntries, otPolicy.threshold_hours ?? 8);
  const scaledResult = calcOtScaled(
    otEntries,
    Math.round((contract?.base_salary_cents ?? 0) / (otPolicy.threshold_hours * 4.33 * 60)),
    otPolicy.ot_hours_ytd ?? 0,
    taxRates.otRates,
    taxRates.otLimits,
    true, // isMPE — use true as default; can be made configurable later
  );
  setScaledOtResult(scaledResult); // new state variable
  const irsRate = /* from contract IRS config or 0 */;
  setOtIrsCents(calcOtIrsWithholding(scaledResult.otPayCents, irsRate,
    taxRates.otIrsWithholding.autonomous_rate_of_base));
}
```

Add state variables:
```typescript
const [scaledOtResult, setScaledOtResult] = useState<OtScaledResult | null>(null);
const [otIrsCents, setOtIrsCents] = useState(0);
```

- [ ] **Step 3: Add scaled OT table**

After the existing OT breakdown display, add:

```tsx
{scaledOtResult && (
  <Card className="mt-4">
    <CardHeader>
      <CardTitle>Motor Fiscal PT — OT por Escala</CardTitle>
    </CardHeader>
    <CardContent>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="text-left py-2">Data</th>
            <th className="text-right py-2">Escala</th>
            <th className="text-right py-2">Valor Bruto</th>
          </tr>
        </thead>
        <tbody>
          {scaledOtResult.components.map((c, i) => {
            // calcOtScaled encodes 'E2' in labels when ytd crosses 100h
            const isScale2 = c.label.includes('E2');
            return (
              <tr key={i} className="border-b">
                <td className="py-2">{c.label}</td>
                <td className="text-right py-2">
                  <Badge variant={isScale2 ? 'destructive' : 'secondary'}>
                    {isScale2 ? 'Escala 2' : 'Escala 1'}
                  </Badge>
                </td>
                <td className="text-right py-2">{formatCurrency(c.amount_cents / 100)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 p-3 bg-muted rounded text-sm space-y-1">
        <p>Total OT: <strong>{formatCurrency(scaledOtResult.otPayCents / 100)}</strong></p>
        <p>IRS autónomo: <strong>{formatCurrency(otIrsCents / 100)}</strong>
          <span className="text-muted-foreground ml-2 text-xs">(50% × taxa IRS base)</span></p>
        <p>Líquido OT: <strong>{formatCurrency((scaledOtResult.otPayCents - otIrsCents) / 100)}</strong></p>
        {scaledOtResult.annualLimitWarning && (
          <p className="text-amber-600">⚠️ A aproximar-se do limite anual de horas extra</p>
        )}
        {scaledOtResult.annualLimitExceeded && (
          <p className="text-red-600">🚨 Limite anual de horas extra excedido</p>
        )}
      </div>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "PayrollOvertimeDetailPage" | head -5
```

- [ ] **Step 5: Commit**

```bash
git add src/features/payroll/pages/PayrollOvertimeDetailPage.tsx
git commit -m "feat(ui): add two-scale OT panel with IRS autónomo to overtime page (Unit 12a)"
```

---

## Task 12: PayrollVacationCalendarPage — employer_days + affects_subsidy

**Files:**
- Modify: `src/features/payroll/pages/PayrollVacationCalendarPage.tsx`

The page uses a leave registration form (if it exists) or adds a new one. Look for where leaves are recorded; if there's a separate leave form, add the new fields there.

- [ ] **Step 1: Check current leave registration form**

```bash
grep -n "employer_days\|affects_subsidy\|leave_type" src/features/payroll/pages/PayrollVacationCalendarPage.tsx | head -10
```

If neither field exists, proceed with step 2.

- [ ] **Step 2: Add `employer_days` field (for sick leave)**

In the leave creation/edit form, add:

```tsx
{/* employer_days — only for sick leave */}
{leaveType === 'sick' && (
  <div className="space-y-1">
    <Label>Dias a cargo do empregador</Label>
    <Input
      type="number" min="0" max="30"
      value={employerDays}
      onChange={e => setEmployerDays(parseInt(e.target.value, 10))}
      defaultValue={3}
    />
    <p className="text-xs text-muted-foreground">
      Default: 3 dias. A partir do dia {employerDays + 1}, a SS paga.
    </p>
  </div>
)}
```

Add state: `const [employerDays, setEmployerDays] = useState(3);`

- [ ] **Step 3: Add `affects_subsidy` checkbox (for vacation)**

```tsx
{/* affects_subsidy — only for vacation */}
{leaveType === 'vacation' && (
  <div className="flex items-center gap-2">
    <input
      type="checkbox" id="affects-subsidy"
      checked={affectsSubsidy}
      onChange={e => setAffectsSubsidy(e.target.checked)}
    />
    <Label htmlFor="affects-subsidy">Reduz subsídio de férias pro-rata</Label>
  </div>
)}
```

Add state: `const [affectsSubsidy, setAffectsSubsidy] = useState(false);`

- [ ] **Step 4: Pass new fields when saving**

In the save call (wherever `payrollService.createLeave` or equivalent is called), include:

```typescript
{ ..., employer_days: employerDays, affects_subsidy: affectsSubsidy }
```

- [ ] **Step 5: Show fiscal impact in leave list**

In the leave list, for each leave, call `calcLeaveImpact` to show estimated impact:

```tsx
import { calcLeaveImpact } from '../lib/calc';

// In leave list row:
{(() => {
  const impact = calcLeaveImpact([{
    leaveType: leave.leave_type as any,
    totalDays: leave.total_days,
    employerDays: (leave as any).employer_days ?? 3,
    affectsSubsidy: (leave as any).affects_subsidy ?? false,
  }], /* grossDailyCents from contract */ 0);
  if (impact.unpaidDeductionCents > 0) {
    return <Badge variant="destructive">-{formatCurrency(impact.unpaidDeductionCents / 100)}</Badge>;
  }
  return <Badge variant="secondary">Sem impacto</Badge>;
})()}
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "PayrollVacationCalendarPage" | head -5
```

- [ ] **Step 7: Commit**

```bash
git add src/features/payroll/pages/PayrollVacationCalendarPage.tsx
git commit -m "feat(ui): add employer_days + affects_subsidy fields to leave form (Unit 12a)"
```

---

## Task 13: WeeklyTimesheetForm — OT YTD tracker panel

**Files:**
- Modify: `src/features/payroll/components/WeeklyTimesheetForm.tsx`

The existing form shows a weekly grid. Add an OT tracker panel below the grid.

- [ ] **Step 1: Check where the timesheet grid ends**

```bash
grep -n "ytd\|tracker\|YTD\|ot_hours" src/features/payroll/components/WeeklyTimesheetForm.tsx | head -10
```

- [ ] **Step 2: Import required utilities**

Add to imports in `WeeklyTimesheetForm.tsx`:

```typescript
import { calcOtScaled, buildOtDayEntries } from '../lib/calc';
import { fetchTaxRates } from '../services/payrollAdvanced.service';
```

- [ ] **Step 3: Add state and effect for OT stats**

```typescript
import type { OtScaledResult } from '../types/payroll-advanced.types';

const [otStats, setOtStats] = useState<OtScaledResult | null>(null);
const [otYtdLimit, setOtYtdLimit] = useState<{ annual: number; ytdBefore: number }>({ annual: 150, ytdBefore: 0 });

// Effect: recalculate whenever entries change
useEffect(() => {
  if (!otPolicy?.use_legal_defaults || entries.length === 0) {
    setOtStats(null);
    return;
  }
  fetchTaxRates(new Date().getFullYear()).then(taxRates => {
    const otEntries = buildOtDayEntries(entries, otPolicy.threshold_hours ?? 8);
    const baseHourlyCents = Math.round(
      (activeContract?.base_salary_cents ?? 0) / ((otPolicy.threshold_hours ?? 8) * 4.33 * 60)
    );
    const result = calcOtScaled(
      otEntries, baseHourlyCents, otPolicy.ot_hours_ytd ?? 0,
      taxRates.otRates, taxRates.otLimits, true,
    );
    setOtStats(result);
    setOtYtdLimit({ annual: taxRates.otLimits.mpe_hours, ytdBefore: otPolicy.ot_hours_ytd ?? 0 });
  }).catch(() => {}); // fail silently if tax_tables not yet seeded
}, [entries, otPolicy]);
```

- [ ] **Step 4: Render the OT tracker panel**

Below the weekly grid (before the save button), add:

```tsx
{otStats && (
  <div className="mt-4 p-4 border rounded-lg space-y-3">
    <h3 className="font-medium text-sm">OT — Tracker Anual</h3>

    {/* Scale transition bar (0 → 100h) */}
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>Escala 1→2 (100h)</span>
        <span>{Math.min(otStats.newYtdHours, 100).toFixed(1)}h / 100h</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${otStats.newYtdHours >= 100 ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${Math.min((otStats.newYtdHours / 100) * 100, 100)}%` }}
        />
      </div>
    </div>

    {/* Annual limit bar */}
    <div>
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>Limite anual ({otYtdLimit.annual}h)</span>
        <span>{otStats.newYtdHours.toFixed(1)}h / {otYtdLimit.annual}h</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            otStats.annualLimitExceeded ? 'bg-destructive'
            : otStats.annualLimitWarning  ? 'bg-amber-500'
            : 'bg-primary'
          }`}
          style={{ width: `${Math.min((otStats.newYtdHours / otYtdLimit.annual) * 100, 100)}%` }}
        />
      </div>
    </div>

    {otStats.dailyLimitWarning && (
      <p className="text-xs text-amber-600">⚠️ OT diária excede 2h em alguns dias desta semana</p>
    )}
    {otStats.annualLimitWarning && (
      <p className="text-xs text-amber-600">⚠️ A aproximar-se do limite anual</p>
    )}
    {otStats.annualLimitExceeded && (
      <p className="text-xs text-red-600 font-medium">🚨 Limite anual de horas extra excedido</p>
    )}

    <p className="text-xs text-muted-foreground">
      Este mês: {otStats.otHoursThisMonth.toFixed(1)}h OT
    </p>
  </div>
)}
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "WeeklyTimesheetForm" | head -5
```

- [ ] **Step 6: Commit**

```bash
git add src/features/payroll/components/WeeklyTimesheetForm.tsx
git commit -m "feat(ui): add OT YTD tracker panel to WeeklyTimesheetForm (Unit 12a)"
```

---

## Task 14: Final Validation

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run --reporter=verbose 2>&1 | tail -15
```

Expected: no NEW failures compared to baseline (10 pre-existing failures on the branch are acceptable)

- [ ] **Step 2: Check TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: build completes without errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Unit 12a final cleanup — TypeScript + build verified"
```

- [ ] **Step 5: Use superpowers:finishing-a-development-branch**

Follow the finishing-a-development-branch skill to present options (merge locally, create PR, keep branch, discard).
