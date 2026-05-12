import type { NormalizedRow } from '../types.ts';
import { parseCsvWithTemplate } from './csv-bank-template.ts';

interface ManualMapping {
  date: string;
  amount: string;
  description: string;
  decimal?: string;
  date_fmt?: string;
  debit_sign?: number;
}

export function parseCsvGeneric(content: string, mapping: ManualMapping): NormalizedRow[] {
  return parseCsvWithTemplate(content, {
    date_col: mapping.date,
    amount_col: mapping.amount,
    description_col: mapping.description,
    decimal_separator: mapping.decimal ?? '.',
    date_format: mapping.date_fmt,
  }).map(row => ({
    ...row,
    amount_cents: mapping.debit_sign
      ? row.amount_cents * mapping.debit_sign
      : row.amount_cents,
  }));
}
