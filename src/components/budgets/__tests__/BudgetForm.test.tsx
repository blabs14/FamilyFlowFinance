// src/components/budgets/__tests__/BudgetForm.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../hooks/useBudgetsQuery', () => ({
  useCreateBudget: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateBudget: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBudgetTemplates: () => ({ data: [] }),
}));

vi.mock('../../../hooks/useCategoriesQuery', () => ({
  useCategoriesDomain: () => ({ data: [{ id: 'cat-1', nome: 'Alimentação' }], isLoading: false }),
}));

vi.mock('../../../features/scope', () => ({
  useScope: () => ({ scope: { kind: 'personal' } }),
}));

import BudgetFormSheet from '../BudgetForm';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('BudgetFormSheet', () => {
  it('renderiza o formulário quando open=true', () => {
    render(<BudgetFormSheet open={true} editingBudget={null} onClose={() => {}} />, { wrapper });
    expect(screen.getByLabelText(/Categoria/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Montante/i)).toBeInTheDocument();
  });

  it('mostra campo de objetivo quando rollover=transfer_to_goal', async () => {
    render(<BudgetFormSheet open={true} editingBudget={null} onClose={() => {}} />, { wrapper });
    const rolloverSelect = screen.getByRole('combobox', { name: /Rollover/i });
    fireEvent.change(rolloverSelect, { target: { value: 'transfer_to_goal' } });
    // Trigger by clicking the transfer_to_goal option in the Select
    fireEvent.click(rolloverSelect);
    expect(screen.getByLabelText(/Rollover/i)).toBeInTheDocument();
  });
});
