import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import FamilyAccounts from '../FamilyAccounts';
import { FamilyProvider } from '../FamilyProvider';
import { AuthProvider, useAuth } from '../../../contexts/AuthContext';
import * as accountsService from '../../../services/accounts';
import * as familyService from '../../../services/family';

// Mock dos serviços
vi.mock('../../../services/accounts', () => ({
  getAccountsWithBalances: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock('../../../services/family', () => ({
  getFamilyData: vi.fn(() => Promise.resolve({
    family: {
      id: 'family-1',
      nome: 'Família Silva',
      description: 'Família de teste',
    },
    myRole: 'owner',
  })),
  getFamilyMembers: vi.fn(() => Promise.resolve([])),
  getPendingInvites: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock do AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: vi.fn(),
}));

// Mock do Supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      getSession: vi.fn(() => 
        Promise.resolve({
          data: { session: null },
          error: null,
        })
      ),
      signUp: vi.fn().mockImplementation(({ email }) => 
        Promise.resolve({
          data: { user: { email }, session: null },
          error: null,
        })
      ),
      signInWithPassword: vi.fn().mockImplementation(({ email }) => 
        Promise.resolve({
          data: { user: { email }, session: { user: { email } } },
          error: null,
        })
      ),
    },
    rpc: vi.fn((functionName, params) => {
      console.log('[Mock RPC] Called with:', functionName, params);
      if (functionName === 'get_family_accounts_with_balances') {
        console.log('[Mock RPC] Returning accounts:', [...mockBankAccounts, ...mockCreditCards]);
        return Promise.resolve({ data: [...mockBankAccounts, ...mockCreditCards], error: null });
      }
      if (functionName === 'get_family_goals') {
        return Promise.resolve({ data: [], error: null });
      }
      if (functionName === 'get_family_budgets') {
        return Promise.resolve({ data: [], error: null });
      }
      if (functionName === 'get_family_transactions') {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: [], error: null });
    }),
  },
}));

// Wrapper para testes
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <FamilyProvider>
            {children}
          </FamilyProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Dados de teste
const mockUser = { id: 'test-user-id', email: 'test@example.com' };

const mockFamilyData = {
  family: {
    id: 'family-1',
    nome: 'Família Silva',
    description: 'Família de teste',
  },
  myRole: 'owner' as const,
};

// Configurar mock do useAuth
const mockUseAuth = vi.mocked(useAuth);
mockUseAuth.mockReturnValue({
  user: mockUser,
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
});

const mockBankAccounts = [
  {
    account_id: 'account-1',
    nome: 'Conta Corrente',
    tipo: 'conta corrente',
    saldo_atual: 500000, // 5000€ em cêntimos
    saldo_disponivel: 450000, // 4500€ em cêntimos
    total_reservado: 50000, // 500€ em cêntimos
  },
  {
    account_id: 'account-2',
    nome: 'Poupança',
    tipo: 'poupança',
    saldo_atual: 1000000, // 10000€ em cêntimos
    saldo_disponivel: 1000000, // 10000€ em cêntimos
    total_reservado: 0,
  },
];

const mockCreditCards = [
  {
    account_id: 'card-1',
    nome: 'Cartão Principal',
    tipo: 'cartão de crédito',
    saldo_atual: -150000, // -1500€ em cêntimos
    saldo_disponivel: -150000, // -1500€ em cêntimos
    total_reservado: 0,
  },
  {
    account_id: 'card-2',
    nome: 'Cartão Secundário',
    tipo: 'cartão de crédito',
    saldo_atual: 0,
    saldo_disponivel: 0,
    total_reservado: 0,
  },
];

