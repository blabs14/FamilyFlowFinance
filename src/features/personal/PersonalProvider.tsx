import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getPersonalAccountsWithBalances, 
  createAccount, 
  updateAccount, 
  deleteAccount
} from '../../services/accounts';
import { 
  getPersonalGoals, 
  createGoal, 
  updateGoal, 
  deleteGoal 
} from '../../services/goals';
import { 
  getPersonalBudgets, 
  createBudget, 
  updateBudget, 
  deleteBudget 
} from '../../services/budgets';
import { 
  getPersonalTransactions, 
  createTransaction, 
  updateTransaction, 
  deleteTransaction 
} from '../../services/transactions';
import { useGoals } from '../../hooks/useGoalsQuery';
import { useBudgets } from '../../hooks/useBudgetsQuery';
import { useTransactions } from '../../hooks/useTransactionsQuery';
import { useCrudMutation } from '../../hooks/useMutationWithFeedback';
import { supabase } from '../../lib/supabaseClient';

// Tipos para o contexto
interface PersonalContextType {
  // Dados pessoais (family_id IS NULL)
  myAccounts: any[];
  myCards: any[];
  myGoals: any[];
  myBudgets: any[];
  myTransactions: any[];
  
  // KPIs pessoais
  personalKPIs: {
    totalBalance: number;
    creditCardDebt: number;
    topGoalProgress: number;
    monthlySavings: number;
    goalsAccountBalance: number;
    totalGoalsValue: number;
    goalsProgressPercentage: number;
    totalBudgetSpent: number;
    totalBudgetAmount: number;
    budgetSpentPercentage: number;
  };
  
  // Estados de loading
  isLoading: {
    accounts: boolean;
    goals: boolean;
    budgets: boolean;
    transactions: boolean;
    kpis: boolean;
  };
  
  // Métodos de criação
  createPersonalAccount: (data: any) => Promise<any>;
  createPersonalGoal: (data: any) => Promise<any>;
  createPersonalBudget: (data: any) => Promise<any>;
  createPersonalTransaction: (data: any) => Promise<any>;
  
  // Métodos de atualização
  updatePersonalAccount: (id: string, data: any) => Promise<any>;
  updatePersonalGoal: (id: string, data: any) => Promise<any>;
  updatePersonalBudget: (id: string, data: any) => Promise<any>;
  updatePersonalTransaction: (id: string, data: any) => Promise<any>;
  
  // Métodos de eliminação
  deletePersonalAccount: (id: string) => Promise<any>;
  deletePersonalGoal: (id: string) => Promise<any>;
  deletePersonalBudget: (id: string) => Promise<any>;
  deletePersonalTransaction: (id: string) => Promise<any>;
  
  // Métodos específicos
  payCreditCard: (accountId: string, amount: number) => Promise<any>;
  allocateToGoal: (goalId: string, amount: number, accountId: string) => Promise<any>;
  
  // Refetch methods
  refetchAll: () => void;
}

const PersonalContext = createContext<PersonalContextType | undefined>(undefined);

interface PersonalProviderProps {
  children: ReactNode;
}

