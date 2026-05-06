// src/features/family/__tests__/FamilyAccounts.test.tsx
// Unit 5: FamilyAccounts agora delega para ContasPage — testa delegação mínima.
// Os cenários detalhados estão em src/pages/__tests__/ContasPage.test.tsx.
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock das dependências de ContasPage (renderizado via FamilyAccounts)
vi.mock('../../../features/scope/useScope', () => ({
  useScope: () => ({
    scope: { kind: 'family', familyId: 'fam-1' },
    setScope: () => {},
    scopedFilter: { userId: 'user-1', familyId: 'fam-1' },
  }),
}));

vi.mock('../../../hooks/useAccountsQuery', () => ({
  useAccountsScoped: () => ({
    data: { data: [{ account_id: 'acc-1', nome: 'Conta Familiar', tipo: 'corrente', saldo_atual: 2000, currency: 'EUR' }] },
    isLoading: false,
  }),
  useCreditCards: () => ({
    data: { data: [] },
    isLoading: false,
  }),
  useSoftDeleteAccount: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSoftDeleteCreditCard: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../../hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import FamilyAccounts from '../FamilyAccounts';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('FamilyAccounts', () => {
  it('delega para ContasPage e mostra secção de contas bancárias', () => {
    render(<FamilyAccounts />, { wrapper });
    expect(screen.getByText(/contas bancárias/i)).toBeInTheDocument();
    expect(screen.getByText('Conta Familiar')).toBeInTheDocument();
  });

  it('delega para ContasPage e mostra secção de cartões de crédito', () => {
    render(<FamilyAccounts />, { wrapper });
    expect(screen.getByRole('heading', { name: /cartões de crédito/i })).toBeInTheDocument();
  });
});
