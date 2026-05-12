import { describe, it, expect } from 'vitest';
import {
  formatCents,
  periodLabel,
  currentPeriod,
  availablePeriods,
  enrichComponents,
} from '../payrollCalculator';

describe('formatCents', () => {
  it('formats 92000 cents as Portuguese currency', () => {
    const result = formatCents(92000);
    expect(result).toContain('920');
    expect(result).toContain('€');
  });

  it('formats 0 cents', () => {
    const result = formatCents(0);
    expect(result).toContain('0');
    expect(result).toContain('€');
  });

  it('formats 150000 cents as 1500.00 EUR', () => {
    const result = formatCents(150000);
    expect(result).toContain('1');
    expect(result).toContain('500');
  });

  it('passes through negative values without absolute-value guard (caller must use Math.abs)', () => {
    // formatCents does NOT guard against negatives — callers (e.g. enrichComponents) must pass Math.abs first
    const result = formatCents(-92000);
    expect(result).toContain('920');
  });
});

describe('periodLabel', () => {
  it('converts YYYY-MM to Portuguese month label', () => {
    const result = periodLabel('2026-05');
    expect(result.toLowerCase()).toContain('maio');
    expect(result).toContain('2026');
  });

  it('handles January', () => {
    const result = periodLabel('2026-01');
    expect(result.toLowerCase()).toContain('janeiro');
  });

  it('handles December', () => {
    const result = periodLabel('2026-12');
    expect(result.toLowerCase()).toContain('dezembro');
  });
});

describe('currentPeriod', () => {
  it('returns YYYY-MM format', () => {
    const result = currentPeriod();
    expect(result).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('availablePeriods', () => {
  it('returns monthsBack+1 periods', () => {
    expect(availablePeriods(12)).toHaveLength(13);
  });

  it('first element is current period', () => {
    expect(availablePeriods(12)[0]).toBe(currentPeriod());
  });

  it('periods are in descending order', () => {
    const periods = availablePeriods(3);
    expect(periods[0] >= periods[1]).toBe(true);
    expect(periods[1] >= periods[2]).toBe(true);
  });
});

describe('enrichComponents', () => {
  it('marks deductions correctly', () => {
    const components = [
      { label: 'Salário', amount_cents: 150000, sign: '+' as const },
      { label: 'IRS', amount_cents: 25808, sign: '-' as const },
    ];
    const enriched = enrichComponents(components);
    expect(enriched[0].isDeduction).toBe(false);
    expect(enriched[1].isDeduction).toBe(true);
  });

  it('formats amount_cents as currency string', () => {
    const components = [{ label: 'Salário', amount_cents: 150000, sign: '+' as const }];
    const enriched = enrichComponents(components);
    expect(enriched[0].formatted).toContain('€');
    expect(enriched[0].formatted).toContain('1');
    expect(enriched[0].formatted).toContain('500');
  });
});
