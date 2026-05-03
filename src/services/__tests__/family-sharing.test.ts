// src/services/__tests__/family-sharing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
}));

import {
  transferOwnership,
  softRemoveFamilyMember,
  splitTransactionAmongMembers,
  getMemberBalances,
  settleBalance,
} from '../family';

beforeEach(() => { vi.clearAllMocks(); });

describe('transferOwnership', () => {
  it('calls transfer_ownership RPC with correct params', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await transferOwnership('fam-1', 'user-new');
    expect(mockRpc).toHaveBeenCalledWith('transfer_ownership', {
      p_family_id: 'fam-1',
      p_new_owner_id: 'user-new',
    });
  });

  it('throws on RPC error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'PERMISSION_DENIED' } });
    await expect(transferOwnership('fam-1', 'user-new')).rejects.toThrow();
  });
});

describe('softRemoveFamilyMember', () => {
  it('calls soft_remove_family_member RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await softRemoveFamilyMember('fam-1', 'user-rm', 'saiu da família');
    expect(mockRpc).toHaveBeenCalledWith('soft_remove_family_member', {
      p_family_id: 'fam-1',
      p_user_id: 'user-rm',
      p_reason: 'saiu da família',
    });
  });
});

describe('splitTransactionAmongMembers', () => {
  it('calls split_transaction_among_members RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const shares = [{ user_id: 'u1', share_cents: 1000 }, { user_id: 'u2', share_cents: 500 }];
    await splitTransactionAmongMembers('tx-1', shares);
    expect(mockRpc).toHaveBeenCalledWith('split_transaction_among_members', {
      p_transaction_id: 'tx-1',
      p_shares: shares,
    });
  });
});

describe('getMemberBalances', () => {
  it('returns member balances from view', async () => {
    const rows = [{ family_id: 'fam-1', user_id: 'u1', paid_cents: 1000, owed_cents: 500, balance_cents: 500 }];
    const selectMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValueOnce({ data: rows, error: null }),
    };
    mockFrom.mockReturnValueOnce(selectMock);
    const result = await getMemberBalances('fam-1');
    expect(result).toHaveLength(1);
    expect(result[0].balance_cents).toBe(500);
  });
});

describe('settleBalance', () => {
  it('calls settle_member_balance RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'log-uuid', error: null });
    const id = await settleBalance('fam-1', 'u1', 'u2', 5000, 'acc-1', 'acc-2');
    expect(mockRpc).toHaveBeenCalledWith('settle_member_balance', expect.objectContaining({
      p_family_id: 'fam-1',
      p_amount_cents: 5000,
    }));
    expect(id).toBe('log-uuid');
  });
});
