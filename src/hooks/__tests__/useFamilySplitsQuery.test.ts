// src/hooks/__tests__/useFamilySplitsQuery.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockScope = vi.hoisted(() =>
  vi.fn().mockReturnValue({ scope: { kind: 'family', familyId: 'fam-1' } })
);
const mockGetMemberBalances = vi.hoisted(() =>
  vi.fn().mockResolvedValue([
    { family_id: 'fam-1', user_id: 'u1', paid_cents: 1000, owed_cents: 500, balance_cents: 500 },
  ])
);

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn(), auth: { getUser: vi.fn() } },
}));
vi.mock('@/features/scope', () => ({ useScope: mockScope }));
vi.mock('@/services/family', () => ({
  getMemberBalances: mockGetMemberBalances,
  splitTransactionAmongMembers: vi.fn().mockResolvedValue(undefined),
  settleBalance: vi.fn().mockResolvedValue('transfer-id'),
  transferOwnership: vi.fn().mockResolvedValue(undefined),
  softRemoveFamilyMember: vi.fn().mockResolvedValue(undefined),
}));

import { useMemberBalances } from '../useFamilySplitsQuery';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }, children);

describe('useMemberBalances', () => {
  it('fetches balances for current family scope', async () => {
    const { result } = renderHook(() => useMemberBalances(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].balance_cents).toBe(500);
  });

  it('is disabled when not in family scope', () => {
    mockScope.mockReturnValueOnce({ scope: { kind: 'personal' } });
    const { result } = renderHook(() => useMemberBalances(), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(false);
  });
});
