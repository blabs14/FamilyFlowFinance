// src/hooks/useGoalsQuery.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useScope } from '../features/scope';
import {
  getGoalsWithBalance,
  getGoalLedger,
  createGoal,
  updateGoal,
  deleteGoal,
  allocateToGoal,
  deallocateFromGoal,
  completeGoal,
  setContributorTarget,
  // legacy
  getGoals,
  getGoalsDomain,
  getGoalProgress,
  allocateFunds,
  type GoalWithBalance,
  type CompleteGoalParams,
  type AllocateGoalParams,
} from '../services/goals';
import { useAuth } from '../contexts/AuthContext';
import type { GoalInsert, GoalUpdate } from '../integrations/supabase/types';
import type { GoalDomain } from '../shared/types/goals';

const GOALS_KEY = 'goals_with_balance';

// --- Scope-aware primary hook ---

export const useGoalsWithBalance = () => {
  const { scope } = useScope();
  const familyId = scope.kind === 'family' ? scope.familyId : null;

  return useQuery<GoalWithBalance[]>({
    queryKey: [GOALS_KEY, familyId],
    queryFn: async () => {
      const { data, error } = await getGoalsWithBalance(familyId);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });
};

export const useGoalLedger = (goalId?: string) => {
  return useQuery({
    queryKey: ['goal_ledger', goalId],
    queryFn: async () => {
      const { data, error } = await getGoalLedger(goalId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!goalId,
    staleTime: 30 * 1000,
  });
};

// --- Mutations ---

export const useCreateGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: GoalInsert) => {
      const result = await createGoal(data);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GOALS_KEY] }),
  });
};

export const useUpdateGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: GoalUpdate }) => {
      const result = await updateGoal(id, updates);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GOALS_KEY] }),
  });
};

export const useDeleteGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteGoal(id);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GOALS_KEY] }),
  });
};

export const useAllocateToGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: AllocateGoalParams) => {
      const result = await allocateToGoal(params);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GOALS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['goal_ledger'] });
    },
  });
};

export const useDeallocateFromGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { goalId: string; accountId: string; amountCents: number }) => {
      const result = await deallocateFromGoal(params);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [GOALS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['goal_ledger'] });
    },
  });
};

export const useCompleteGoal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: CompleteGoalParams) => {
      const result = await completeGoal(params);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GOALS_KEY] }),
  });
};

export const useSetContributorTarget = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, targetCents }: { goalId: string; targetCents: number | null }) => {
      const { error } = await setContributorTarget(goalId, targetCents);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [GOALS_KEY] }),
  });
};

// --- Legacy aliases (keep old consumers working) ---

export const useGoals = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['goals', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await getGoals(user.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });
};

export const useGoalsDomain = () => {
  const { user } = useAuth();
  return useQuery<GoalDomain[]>({
    queryKey: ['goals-domain', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await getGoalsDomain(user.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
};

export const useGoalProgress = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['goalProgress', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await getGoalProgress(user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });
};

export const useAllocateFunds = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, amount }: { goalId: string; amount: number }) => {
      const result = await allocateFunds(goalId, amount);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });
};
