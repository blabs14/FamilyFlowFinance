import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getAccounts } from '../services/accounts';
import { getTransactions } from '../services/transactions';
import { getGoals } from '../services/goals';
import { getCategories } from '../services/categories';
import { getPersonalKPIs } from '../services/accounts';
import { logger } from '../shared/lib/logger';

export const useDashboardData = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('Utilizador não autenticado');
      }

      try {
        // Buscar dados principais e KPIs pessoais (RPC evita cálculos redundantes no frontend)
        const [accountsResult, transactionsResult, goalsResult, categoriesResult, kpisResult] = await Promise.all([
          getAccounts(),
          getTransactions(),
          getGoals(user.id),
          getCategories(),
          getPersonalKPIs(),
        ]);

        if (accountsResult.error) throw accountsResult.error;
        if (transactionsResult.error) throw transactionsResult.error;
        if (goalsResult.error) throw goalsResult.error;
        if (categoriesResult.error) throw categoriesResult.error;

        const accounts = accountsResult.data || [];
        const transactions = (transactionsResult.data || []).filter((tx) => tx.tipo !== 'transferencia');
        const goals = goalsResult.data || [];
        const categories = categoriesResult.data || [];

        // KPIs do RPC
        const rpc = (kpisResult?.data as Record<string, unknown>) || {};
        const totalBalanceFromRPC = Number(rpc.total_balance) || 0;
        const monthlySavingsFromRPC = Number(rpc.monthly_savings) || 0;
        const goalsProgressPctFromRPC = rpc.goals_progress_percentage != null ? Number(rpc.goals_progress_percentage) : null;
        const budgetSpentPctFromRPC = rpc.budget_spent_percentage != null ? Number(rpc.budget_spent_percentage) : null;

        // Fallbacks locais
        const totalBalanceLocal = accounts.reduce((sum, account) => sum + (Number(account.saldo) || 0), 0);
        const totalBalance = totalBalanceFromRPC !== 0 ? totalBalanceFromRPC : totalBalanceLocal;

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyTransactions = transactions.filter((tx) => {
          const txDate = new Date(tx.data);
          return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
        });
        const monthlyIncome = monthlyTransactions
          .filter((tx) => tx.tipo === 'receita')
          .reduce((sum, tx) => sum + (Number(tx.valor) || 0), 0);
        const monthlyExpenses = monthlyTransactions
          .filter((tx) => tx.tipo === 'despesa')
          .reduce((sum, tx) => sum + (Number(tx.valor) || 0), 0);

        const activeGoals = goals.filter((goal) => goal.ativa !== false).length;
        const totalGoals = goals.length;

        // Top categorias por contagem (exclui transferências)
        const categoryCounts = transactions.reduce((acc, tx) => {
          const category = categories.find((cat) => cat.id === tx.categoria_id);
          const categoryName = category?.nome || 'Categoria Desconhecida';
          acc[categoryName] = (acc[categoryName] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        const topCategories = Object.entries(categoryCounts)
          .map(([categoryName, count]) => ({ category: categoryName, count: count as number }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        return {
          totalBalance,
          monthlyIncome,
          monthlyExpenses,
          monthlySavings: monthlySavingsFromRPC !== 0 ? monthlySavingsFromRPC : (monthlyIncome - monthlyExpenses),
          activeGoals,
          totalGoals,
          topCategories,
          goalsProgressPercentage: goalsProgressPctFromRPC, // pode ser null se o RPC não reportar
          budgetSpentPercentage: budgetSpentPctFromRPC,     // pode ser null se o RPC não reportar
        } as const;
      } catch (error) {
        logger.error('Erro no dashboard query:', error);
        throw error;
      }
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
};