// src/pages/app/__tests__/MembersPage.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mockScope = vi.hoisted(() =>
  vi.fn().mockReturnValue({ scope: { kind: 'family', familyId: 'fam-1' } })
);
const mockMembers = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    data: [
      {
        id: 'm1', user_id: 'u1', role: 'owner', status: 'active',
        joined_at: '2026-01-01T00:00:00Z', profiles: { nome: 'Ana Silva' },
      },
      {
        id: 'm2', user_id: 'u2', role: 'member', status: 'active',
        joined_at: '2026-02-01T00:00:00Z', profiles: { nome: 'Pedro Costa' },
      },
    ],
    isLoading: false,
  })
);

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), auth: { getUser: vi.fn() } },
}));
vi.mock('@/features/scope', () => ({ useScope: mockScope }));
vi.mock('@/hooks/useFamilyMembersQuery', () => ({
  useFamilyMembers: mockMembers,
  useTransferOwnership: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSoftRemoveFamilyMember: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useFamilySplitsQuery', () => ({
  useMemberBalances: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));

import MembersPage from '../MembersPage';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);

describe('MembersPage', () => {
  it('shows member names', async () => {
    render(<MembersPage />, { wrapper });
    expect(await screen.findByText('Ana Silva')).toBeInTheDocument();
    expect(screen.getByText('Pedro Costa')).toBeInTheDocument();
  });

  it('shows owner role badge for Ana Silva', async () => {
    render(<MembersPage />, { wrapper });
    const ownerBadges = await screen.findAllByText(/owner/i);
    expect(ownerBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Remover button for non-owner members when user is owner', async () => {
    render(<MembersPage />, { wrapper });
    const removeButtons = await screen.findAllByRole('button', { name: /remover/i });
    expect(removeButtons).toHaveLength(1);
  });

  it('redirects when not in family scope', () => {
    mockScope.mockReturnValueOnce({ scope: { kind: 'personal' } });
    render(<MembersPage />, { wrapper });
    expect(screen.queryByText('Ana Silva')).not.toBeInTheDocument();
  });
});
