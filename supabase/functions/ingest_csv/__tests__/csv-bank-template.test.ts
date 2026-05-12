import { describe, it, expect } from 'vitest';
import { parseCsvWithTemplate } from '../parsers/csv-bank-template.ts';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf-8');

const bcpMapping = {
  date_col: 'Data movimento',
  amount_col_debit: 'Débito',
  amount_col_credit: 'Crédito',
  description_col: 'Descrição',
  decimal_separator: '.',
  date_format: 'DD-MM-YYYY',
};

describe('parseCsvWithTemplate', () => {
  it('parses Millennium BCP fixture', () => {
    const rows = parseCsvWithTemplate(fixture('millennium_bcp.csv'), bcpMapping);
    expect(rows.length).toBe(3);
    expect(rows[0].date).toBe('2025-01-01');
    expect(rows[0].amount_cents).toBe(-2550);
    expect(rows[0].description).toBe('LIDL LISBOA');
    expect(rows[1].amount_cents).toBe(150000); // credit
  });

  it('normalises DD/MM/YYYY date format', () => {
    const csv = 'Data,Valor,Desc\n03/01/2025,-10.50,Test';
    const rows = parseCsvWithTemplate(csv, {
      date_col: 'Data', amount_col: 'Valor', description_col: 'Desc',
      decimal_separator: '.', date_format: 'DD/MM/YYYY',
    });
    expect(rows[0].date).toBe('2025-01-03');
  });

  it('normalises YYYYMMDD date format', () => {
    const csv = 'Data,Valor,Desc\n20250103,-10.00,Test';
    const rows = parseCsvWithTemplate(csv, {
      date_col: 'Data', amount_col: 'Valor', description_col: 'Desc',
      decimal_separator: '.', date_format: 'YYYYMMDD',
    });
    expect(rows[0].date).toBe('2025-01-03');
    expect(rows[0].amount_cents).toBe(-1000);
  });
});
