// src/pages/app/__tests__/InboxPage.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockInboxItems = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    data: [
      {
        id: 'item-1',
        user_id: 'u-1',
        family_id: null,
        source_type: 'recurring_instance',
        source_id: 'inst-1',
        title: 'Confirmar: Netflix',
        body: null,
        due_at: new Date().toISOString(),
        status: 'pending',
        snoozed_until: null,
        completed_at: null,
        created_at: new Date().toISOString(),
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

vi.mock('@/hooks/useInboxQuery', () => ({
  useInboxItems:       mockInboxItems,
  useDismissInboxItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDoneInboxItem:    () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import InboxPage from '../InboxPage';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('InboxPage', () => {
  it('renders inbox item title', () => {
    render(<InboxPage />, { wrapper });
    expect(screen.getByText('Confirmar: Netflix')).toBeInTheDocument();
  });

  it('shows page heading', () => {
    render(<InboxPage />, { wrapper });
    expect(screen.getByRole('heading', { name: /inbox/i })).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    mockInboxItems.mockReturnValueOnce({ data: [], isLoading: false });
    render(<InboxPage />, { wrapper });
    expect(screen.getByText(/tudo em dia/i)).toBeInTheDocument();
  });
});
