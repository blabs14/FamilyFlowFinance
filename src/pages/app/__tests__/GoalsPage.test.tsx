// src/pages/app/__tests__/GoalsPage.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockScope = vi.hoisted(() =>
  vi.fn().mockReturnValue({ scope: { kind: 'personal' } })
);
const mockGoals = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    data: [
      {
        id: 'g-1',
        nome: 'Férias Algarve',
        tipo: 'savings',
        priority: 3,
        order_index: 0,
        status: 'active',
        ativa: true,
        family_id: null,
        target_cents: 100000,
        valor_atual_cents: 30000,
        progress_percent: 30,
        required_monthly_cents: 5000,
        is_behind_schedule: false,
        target_account_id: null,
        prazo: '2026-12-01',
        user_id: 'u-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ],
    isLoading: false,
  })
);

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

vi.mock('@/features/scope', () => ({
  useScope: mockScope,
}));

vi.mock('@/hooks/useGoalsQuery', () => ({
  useGoalsWithBalance: mockGoals,
  useCreateGoal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateGoal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteGoal: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useAccountsQuery', () => ({
  useAccounts: () => ({ data: [], isLoading: false }),
}));

import GoalsPage from '../GoalsPage';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('GoalsPage', () => {
  it('renders goal card from list', async () => {
    render(<GoalsPage />, { wrapper });
    expect(await screen.findByText('Férias Algarve')).toBeInTheDocument();
  });

  it('shows "Novo objetivo" button', () => {
    render(<GoalsPage />, { wrapper });
    expect(screen.getByRole('button', { name: /novo objetivo/i })).toBeInTheDocument();
  });
});
