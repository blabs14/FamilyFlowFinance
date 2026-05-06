// src/components/dashboard/__tests__/DashboardInsights.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { makeInsight } from '../../../../tests/utils/factories';

const mockInsights = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));
vi.mock('@/hooks/useInsightsQuery', () => ({
  useDashboardInsights: mockInsights,
}));

import { DashboardInsights } from '../DashboardInsights';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('DashboardInsights', () => {
  it('renders insight titles', async () => {
    mockInsights.mockReturnValue({
      data: [
        makeInsight({ title: 'Despesas vs. mês anterior', value: -12.5 }),
        makeInsight({ type: 'budget_risk', title: 'Orçamentos em risco', value: 2 }),
      ],
      isLoading: false,
    });

    render(<DashboardInsights />, { wrapper });
    expect(await screen.findByText('Despesas vs. mês anterior')).toBeInTheDocument();
    expect(screen.getByText('Orçamentos em risco')).toBeInTheDocument();
  });

  it('shows negative mom_change as red badge', async () => {
    mockInsights.mockReturnValue({
      data: [makeInsight({ type: 'mom_change', value: -12.5 })],
      isLoading: false,
    });

    render(<DashboardInsights />, { wrapper });
    const badge = await screen.findByText(/-12\.5%/);
    expect(badge).toBeInTheDocument();
  });

  it('renders nothing when no insights', () => {
    mockInsights.mockReturnValue({ data: [], isLoading: false });
    const { container } = render(<DashboardInsights />, { wrapper });
    expect(container.firstChild).toBeNull();
  });
});