describe('FamilyAccounts - Cenários de Teste', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cenário 1: Família com Contas e Cartões', () => {
    it('deve exibir contas bancárias e cartões de crédito corretamente', async () => {
      // Mock dos dados
      const getAccountsWithBalances = vi.mocked(accountsService.getAccountsWithBalances);
      getAccountsWithBalances.mockResolvedValue([...mockBankAccounts, ...mockCreditCards]);

      const getFamilyData = vi.mocked(familyService.getFamilyData);
      getFamilyData.mockResolvedValue(mockFamilyData);

      render(
        <TestWrapper>
          <FamilyAccounts />
        </TestWrapper>
      );

      // Aguardar carregamento
      await waitFor(() => {
        expect(screen.getByText('Contas Familiares')).toBeInTheDocument();
      });

      // Verificar seção de contas bancárias
      expect(screen.getByText('Contas Bancárias')).toBeInTheDocument();
      expect(screen.getByText('Conta Corrente')).toBeInTheDocument();
      expect(screen.getByText('Poupança')).toBeInTheDocument();

      // Verificar seção de cartões de crédito
      expect(screen.getByText('Cartões de Crédito')).toBeInTheDocument();
      expect(screen.getByText('Cartão Principal')).toBeInTheDocument();
      expect(screen.getByText('Cartão Secundário')).toBeInTheDocument();

      // Verificar status dos cartões
      expect(screen.getByText('Em Dívida')).toBeInTheDocument();
      expect(screen.getByText('Em Dia')).toBeInTheDocument();
    });

    it('deve permitir criar nova conta quando user tem permissões', async () => {
      const getAccountsWithBalances = vi.mocked(accountsService.getAccountsWithBalances);
      getAccountsWithBalances.mockResolvedValue([...mockBankAccounts, ...mockCreditCards]);

      const getFamilyData = vi.mocked(familyService.getFamilyData);
      getFamilyData.mockResolvedValue(mockFamilyData);

      render(
        <TestWrapper>
          <FamilyAccounts />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Nova Conta')).toBeInTheDocument();
      });

      const newAccountButton = screen.getByText('Nova Conta');
      fireEvent.click(newAccountButton);

      // Verificar se o modal de criação aparece com o título correto
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Criar nova conta familiar')).toBeInTheDocument();
      });
    });
  });

  describe('Cenário 2: Família sem Contas', () => {
    it('deve exibir estados vazios quando não há contas', async () => {
      const getAccountsWithBalances = vi.mocked(accountsService.getAccountsWithBalances);
      getAccountsWithBalances.mockResolvedValue([]);

      const getFamilyData = vi.mocked(familyService.getFamilyData);
      getFamilyData.mockResolvedValue(mockFamilyData);

      render(
        <TestWrapper>
          <FamilyAccounts />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Nenhuma conta bancária encontrada')).toBeInTheDocument();
        expect(screen.getByText('Nenhum cartão de crédito encontrado')).toBeInTheDocument();
      });
    });
  });

  describe('Cenário 3: Família com Apenas Contas Bancárias', () => {
    it('deve exibir apenas contas bancárias quando não há cartões', async () => {
      const getAccountsWithBalances = vi.mocked(accountsService.getAccountsWithBalances);
      getAccountsWithBalances.mockResolvedValue(mockBankAccounts);

      const getFamilyData = vi.mocked(familyService.getFamilyData);
      getFamilyData.mockResolvedValue(mockFamilyData);

      render(
        <TestWrapper>
          <FamilyAccounts />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Conta Corrente')).toBeInTheDocument();
        expect(screen.getByText('Poupança')).toBeInTheDocument();
        expect(screen.getByText('Nenhum cartão de crédito encontrado')).toBeInTheDocument();
      });
    });
  });

  describe('Cenário 4: Família com Apenas Cartões de Crédito', () => {
    it('deve exibir apenas cartões quando não há contas bancárias', async () => {
      const getAccountsWithBalances = vi.mocked(accountsService.getAccountsWithBalances);
      getAccountsWithBalances.mockResolvedValue(mockCreditCards);

      const getFamilyData = vi.mocked(familyService.getFamilyData);
      getFamilyData.mockResolvedValue(mockFamilyData);

      render(
        <TestWrapper>
          <FamilyAccounts />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Nenhuma conta bancária encontrada')).toBeInTheDocument();
        expect(screen.getByText('Cartão Principal')).toBeInTheDocument();
        expect(screen.getByText('Cartão Secundário')).toBeInTheDocument();
      });
    });
  });

  describe('Cenário 5: Utilizador sem Permissões', () => {
    it('deve ocultar botões de ação quando user não tem permissões', async () => {
      const getAccountsWithBalances = vi.mocked(accountsService.getAccountsWithBalances);
      getAccountsWithBalances.mockResolvedValue([...mockBankAccounts, ...mockCreditCards]);

      const getFamilyData = vi.mocked(familyService.getFamilyData);
      getFamilyData.mockResolvedValue({
        ...mockFamilyData,
        myRole: 'viewer' as const,
      });

      render(
        <TestWrapper>
          <FamilyAccounts />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Contas Familiares')).toBeInTheDocument();
      });

      // Verificar que botões de ação não estão presentes
      expect(screen.queryByText('Nova Conta')).not.toBeInTheDocument();
      expect(screen.queryByText('Transferir')).not.toBeInTheDocument();
    });
  });

  describe('Cenário 6: Estados de Loading', () => {
    it('deve exibir loading state durante carregamento', async () => {
      const getAccountsWithBalances = vi.mocked(accountsService.getAccountsWithBalances);
      getAccountsWithBalances.mockImplementation(() => new Promise(() => {})); // Promise que nunca resolve

      const getFamilyData = vi.mocked(familyService.getFamilyData);
      getFamilyData.mockResolvedValue(mockFamilyData);

      render(
        <TestWrapper>
          <FamilyAccounts />
        </TestWrapper>
      );

      expect(screen.getByText('A carregar contas...')).toBeInTheDocument();
    });
  });

  describe('Cenário 7: Operações CRUD', () => {
    it('deve permitir editar conta existente', async () => {
      const getAccountsWithBalances = vi.mocked(accountsService.getAccountsWithBalances);
      getAccountsWithBalances.mockResolvedValue([...mockBankAccounts, ...mockCreditCards]);

      const getFamilyData = vi.mocked(familyService.getFamilyData);
      getFamilyData.mockResolvedValue(mockFamilyData);

      render(
        <TestWrapper>
          <FamilyAccounts />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Conta Corrente')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText('Editar');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Editar Conta')).toBeInTheDocument();
      });
    });

    it('deve permitir eliminar conta com confirmação', async () => {
      const getAccountsWithBalances = vi.mocked(accountsService.getAccountsWithBalances);
      getAccountsWithBalances.mockResolvedValue([...mockBankAccounts, ...mockCreditCards]);

      const getFamilyData = vi.mocked(familyService.getFamilyData);
      getFamilyData.mockResolvedValue(mockFamilyData);

      render(
        <TestWrapper>
          <FamilyAccounts />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Conta Corrente')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByText('Eliminar');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Eliminar Conta')).toBeInTheDocument();
        expect(screen.getByText(/Tem a certeza que deseja eliminar/)).toBeInTheDocument();
      });
    });
  });

  describe('Cenário 8: Transferências', () => {
    it('deve permitir abrir modal de transferência', async () => {
      const getAccountsWithBalances = vi.mocked(accountsService.getAccountsWithBalances);
      getAccountsWithBalances.mockResolvedValue([...mockBankAccounts, ...mockCreditCards]);

      const getFamilyData = vi.mocked(familyService.getFamilyData);
      getFamilyData.mockResolvedValue(mockFamilyData);

      render(
        <TestWrapper>
          <FamilyAccounts />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Transferir')).toBeInTheDocument();
      });

      const transferButton = screen.getByText('Transferir');
      fireEvent.click(transferButton);

      // Verificar se o modal de transferência aparece
      await waitFor(() => {
        expect(screen.getByText('A carregar modal...')).toBeInTheDocument();
      });
    });
  });

  describe('Cenário 9: Formatação de Valores', () => {
    it.skip('deve formatar valores monetários corretamente', async () => {
      // Expectativas de formatação dependem do locale do ambiente (separadores de milhar)
      const getAccountsWithBalances = vi.mocked(accountsService.getAccountsWithBalances);
      getAccountsWithBalances.mockResolvedValue([...mockBankAccounts, ...mockCreditCards]);

      const getFamilyData = vi.mocked(familyService.getFamilyData);
      getFamilyData.mockResolvedValue(mockFamilyData);

      render(
        <TestWrapper>
          <FamilyAccounts />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('5000,00 €')).toBeInTheDocument();
        expect(screen.getByText('10 000,00 €')).toBeInTheDocument();
        expect(screen.getByText('-1500,00 €')).toBeInTheDocument();
      });
    });
  });

  describe('Cenário 10: Responsividade', () => {
    it('deve adaptar layout para diferentes tamanhos de ecrã', async () => {
      const getAccountsWithBalances = vi.mocked(accountsService.getAccountsWithBalances);
      getAccountsWithBalances.mockResolvedValue([]);

      const getFamilyData = vi.mocked(familyService.getFamilyData);
      getFamilyData.mockResolvedValue(mockFamilyData);

      render(
        <TestWrapper>
          <FamilyAccounts />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Contas Familiares')).toBeInTheDocument();
      });

      // Verificar que o componente renderiza corretamente mesmo sem contas
      expect(screen.getByText('Nenhuma conta bancária familiar encontrada')).toBeInTheDocument();
      expect(screen.getByText('Nenhum cartão de crédito familiar encontrado')).toBeInTheDocument();
    });
  });
});