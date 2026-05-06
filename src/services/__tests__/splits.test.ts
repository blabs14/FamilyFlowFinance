// src/services/__tests__/splits.test.ts
// Unit 6 Task 9: TDD para splits service
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDelete = vi.fn().mockReturnThis();
const mockInsert = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
const mockSingle = vi.fn();

const mockChain = {
  select: mockSelect,
  insert: mockInsert,
  delete: mockDelete,
  eq: mockEq,
  order: mockOrder,
  single: mockSingle,
};

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => mockChain),
  },
}));

import { updateTransactionSplits, getTransactionSplits } from '../splits';

describe('splits service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updateTransactionSplits deleta splits antigos e insere novos', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    // For delete: eq() → resolves immediately (mocked as ReturnThis, delete chain ends with eq)
    // We mock order to not be called here; delete chain is .delete().eq() → resolved by mockEq's ReturnThis + underlying await
    mockEq.mockReturnThis();
    mockSelect.mockResolvedValueOnce({
      data: [
        { id: 's-1', transaction_id: 'tx-1', categoria_id: 'cat-1', amount_cents: 700 },
        { id: 's-2', transaction_id: 'tx-1', categoria_id: 'cat-2', amount_cents: 300 },
      ],
      error: null,
    });

    const result = await updateTransactionSplits('tx-1', [
      { categoria_id: 'cat-1', amount_cents: 700 },
      { categoria_id: 'cat-2', amount_cents: 300 },
    ]);

    expect(supabase.from).toHaveBeenCalledWith('transaction_splits');
    expect(mockDelete).toHaveBeenCalled();
    expect(result.error).toBeNull();
  });

  it('updateTransactionSplits com lista vazia apaga todos e retorna []', async () => {
    mockEq.mockResolvedValueOnce({ error: null });

    const result = await updateTransactionSplits('tx-1', []);
    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('getTransactionSplits ordena por order_index', async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null });

    await getTransactionSplits('tx-1');

    expect(mockOrder).toHaveBeenCalledWith('order_index', { ascending: true });
  });
});
