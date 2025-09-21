import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGoals, getGoalsDomain, createGoal, updateGoal, deleteGoal, allocateFunds, getGoalProgress } from '../services/goals';
import { useAuth } from '../contexts/AuthContext';
import type { GoalInsert, GoalUpdate } from '../integrations/supabase/types';
import type { GoalDomain } from '../shared/types/goals';
import { logger } from '@/shared/lib/logger';

export const useGoals = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['goals', user?.id],
    queryFn: async () => {
      console.log('🎯 useGoals: Starting query for user:', user?.id);
      // Garantir que temos um userId válido antes de fazer a query
      if (!user?.id) {
        console.warn('⚠️ useGoals: No valid userId');
        logger.warn('[useGoals] Tentativa de query sem userId válido');
        return [];
      }
      
      console.log('📡 useGoals: Calling getGoals...');
      const { data, error } = await getGoals(user.id);
      console.log('📊 useGoals: Result data:', data);
      console.log('❌ useGoals: Result error:', error);
      if (error) {
        console.error('💥 useGoals: Error fetching goals:', error);
        logger.error('[useGoals] Erro ao buscar objetivos:', error);
        throw error;
      }
      console.log('✅ useGoals: Returning data:', data || []);
      return data || [];
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: false, // Reduzir refetches desnecessários
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 2 * 60 * 1000, // 2 minutos para permitir persistência
    gcTime: 10 * 60 * 1000, // Aumentar tempo de cache
    retry: (failureCount, error) => {
      // Não tentar novamente se não há userId
      if (!user?.id) return false;
      // Em ambiente de teste, não fazer retry
      if (process.env.NODE_ENV === 'test') return false;
      return failureCount < 3;
    },
  });
};

export const useGoalsDomain = () => {
  const { user } = useAuth();
  return useQuery<GoalDomain[]>({
    queryKey: ['goals-domain', user?.id],
    queryFn: async () => {
      // Garantir que temos um userId válido antes de fazer a query
      if (!user?.id) {
        logger.warn('[useGoalsDomain] Tentativa de query sem userId válido');
        return [];
      }
      
      const { data, error } = await getGoalsDomain(user.id);
      if (error) {
        logger.error('[useGoalsDomain] Erro ao buscar domínio dos objetivos:', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (!user?.id) return false;
      return failureCount < 3;
    },
  });
};

export const useCreateGoal = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: GoalInsert) => {
      const result = await createGoal(data);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['goals-domain'] });
      queryClient.invalidateQueries({ queryKey: ['goalProgress', user?.id] });
    },
  });
};

export const useUpdateGoal = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (
      variables: { id: string; data?: GoalUpdate } & Partial<GoalUpdate>
    ) => {
      const { id, data, ...maybeFields } = variables;
      const updateData: GoalUpdate = data ?? (maybeFields as GoalUpdate);
      const result = await updateGoal(id, updateData);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['goals-domain'] });
      queryClient.invalidateQueries({ queryKey: ['goalProgress', user?.id] });
    }
  });
};

export const useDeleteGoal = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteGoal(id);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['goals-domain'] });
      queryClient.invalidateQueries({ queryKey: ['goalProgress', user?.id] });
    }
  });
};

export const useAllocateFunds = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ goalId, amount }: { goalId: string; amount: number }) => {
      const result = await allocateFunds(goalId, amount);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['goals-domain'] });
      queryClient.invalidateQueries({ queryKey: ['goalProgress', user?.id] });
    }
  });
};

export const useGoalProgress = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['goalProgress', user?.id],
    queryFn: async () => {
      console.log('🎯 useGoalProgress: Starting query for user:', user?.id);
      if (!user?.id) {
        console.warn('⚠️ useGoalProgress: No valid userId');
        logger.warn('[useGoalProgress] Tentativa de query sem userId válido');
        return { data: null, error: 'User ID não disponível' };
      }
      try {
        console.log('📡 useGoalProgress: Calling getGoalProgress...');
        const { data, error } = await getGoalProgress(user.id);
        console.log('📊 useGoalProgress: Result data:', data);
        console.log('❌ useGoalProgress: Result error:', error);
        if (error) {
          logger.error('[useGoalProgress] Erro ao buscar progresso dos objetivos:', error);
          throw error;
        }
        console.log('✅ useGoalProgress: Returning data:', data);
        return data;
      } catch (error) {
        console.error('💥 useGoalProgress: Unexpected error:', error);
        logger.error('[useGoalProgress] Erro inesperado:', error);
        throw error;
      }
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};