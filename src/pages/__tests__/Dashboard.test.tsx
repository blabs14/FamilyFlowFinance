// src/pages/__tests__/Dashboard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { makeKpiResult } from '../../../tests/utils/factories';

const mockDashboard = vi.hoisted(() => vi.fn());
const mockScope = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn(), auth: { getUser: vi.fn() } },
}));
vi.mock('@/hooks/useDashboardQuery', () => ({ useDashboardData: mockDashboard }));
vi.mock('@/features/scope', () => ({ useScope: mockScope }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, loading: false }),
}));
vi.mock('@/hooks/useAccountsQuery', () => ({ useAccountsWithBalances: () => ({ data: [] }) }));
vi.mock('@/hooks/useTransactionsQuery', () => ({ useTransactions: () => ({ data: [] }) }));
vi.mock('@/hooks/useGoalsQuery', () => ({ useGoals: () => ({ data: [] }) }));
vi.mock('@/hooks/useRemindersQuery', () => ({ useReminders: () => ({ data: [] }) }));
vi.mock('@/hooks/useBudgetsQuery', () => ({ useBudgets: () => ({ data: [] }) }));
vi.mock('@/hooks/useInsightsQuery', () => ({ useDashboardInsights: () => ({ data: [] }) }));
vi.mock('@/hooks/useCashflowQuery', () => ({ useCashflowTimeline: () => ({ data: [] }) }));
vi.mock('@/components/dashboard/ContributionsWidget', () => ({
  ContributionsWidget: () => <div>ContributionsWidget</div>,
}));
vi.mock('@/components/dashboard/DashboardInsights', () => ({
  DashboardInsights: () => <div>DashboardInsights</div>,
}));

import Dashboard from '../Dashboard';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);

beforeEach(() => { vi.clearAllMocks(); });

describe('Dashboard', () => {
  it('shows inbox badge with pending count', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'personal' } });
    mockDashboard.mockReturnValue({
      data: { ...makeKpiResult(), inboxPendingCount: 7 },
      isLoading: false,
    });

    render(<Dashboard />, { wrapper });
    expect(await screen.findByText('7')).toBeInTheDocument();
  });

  it('has no hardcoded /personal/ links', () => {
    mockScope.mockReturnValue({ scope: { kind: 'personal' } });
    mockDashboard.mockReturnValue({ data: makeKpiResult(), isLoading: false });

    const { container } = render(<Dashboard />, { wrapper });
    const links = container.querySelectorAll('[href*="/personal/"]');
    expect(links).toHaveLength(0);
  });

  it('shows ContributionsWidget in family scope', async () => {
    mockScope.mockReturnValue({ scope: { kind: 'family', familyId: 'fam-1' } });
    mockDashboard.mockReturnValue({ data: makeKpiResult(), isLoading: false });

    render(<Dashboard />, { wrapper });
    expect(await screen.findByText('ContributionsWidget')).toBeInTheDocument();
  });
});
