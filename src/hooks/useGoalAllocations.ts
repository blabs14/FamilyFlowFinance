import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getGoalAllocations, 
  getAllGoalAllocations, 
  createGoalAllocation, 
  updateGoalAllocation, 
  deleteGoalAllocation,
  deallocateFromGoal,
  getGoalAllocationsTotal,
  getAccountAllocationsTotal
} from '../services/goalAllocations';
import { allocateToGoal } from '../services/goals';
import { useAuth } from '../contexts/AuthContext';

export const useGoalAllocations = (goalId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Hook para alocações de objetivos

  // Garantir que sempre temos um goalId válido para evitar hooks condicionais
  const validGoalId = goalId || 'all';
  const isValidQuery = !!user?.id;

  const {
    data: allocationsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['goalAllocations', user?.id, validGoalId],
    queryFn: async () => {
      // Validação defensiva: se goalId é esperado mas está undefined, retorna array vazio
      if (goalId === undefined) {
        console.warn('⚠️ [useGoalAllocations] goalId é undefined, retornando array vazio');
        return [];
      }
      
      const { data, error } = goalId 
        ? await getGoalAllocations(goalId, user?.id || '')
        : await getAllGoalAllocations(user?.id || '');
      if (error) throw error;
      return data || [];
    },
    enabled: isValidQuery
  });

  const createAllocationMutation = useMutation({
    mutationFn: ({ goalId, accountId, amount, description }: {
      goalId: string;
      accountId: string;
      amount: number;
      description?: string;
    }) => createGoalAllocation({
      goal_id: goalId,
      account_id: accountId,
      valor: amount,
      descricao: description,
      user_id: user?.id || ''
    }, user?.id || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goalAllocations'] });
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

  // Função auxiliar para extrair mensagem de erro amigável
  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      // Se já é uma mensagem amigável (do nosso retry logic), usar diretamente
      if (error.message.includes('Problema de conectividade') || 
          error.message.includes('Dados inválidos') ||
          error.message.includes('deve ser positivo') ||
          error.message.includes('Utilizador não autenticado')) {
        return error.message;
      }
      
      // Tratar outros tipos de erro
      if (error.message.includes('Failed to fetch') || error.message.includes('ERR_ABORTED')) {
        return 'Problema de conectividade. Verifique a sua ligação à internet e tente novamente.';
      }
      
      if (error.message.includes('Parâmetros obrigatórios') || error.message.includes('Parâmetros inválidos')) {
        return 'Dados inválidos. Tente recarregar a página.';
      }
      
      return error.message;
    }
    
    return 'Erro desconhecido. Tente novamente.';
  };

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
      // Validações para evitar UUID inválidos e erros silenciosos
      if (!user?.id) {
        throw new Error('Utilizador não autenticado. Inicie sessão para alocar fundos.');
      }
      
      // Verificar tanto null como undefined para goalId e accountId
      if (!goalId || goalId === null || !accountId || accountId === null) {
        throw new Error('Dados inválidos para alocação: goalId e accountId são obrigatórios.');
      }

      const result = await allocateToGoal(goalId, accountId, amount, user.id, description);
      if ((result as any)?.error) {
        // Converter padrão de retorno { data, error } em exceção para o React Query tratar corretamente
        throw (result as any).error;
      }
      return (result as any)?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goalAllocations'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accountsWithAllocations'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['goalProgress', user.id] });
        queryClient.invalidateQueries({ queryKey: ['accountsWithBalances', user.id] });
        queryClient.invalidateQueries({ queryKey: ['accountsWithBalances-domain', user.id] });
      }
    },
    onError: (error) => {
      const userMessage = getErrorMessage(error);
      console.error('[useGoalAllocations] Erro na alocação:', {
        originalError: error,
        userMessage
      });
      
      // Aqui pode adicionar uma notificação toast se tiver um sistema de notificações
      // toast.error(userMessage);
    }
  });

  const updateAllocationMutation = useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: { valor?: number; data_alocacao?: string; descricao?: string };
    }) => updateGoalAllocation(id, data, user?.id || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goalAllocations'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accountsWithAllocations'] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['goalProgress', user.id] });
        queryClient.invalidateQueries({ queryKey: ['accountsWithBalances', user.id] });
        queryClient.invalidateQueries({ queryKey: ['accountsWithBalances-domain', user.id] });
      }
    }
  });

  const deleteAllocationMutation = useMutation({
    mutationFn: (id: string) => deleteGoalAllocation(id, user?.id || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goalAllocations'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accountsWithAllocations'] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['goalProgress', user.id] });
        queryClient.invalidateQueries({ queryKey: ['accountsWithBalances', user.id] });
        queryClient.invalidateQueries({ queryKey: ['accountsWithBalances-domain', user.id] });
      }
    }
  });

  const deallocateMutation = useMutation({
    mutationFn: async ({ goalId, accountId, amount }: { goalId: string; accountId: string; amount: number }) => {
      if (!goalId || !accountId || !amount || !user?.id) {
        throw new Error('Parâmetros inválidos para desalocação');
      }

      const result = await deallocateFromGoal(
        goalId,
        accountId,
        amount,
        user.id
      );
      
      return result;
    },
    onSuccess: (data) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({
        queryKey: ['goal-allocations']
      });
      
      queryClient.invalidateQueries({
        queryKey: ['personal-goals']
      });
      
      queryClient.invalidateQueries({
        queryKey: ['accounts-with-balances']
      });
      
      console.log('✅ [deallocateMutation] Desalocação bem-sucedida:', data);
    },
    onError: (error) => {
      const userMessage = getErrorMessage(error);
      console.error('❌ [deallocateMutation] Erro na desalocação:', {
        originalError: error,
        userMessage
      });
      
      // Aqui pode adicionar uma notificação toast se tiver um sistema de notificações
      // toast.error(userMessage);
    }
  });

  const getTotalAllocated = async (goalId: string) => {
    return await getGoalAllocationsTotal(goalId, user?.id || '');
  };

  const getAccountTotalAllocated = async (accountId: string) => {
    return await getAccountAllocationsTotal(accountId, user?.id || '');
  };

  return {
    allocations: allocationsData || [],
    isLoading,
    error,
    refetch,
    createAllocation: createAllocationMutation.mutateAsync,
    allocateToGoal: allocateToGoalMutation.mutateAsync,
    updateAllocation: updateAllocationMutation.mutateAsync,
    deleteAllocation: deleteAllocationMutation.mutateAsync,
    deallocate: deallocateMutation.mutateAsync,
    getTotalAllocated,
    getAccountTotalAllocated,
    isCreating: createAllocationMutation.isPending,
    isAllocating: allocateToGoalMutation.isPending,
    isUpdating: updateAllocationMutation.isPending,
    isDeleting: deleteAllocationMutation.isPending,
    isSuccess: allocateToGoalMutation.isSuccess
  };
};