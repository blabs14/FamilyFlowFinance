// src/hooks/__tests__/useCashflowQuery.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { makeCashflowTimelineEvent } from '../../../tests/utils/factories';

const mockRpc = vi.hoisted(() => vi.fn());
const mockScope = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: mockRpc } }));
vi.mock('@/features/scope', () => ({ useScope: mockScope }));

import { useCashflowTimeline } from '../useCashflowQuery';

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

beforeEach(() => { vi.clearAllMocks(); });

describe('useCashflowTimeline', () => {
  it('calls get_cashflow_timeline with correct scope', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'personal' } });
    mockRpc.mockResolvedValueOnce({ data: [makeCashflowTimelineEvent()], error: null });

    const { result } = renderHook(
      () => useCashflowTimeline({ daysBefore: 30, daysAfter: 60 }),
      { wrapper: makeWrapper() }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_cashflow_timeline', expect.objectContaining({
      scope_family_id: null,
    }));
  });

  it('flags needs_confirm events', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'personal' } });
    mockRpc.mockResolvedValueOnce({
      data: [
        makeCashflowTimelineEvent({ is_projected: false }),
        makeCashflowTimelineEvent({ is_projected: true, needs_confirm: true }),
      ],
      error: null,
    });

    const { result } = renderHook(
      () => useCashflowTimeline({ daysBefore: 30, daysAfter: 60 }),
      { wrapper: makeWrapper() }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const confirmed = result.current.data?.filter(e => e.needsConfirm);
    expect(confirmed).toHaveLength(1);
  });
});
