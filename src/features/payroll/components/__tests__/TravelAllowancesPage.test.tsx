// src/features/payroll/components/__tests__/TravelAllowancesPage.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../hooks/useActiveContract', () => ({
  useActiveContract: () => ({ activeContract: { id: 'c1', name: 'Test' }, loading: false }),
}));
vi.mock('../../services/payrollAdvanced.service', () => ({
  fetchTravelAllowances: vi.fn().mockResolvedValue([]),
  saveTravelAllowance: vi.fn().mockResolvedValue({ id: 'new-id', operation_id: 'op-1' }),
  deleteTravelAllowance: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('TravelAllowancesPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the page heading', async () => {
    const { default: TravelAllowancesPage } = await import('../../pages/TravelAllowancesPage');
    render(<TravelAllowancesPage />, { wrapper: makeWrapper() });
    expect(screen.getByText(/ajudas de custo/i)).toBeInTheDocument();
  });

  it('renders the type selector', async () => {
    const { default: TravelAllowancesPage } = await import('../../pages/TravelAllowancesPage');
    render(<TravelAllowancesPage />, { wrapper: makeWrapper() });
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
  });

  it('renders a save button', async () => {
    const { default: TravelAllowancesPage } = await import('../../pages/TravelAllowancesPage');
    render(<TravelAllowancesPage />, { wrapper: makeWrapper() });
    expect(screen.getByRole('button', { name: /guardar/i })).toBeInTheDocument();
  });
});
