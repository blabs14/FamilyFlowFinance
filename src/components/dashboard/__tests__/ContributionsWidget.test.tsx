// src/components/dashboard/__tests__/ContributionsWidget.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockBalances = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    data: [
      { family_id: 'fam-1', user_id: 'u1', paid_cents: 7000, owed_cents: 0, balance_cents: 7000 },
      { family_id: 'fam-1', user_id: 'u2', paid_cents: 3000, owed_cents: 0, balance_cents: 3000 },
    ],
    isLoading: false,
  })
);
const mockMembers = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    data: [
      { user_id: 'u1', status: 'active', profiles: { nome: 'Ana Silva' } },
      { user_id: 'u2', status: 'active', profiles: { nome: 'Pedro Costa' } },
    ],
    isLoading: false,
  })
);

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), auth: { getUser: vi.fn() } },
}));
vi.mock('@/hooks/useFamilySplitsQuery', () => ({ useMemberBalances: mockBalances }));
vi.mock('@/hooks/useFamilyMembersQuery', () => ({ useFamilyMembers: mockMembers }));

import { ContributionsWidget } from '../ContributionsWidget';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('ContributionsWidget', () => {
  it('shows member names', async () => {
    render(<ContributionsWidget />, { wrapper });
    expect(await screen.findByText('Ana Silva')).toBeInTheDocument();
    expect(screen.getByText('Pedro Costa')).toBeInTheDocument();
  });

  it('shows contribution percentages', async () => {
    render(<ContributionsWidget />, { wrapper });
    expect(await screen.findByText('70%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  it('shows section heading', async () => {
    render(<ContributionsWidget />, { wrapper });
    expect(await screen.findByText(/contribuições/i)).toBeInTheDocument();
  });
});
