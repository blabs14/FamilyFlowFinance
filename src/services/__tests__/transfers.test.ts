// src/services/__tests__/transfers.test.ts
// Unit 6 Task 8: TDD para transfers service
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSingle = vi.fn();
const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
const mockInsert = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();

const mockChain = {
  select: mockSelect,
  insert: mockInsert,
  eq: mockEq,
  order: mockOrder,
  single: mockSingle,
};

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => mockChain),
  },
}));

import { createTransfer, listTransfers } from '../transfers';

describe('transfers service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('createTransfer insere na tabela transfers com operation_id', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    mockSingle.mockResolvedValueOnce({
      data: { id: 'tr-1', amount_cents: 5000, operation_id: 'op-1' },
      error: null,
    });

    const result = await createTransfer({
      user_id: 'user-1',
      from_account_id: 'acc-1',
      to_account_id: 'acc-2',
      amount_cents: 5000,
      date: '2026-04-21',
    });

    expect(supabase.from).toHaveBeenCalledWith('transfers');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          amount_cents: 5000,
          operation_id: expect.any(String),
        }),
      ])
    );
    expect(result.data?.id).toBe('tr-1');
  });

  it('listTransfers ordena por date DESC', async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null });

    await listTransfers('user-1');

    expect(mockOrder).toHaveBeenCalledWith('date', { ascending: false });
  });
});