export const PersonalProvider: React.FC<PersonalProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query para contas pessoais - usar exatamente a mesma abordagem que funciona na página de contas
  const { data: myAccounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['personal', 'accounts', user?.id],
    queryFn: async () => {
      const { data, error } = await getPersonalAccountsWithBalances(user?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });

  // Separar contas normais de cartões de crédito
  const myCards = myAccounts.filter(account => account.tipo === 'cartão de crédito');
  const regularAccounts = myAccounts.filter(account => account.tipo !== 'cartão de crédito');

  // Query para objetivos pessoais - usar a função que filtra apenas dados pessoais
  const { data: myGoals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ['personal', 'goals', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await getPersonalGoals(user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });

  // Query para orçamentos pessoais - usar a função que filtra apenas dados pessoais
  const { data: myBudgets = [], isLoading: budgetsLoading } = useQuery({
    queryKey: ['personal', 'budgets', user?.id],
    queryFn: async () => {
      const { data, error } = await getPersonalBudgets();
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });

  // Query para transações pessoais - usar a função que filtra apenas dados pessoais
  const { data: myTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['personal', 'transactions', user?.id],
    queryFn: async () => {
      const { data, error } = await getPersonalTransactions();
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });

  // Query para KPIs pessoais
  const { data: personalKPIs, isLoading: kpisLoading } = useQuery({
    queryKey: ['personal', 'kpis', user?.id],
    queryFn: async () => {
      // Calcular saldo total das contas pessoais
      const totalBalance = regularAccounts.reduce((sum, account) => sum + account.saldo_atual, 0);
      
      // Calcular dívida total dos cartões de crédito
      const creditCardDebt = myCards.reduce((sum, card) => {
        const balance = card.saldo_atual;
        return sum + (balance < 0 ? Math.abs(balance) : 0);
      }, 0);
      
      // Calcular progresso do objetivo principal
      const topGoal = myGoals[0];
      const topGoalProgress = topGoal 
        ? ((topGoal.valor_atual || 0) / (topGoal.valor_objetivo || 1)) * 100
        : 0;
      
      // Calcular poupança mensal (simplificado - pode ser melhorado)
      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthlyTransactions = myTransactions.filter(t => 
        t.data.startsWith(currentMonth) && t.tipo === 'receita'
      );
      const monthlySavings = monthlyTransactions.reduce((sum, t) => sum + (t.valor || 0), 0);
      
      // Calcular dados da conta objetivos
      const goalsAccount = myAccounts.find(account => account.nome.toLowerCase().includes('objetivo') || account.tipo === 'objetivo');
      const goalsAccountBalance = goalsAccount ? (goalsAccount.saldo_atual || 0) : 0;
      
      // Calcular valor total de todos os objetivos
      const totalGoalsValue = myGoals.reduce((sum, goal) => sum + (goal.valor_objetivo || 0), 0);
      
      // Calcular percentagem de progresso (valor total dos objetivos vs saldo da conta objetivos)
      const goalsProgressPercentage = totalGoalsValue > 0 ? (goalsAccountBalance / totalGoalsValue) * 100 : 0;
      
      // Calcular dados dos orçamentos (todos os orçamentos existentes)
      const activeBudgets = myBudgets;
      const totalBudgetAmount = activeBudgets.reduce((sum, budget) => sum + (budget.valor_orcamento || 0), 0);
      const totalBudgetSpent = activeBudgets.reduce((sum, budget) => sum + (budget.valor_gasto || 0), 0);
      const budgetSpentPercentage = totalBudgetAmount > 0 ? (totalBudgetSpent / totalBudgetAmount) * 100 : 0;
      
      return {
        totalBalance,
        creditCardDebt,
        topGoalProgress: Math.min(topGoalProgress, 100),
        monthlySavings,
        goalsAccountBalance,
        totalGoalsValue,
        goalsProgressPercentage: Math.min(goalsProgressPercentage, 100),
        totalBudgetSpent,
        totalBudgetAmount,
        budgetSpentPercentage: Math.min(budgetSpentPercentage, 100)
      };
    },
    enabled: !!user?.id && !accountsLoading && !goalsLoading && !budgetsLoading && !transactionsLoading,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });

  // Mutations para contas pessoais
  const createPersonalAccountMutation = useCrudMutation(
    (data: any) => createAccount({ ...data, family_id: null }, user?.id || ''),
    {
      operation: 'create',
      entityName: 'Conta Pessoal',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['personal', 'accounts', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['personal', 'kpis', user?.id] });
      }
    }
  );

  const updatePersonalAccountMutation = useCrudMutation(
    ({ id, data }: { id: string; data: any }) => updateAccount(id, data, user?.id || ''),
    {
      operation: 'update',
      entityName: 'Conta Pessoal',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['personal', 'accounts', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['personal', 'kpis', user?.id] });
      }
    }
  );

  const deletePersonalAccountMutation = useCrudMutation(
    (id: string) => deleteAccount(id, user?.id || ''),
    {
      operation: 'delete',
      entityName: 'Conta Pessoal',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['personal', 'accounts', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['personal', 'kpis', user?.id] });
      }
    }
  );

  // Mutations para objetivos pessoais
  const createPersonalGoalMutation = useCrudMutation(
    (data: any) => createGoal({ ...data, family_id: null }, user?.id || ''),
    {
      operation: 'create',
      entityName: 'Objetivo Pessoal',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['personal', 'goals', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['personal', 'kpis', user?.id] });
      }
    }
  );

  const updatePersonalGoalMutation = useCrudMutation(
    ({ id, data }: { id: string; data: any }) => updateGoal(id, data, user?.id || ''),
    {
      operation: 'update',
      entityName: 'Objetivo Pessoal',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['personal', 'goals', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['personal', 'kpis', user?.id] });
      }
    }
  );

  const deletePersonalGoalMutation = useCrudMutation(
    (id: string) => deleteGoal(id, user?.id || ''),
    {
      operation: 'delete',
      entityName: 'Objetivo Pessoal',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['personal', 'goals', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['personal', 'kpis', user?.id] });
      }
    }
  );

  // Mutations para orçamentos pessoais
  const createPersonalBudgetMutation = useCrudMutation(
    (data: any) => createBudget({ ...data, family_id: null }, user?.id || ''),
    {
      operation: 'create',
      entityName: 'Orçamento Pessoal',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['personal', 'budgets', user?.id] });
      }
    }
  );

  const updatePersonalBudgetMutation = useCrudMutation(
    ({ id, data }: { id: string; data: any }) => updateBudget(id, data, user?.id || ''),
    {
      operation: 'update',
      entityName: 'Orçamento Pessoal',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['personal', 'budgets', user?.id] });
      }
    }
  );

  const deletePersonalBudgetMutation = useCrudMutation(
    (id: string) => deleteBudget(id, user?.id || ''),
    {
      operation: 'delete',
      entityName: 'Orçamento Pessoal',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['personal', 'budgets', user?.id] });
      }
    }
  );

  // Mutations para transações pessoais
  const createPersonalTransactionMutation = useCrudMutation(
    (data: any) => createTransaction({ ...data, family_id: null }, user?.id || ''),
    {
      operation: 'create',
      entityName: 'Transação Pessoal',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['personal', 'transactions', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['personal', 'accounts', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['personal', 'kpis', user?.id] });
      }
    }
  );

  const updatePersonalTransactionMutation = useCrudMutation(
    ({ id, data }: { id: string; data: any }) => updateTransaction(id, data, user?.id || ''),
    {
      operation: 'update',
      entityName: 'Transação Pessoal',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['personal', 'transactions', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['personal', 'accounts', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['personal', 'kpis', user?.id] });
      }
    }
  );

  const deletePersonalTransactionMutation = useCrudMutation(
    (id: string) => deleteTransaction(id, user?.id || ''),
    {
      operation: 'delete',
      entityName: 'Transação Pessoal',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['personal', 'transactions', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['personal', 'accounts', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['personal', 'kpis', user?.id] });
      }
    }
  );

  // Métodos específicos
  const payCreditCard = async (accountId: string, amount: number) => {
    try {
      // Criar transação de pagamento do cartão
      const { error } = await supabase
        .from('transactions')
        .insert([{
          account_id: accountId,
          user_id: user?.id,
          valor: amount,
          tipo: 'receita',
          data: new Date().toISOString().split('T')[0],
          descricao: 'Pagamento do cartão de crédito',
          categoria_id: null // Será definido automaticamente ou pelo utilizador
        }]);

      if (error) throw error;

      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['personal', 'transactions', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['personal', 'accounts', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['personal', 'kpis', user?.id] });

      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  };

  const allocateToGoal = async (goalId: string, amount: number, accountId: string) => {
    try {
      // Usar a função RPC existente para alocar a objetivo
      const { error } = await supabase.rpc('allocate_to_goal_with_transaction', {
        goal_id_param: goalId,
        account_id_param: accountId,
        amount_param: amount,
        user_id_param: user?.id || ''
      });

      if (error) throw error;

      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['personal', 'goals', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['personal', 'accounts', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['personal', 'kpis', user?.id] });

      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  };

  // Método para refetch de todos os dados
  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ['personal'] });
  };

  const contextValue: PersonalContextType = {
    myAccounts,
    myCards,
    myGoals,
    myBudgets,
    myTransactions,
    personalKPIs: personalKPIs || {
      totalBalance: 0,
      creditCardDebt: 0,
      topGoalProgress: 0,
      monthlySavings: 0,
      goalsAccountBalance: 0,
      totalGoalsValue: 0,
      goalsProgressPercentage: 0,
      totalBudgetSpent: 0,
      totalBudgetAmount: 0,
      budgetSpentPercentage: 0
    },
    isLoading: {
      accounts: accountsLoading,
      goals: goalsLoading,
      budgets: budgetsLoading,
      transactions: transactionsLoading,
      kpis: kpisLoading
    },
    createPersonalAccount: createPersonalAccountMutation.mutateAsync,
    createPersonalGoal: createPersonalGoalMutation.mutateAsync,
    createPersonalBudget: createPersonalBudgetMutation.mutateAsync,
    createPersonalTransaction: createPersonalTransactionMutation.mutateAsync,
    updatePersonalAccount: (id: string, data: any) => updatePersonalAccountMutation.mutateAsync({ id, data }),
    updatePersonalGoal: (id: string, data: any) => updatePersonalGoalMutation.mutateAsync({ id, data }),
    updatePersonalBudget: (id: string, data: any) => updatePersonalBudgetMutation.mutateAsync({ id, data }),
    updatePersonalTransaction: (id: string, data: any) => updatePersonalTransactionMutation.mutateAsync({ id, data }),
    deletePersonalAccount: deletePersonalAccountMutation.mutateAsync,
    deletePersonalGoal: deletePersonalGoalMutation.mutateAsync,
    deletePersonalBudget: deletePersonalBudgetMutation.mutateAsync,
    deletePersonalTransaction: deletePersonalTransactionMutation.mutateAsync,
    payCreditCard,
    allocateToGoal,
    refetchAll
  };

  return (
    <PersonalContext.Provider value={contextValue}>
      {children}
    </PersonalContext.Provider>
  );
};

// Hook para usar o contexto
export const usePersonal = () => {
  const context = useContext(PersonalContext);
  if (context === undefined) {
    throw new Error('usePersonal must be used within a PersonalProvider');
  }
  return context;
}; 