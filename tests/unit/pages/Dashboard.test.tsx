import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Dashboard from '@/pages/Dashboard';

const navigateMock = vi.fn();
const useDashboardDataMock = vi.fn();
const useAccountsWithBalancesMock = vi.fn();
const useTransactionsMock = vi.fn();
const useGoalsMock = vi.fn();
const useRemindersMock = vi.fn();
const useBudgetsMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'ana@example.com' },
    loading: false,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/hooks/useDashboardQuery', () => ({
  useDashboardData: () => useDashboardDataMock(),
}));

vi.mock('@/hooks/useAccountsQuery', () => ({
  useAccountsWithBalances: () => useAccountsWithBalancesMock(),
}));

vi.mock('@/hooks/useTransactionsQuery', () => ({
  useTransactions: () => useTransactionsMock(),
}));

vi.mock('@/hooks/useGoalsQuery', () => ({
  useGoals: () => useGoalsMock(),
}));

vi.mock('@/hooks/useRemindersQuery', () => ({
  useReminders: () => useRemindersMock(),
}));

vi.mock('@/hooks/useBudgetsQuery', () => ({
  useBudgets: () => useBudgetsMock(),
}));

vi.mock('@/components/DashboardChart', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}));

describe('Dashboard page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAccountsWithBalancesMock.mockReturnValue({ data: [] });
    useTransactionsMock.mockReturnValue({ data: [] });
    useGoalsMock.mockReturnValue({ data: [] });
    useRemindersMock.mockReturnValue({ data: [] });
    useBudgetsMock.mockReturnValue({ data: [] });
  });

  it('renders the loading state', () => {
    useDashboardDataMock.mockReturnValue({ data: null, isLoading: true, error: null });

    render(<Dashboard />);

    expect(screen.getByText(/a carregar dashboard/i)).toBeInTheDocument();
  });

  it('renders the error state', () => {
    useDashboardDataMock.mockReturnValue({ data: null, isLoading: false, error: new Error('boom') });

    render(<Dashboard />);

    expect(screen.getByText(/erro ao carregar dados do dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/tente recarregar a página/i)).toBeInTheDocument();
  });

  it('renders key dashboard sections with loaded data', () => {
    useDashboardDataMock.mockReturnValue({
      data: {
        totalBalance: 1500,
        monthlyIncome: 3000,
        monthlyExpenses: 1200,
        monthlySavings: 1800,
        goalsProgressPercentage: 42.5,
        budgetSpentPercentage: 55.5,
      },
      isLoading: false,
      error: null,
    });
    useAccountsWithBalancesMock.mockReturnValue({
      data: [{ nome: 'Conta Principal', saldo_atual: 1500 }],
    });
    useTransactionsMock.mockReturnValue({
      data: [
        { id: 't1', tipo: 'receita', valor: 3000, descricao: 'Salário', data: '2026-04-01' },
        { id: 't2', tipo: 'despesa', valor: 1200, descricao: 'Renda', data: '2026-04-05' },
      ],
    });
    useGoalsMock.mockReturnValue({
      data: [{ id: 'g1', ativa: true }],
    });
    useRemindersMock.mockReturnValue({
      data: [{ id: 'r1', date: new Date().toISOString().slice(0, 10) }],
    });
    useBudgetsMock.mockReturnValue({
      data: [{ valor_gasto: 200, valor_orcamento: 100 }],
    });

    render(<Dashboard />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/bem-vindo de volta, ana@example.com/i)).toBeInTheDocument();
    expect(screen.getByText('Lembretes de Hoje')).toBeInTheDocument();
    expect(screen.getByText('Orçamentos em Excesso')).toBeInTheDocument();
    expect(screen.getByText('Transações Recentes')).toBeInTheDocument();
    expect(screen.getByText('Distribuição por Conta')).toBeInTheDocument();
    expect(screen.getByText('Receitas vs Despesas')).toBeInTheDocument();
  });
});
