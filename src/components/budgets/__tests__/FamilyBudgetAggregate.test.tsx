// src/components/budgets/__tests__/FamilyBudgetAggregate.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({
      data: [
        { user_id: 'user-1', target_cents: 15000 },
        { user_id: 'user-2', target_cents: 10000 },
      ],
      error: null,
    }),
  },
}));

import FamilyBudgetAggregate from '../FamilyBudgetAggregate';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('FamilyBudgetAggregate', () => {
  it('mostra contribuicoes dos membros (placeholder display_name)', async () => {
    render(
      <FamilyBudgetAggregate budgetId="bud-1" familyId="fam-1" budgetCents={50000} />,
      { wrapper }
    );
    // Component shows user_id as placeholder since profiles are wired in Unit 12
    expect(await screen.findByText('user-1')).toBeInTheDocument();
    expect(await screen.findByText('user-2')).toBeInTheDocument();
  });
});
