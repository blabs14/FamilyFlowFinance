import { describe, it, expect } from 'vitest';
import {
  calcOtIrsWithholding,
  calcMileageCap,
  calcTravelAllowance,
  calcLeaveImpact,
  mergeComponents,
} from '../calc';
import type {
  OtScaledResult,
  TravelAllowanceCaps,
  LeaveRecord,
} from '../../types/payroll-advanced.types';

// ── Test constants ────────────────────────────────────────────────────────────

const CAPS: TravelAllowanceCaps = {
  national_general_cents: 6589,
  national_admin_cents:   7265,
  foreign_general_cents:  15636,
  foreign_admin_cents:    17542,
  breakdown: { lunch: 0.25, dinner: 0.25, sleep: 0.50 },
};

const MILEAGE_CAP_CENTS = 40; // €0,40/km

// ── calcOtIrsWithholding ──────────────────────────────────────────────────────

describe('calcOtIrsWithholding', () => {
  it('computes 50% of base IRS rate applied to OT pay', () => {
    // OT pay = €100 (10000 cents), base IRS rate = 28% → OT IRS = 10000 × 0.28 × 0.50 = 1400
    expect(calcOtIrsWithholding(10000, 0.28, 0.50)).toBe(1400);
  });

  it('returns 0 when OT pay is 0', () => {
    expect(calcOtIrsWithholding(0, 0.28, 0.50)).toBe(0);
  });

  it('returns 0 when IRS rate is 0', () => {
    expect(calcOtIrsWithholding(10000, 0, 0.50)).toBe(0);
  });

  it('rounds to nearest cent', () => {
    // 1001 × 0.28 × 0.50 = 140.14 → rounds to 140
    expect(calcOtIrsWithholding(1001, 0.28, 0.50)).toBe(140);
  });
});

// ── calcMileageCap ────────────────────────────────────────────────────────────

describe('calcMileageCap', () => {
  it('returns all exempt when rate <= cap', () => {
    const r = calcMileageCap([{ km: 100, rateCentsPerKm: 40 }], 40);
    expect(r.exemptCents).toBe(4000);
    expect(r.taxableCents).toBe(0);
    expect(r.totalCents).toBe(4000);
  });

  it('splits when rate > cap', () => {
    // rate = 50¢/km, cap = 40¢/km → 10¢ taxable per km
    const r = calcMileageCap([{ km: 100, rateCentsPerKm: 50 }], 40);
    expect(r.exemptCents).toBe(4000);
    expect(r.taxableCents).toBe(1000);
    expect(r.totalCents).toBe(5000);
  });

  it('aggregates multiple trips', () => {
    const r = calcMileageCap([
      { km: 50, rateCentsPerKm: 40 },
      { km: 100, rateCentsPerKm: 50 },
    ], 40);
    expect(r.exemptCents).toBe(50 * 40 + 100 * 40);  // 2000 + 4000 = 6000
    expect(r.taxableCents).toBe(100 * 10);             // 1000
  });

  it('returns zeros for empty trip list', () => {
    const r = calcMileageCap([], 40);
    expect(r.exemptCents).toBe(0);
    expect(r.taxableCents).toBe(0);
  });
});

// ── calcTravelAllowance ───────────────────────────────────────────────────────

describe('calcTravelAllowance', () => {
  it('national general: 2 days within cap → all exempt', () => {
    // 2 × 6589 = 13178 cents declared = cap → all exempt
    const r = calcTravelAllowance(
      { type: 'deslocacao_nacional', days: 2, role: 'general', declaredCents: 13178 },
      CAPS, MILEAGE_CAP_CENTS,
    );
    expect(r.exemptCents).toBe(13178);
    expect(r.taxableExcessCents).toBe(0);
  });

  it('national general: declared > cap → excess is taxable', () => {
    // Cap = 2 × 6589 = 13178; declared = 15000 → taxable = 1822
    const r = calcTravelAllowance(
      { type: 'deslocacao_nacional', days: 2, role: 'general', declaredCents: 15000 },
      CAPS, MILEAGE_CAP_CENTS,
    );
    expect(r.exemptCents).toBe(13178);
    expect(r.taxableExcessCents).toBe(15000 - 13178);
  });

  it('national admin: uses admin cap', () => {
    const r = calcTravelAllowance(
      { type: 'deslocacao_nacional', days: 1, role: 'admin', declaredCents: 7265 },
      CAPS, MILEAGE_CAP_CENTS,
    );
    expect(r.exemptCents).toBe(7265);
    expect(r.taxableExcessCents).toBe(0);
  });

  it('foreign general: uses foreign_general cap', () => {
    const r = calcTravelAllowance(
      { type: 'deslocacao_estrangeiro', days: 1, role: 'general', declaredCents: 15636 },
      CAPS, MILEAGE_CAP_CENTS,
    );
    expect(r.exemptCents).toBe(15636);
    expect(r.taxableExcessCents).toBe(0);
  });

  it('alojamento: uses sleep fraction of national_general cap', () => {
    // national_general = 6589, sleep = 0.50 → cap = floor(6589 × 0.50) = 3294 (or round)
    const capAloj = Math.round(CAPS.national_general_cents * CAPS.breakdown.sleep);
    const r = calcTravelAllowance(
      { type: 'alojamento', days: 1, role: 'general', declaredCents: capAloj },
      CAPS, MILEAGE_CAP_CENTS,
    );
    expect(r.exemptCents).toBe(capAloj);
    expect(r.taxableExcessCents).toBe(0);
  });

  it('viatura propria: delegates to calcMileageCap', () => {
    // 100km at 40¢/km = 4000 cents → all exempt
    const r = calcTravelAllowance(
      { type: 'deslocacao_viatura_propria', km: 100, role: 'general', declaredCents: 4000 },
      CAPS, MILEAGE_CAP_CENTS,
    );
    expect(r.exemptCents).toBe(4000);
    expect(r.taxableExcessCents).toBe(0);
  });
});

