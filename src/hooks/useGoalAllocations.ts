import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { deallocateFromGoal } from '../services/goalAllocations';
import { allocateToGoal } from '../services/goals';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export const useGoalAllocations = (goalId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: allocationsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['goalLedger', user?.id, goalId || 'all'],
    queryFn: async () => {
      if (!goalId) return [];
      const { data, error } = await supabase
        .from('goal_ledger')
        .select('*')
        .eq('goal_id', goalId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!goalId
  });

  const allocateToGoalMutation = useMutation({
    mutationFn: async ({
      goalId,
      accountId,
      amount,
      description
    }: {
      goalId: string;
      accountId: string;
      amount: number;
      description?: string;
    }) => {
      if (!user?.id) throw new Error('Utilizador não autenticado. Inicie sessão para alocar fundos.');
      if (!goalId || !accountId) throw new Error('Dados inválidos para alocação: goalId e accountId são obrigatórios.');
      const result = await allocateToGoal(goalId, accountId, amount, user.id, description);
      if ((result as any)?.error) throw (result as any).error;
      return (result as any)?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goalLedger'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['goalProgress', user.id] });
        queryClient.invalidateQueries({ queryKey: ['accountsWithBalances', user.id] });
        queryClient.invalidateQueries({ queryKey: ['accountsWithBalances-domain', user.id] });
      }
    }
  });

  const deallocateMutation = useMutation({
    mutationFn: async ({ goalId, accountId, amount }: { goalId: string; accountId: string; amount: number }) => {
      if (!goalId || !accountId || !amount || !user?.id) throw new Error('Parâmetros inválidos para desalocação');
      return deallocateFromGoal(goalId, accountId, amount, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goalLedger'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accountsWithBalances', user?.id] });
    }
  });

  return {
    allocations: allocationsData || [],
    isLoading,
    error,
    refetch,
    allocateToGoal: allocateToGoalMutation.mutateAsync,
    deallocate: deallocateMutation.mutateAsync,
    isAllocating: allocateToGoalMutation.isPending,
    isDeleting: deallocateMutation.isPending,
    isSuccess: allocateToGoalMutation.isSuccess,
    // Stubs removidos (Unit 7 reescreve fluxo completo de goals)
    createAllocation: async () => { throw new Error('Não disponível — use allocateToGoal'); },
    updateAllocation: async () => { throw new Error('Não disponível — Unit 7 reescreve fluxo de goals'); },
    deleteAllocation: async () => { throw new Error('Não disponível — Unit 7 reescreve fluxo de goals'); },
    getTotalAllocated: async (_goalId: string) => ({ data: 0, error: null }),
    getAccountTotalAllocated: async (_accountId: string) => ({ data: 0, error: null }),
    isCreating: false,
    isUpdating: false,
  };
};
