// src/pages/app/__tests__/RecurrentsPage.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockScope = vi.hoisted(() =>
  vi.fn().mockReturnValue({ scope: { kind: 'personal' } })
);
const mockRules = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    data: [
      {
        id: 'r-1',
        description: 'Netflix',
        payee: 'Netflix',
        amount_cents: 1499,
        interval_unit: 'month',
        interval_count: 1,
        status: 'active',
        execution_mode: 'confirm',
        amount_mode: 'fixed',
        schedule_type: 'monthly',
        next_run_date: '2026-05-01',
        is_subscription: true,
        type: 'expense',
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

vi.mock('@/features/scope', () => ({ useScope: mockScope }));

vi.mock('@/hooks/useRecurrentsQuery', () => ({
  useRecurringRules:       mockRules,
  useCreateRecurringRule:  () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateRecurringRule:  () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteRecurringRule:  () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePauseRecurringRule:   () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResumeRecurringRule:  () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import RecurrentsPage from '../RecurrentsPage';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('RecurrentsPage', () => {
  it('renders rule card from list', async () => {
    render(<RecurrentsPage />, { wrapper });
    expect(await screen.findByText('Netflix')).toBeInTheDocument();
  });

  it('shows "Nova regra" button', () => {
    render(<RecurrentsPage />, { wrapper });
    expect(screen.getByRole('button', { name: /nova regra/i })).toBeInTheDocument();
  });

  it('shows page heading "Recorrentes"', () => {
    render(<RecurrentsPage />, { wrapper });
    expect(screen.getByRole('heading', { name: /recorrentes/i })).toBeInTheDocument();
  });
});
