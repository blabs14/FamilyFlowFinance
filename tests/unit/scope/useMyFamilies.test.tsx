import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMyFamilies } from '../../../src/features/scope/useMyFamilies';

vi.mock('../../../src/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../../src/contexts/AuthContext';
import { supabase } from '../../../src/lib/supabaseClient';

const wrap = (children: ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe('useMyFamilies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when user is not authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as never);

    const { result } = renderHook(() => useMyFamilies(), {
      wrapper: ({ children }) => wrap(children),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('returns families joined via family_members for the current user', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as never);

    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        { family_id: 'fam-1', family: { id: 'fam-1', nome: 'Silva' } },
        { family_id: 'fam-2', family: { id: 'fam-2', nome: 'Costa' } },
      ],
      error: null,
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: mockOrder,
        }),
      }),
    } as never);

    const { result } = renderHook(() => useMyFamilies(), {
      wrapper: ({ children }) => wrap(children),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { id: 'fam-1', nome: 'Silva' },
      { id: 'fam-2', nome: 'Costa' },
    ]);
  });
});
