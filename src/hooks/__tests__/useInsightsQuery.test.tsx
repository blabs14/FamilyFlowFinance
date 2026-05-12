// src/hooks/__tests__/useInsightsQuery.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { makeInsight } from '../../../tests/utils/factories';

const mockRpc = vi.hoisted(() => vi.fn());
const mockScope = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: mockRpc } }));
vi.mock('@/features/scope', () => ({ useScope: mockScope }));

import { useDashboardInsights } from '../useInsightsQuery';

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

beforeEach(() => { vi.clearAllMocks(); });

describe('useDashboardInsights', () => {
  it('calls get_dashboard_insights with null in personal scope', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'personal' } });
    mockRpc.mockResolvedValueOnce({ data: [makeInsight()], error: null });

    const { result } = renderHook(() => useDashboardInsights(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_dashboard_insights', { scope_family_id: null });
  });

  it('returns array of insights', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'personal' } });
    mockRpc.mockResolvedValueOnce({
      data: [makeInsight(), makeInsight({ type: 'budget_risk', value: 2 })],
      error: null,
    });

    const { result } = renderHook(() => useDashboardInsights(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });
});
