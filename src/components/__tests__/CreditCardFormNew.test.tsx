// src/components/__tests__/CreditCardFormNew.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Stable mock references (Vitest hoists vi.fn() declared at module level)
const mockCreateMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();

vi.mock('../../hooks/useAccountsQuery', () => ({
  useCreateCreditCard: () => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateCreditCard: () => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

import CreditCardFormNew from '../CreditCardFormNew';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('CreditCardFormNew', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMutateAsync.mockResolvedValue({ data: { id: 'card-new' }, error: null });
    mockUpdateMutateAsync.mockResolvedValue({ data: { id: 'card-1' }, error: null });
  });

  it('renderiza campos obrigatórios', () => {
    render(
      <CreditCardFormNew onSuccess={vi.fn()} onCancel={vi.fn()} />,
      { wrapper }
    );
    expect(screen.getByLabelText(/nome do cartão/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/limite de crédito/i)).toBeInTheDocument();
  });

  it('mostra erro de validação quando nome é vazio', async () => {
    render(
      <CreditCardFormNew onSuccess={vi.fn()} onCancel={vi.fn()} />,
      { wrapper }
    );
    fireEvent.click(screen.getByRole('button', { name: /guardar|criar/i }));
    await waitFor(() => {
      expect(screen.getByText(/nome obrigatório/i)).toBeInTheDocument();
    });
  });

  it('chama onSuccess após submissão bem-sucedida', async () => {
    const onSuccess = vi.fn();
    render(
      <CreditCardFormNew onSuccess={onSuccess} onCancel={vi.fn()} />,
      { wrapper }
    );
    fireEvent.change(screen.getByLabelText(/nome do cartão/i), { target: { value: 'Visa Platinum' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar|criar/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});
