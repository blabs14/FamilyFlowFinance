import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import * as transactionService from '../services/transactions';
import type { TransactionUpdate } from '../integrations/supabase/types';
import { logger } from '../shared/lib/logger';

// Hook para buscar transações
export const useTransactions = (filters?: { account_id?: string }) => {
  const { user } = useAuth();
  
  // Debug: useTransactions hook called
  
  return useQuery({
    queryKey: ['transactions', user?.id, filters?.account_id],
    queryFn: async () => {
      // Debug: Query function called
      const { data, error } = await transactionService.getTransactions();
      if (error) throw error;
      // Debug: Query result received
      let list = data || [];
      if (filters?.account_id) {
        list = list.filter(tx => tx.account_id === filters.account_id);
      }
      return list;
    },
    enabled: !!user,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 0, // Dados sempre considerados stale para forçar refetch
    gcTime: 5 * 60 * 1000, // 5 minutos de cache
  });
};

// Hook para criar transação
export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (transactionData: Parameters<typeof transactionService.createTransaction>[0]) => {
      // Debug: Create transaction mutation called
      const result = await transactionService.createTransaction(transactionData, user?.id || '');
      // Debug: Service result received
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      // Debug: Create transaction success, invalidating queries
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accountsWithBalances', user?.id] });
      // Invalidação mais agressiva
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['creditCardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['creditCardSummary', user?.id] });
      // Debug: Invalidation complete
    },
    onError: (error) => {
      logger.error('Erro ao criar transação:', error);
    }
  });
};

// Hook para atualizar transação
export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TransactionUpdate }) => {
      // Debug: Update transaction mutation called
      const result = await transactionService.updateTransaction(id, data, user?.id || '');
      // Debug: Service result received
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      // Debug: Update transaction success, invalidating queries
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accountsWithBalances', user?.id] });
      // Invalidação mais agressiva
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['creditCardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['creditCardSummary', user?.id] });
      // Debug: Invalidation complete
    },
    onError: (error) => {
      logger.error('Erro ao atualizar transação:', error);
    }
  });
};

// Hook para eliminar transação
export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await transactionService.deleteTransaction(id, user?.id || '');
      if (result.error) {
        const errorMessage = result.error && typeof result.error === 'object' && 'message' in result.error 
          ? (result.error as { message: string }).message 
          : 'Erro ao eliminar transação';
        throw new Error(errorMessage);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accountsWithBalances', user?.id] });
      // Invalidação mais agressiva
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['creditCardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['creditCardSummary', user?.id] });
    },
    onError: (error) => {
      logger.error('Erro ao eliminar transação:', error);
    }
  });
};

// Hook para transações recentes (otimizado para dashboard)
export const useRecentTransactions = (limit: number = 5) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recent-transactions', limit],
    queryFn: async () => {
      const { data, error } = await transactionService.getTransactions();
      if (error) throw error;
      
      // Ordenar por data e pegar as mais recentes
      const sorted = (data || []).sort((a, b) => 
        new Date(b.data).getTime() - new Date(a.data).getTime()
      );
      
      return sorted.slice(0, limit);
    },
    enabled: !!user,
    staleTime: 1 * 60 * 1000, // 1 minuto para dados recentes
  });
};

// Hook para estatísticas de transações
export const useTransactionStats = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['transaction-stats'],
    queryFn: async () => {
      const { data, error } = await transactionService.getTransactions();
      if (error) throw error;
      
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const monthlyTransactions = (data || []).filter(tx => {
        const txDate = new Date(tx.data);
        return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      });

      const income = monthlyTransactions
        .filter(tx => tx.tipo === 'receita')
        .reduce((sum, tx) => sum + Number(tx.valor), 0);

      const expenses = monthlyTransactions
        .filter(tx => tx.tipo === 'despesa')
        .reduce((sum, tx) => sum + Number(tx.valor), 0);

      const balance = income - expenses;

      return {
        monthlyIncome: income,
        monthlyExpenses: expenses,
        balance,
        transactionCount: monthlyTransactions.length,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutos para estatísticas
  });
};