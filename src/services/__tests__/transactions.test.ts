// src/services/__tests__/transactions.test.ts
// Unit 6 Task 7: testa operation_id auto-gerado e reverseTransaction RPC
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    rpc: vi.fn(),
    from: vi.fn().mockReturnThis(),
  };
  return {
    supabase: {
      from: vi.fn(() => mockChain),
      rpc: vi.fn(),
    },
  };
});

import { createTransaction, reverseTransaction } from '../transactions';

describe('transactions service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('createTransaction inclui operation_id gerado lado cliente', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    const mockChain = (supabase.from as any)();

    mockChain.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }); // accounts lookup falls through
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'tx-1', operation_id: 'op-uuid', amount_cents: 1000 },
      error: null,
    });

    await createTransaction(
      { account_id: 'acc-1', amount_cents: 1000, tipo: 'despesa', data: '2026-04-21' },
      'user-1'
    );

    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ operation_id: expect.any(String) }),
      ])
    );
  });

  it('reverseTransaction chama RPC reverse_transaction', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    (supabase.rpc as any).mockResolvedValue({
      data: { reversal_id: 'tx-2', original_id: 'tx-1', operation_id: 'op-2' },
      error: null,
    });

    const result = await reverseTransaction('tx-1');

    expect(supabase.rpc).toHaveBeenCalledWith('reverse_transaction', { p_tx_id: 'tx-1' });
    expect(result.data?.reversal_id).toBe('tx-2');
  });
});
