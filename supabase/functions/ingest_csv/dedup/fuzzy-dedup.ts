import type { NormalizedRow } from '../types.ts';

export interface DedupResult extends NormalizedRow {
  row_status: 'ok' | 'duplicate' | 'probable_duplicate' | 'matches_recurring';
  matched_transaction_id?: string | null;
  matched_recurring_instance_id?: string | null;
}

type RpcFn = (params: { p_account_id: string; p_rows: unknown[] }) => Promise<Array<{
  row_index: number;
  row_status: string;
  matched_transaction_id: string | null;
  matched_recurring_instance_id: string | null;
}>>;

export async function runFuzzyDedup(
  rows: NormalizedRow[],
  accountId: string,
  rpc: RpcFn
): Promise<DedupResult[]> {
  const payload = rows.map((r, i) => ({
    row_index: i,
    date: r.date,
    amount_cents: r.amount_cents,
    description: r.description,
  }));

  const results = await rpc({ p_account_id: accountId, p_rows: payload });
  const byIndex = new Map(results.map(r => [r.row_index, r]));

  return rows.map((row, i) => {
    const res = byIndex.get(i);
    return {
      ...row,
      row_status: (res?.row_status ?? 'ok') as DedupResult['row_status'],
      matched_transaction_id: res?.matched_transaction_id ?? null,
      matched_recurring_instance_id: res?.matched_recurring_instance_id ?? null,
    };
  });
}