// ── calcLeaveImpact ───────────────────────────────────────────────────────────

describe('calcLeaveImpact', () => {
  const GROSS_DAILY = 5000; // €50/day

  it('returns zero impact for empty leave list', () => {
    const r = calcLeaveImpact([], GROSS_DAILY);
    expect(r.unpaidDeductionCents).toBe(0);
    expect(r.subsidyAdjustmentCents).toBe(0);
    expect(r.components).toHaveLength(0);
  });

  it('sick leave: adds informational components (no deduction)', () => {
    const leave: LeaveRecord = { leaveType: 'sick', totalDays: 5, employerDays: 3, affectsSubsidy: false };
    const r = calcLeaveImpact([leave], GROSS_DAILY);
    expect(r.unpaidDeductionCents).toBe(0); // sick leave: employer pays days 1–3, SS pays rest
    expect(r.components.some(c => c.label.includes('empregador'))).toBe(true);
    expect(r.components.some(c => c.label.includes('SS'))).toBe(true);
  });

  it('unpaid leave: deducts daily gross × days', () => {
    const leave: LeaveRecord = { leaveType: 'unpaid', totalDays: 2, employerDays: 0, affectsSubsidy: false };
    const r = calcLeaveImpact([leave], GROSS_DAILY);
    expect(r.unpaidDeductionCents).toBe(2 * GROSS_DAILY);
    expect(r.components.some(c => c.sign === '-')).toBe(true);
  });

  it('maternity leave: deducts (employer gross reduction, SS pays)', () => {
    const leave: LeaveRecord = { leaveType: 'maternity', totalDays: 10, employerDays: 0, affectsSubsidy: false };
    const r = calcLeaveImpact([leave], GROSS_DAILY);
    expect(r.unpaidDeductionCents).toBe(10 * GROSS_DAILY);
  });

  it('vacation affecting subsidy: adds to subsidyAdjustmentCents', () => {
    const leave: LeaveRecord = { leaveType: 'vacation', totalDays: 3, employerDays: 0, affectsSubsidy: true };
    const r = calcLeaveImpact([leave], GROSS_DAILY);
    expect(r.subsidyAdjustmentCents).toBe(3 * GROSS_DAILY);
    expect(r.unpaidDeductionCents).toBe(0);
  });
});

// ── mergeComponents ───────────────────────────────────────────────────────────

describe('mergeComponents', () => {
  const base = {
    gross_cents: 100000,
    irs_cents:   20000,
    ss_cents:    11000,
    meal_cents:  8800,
    net_cents:   61000,
    working_days: 22,
    components: [{ label: 'Salário base', amount_cents: 100000, sign: '+' as const }],
  };

  const emptyOt: OtScaledResult = {
    otPayCents: 0, otHoursThisMonth: 0, newYtdHours: 0,
    nightBonusCents: 0, dailyLimitWarning: false,
    annualLimitWarning: false, annualLimitExceeded: false,
    components: [],
  };

  it('returns base unchanged when no extras', () => {
    const r = mergeComponents(base, emptyOt, 0,
      { exemptCents: 0, taxableCents: 0, totalCents: 0 }, [],
      { unpaidDeductionCents: 0, subsidyAdjustmentCents: 0, components: [] });
    expect(r.net_cents).toBe(base.net_cents);
    expect(r.components).toHaveLength(base.components.length);
  });

  it('adds OT pay to net', () => {
    const otResult: OtScaledResult = {
      ...emptyOt,
      otPayCents: 5000,
      components: [{ label: 'OT E1 2026-01-06', amount_cents: 5000, sign: '+' }],
    };
    const r = mergeComponents(base, otResult, 0,
      { exemptCents: 0, taxableCents: 0, totalCents: 0 }, [],
      { unpaidDeductionCents: 0, subsidyAdjustmentCents: 0, components: [] });
    expect(r.net_cents).toBe(base.net_cents + 5000);
    expect(r.components.some(c => c.label === 'OT E1 2026-01-06')).toBe(true);
  });

  it('subtracts IRS OT withholding from net', () => {
    const otResult: OtScaledResult = {
      ...emptyOt,
      otPayCents: 5000,
      components: [{ label: 'OT E1 2026-01-06', amount_cents: 5000, sign: '+' }],
    };
    const r = mergeComponents(base, otResult, 700,
      { exemptCents: 0, taxableCents: 0, totalCents: 0 }, [],
      { unpaidDeductionCents: 0, subsidyAdjustmentCents: 0, components: [] });
    expect(r.net_cents).toBe(base.net_cents + 5000 - 700);
    expect(r.components.some(c => c.label === 'IRS s/ Horas Extra')).toBe(true);
  });

  it('does not mutate the base object', () => {
    mergeComponents(base, emptyOt, 0,
      { exemptCents: 0, taxableCents: 0, totalCents: 0 }, [],
      { unpaidDeductionCents: 0, subsidyAdjustmentCents: 0, components: [] });
    expect(base.net_cents).toBe(61000);
  });
});
