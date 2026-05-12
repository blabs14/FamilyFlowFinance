import { describe, it, expect, vi } from 'vitest';
import { runFuzzyDedup } from '../dedup/fuzzy-dedup.ts';
import type { NormalizedRow } from '../types.ts';

const rows: NormalizedRow[] = [
  { date: '2025-01-01', amount_cents: -2550, description: 'LIDL LISBOA', raw_json: {} },
  { date: '2025-01-05', amount_cents: 150000, description: 'SALARIO', raw_json: {} },
  { date: '2025-01-02', amount_cents: -2550, description: 'LIDL LX', raw_json: {} },
];

describe('runFuzzyDedup', () => {
  it('marks exact duplicate', async () => {
    const mockRpc = vi.fn().mockResolvedValue([
      { row_index: 0, row_status: 'duplicate', matched_transaction_id: 'txn-1', matched_recurring_instance_id: null },
      { row_index: 1, row_status: 'ok', matched_transaction_id: null, matched_recurring_instance_id: null },
      { row_index: 2, row_status: 'probable_duplicate', matched_transaction_id: 'txn-2', matched_recurring_instance_id: null },
    ]);
    const result = await runFuzzyDedup(rows, 'account-1', mockRpc);
    expect(result[0].row_status).toBe('duplicate');
    expect(result[1].row_status).toBe('ok');
    expect(result[2].row_status).toBe('probable_duplicate');
  });

  it('marks matches_recurring', async () => {
    const mockRpc = vi.fn().mockResolvedValue([
      { row_index: 0, row_status: 'matches_recurring', matched_transaction_id: null, matched_recurring_instance_id: 'ri-1' },
    ]);
    const result = await runFuzzyDedup([rows[0]], 'account-1', mockRpc);
    expect(result[0].row_status).toBe('matches_recurring');
    expect(result[0].matched_recurring_instance_id).toBe('ri-1');
  });

  it('passes all rows as bulk JSON to RPC', async () => {
    const mockRpc = vi.fn().mockResolvedValue(
      rows.map((_, i) => ({ row_index: i, row_status: 'ok', matched_transaction_id: null, matched_recurring_instance_id: null }))
    );
    await runFuzzyDedup(rows, 'account-1', mockRpc);
    expect(mockRpc).toHaveBeenCalledOnce();
    const call = mockRpc.mock.calls[0][0];
    expect(call.p_rows).toHaveLength(3);
  });
});
