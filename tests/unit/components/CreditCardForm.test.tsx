import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CreditCardForm from '@/components/CreditCardForm';
import { setupUser } from '../../utils/testHelpers';

const createAccountMutateAsync = vi.fn();
const updateAccountMutateAsync = vi.fn();
const toastMock = vi.fn();
const invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    loading: false,
  }),
}));

vi.mock('@/hooks/useAccountsQuery', () => ({
  useCreateAccount: () => ({
    mutateAsync: createAccountMutateAsync,
    isPending: false,
  }),
  useUpdateAccount: () => ({
    mutateAsync: updateAccountMutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');

  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: invalidateQueriesMock,
    }),
  };
});

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { saldo_atual: 0 }, error: null }),
        })),
      })),
    })),
  },
}));

vi.mock('@/shared/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

const createInitialData = (overrides: Record<string, unknown> = {}) => ({
  id: '',
  nome: '',
  tipo: 'cartão de crédito',
  saldoAtual: 0,
  ajusteSaldo: 0,
  ...overrides,
});

describe('CreditCardForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAccountMutateAsync.mockResolvedValue({ id: 'new-card-id' });
    updateAccountMutateAsync.mockResolvedValue(undefined);
  });

  it('renders all inputs for the credit card form', () => {
    render(<CreditCardForm initialData={createInitialData()} onCancel={vi.fn()} />);

    expect(screen.getByPlaceholderText(/nome do cartão/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/saldo atual/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ajuste de saldo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar cartão/i })).toBeInTheDocument();
  });

  it('shows a validation error when the name is missing', async () => {
    const user = setupUser();
    render(<CreditCardForm initialData={createInitialData()} onCancel={vi.fn()} />);
    screen.getByRole('button', { name: /criar cartão/i }).closest('form')?.setAttribute('novalidate', 'true');

    await user.click(screen.getByRole('button', { name: /criar cartão/i }));

    expect(await screen.findByText('Nome obrigatório')).toBeInTheDocument();
    expect(createAccountMutateAsync).not.toHaveBeenCalled();
  });

  it('normalizes positive balance input into negative debt', async () => {
    const user = setupUser();
    render(<CreditCardForm initialData={createInitialData()} onCancel={vi.fn()} />);

    const balanceInput = screen.getByPlaceholderText(/saldo atual/i);
    await user.type(balanceInput, '100');

    expect(balanceInput).toHaveValue('-100');
  });

  it('creates a card with the right payload and saldo update when needed', async () => {
    const user = setupUser();
    const onSuccess = vi.fn();
    render(<CreditCardForm initialData={createInitialData()} onCancel={vi.fn()} onSuccess={onSuccess} />);

    await user.type(screen.getByPlaceholderText(/nome do cartão/i), 'Visa');
    await user.type(screen.getByPlaceholderText(/saldo atual/i), '250');
    await user.click(screen.getByRole('button', { name: /criar cartão/i }));

    await waitFor(() => {
      expect(createAccountMutateAsync).toHaveBeenCalledWith({
        nome: 'Visa',
        tipo: 'cartão de crédito',
      });
    });
    expect(updateAccountMutateAsync).toHaveBeenCalledWith({
      id: 'new-card-id',
      saldoAtual: -250,
      ajusteSaldo: 0,
    });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    }, { timeout: 1200 });
  });

  it('populates inputs in edit mode and updates the base account data', async () => {
    const user = setupUser();
    render(
      <CreditCardForm
        initialData={createInitialData({ id: 'card-1', nome: 'Cartão Atual', saldoAtual: -150 })}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText(/nome do cartão/i)).toHaveValue('Cartão Atual');
    expect(screen.getByPlaceholderText(/saldo atual/i)).toHaveValue('-150');

    await user.clear(screen.getByPlaceholderText(/nome do cartão/i));
    await user.type(screen.getByPlaceholderText(/nome do cartão/i), 'Cartão Novo');
    await user.click(screen.getByRole('button', { name: /atualizar/i }));

    await waitFor(() => {
      expect(updateAccountMutateAsync).toHaveBeenCalledWith({
        id: 'card-1',
        nome: 'Cartão Novo',
        tipo: 'cartão de crédito',
      });
    });
  });

  it('does not call updateAccount after create when saldo and adjustment are zero', async () => {
    const user = setupUser();
    render(<CreditCardForm initialData={createInitialData()} onCancel={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/nome do cartão/i), 'Visa Zero');
    await user.click(screen.getByRole('button', { name: /criar cartão/i }));

    await waitFor(() => {
      expect(createAccountMutateAsync).toHaveBeenCalledWith({
        nome: 'Visa Zero',
        tipo: 'cartão de crédito',
      });
    });
    expect(updateAccountMutateAsync).not.toHaveBeenCalled();
  });
});
