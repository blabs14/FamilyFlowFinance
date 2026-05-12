import { describe, it, expect } from 'vitest';
import { parseCsvGeneric } from '../parsers/csv-generic.ts';

describe('parseCsvGeneric', () => {
  it('parses semicolon-delimited CSV with manual mapping', () => {
    const csv = 'Data;Valor;Desc\n01-01-2025;-25.50;LIDL';
    const rows = parseCsvGeneric(csv, { date: 'Data', amount: 'Valor', description: 'Desc', decimal: '.' });
    expect(rows[0].date).toBe('2025-01-01');
    expect(rows[0].amount_cents).toBe(-2550);
  });

  it('applies debit_sign inversion', () => {
    const csv = 'Data,Valor,Desc\n01-01-2025,25.50,GALP';
    const rows = parseCsvGeneric(csv, { date: 'Data', amount: 'Valor', description: 'Desc', decimal: '.', debit_sign: -1 });
    expect(rows[0].amount_cents).toBe(-2550);
  });
});
