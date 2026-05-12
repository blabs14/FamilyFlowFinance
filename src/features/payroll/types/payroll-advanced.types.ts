// src/features/payroll/types/payroll-advanced.types.ts
// Unit 12a — Motor Fiscal PT type definitions

// ── OT Rates (Lei 13/2023) ────────────────────────────────────────────────────

export interface OtScale {
  first_hour_pct: number;   // % premium for first OT hour
  next_hours_pct: number;   // % premium for subsequent OT hours
  rest_day_pct:   number;   // % premium for rest/holiday day OT
}

export interface OtRates {
  up_to_100h:    OtScale;   // Escala 1: YTD OT hours ≤ 100
  above_100h:    OtScale;   // Escala 2: YTD OT hours > 100
  night_work_pct: number;   // Additional % for night OT
  night_start:    string;   // e.g. "22:00"
  night_end:      string;   // e.g. "07:00"
}

export interface OtAnnualLimits {
  mpe_hours:       number;  // MPE (micro/small): 175h
  others_hours:    number;  // Other companies: 150h
  irct_max_hours:  number;  // With IRCT agreement: up to 200h
  daily_max_hours: number;  // Max OT per day: 2h
}

// ── Mileage / Travel Allowance Caps ──────────────────────────────────────────

export interface MileageCaps {
  cents_per_km: number;     // AT cap: 40 cents/km for 2026
}

export interface TravelAllowanceCaps {
  national_general_cents: number;   // €65,89/day for general staff
  national_admin_cents:   number;   // €72,65/day for admin/managers
  foreign_general_cents:  number;   // €156,36/day for general staff abroad
  foreign_admin_cents:    number;   // €175,42/day for admin/managers abroad
  breakdown: {
    lunch:  number;   // fraction of daily rate: 0.25
    dinner: number;   // fraction of daily rate: 0.25
    sleep:  number;   // fraction of daily rate: 0.50
  };
}

// ── OT Computation Inputs ─────────────────────────────────────────────────────

/** One day's worth of OT data, derived from PayrollTimeEntry[] */
export interface OtDayEntry {
  date:          string;   // ISO date "YYYY-MM-DD"
  otMinutes:     number;   // minutes of OT beyond threshold
  isRestDay:     boolean;  // Sunday or public holiday
  nightMinutes:  number;   // OT minutes that fall in 22:00–07:00
}

/** Result of calcOtScaled — the full scaled OT output */
export interface OtScaledResult {
  otPayCents:         number;
  otHoursThisMonth:   number;
  newYtdHours:        number;
  nightBonusCents:    number;
  dailyLimitWarning:  boolean;  // any day exceeded 2h OT
  annualLimitWarning: boolean;  // newYtdHours within 10h of annual limit
  annualLimitExceeded:boolean;  // newYtdHours >= annual limit
  components: {
    label:        string;  // e.g. "OT E1 2026-01-06" or "OT E2 2026-01-06"
    amount_cents: number;
    sign:         '+' | '-';
  }[];
}

// ── Leaves ────────────────────────────────────────────────────────────────────

export interface LeaveRecord {
  leaveType:       'sick' | 'unpaid' | 'maternity' | 'paternity' | 'vacation' | string;
  totalDays:       number;
  employerDays:    number;   // days employer pays (default 3 for sick)
  affectsSubsidy:  boolean;  // true if this vacation reduces subsidy pro-rata
}

export interface LeaveImpact {
  unpaidDeductionCents:    number;
  subsidyAdjustmentCents: number;
  components: {
    label:        string;
    amount_cents: number;
    sign:         '+' | '-';
  }[];
}

// ── Travel Allowances (DB record) ─────────────────────────────────────────────

export type TravelAllowanceType =
  | 'deslocacao_nacional'
  | 'deslocacao_estrangeiro'
  | 'deslocacao_viatura_propria'
  | 'alojamento';

export interface TravelAllowanceRecord {
  id:                   string;
  contract_id:          string;
  type:                 TravelAllowanceType;
  date_start:           string;  // ISO date
  days:                 number | null;
  km:                   number | null;
  role:                 'general' | 'admin';
  declared_cents:       number;
  taxable_excess_cents: number;
  operation_id:         string;
  created_at:           string;
}

export interface TravelAllowanceInput {
  contract_id:          string;
  type:                 TravelAllowanceType;
  date_start:           string;
  days?:                number;
  km?:                  number;
  role:                 'general' | 'admin';
  declared_cents:       number;
  taxable_excess_cents: number;
  operation_id:         string;
}

// ── Aggregated Tax Rates (fetched from tax_tables) ────────────────────────────

export interface OtIrsWithholding {
  autonomous_rate_of_base: number;  // 0.50 — 50% of base IRS rate
  since:                   string;  // "2025-01-01"
}

export interface TaxRates {
  otRates:          OtRates;
  otLimits:         OtAnnualLimits;
  otIrsWithholding: OtIrsWithholding;
  mileageCaps:      MileageCaps;
  travelCaps:       TravelAllowanceCaps;
}
