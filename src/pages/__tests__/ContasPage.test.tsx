// src/pages/__tests__/ContasPage.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('../../features/scope/useScope', () => ({
  useScope: () => ({
    scope: { kind: 'personal' },
    setScope: () => {},
    scopedFilter: { userId: 'user-1', familyId: null },
  }),
}));

vi.mock('../../hooks/useAccountsQuery', () => ({
  useAccountsScoped: () => ({
    data: {
      data: [{ account_id: 'acc-1', nome: 'Conta Corrente', tipo: 'corrente', saldo_atual: 1500, currency: 'EUR' }],
    },
    isLoading: false,
  }),
  useCreditCards: () => ({
    data: {
      data: [{ card_id: 'card-1', nome: 'Visa Platinum', credit_limit_cents: 500000, current_balance_cents: 150000, utilization_pct: 30 }],
    },
    isLoading: false,
  }),
  useSoftDeleteAccount: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSoftDeleteCreditCard: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

import ContasPage from '../ContasPage';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('ContasPage', () => {
  it('renderiza secção de contas bancárias', () => {
    render(<ContasPage />, { wrapper });
    expect(screen.getByText(/contas bancárias/i)).toBeInTheDocument();
    expect(screen.getByText('Conta Corrente')).toBeInTheDocument();
  });

  it('renderiza secção de cartões de crédito', () => {
    render(<ContasPage />, { wrapper });
    expect(screen.getByText(/cartões de crédito/i)).toBeInTheDocument();
    expect(screen.getByText('Visa Platinum')).toBeInTheDocument();
  });

  it('mostra utilização do cartão em percentagem', () => {
    render(<ContasPage />, { wrapper });
    expect(screen.getByText(/30%/)).toBeInTheDocument();
  });
});
