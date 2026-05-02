// src/components/goals/__tests__/GoalAllocationModal.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockAllocate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockAccounts = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    data: [{ id: 'acc-1', nome: 'Conta Corrente', amount_cents: 50000 }],
    isLoading: false,
  })
);

vi.mock('@/hooks/useGoalsQuery', () => ({
  useAllocateToGoal: () => ({ mutateAsync: mockAllocate, isPending: false }),
}));

vi.mock('@/hooks/useAccountsQuery', () => ({
  useAccounts: mockAccounts,
}));

import GoalAllocationModal from '../GoalAllocationModal';
import type { GoalWithBalance } from '@/services/goals';

const goal: GoalWithBalance = {
  id: 'g-1',
  user_id: 'u-1',
  nome: 'Férias',
  prazo: null,
  tipo: 'savings',
  priority: 3,
  order_index: 0,
  status: 'active',
  ativa: true,
  family_id: null,
  target_cents: 100000,
  valor_atual_cents: 20000,
  progress_percent: 20,
  required_monthly_cents: null,
  is_behind_schedule: false,
  target_account_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('GoalAllocationModal', () => {
  it('shows goal name in modal title', () => {
    render(
      <GoalAllocationModal goal={goal} open={true} onClose={vi.fn()} />,
      { wrapper }
    );
    expect(screen.getByText(/Alocar para Férias/)).toBeInTheDocument();
  });

  it('calls allocate mutation on submit', async () => {
    render(
      <GoalAllocationModal goal={goal} open={true} onClose={vi.fn()} />,
      { wrapper }
    );
    // Fill amount
    fireEvent.change(screen.getByPlaceholderText(/valor/i), {
      target: { value: '100' },
    });
    fireEvent.click(screen.getByRole('button', { name: /alocar/i }));
    await waitFor(() => expect(mockAllocate).toHaveBeenCalled());
  });
});
