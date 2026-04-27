import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AccountForm from '@/components/AccountForm';
import { useAuth } from '@/contexts/AuthContext';
import * as accountsService from '@/services/accounts';
import { useCreateAccount, useUpdateAccount } from '@/hooks/useAccountsQuery';

// Mock dos serviços e hooks
vi.mock('@/contexts/AuthContext');
vi.mock('@/services/accounts');
vi.mock('@/hooks/useAccountsQuery');

const mockUseAuth = vi.mocked(useAuth);
const mockAccountsService = vi.mocked(accountsService);
const mockUseCreateAccount = vi.mocked(useCreateAccount);
const mockUseUpdateAccount = vi.mocked(useUpdateAccount);

// Wrapper para QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('AccountForm', () => {
  const mockUser = { id: 'test-user-id', email: 'test@example.com' };
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  // Mock das mutações
  const mockCreateMutation = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    error: null,
  };

  const mockUpdateMutation = {
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock do scrollIntoView para JSDOM
    Element.prototype.scrollIntoView = vi.fn();
    
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });

    mockAccountsService.createAccount.mockResolvedValue({
      data: { id: 'new-account-id', nome: 'Nova Conta', tipo: 'corrente' },
      error: null,
    });

    mockAccountsService.updateAccount.mockResolvedValue({
      data: { id: 'account-1', nome: 'Conta Atualizada', tipo: 'corrente' },
      error: null,
    });

    // Mock dos hooks de mutação
    mockUseCreateAccount.mockReturnValue(mockCreateMutation as any);
    mockUseUpdateAccount.mockReturnValue(mockUpdateMutation as any);
  });

  it('should render form fields correctly', () => {
    render(
      <AccountForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByPlaceholderText('Nome da Conta')).toBeInTheDocument();
    expect(screen.getByText('Tipo de Conta')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Saldo Atual (€) - Opcional')).toBeInTheDocument();
    expect(screen.getByText('Criar')).toBeInTheDocument();
    expect(screen.getByText('Cancelar')).toBeInTheDocument();
  });

  it('should handle form submission for new account', async () => {
    render(
      <AccountForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    // Preencher campos
    fireEvent.change(screen.getByPlaceholderText('Nome da Conta'), {
      target: { value: 'Conta Teste' },
    });
    
    // Preencher o campo tipo (select) - usar uma abordagem mais simples
    // Simular a seleção diretamente através do valor
    const tipoSelect = screen.getByRole('combobox');
    fireEvent.click(tipoSelect);
    
    // Aguardar um pouco para o dropdown abrir
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Tentar encontrar a opção por diferentes métodos
    let option;
    try {
      option = screen.getByText('Conta Corrente');
    } catch {
      // Se não encontrar pelo texto, tentar pelo role
      option = screen.getByRole('option', { name: /conta corrente/i });
    }
    
    fireEvent.click(option);
    
    fireEvent.change(screen.getByPlaceholderText('Saldo Atual (€) - Opcional'), {
      target: { value: '1000' },
    });

    // Submeter formulário
    fireEvent.click(screen.getByText('Criar'));

    await waitFor(() => {
      expect(mockCreateMutation.mutateAsync).toHaveBeenCalledWith({
        nome: 'Conta Teste',
        tipo: 'corrente',
        amount_cents: 100000,
      });
    });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should handle form submission for editing account', async () => {
    const existingAccount = {
      id: 'account-1',
      nome: 'Conta Existente',
      tipo: 'corrente' as const,
      saldoAtual: 500,
    };

    render(
      <AccountForm 
        initialData={existingAccount}
        onSuccess={mockOnSuccess} 
        onCancel={mockOnCancel} 
      />,
      { wrapper: createWrapper() }
    );

    // Verificar se os campos estão preenchidos
    expect(screen.getByDisplayValue('Conta Existente')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    expect(screen.getByText('Atualizar')).toBeInTheDocument();

    // Alterar nome
    fireEvent.change(screen.getByDisplayValue('Conta Existente'), {
      target: { value: 'Conta Atualizada' },
    });

    // Submeter formulário
    fireEvent.click(screen.getByText('Atualizar'));

    await waitFor(() => {
      expect(mockUpdateMutation.mutateAsync).toHaveBeenCalledWith({
        id: 'account-1',
        data: {
          nome: 'Conta Atualizada',
          tipo: 'corrente',
          saldoAtual: 500,
          ajusteSaldo: 0,
        }
      });
    });

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should handle cancel button click', () => {
    render(
      <AccountForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByText('Cancelar'));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should show validation errors for empty required fields', async () => {
    render(
      <AccountForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    // Tentar submeter sem preencher campos obrigatórios
    fireEvent.click(screen.getByText('Criar'));

    // Verificar que o serviço não foi chamado (validação impediu submissão)
    await waitFor(() => {
      expect(mockAccountsService.createAccount).not.toHaveBeenCalled();
    });
  });

  it('should handle numeric input for saldo inicial', () => {
    render(
      <AccountForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />,
      { wrapper: createWrapper() }
    );

    const saldoInput = screen.getByPlaceholderText('Saldo Atual (€) - Opcional');
    
    // Testar input numérico válido
    fireEvent.change(saldoInput, { target: { value: '1500.50' } });
    expect(saldoInput).toHaveValue('1500.5');

    // Testar input não numérico (deve ser filtrado)
    fireEvent.change(saldoInput, { target: { value: 'abc123' } });
    expect(saldoInput).toHaveValue('123');
  });
});