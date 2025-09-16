import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { customRender, setupIntegrationTest, typeIntoInput, submitForm, waitForLoadingToFinish } from '../utils/test-utils';
import { 
  createPersonalAccountData, 
  createPersonalTransactionData,
  createPersonalBudgetData,
  createPersonalReportData,
  createMockPersonalService,
  ACCOUNT_TYPES,
  TRANSACTION_TYPES,
  TRANSACTION_CATEGORIES
} from '../factories/personal-factories';
import { createMockUser } from '../utils/test-utils';
import PersonalDashboard from '@/features/personal/PersonalDashboard';
import PersonalAccounts from '@/features/personal/PersonalAccounts';
import PersonalTransactions from '@/features/personal/PersonalTransactions';
import PersonalBudgets from '@/features/personal/PersonalBudgets';
import PersonalInsights from '@/features/personal/PersonalInsights';

// Mock do serviço pessoal
const mockPersonalService = createMockPersonalService();

// Mock do router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/personal',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock do contexto de autenticação
let mockAuthContext = {
  user: createMockUser(),
  session: null,
  loading: false,
  error: null,
  isAuthenticated: true,
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock do hook de gestão pessoal
let mockPersonalData = {
  accounts: [],
  transactions: [],
  budgets: [],
  reports: null,
  loading: false,
  error: null,
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  createBudget: vi.fn(),
  updateBudget: vi.fn(),
  deleteBudget: vi.fn(),
  generateReport: vi.fn(),
  getAccountBalance: vi.fn(),
  getTransactionHistory: vi.fn(),
};

vi.mock('@/features/personal/hooks/usePersonal', () => ({
  usePersonal: () => mockPersonalData,
}));

// Mock do hook de estatísticas
let mockStatsData = {
  totalBalance: 0,
  monthlyIncome: 0,
  monthlyExpenses: 0,
  savingsRate: 0,
  topCategories: [],
  loading: false,
  error: null,
};

vi.mock('@/features/personal/hooks/usePersonalStats', () => ({
  usePersonalStats: () => mockStatsData,
}));

describe('Fluxo de Gestão Pessoal - Integração', () => {
  const testEnv = setupIntegrationTest();
  const user = userEvent.setup();

  beforeEach(() => {
    // Reset dos dados pessoais
    mockPersonalData = {
      accounts: [],
      transactions: [],
      budgets: [],
      reports: null,
      loading: false,
      error: null,
      createAccount: vi.fn(),
      updateAccount: vi.fn(),
      deleteAccount: vi.fn(),
      createTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      deleteTransaction: vi.fn(),
      createBudget: vi.fn(),
      updateBudget: vi.fn(),
      deleteBudget: vi.fn(),
      generateReport: vi.fn(),
      getAccountBalance: vi.fn(),
      getTransactionHistory: vi.fn(),
    };

    // Reset das estatísticas
    mockStatsData = {
      totalBalance: 0,
      monthlyIncome: 0,
      monthlyExpenses: 0,
      savingsRate: 0,
      topCategories: [],
      loading: false,
      error: null,
    };

    // Reset do contexto de autenticação
    mockAuthContext = {
      user: createMockUser(),
      session: null,
      loading: false,
      error: null,
      isAuthenticated: true,
    };

    // Reset dos mocks
    vi.clearAllMocks();
  });

  describe('Dashboard Pessoal', () => {
    it('deve mostrar resumo financeiro', async () => {
      const accounts = [
        createPersonalAccountData({ 
          name: 'Conta Corrente', 
          type: ACCOUNT_TYPES.CHECKING,
          balance: 2500.00 
        }),
        createPersonalAccountData({ 
          name: 'Conta Poupança', 
          type: ACCOUNT_TYPES.SAVINGS,
          balance: 15000.00 
        }),
      ];
      
      // Mock dos dados carregados
      mockPersonalData.accounts = accounts;
      mockStatsData = {
        totalBalance: 17500.00,
        monthlyIncome: 3500.00,
        monthlyExpenses: 2800.00,
        savingsRate: 20,
        topCategories: [
          { category: TRANSACTION_CATEGORIES.FOOD, amount: 800, percentage: 28.6 },
          { category: TRANSACTION_CATEGORIES.TRANSPORT, amount: 400, percentage: 14.3 },
        ],
        loading: false,
        error: null,
      };

      customRender(<PersonalDashboard />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar resumo financeiro
      expect(screen.getByText(/17[.,]500/)).toBeInTheDocument(); // Saldo total
      expect(screen.getByText(/3[.,]500/)).toBeInTheDocument(); // Receitas mensais
      expect(screen.getByText(/2[.,]800/)).toBeInTheDocument(); // Despesas mensais
      expect(screen.getByText(/20%/)).toBeInTheDocument(); // Taxa de poupança

      // Verificar contas
      expect(screen.getByText('Conta Corrente')).toBeInTheDocument();
      expect(screen.getByText('Conta Poupança')).toBeInTheDocument();
      expect(screen.getByText(/2[.,]500/)).toBeInTheDocument();
      expect(screen.getByText(/15[.,]000/)).toBeInTheDocument();

      // Verificar categorias principais
      expect(screen.getByText(/alimentação/i)).toBeInTheDocument();
      expect(screen.getByText(/transporte/i)).toBeInTheDocument();
      expect(screen.getByText(/800/)).toBeInTheDocument();
      expect(screen.getByText(/400/)).toBeInTheDocument();
    });

    it('deve mostrar estado vazio quando não há dados', async () => {
      // Mock sem dados
      mockPersonalData.accounts = [];
      mockPersonalData.transactions = [];
      mockStatsData.totalBalance = 0;

      customRender(<PersonalDashboard />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar mensagens de estado vazio
      expect(screen.getByText(/ainda não tem contas configuradas/i)).toBeInTheDocument();
      expect(screen.getByText(/começar por criar uma conta/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument();
    });

    it('deve navegar para páginas específicas', async () => {
      const accounts = [createPersonalAccountData()];
      mockPersonalData.accounts = accounts;

      customRender(<PersonalDashboard />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Clicar no botão de ver todas as contas
      const viewAccountsButton = screen.getByRole('button', { name: /ver todas as contas/i });
      await user.click(viewAccountsButton);

      // Verificar navegação
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/personal/accounts');
      });
    });
  });

  describe('Gestão de Contas', () => {
    it('deve criar nova conta', async () => {
      const newAccount = createPersonalAccountData({
        name: 'Nova Conta Corrente',
        type: ACCOUNT_TYPES.CHECKING,
        balance: 1000.00,
      });
      
      // Mock da criação bem-sucedida
      mockPersonalData.createAccount = vi.fn().mockResolvedValue({
        success: true,
        data: newAccount,
      });

      customRender(<PersonalAccounts />);

      // Verificar se a página está carregada
      expect(screen.getByText(/gestão de contas/i)).toBeInTheDocument();

      // Clicar no botão para criar conta
      const createAccountButton = screen.getByRole('button', { name: /criar conta/i });
      await user.click(createAccountButton);

      // Preencher o formulário
      const nameInput = screen.getByLabelText(/nome da conta/i);
      const typeSelect = screen.getByLabelText(/tipo de conta/i);
      const balanceInput = screen.getByLabelText(/saldo inicial/i);
      const descriptionInput = screen.getByLabelText(/descrição/i);
      
      await typeIntoInput(nameInput, newAccount.name);
      await user.selectOptions(typeSelect, newAccount.type);
      await typeIntoInput(balanceInput, newAccount.balance.toString());
      await typeIntoInput(descriptionInput, newAccount.description || '');

      // Submeter o formulário
      const submitButton = screen.getByRole('button', { name: /criar/i });
      await user.click(submitButton);

      // Verificar se a criação foi chamada
      await waitFor(() => {
        expect(mockPersonalData.createAccount).toHaveBeenCalledWith({
          name: newAccount.name,
          type: newAccount.type,
          balance: newAccount.balance,
          description: newAccount.description,
          userId: mockAuthContext.user.id,
        });
      });

      // Verificar mensagem de sucesso
      await waitFor(() => {
        expect(screen.getByText(/conta criada com sucesso/i)).toBeInTheDocument();
      });
    });

    it('deve validar campos obrigatórios ao criar conta', async () => {
      customRender(<PersonalAccounts />);

      // Clicar no botão para criar conta
      const createAccountButton = screen.getByRole('button', { name: /criar conta/i });
      await user.click(createAccountButton);

      // Tentar submeter sem preencher campos
      const submitButton = screen.getByRole('button', { name: /criar/i });
      await user.click(submitButton);

      // Verificar mensagens de validação
      await waitFor(() => {
        expect(screen.getByText(/nome da conta é obrigatório/i)).toBeInTheDocument();
        expect(screen.getByText(/tipo de conta é obrigatório/i)).toBeInTheDocument();
        expect(screen.getByText(/saldo inicial é obrigatório/i)).toBeInTheDocument();
      });

      // Verificar que a criação não foi chamada
      expect(mockPersonalData.createAccount).not.toHaveBeenCalled();
    });

    it('deve editar conta existente', async () => {
      const account = createPersonalAccountData({ 
        name: 'Conta Original', 
        balance: 1000.00 
      });
      const updatedAccount = { 
        ...account, 
        name: 'Conta Atualizada', 
        balance: 1500.00 
      };
      
      // Mock dos dados existentes
      mockPersonalData.accounts = [account];
      mockPersonalData.updateAccount = vi.fn().mockResolvedValue({
        success: true,
        data: updatedAccount,
      });

      customRender(<PersonalAccounts />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Clicar no botão de editar
      const editButton = screen.getByTestId(`edit-account-${account.id}`);
      await user.click(editButton);

      // Modificar os campos
      const nameInput = screen.getByLabelText(/nome da conta/i);
      const balanceInput = screen.getByLabelText(/saldo/i);
      
      await user.clear(nameInput);
      await typeIntoInput(nameInput, updatedAccount.name);
      await user.clear(balanceInput);
      await typeIntoInput(balanceInput, updatedAccount.balance.toString());

      // Submeter as alterações
      const saveButton = screen.getByRole('button', { name: /guardar/i });
      await user.click(saveButton);

      // Verificar se a atualização foi chamada
      await waitFor(() => {
        expect(mockPersonalData.updateAccount).toHaveBeenCalledWith(account.id, {
          name: updatedAccount.name,
          balance: updatedAccount.balance,
        });
      });

      // Verificar mensagem de sucesso
      await waitFor(() => {
        expect(screen.getByText(/conta atualizada com sucesso/i)).toBeInTheDocument();
      });
    });

    it('deve eliminar conta', async () => {
      const account = createPersonalAccountData({ name: 'Conta a Eliminar' });
      
      // Mock dos dados existentes
      mockPersonalData.accounts = [account];
      mockPersonalData.deleteAccount = vi.fn().mockResolvedValue({ success: true });

      customRender(<PersonalAccounts />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Clicar no botão de eliminar
      const deleteButton = screen.getByTestId(`delete-account-${account.id}`);
      await user.click(deleteButton);

      // Confirmar eliminação no modal
      const confirmButton = screen.getByRole('button', { name: /confirmar/i });
      await user.click(confirmButton);

      // Verificar se a eliminação foi chamada
      await waitFor(() => {
        expect(mockPersonalData.deleteAccount).toHaveBeenCalledWith(account.id);
      });

      // Verificar mensagem de sucesso
      await waitFor(() => {
        expect(screen.getByText(/conta eliminada com sucesso/i)).toBeInTheDocument();
      });
    });
  });

  describe('Gestão de Transações', () => {
    it('deve criar nova transação', async () => {
      const account = createPersonalAccountData({ name: 'Conta Corrente' });
      const newTransaction = createPersonalTransactionData({
        accountId: account.id,
        description: 'Compra no supermercado',
        amount: -85.50,
        type: TRANSACTION_TYPES.EXPENSE,
        category: TRANSACTION_CATEGORIES.FOOD,
      });
      
      // Mock dos dados existentes
      mockPersonalData.accounts = [account];
      mockPersonalData.createTransaction = vi.fn().mockResolvedValue({
        success: true,
        data: newTransaction,
      });

      customRender(<PersonalTransactions />);

      // Clicar no botão para criar transação
      const createTransactionButton = screen.getByRole('button', { name: /nova transação/i });
      await user.click(createTransactionButton);

      // Preencher o formulário
      const accountSelect = screen.getByLabelText(/conta/i);
      const descriptionInput = screen.getByLabelText(/descrição/i);
      const amountInput = screen.getByLabelText(/valor/i);
      const typeSelect = screen.getByLabelText(/tipo/i);
      const categorySelect = screen.getByLabelText(/categoria/i);
      const dateInput = screen.getByLabelText(/data/i);
      
      await user.selectOptions(accountSelect, account.id);
      await typeIntoInput(descriptionInput, newTransaction.description);
      await typeIntoInput(amountInput, Math.abs(newTransaction.amount).toString());
      await user.selectOptions(typeSelect, newTransaction.type);
      await user.selectOptions(categorySelect, newTransaction.category);
      await typeIntoInput(dateInput, '2024-03-15');

      // Submeter o formulário
      const submitButton = screen.getByRole('button', { name: /criar transação/i });
      await user.click(submitButton);

      // Verificar se a criação foi chamada
      await waitFor(() => {
        expect(mockPersonalData.createTransaction).toHaveBeenCalledWith({
          accountId: account.id,
          description: newTransaction.description,
          amount: newTransaction.amount,
          type: newTransaction.type,
          category: newTransaction.category,
          date: '2024-03-15',
        });
      });

      // Verificar mensagem de sucesso
      await waitFor(() => {
        expect(screen.getByText(/transação criada com sucesso/i)).toBeInTheDocument();
      });
    });

    it('deve mostrar lista de transações', async () => {
      const account = createPersonalAccountData({ name: 'Conta Corrente' });
      const transactions = [
        createPersonalTransactionData({
          accountId: account.id,
          description: 'Salário',
          amount: 3000.00,
          type: TRANSACTION_TYPES.INCOME,
          category: TRANSACTION_CATEGORIES.SALARY,
          date: '2024-03-01',
        }),
        createPersonalTransactionData({
          accountId: account.id,
          description: 'Supermercado',
          amount: -120.50,
          type: TRANSACTION_TYPES.EXPENSE,
          category: TRANSACTION_CATEGORIES.FOOD,
          date: '2024-03-02',
        }),
      ];
      
      // Mock dos dados carregados
      mockPersonalData.accounts = [account];
      mockPersonalData.transactions = transactions;

      customRender(<PersonalTransactions />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar se as transações são mostradas
      expect(screen.getByText('Salário')).toBeInTheDocument();
      expect(screen.getByText('Supermercado')).toBeInTheDocument();
      expect(screen.getByText(/3[.,]000/)).toBeInTheDocument();
      expect(screen.getByText(/120[.,]50/)).toBeInTheDocument();

      // Verificar tipos e categorias
      expect(screen.getByText(/receita/i)).toBeInTheDocument();
      expect(screen.getByText(/despesa/i)).toBeInTheDocument();
      expect(screen.getByText(/salário/i)).toBeInTheDocument();
      expect(screen.getByText(/alimentação/i)).toBeInTheDocument();
    });

    it('deve filtrar transações por período', async () => {
      const account = createPersonalAccountData();
      const transactions = [
        createPersonalTransactionData({ 
          accountId: account.id,
          date: '2024-01-15',
          description: 'Transação Janeiro' 
        }),
        createPersonalTransactionData({ 
          accountId: account.id,
          date: '2024-02-15',
          description: 'Transação Fevereiro' 
        }),
        createPersonalTransactionData({ 
          accountId: account.id,
          date: '2024-03-15',
          description: 'Transação Março' 
        }),
      ];
      
      mockPersonalData.accounts = [account];
      mockPersonalData.transactions = transactions;

      customRender(<PersonalTransactions />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Filtrar por mês específico
      const monthFilter = screen.getByLabelText(/filtrar por mês/i);
      await user.selectOptions(monthFilter, '2024-02');

      // Verificar se apenas transações de fevereiro são mostradas
      await waitFor(() => {
        expect(screen.getByText('Transação Fevereiro')).toBeInTheDocument();
        expect(screen.queryByText('Transação Janeiro')).not.toBeInTheDocument();
        expect(screen.queryByText('Transação Março')).not.toBeInTheDocument();
      });
    });

    it('deve filtrar transações por categoria', async () => {
      const account = createPersonalAccountData();
      const transactions = [
        createPersonalTransactionData({ 
          accountId: account.id,
          category: TRANSACTION_CATEGORIES.FOOD,
          description: 'Supermercado' 
        }),
        createPersonalTransactionData({ 
          accountId: account.id,
          category: TRANSACTION_CATEGORIES.TRANSPORT,
          description: 'Combustível' 
        }),
      ];
      
      mockPersonalData.accounts = [account];
      mockPersonalData.transactions = transactions;

      customRender(<PersonalTransactions />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Filtrar por categoria
      const categoryFilter = screen.getByLabelText(/filtrar por categoria/i);
      await user.selectOptions(categoryFilter, TRANSACTION_CATEGORIES.FOOD);

      // Verificar se apenas transações de alimentação são mostradas
      await waitFor(() => {
        expect(screen.getByText('Supermercado')).toBeInTheDocument();
        expect(screen.queryByText('Combustível')).not.toBeInTheDocument();
      });
    });
  });

  describe('Gestão de Orçamentos', () => {
    it('deve criar novo orçamento', async () => {
      const newBudget = createPersonalBudgetData({
        category: TRANSACTION_CATEGORIES.FOOD,
        amount: 500.00,
        period: 'monthly',
      });
      
      // Mock da criação bem-sucedida
      mockPersonalData.createBudget = vi.fn().mockResolvedValue({
        success: true,
        data: newBudget,
      });

      customRender(<PersonalBudgets />);

      // Clicar no botão para criar orçamento
      const createBudgetButton = screen.getByRole('button', { name: /criar orçamento/i });
      await user.click(createBudgetButton);

      // Preencher o formulário
      const categorySelect = screen.getByLabelText(/categoria/i);
      const amountInput = screen.getByLabelText(/valor/i);
      const periodSelect = screen.getByLabelText(/período/i);
      
      await user.selectOptions(categorySelect, newBudget.category);
      await typeIntoInput(amountInput, newBudget.amount.toString());
      await user.selectOptions(periodSelect, newBudget.period);

      // Submeter o formulário
      const submitButton = screen.getByRole('button', { name: /criar/i });
      await user.click(submitButton);

      // Verificar se a criação foi chamada
      await waitFor(() => {
        expect(mockPersonalData.createBudget).toHaveBeenCalledWith({
          category: newBudget.category,
          amount: newBudget.amount,
          period: newBudget.period,
          userId: mockAuthContext.user.id,
        });
      });

      // Verificar mensagem de sucesso
      await waitFor(() => {
        expect(screen.getByText(/orçamento criado com sucesso/i)).toBeInTheDocument();
      });
    });

    it('deve mostrar progresso dos orçamentos', async () => {
      const budgets = [
        createPersonalBudgetData({
          category: TRANSACTION_CATEGORIES.FOOD,
          amount: 500.00,
          spent: 320.00,
          remaining: 180.00,
        }),
        createPersonalBudgetData({
          category: TRANSACTION_CATEGORIES.TRANSPORT,
          amount: 200.00,
          spent: 250.00,
          remaining: -50.00,
        }),
      ];
      
      mockPersonalData.budgets = budgets;

      customRender(<PersonalBudgets />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar orçamentos
      expect(screen.getByText(/alimentação/i)).toBeInTheDocument();
      expect(screen.getByText(/transporte/i)).toBeInTheDocument();
      expect(screen.getByText(/500/)).toBeInTheDocument();
      expect(screen.getByText(/200/)).toBeInTheDocument();

      // Verificar progresso
      expect(screen.getByText(/320/)).toBeInTheDocument(); // Gasto
      expect(screen.getByText(/180/)).toBeInTheDocument(); // Restante
      expect(screen.getByText(/250/)).toBeInTheDocument(); // Excedido

      // Verificar indicadores visuais
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars).toHaveLength(2);
      
      // Verificar orçamento excedido
      expect(screen.getByText(/orçamento excedido/i)).toBeInTheDocument();
    });
  });

  describe('Relatórios', () => {
    it('deve gerar relatório mensal', async () => {
      const report = createPersonalReportData({
        period: '2024-03',
        totalIncome: 3500.00,
        totalExpenses: 2800.00,
        netIncome: 700.00,
        categoryBreakdown: [
          { category: TRANSACTION_CATEGORIES.FOOD, amount: 800, percentage: 28.6 },
          { category: TRANSACTION_CATEGORIES.TRANSPORT, amount: 400, percentage: 14.3 },
          { category: TRANSACTION_CATEGORIES.UTILITIES, amount: 300, percentage: 10.7 },
        ],
      });
      
      // Mock da geração bem-sucedida
      mockPersonalData.generateReport = vi.fn().mockResolvedValue({
        success: true,
        data: report,
      });

      customRender(<PersonalInsights />);

      // Selecionar período
      const periodSelect = screen.getByLabelText(/período/i);
      await user.selectOptions(periodSelect, '2024-03');

      // Gerar relatório
      const generateButton = screen.getByRole('button', { name: /gerar relatório/i });
      await user.click(generateButton);

      // Verificar se a geração foi chamada
      await waitFor(() => {
        expect(mockPersonalData.generateReport).toHaveBeenCalledWith({
          period: '2024-03',
          userId: mockAuthContext.user.id,
        });
      });

      // Verificar dados do relatório
      await waitFor(() => {
        expect(screen.getByText(/3[.,]500/)).toBeInTheDocument(); // Receitas
        expect(screen.getByText(/2[.,]800/)).toBeInTheDocument(); // Despesas
        expect(screen.getByText(/700/)).toBeInTheDocument(); // Resultado líquido
      });

      // Verificar breakdown por categoria
      expect(screen.getByText(/alimentação.*28[.,]6%/i)).toBeInTheDocument();
      expect(screen.getByText(/transporte.*14[.,]3%/i)).toBeInTheDocument();
      expect(screen.getByText(/utilidades.*10[.,]7%/i)).toBeInTheDocument();
    });

    it('deve exportar relatório para PDF', async () => {
      const report = createPersonalReportData();
      mockPersonalData.reports = report;

      // Mock da função de exportação
      const mockExportToPDF = vi.fn().mockResolvedValue({ success: true });
      vi.mock('@/utils/pdf-export', () => ({
        exportToPDF: mockExportToPDF,
      }));

      customRender(<PersonalInsights />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Clicar no botão de exportar
      const exportButton = screen.getByRole('button', { name: /exportar pdf/i });
      await user.click(exportButton);

      // Verificar se a exportação foi chamada
      await waitFor(() => {
        expect(mockExportToPDF).toHaveBeenCalledWith(report);
      });

      // Verificar mensagem de sucesso
      await waitFor(() => {
        expect(screen.getByText(/relatório exportado com sucesso/i)).toBeInTheDocument();
      });
    });
  });

  describe('Integração entre Funcionalidades', () => {
    it('deve atualizar saldo da conta após transação', async () => {
      const account = createPersonalAccountData({ 
        name: 'Conta Corrente',
        balance: 1000.00 
      });
      const transaction = createPersonalTransactionData({
        accountId: account.id,
        amount: -100.00,
        type: TRANSACTION_TYPES.EXPENSE,
      });
      
      // Mock dos dados e funções
      mockPersonalData.accounts = [account];
      mockPersonalData.createTransaction = vi.fn().mockResolvedValue({
        success: true,
        data: transaction,
      });
      mockPersonalData.getAccountBalance = vi.fn().mockResolvedValue({
        success: true,
        data: { balance: 900.00 },
      });

      customRender(<PersonalTransactions />);

      // Criar nova transação
      const createTransactionButton = screen.getByRole('button', { name: /nova transação/i });
      await user.click(createTransactionButton);

      // Preencher e submeter formulário
      const accountSelect = screen.getByLabelText(/conta/i);
      const amountInput = screen.getByLabelText(/valor/i);
      const typeSelect = screen.getByLabelText(/tipo/i);
      
      await user.selectOptions(accountSelect, account.id);
      await typeIntoInput(amountInput, '100');
      await user.selectOptions(typeSelect, TRANSACTION_TYPES.EXPENSE);

      const submitButton = screen.getByRole('button', { name: /criar transação/i });
      await user.click(submitButton);

      // Verificar se o saldo foi atualizado
      await waitFor(() => {
        expect(mockPersonalData.createTransaction).toHaveBeenCalled();
        expect(mockPersonalData.getAccountBalance).toHaveBeenCalledWith(account.id);
      });
    });

    it('deve sincronizar orçamentos com transações', async () => {
      const budget = createPersonalBudgetData({
        category: TRANSACTION_CATEGORIES.FOOD,
        amount: 500.00,
      });
      const transaction = createPersonalTransactionData({
        category: TRANSACTION_CATEGORIES.FOOD,
        amount: -50.00,
        type: TRANSACTION_TYPES.EXPENSE,
      });
      
      // Mock dos dados
      mockPersonalData.budgets = [budget];
      mockPersonalData.transactions = [transaction];
      mockPersonalData.createTransaction = vi.fn().mockResolvedValue({
        success: true,
        data: transaction,
      });

      customRender(<PersonalBudgets />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar se o orçamento reflete a transação
      expect(screen.getByText(/alimentação/i)).toBeInTheDocument();
      expect(screen.getByText(/500/)).toBeInTheDocument(); // Orçamento total
      expect(screen.getByText(/50/)).toBeInTheDocument(); // Gasto
    });

    it('deve navegar entre páginas mantendo contexto', async () => {
      const account = createPersonalAccountData({ name: 'Conta Principal' });
      mockPersonalData.accounts = [account];

      customRender(<PersonalDashboard />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Navegar para transações a partir do dashboard
      const viewTransactionsButton = screen.getByRole('button', { name: /ver transações/i });
      await user.click(viewTransactionsButton);

      // Verificar navegação
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/personal/transactions');
      });

      // Simular navegação para página de transações
      customRender(<PersonalTransactions />);

      // Verificar se o contexto da conta é mantido
      await waitForLoadingToFinish();
      expect(screen.getByText('Conta Principal')).toBeInTheDocument();
    });
  });
});