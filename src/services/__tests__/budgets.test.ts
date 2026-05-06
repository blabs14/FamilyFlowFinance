// src/services/__tests__/budgets.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom, mockSelect, mockEq, mockIs, mockOrder, mockSingle, mockInsert, mockUpdate, mockDelete, mockRpc } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockEq = vi.fn().mockReturnThis();
  const mockIs = vi.fn().mockReturnThis();
  const mockSelect = vi.fn().mockReturnThis();
  const mockInsert = vi.fn().mockReturnThis();
  const mockUpdate = vi.fn().mockReturnThis();
  const mockDelete = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockRpc = vi.fn();

  const mockChain = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    is: mockIs,
    order: mockOrder,
    single: mockSingle,
  };
  const mockFrom = vi.fn(() => mockChain);

  return { mockFrom, mockSelect, mockEq, mockIs, mockOrder, mockSingle, mockInsert, mockUpdate, mockDelete, mockRpc };
});

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

import { getBudgetTemplates, getBudgetStatus } from '../budgets';

describe('budgets service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getBudgetTemplates queries budgets with is_template=true', async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null });

    await getBudgetTemplates();

    expect(mockFrom).toHaveBeenCalledWith('budgets');
    expect(mockEq).toHaveBeenCalledWith('is_template', true);
  });

  it('getBudgetStatus calls get_budget_status RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{
        spent_cents: 5000,
        remaining_cents: 5000,
        projected_cents: 8000,
        percent_used: 50,
        is_projected_over: false,
      }],
      error: null,
    });

    const result = await getBudgetStatus('instance-uuid-123');

    expect(mockRpc).toHaveBeenCalledWith('get_budget_status', {
      p_instance_id: 'instance-uuid-123',
    });
    expect(result.data?.spent_cents).toBe(5000);
    expect(result.data?.is_projected_over).toBe(false);
  });
});
