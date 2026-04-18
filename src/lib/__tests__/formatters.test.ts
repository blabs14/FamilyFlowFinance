import { describe, expect, it } from 'vitest';

import { formatCurrency } from '../utils';

describe('formatCurrency', () => {
  it('formats an integer euro value', () => {
    expect(formatCurrency(1000)).toMatch(/1(?:[.\s\u00A0\u202F])?000,00\s*€/);
  });

  it('formats a decimal value', () => {
    expect(formatCurrency(1234.56)).toMatch(/1(?:[.\s\u00A0\u202F])?234,56\s*€/);
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toMatch(/0,00\s*€/);
  });

  it('formats negative values', () => {
    expect(formatCurrency(-50)).toMatch(/-.*50,00\s*€/);
  });

  it('supports custom locale and currency', () => {
    expect(formatCurrency(25, 'en-US', 'USD')).toBe('$25.00');
  });
});
