// src/components/goals/__tests__/GoalCompletionModal.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockComplete = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGoalsQuery = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    data: [
      {
        id: 'g-2',
        nome: 'Fundo Emergência',
        valor_atual_cents: 50000,
        target_cents: 50000,
        progress_percent: 100,
        ativa: true,
      },
    ],
    isLoading: false,
  })
);

vi.mock('@/hooks/useGoalsQuery', () => ({
  useCompleteGoal: () => ({ mutateAsync: mockComplete, isPending: false }),
  useGoalsWithBalance: mockGoalsQuery,
}));

vi.mock('@/hooks/useAccountsQuery', () => ({
  useAccounts: () => ({ data: [{ id: 'acc-1', nome: 'Conta Corrente' }] }),
}));

import GoalCompletionModal from '../GoalCompletionModal';
import type { GoalWithBalance } from '@/services/goals';

const completedGoal: GoalWithBalance = {
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
  valor_atual_cents: 100000,
  progress_percent: 100,
  required_monthly_cents: null,
  is_behind_schedule: false,
  target_account_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('GoalCompletionModal', () => {
  it('renders 4 completion CTAs', () => {
    render(
      <GoalCompletionModal goal={completedGoal} open={true} onClose={vi.fn()} />,
      { wrapper }
    );
    expect(screen.getByText(/Transferir para conta/i)).toBeInTheDocument();
    expect(screen.getByText(/Passar para outro objetivo/i)).toBeInTheDocument();
    expect(screen.getByText(/Registar gasto/i)).toBeInTheDocument();
    expect(screen.getByText(/Manter reservado/i)).toBeInTheDocument();
  });

  it('calls complete with keep action', async () => {
    render(
      <GoalCompletionModal goal={completedGoal} open={true} onClose={vi.fn()} />,
      { wrapper }
    );
    fireEvent.click(screen.getByText(/Manter reservado/i));
    await waitFor(() =>
      expect(mockComplete).toHaveBeenCalledWith(
        expect.objectContaining({ goalId: 'g-1', action: 'keep' })
      )
    );
  });
});
