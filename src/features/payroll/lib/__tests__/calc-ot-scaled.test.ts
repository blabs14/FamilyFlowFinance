import { describe, it, expect } from 'vitest';
import { calcOtScaled } from '../calc';
import type { OtDayEntry, OtRates, OtAnnualLimits } from '../../types/payroll-advanced.types';

const RATES: OtRates = {
  up_to_100h: { first_hour_pct: 0.25, next_hours_pct: 0.375, rest_day_pct: 0.50 },
  above_100h: { first_hour_pct: 0.50, next_hours_pct: 0.75, rest_day_pct: 1.00 },
  night_work_pct: 0.25,
  night_start: '22:00',
  night_end: '07:00',
};

const LIMITS: OtAnnualLimits = {
  mpe_hours: 175,
  others_hours: 150,
  irct_max_hours: 200,
  daily_max_hours: 2,
};

// Base hourly rate: €10/hour = 1000 cents/hour = ~16.67 cents/min
const BASE_CENTS_PER_MIN = Math.round(1000 / 60); // 17

function makeEntry(date: string, otMinutes: number, isRestDay = false, nightMinutes = 0): OtDayEntry {
  return { date, otMinutes, isRestDay, nightMinutes };
}

describe('calcOtScaled', () => {
  it('returns zero pay when no OT entries', () => {
    const r = calcOtScaled([], BASE_CENTS_PER_MIN, 0, RATES, LIMITS, true);
    expect(r.otPayCents).toBe(0);
    expect(r.components).toHaveLength(0);
    expect(r.annualLimitExceeded).toBe(false);
  });

  it('applies E1 first_hour_pct to first 60 min of OT on a regular day', () => {
    const entry = makeEntry('2026-01-05', 60); // exactly 1 hour OT
    const r = calcOtScaled([entry], BASE_CENTS_PER_MIN, 0, RATES, LIMITS, true);
    // First hour: 60 min × 17 c/min × (1 + 0.25) = 60 × 17 × 1.25
    const expected = Math.round(60 * BASE_CENTS_PER_MIN * (1 + RATES.up_to_100h.first_hour_pct));
    expect(r.otPayCents).toBe(expected);
    expect(r.components[0].label).toContain('E1');
  });

  it('applies E1 next_hours_pct for OT beyond first hour', () => {
    const entry = makeEntry('2026-01-05', 90); // 1.5h OT
    const r = calcOtScaled([entry], BASE_CENTS_PER_MIN, 0, RATES, LIMITS, true);
    // First 60 min at 25%, next 30 min at 37.5%
    const firstHour  = Math.round(60 * BASE_CENTS_PER_MIN * (1 + RATES.up_to_100h.first_hour_pct));
    const nextMins   = Math.round(30 * BASE_CENTS_PER_MIN * (1 + RATES.up_to_100h.next_hours_pct));
    expect(r.otPayCents).toBe(firstHour + nextMins);
  });

  it('applies E1 rest_day_pct on holidays', () => {
    const entry = makeEntry('2026-01-01', 60, true); // holiday
    const r = calcOtScaled([entry], BASE_CENTS_PER_MIN, 0, RATES, LIMITS, true);
    const expected = Math.round(60 * BASE_CENTS_PER_MIN * (1 + RATES.up_to_100h.rest_day_pct));
    expect(r.otPayCents).toBe(expected);
  });

  it('switches to E2 rates when ytdHours > 100', () => {
    const entry = makeEntry('2026-07-01', 60);
    // Already at 101h YTD before this month
    const r = calcOtScaled([entry], BASE_CENTS_PER_MIN, 101, RATES, LIMITS, true);
    const expected = Math.round(60 * BASE_CENTS_PER_MIN * (1 + RATES.above_100h.first_hour_pct));
    expect(r.otPayCents).toBe(expected);
    expect(r.components[0].label).toContain('E2');
  });

  it('transitions mid-month: some hours E1, some E2', () => {
    // YTD before = 99h, this month 2h → crosses 100h boundary
    const entry1 = makeEntry('2026-06-01', 60); // goes from 99h to 100h → still E1
    const entry2 = makeEntry('2026-06-02', 60); // goes from 100h to 101h → E2
    const r = calcOtScaled([entry1, entry2], BASE_CENTS_PER_MIN, 99, RATES, LIMITS, true);
    expect(r.components.some(c => c.label.includes('E1'))).toBe(true);
    expect(r.components.some(c => c.label.includes('E2'))).toBe(true);
  });

  it('applies daily limit warning when OT exceeds 2h on any day', () => {
    const entry = makeEntry('2026-01-05', 150); // 2.5h OT
    const r = calcOtScaled([entry], BASE_CENTS_PER_MIN, 0, RATES, LIMITS, true);
    expect(r.dailyLimitWarning).toBe(true);
  });

  it('does NOT set daily limit warning when OT is exactly 2h', () => {
    const entry = makeEntry('2026-01-05', 120); // exactly 2h OT
    const r = calcOtScaled([entry], BASE_CENTS_PER_MIN, 0, RATES, LIMITS, true);
    expect(r.dailyLimitWarning).toBe(false);
  });

  it('sets annual limit warning within 10h of limit', () => {
    // MPE limit = 175h. YTD = 168h, this month = 6h → 174h → within 10h → warning
    const entries = Array.from({ length: 6 }, (_, i) =>
      makeEntry(`2026-11-${String(i + 1).padStart(2, '0')}`, 60),
    );
    const r = calcOtScaled(entries, BASE_CENTS_PER_MIN, 168, RATES, LIMITS, true);
    expect(r.annualLimitWarning).toBe(true);
    expect(r.annualLimitExceeded).toBe(false);
  });

  it('sets annual limit exceeded when total >= limit', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry(`2026-12-${String(i + 1).padStart(2, '0')}`, 60),
    );
    const r = calcOtScaled(entries, BASE_CENTS_PER_MIN, 170, RATES, LIMITS, true);
    expect(r.annualLimitExceeded).toBe(true);
  });

  it('uses others_hours limit when isMPE = false', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry(`2026-12-${String(i + 1).padStart(2, '0')}`, 60),
    );
    // 150h others limit. YTD = 147h → total 152h → exceeded
    const r = calcOtScaled(entries, BASE_CENTS_PER_MIN, 147, RATES, LIMITS, false);
    expect(r.annualLimitExceeded).toBe(true);
  });

  it('encodes E1 in component label for scale 1 hours', () => {
    const entry = makeEntry('2026-01-05', 60);
    const r = calcOtScaled([entry], BASE_CENTS_PER_MIN, 0, RATES, LIMITS, true);
    expect(r.components.every(c => c.label.includes('E1'))).toBe(true);
  });

  it('encodes E2 in component label for scale 2 hours', () => {
    const entry = makeEntry('2026-01-05', 60);
    const r = calcOtScaled([entry], BASE_CENTS_PER_MIN, 101, RATES, LIMITS, true);
    expect(r.components.every(c => c.label.includes('E2'))).toBe(true);
  });
});
