export interface NormalizedRow {
  date: string;           // ISO YYYY-MM-DD
  amount_cents: number;   // positive = credit, negative = debit
  description: string;
  counterparty?: string;
  raw_json: Record<string, unknown>;
}
