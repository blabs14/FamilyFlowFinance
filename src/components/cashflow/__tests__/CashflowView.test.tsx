// src/components/cashflow/__tests__/CashflowView.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const mockTimeline = vi.hoisted(() => vi.fn());
const mockScope = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/hooks/useCashflowQuery', () => ({ useCashflowTimeline: mockTimeline }));
vi.mock('@/features/scope', () => ({ useScope: mockScope }));

import { CashflowView } from '../CashflowView';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);

beforeEach(() => {
  mockScope.mockReturnValue({ scope: { kind: 'personal' } });
  vi.clearAllMocks();
});

describe('CashflowView', () => {
  it('renders past event description', async () => {
    mockTimeline.mockReturnValue({
      data: [{
        eventDate: '2020-01-01',
        amountCents: 5000,
        direction: 'out' as const,
        sourceType: 'transaction',
        sourceId: 'id-1',
        description: 'Supermercado',
        isProjected: false,
        needsConfirm: false,
      }],
      isLoading: false,
    });
    render(<CashflowView />, { wrapper });
    expect(await screen.findByText('Supermercado')).toBeInTheDocument();
  });

  it('shows warning icon for needs_confirm events', async () => {
    mockTimeline.mockReturnValue({
      data: [{
        eventDate: '2099-06-01',
        amountCents: 1500,
        direction: 'out' as const,
        sourceType: 'recurring_rule',
        sourceId: 'id-2',
        description: 'Netflix',
        isProjected: true,
        needsConfirm: true,
      }],
      isLoading: false,
    });
    render(<CashflowView />, { wrapper });
    expect(await screen.findByText('Netflix')).toBeInTheDocument();
    expect(screen.getByTitle(/por confirmar/i)).toBeInTheDocument();
  });

  it('shows "Hoje" divider in timeline', async () => {
    mockTimeline.mockReturnValue({
      data: [
        {
          eventDate: '2020-01-01',
          amountCents: 1000,
          direction: 'in' as const,
          sourceType: 'transaction',
          sourceId: 'id-3',
          description: 'Salario antigo',
          isProjected: false,
          needsConfirm: false,
        },
        {
          eventDate: '2099-01-01',
          amountCents: 2000,
          direction: 'out' as const,
          sourceType: 'recurring_rule',
          sourceId: 'id-4',
          description: 'Renda futura',
          isProjected: true,
          needsConfirm: false,
        },
      ],
      isLoading: false,
    });
    render(<CashflowView />, { wrapper });
    expect(await screen.findByText(/hoje/i)).toBeInTheDocument();
  });
});
