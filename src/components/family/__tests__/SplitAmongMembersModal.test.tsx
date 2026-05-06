// src/components/family/__tests__/SplitAmongMembersModal.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));
vi.mock('@/hooks/useFamilySplitsQuery', () => ({
  useSplitTransaction: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import SplitAmongMembersModal from '../SplitAmongMembersModal';

const members = [
  { user_id: 'u1', profiles: { nome: 'Ana Silva' } },
  { user_id: 'u2', profiles: { nome: 'Pedro Costa' } },
];

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('SplitAmongMembersModal', () => {
  it('renders member names', () => {
    render(
      <SplitAmongMembersModal
        open transactionId="tx-1" amountCents={10000} members={members} onClose={() => {}} />,
      { wrapper }
    );
    expect(screen.getByText('Ana Silva')).toBeInTheDocument();
    expect(screen.getByText('Pedro Costa')).toBeInTheDocument();
  });

  it('shows transaction total formatted', () => {
    render(
      <SplitAmongMembersModal
        open transactionId="tx-1" amountCents={10000} members={members} onClose={() => {}} />,
      { wrapper }
    );
    // formatMoney(10000) should show 100.00 in some format
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  it('shows Confirmar button', () => {
    render(
      <SplitAmongMembersModal
        open transactionId="tx-1" amountCents={10000} members={members} onClose={() => {}} />,
      { wrapper }
    );
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeInTheDocument();
  });
});
