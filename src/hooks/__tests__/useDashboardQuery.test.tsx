// src/hooks/__tests__/useDashboardQuery.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { makeKpiResult } from '../../../tests/utils/factories';

const mockRpc = vi.hoisted(() => vi.fn());
const mockScope = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { rpc: mockRpc },
}));
vi.mock('@/features/scope', () => ({ useScope: mockScope }));

import { useDashboardData } from '../useDashboardQuery';

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

beforeEach(() => { vi.clearAllMocks(); });

describe('useDashboardData', () => {
  it('calls get_kpis with null scope_family_id in personal scope', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'personal' } });
    mockRpc.mockResolvedValueOnce({ data: [makeKpiResult()], error: null });

    const { result } = renderHook(() => useDashboardData(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_kpis', expect.objectContaining({
      scope_family_id: null,
    }));
  });

  it('calls get_kpis with familyId in family scope', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'family', familyId: 'fam-1' } });
    mockRpc.mockResolvedValueOnce({ data: [makeKpiResult()], error: null });

    const { result } = renderHook(() => useDashboardData(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_kpis', expect.objectContaining({
      scope_family_id: 'fam-1',
    }));
  });

  it('exposes inbox_pending_count from RPC result', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'personal' } });
    mockRpc.mockResolvedValueOnce({ data: [makeKpiResult({ inbox_pending_count: 5 })], error: null });

    const { result } = renderHook(() => useDashboardData(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.inboxPendingCount).toBe(5);
  });
});
