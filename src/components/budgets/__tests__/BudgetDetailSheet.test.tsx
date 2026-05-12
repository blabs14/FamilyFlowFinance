// src/components/budgets/__tests__/BudgetDetailSheet.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../hooks/useBudgetsQuery', () => ({
  useBudgetStatus: () => ({
    data: {
      spent_cents: 25000,
      remaining_cents: 25000,
      projected_cents: 40000,
      percent_used: 50,
      is_projected_over: false,
    },
    isLoading: false,
  }),
}));

vi.mock('../../../hooks/useTransactionsQuery', () => ({
  useTransactions: () => ({ data: [] }),
}));

import BudgetDetailSheet from '../BudgetDetailSheet';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

const mockBudget = {
  instance_id: 'inst-1', budget_id: 'bud-1', categoria_id: 'cat-1',
  categoria_nome: 'Alimentação', categoria_cor: '#22c55e',
  period_type: 'monthly', period_key: '2026-04',
  period_start: '2026-04-01', period_end: '2026-04-30',
  budget_cents: 50000, spent_cents: 25000, remaining_cents: 25000,
  progresso_percentual: 50, rollover_mode: 'reset',
  cap_type: 'flexible', parent_id: null, is_projected_over: false, status: 'active',
};

describe('BudgetDetailSheet', () => {
  it('mostra nome da categoria no titulo', () => {
    render(
      <BudgetDetailSheet open={true} budget={mockBudget} onClose={() => {}} />,
      { wrapper }
    );
    expect(screen.getByText(/Alimentação/i)).toBeInTheDocument();
  });

  it('mostra gasto e projecao', () => {
    render(
      <BudgetDetailSheet open={true} budget={mockBudget} onClose={() => {}} />,
      { wrapper }
    );
    // 25000 cents = €250,00 — "Gasto" label should be visible
    expect(screen.getByText('Gasto')).toBeInTheDocument();
    // "Restante" label should be visible
    expect(screen.getByText('Restante')).toBeInTheDocument();
  });
});
