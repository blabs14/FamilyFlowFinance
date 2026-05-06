// src/hooks/useRecurrentsQuery.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useScope } from '@/features/scope';
import {
  listRecurringRules,
  listRecurringInstances,
  createRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
  pauseRecurringRule,
  resumeRecurringRule,
  cancelAtPeriodEnd,
  skipNextOccurrence,
  confirmRecurringInstance,
  skipRecurringInstance,
  type RecurringRule,
} from '@/services/recurrents';

const RULES_KEY = 'recurring_rules';
const INSTANCES_KEY = 'recurring_instances';

// ---- Scope-aware rules query ----

export const useRecurringRules = () => {
  const { scope } = useScope();
  const kind = scope.kind as 'personal' | 'family';
  const familyId = scope.kind === 'family' ? (scope as any).familyId : undefined;

  return useQuery({
    queryKey: [RULES_KEY, kind, familyId],
    queryFn: async () => {
      const { data, error } = await listRecurringRules(kind, familyId);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });
};

export const useRecurringInstances = (ruleId?: string) => {
  return useQuery({
    queryKey: [INSTANCES_KEY, ruleId],
    queryFn: async () => {
      const { data, error } = await listRecurringInstances(ruleId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: true,
    staleTime: 60 * 1000,
  });
};

// ---- CRUD mutations ----

export const useCreateRecurringRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: RecurringRule) => {
      const result = await createRecurringRule(data);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [RULES_KEY] }),
  });
};

export const useUpdateRecurringRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RecurringRule> }) => {
      const result = await updateRecurringRule(id, data);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [RULES_KEY] }),
  });
};

export const useDeleteRecurringRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteRecurringRule(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [RULES_KEY] }),
  });
};

export const usePauseRecurringRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: pauseRecurringRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [RULES_KEY] }),
  });
};

export const useResumeRecurringRule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resumeRecurringRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [RULES_KEY] }),
  });
};

export const useCancelAtPeriodEnd = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelAtPeriodEnd,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [RULES_KEY] }),
  });
};

export const useSkipNextOccurrence = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: skipNextOccurrence,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INSTANCES_KEY] }),
  });
};

// ---- Instance actions ----

export const useConfirmRecurringInstance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: string) => confirmRecurringInstance(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INSTANCES_KEY] });
      queryClient.invalidateQueries({ queryKey: ['inbox_items'] });
    },
  });
};

export const useSkipRecurringInstance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: string) => skipRecurringInstance(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INSTANCES_KEY] });
      queryClient.invalidateQueries({ queryKey: ['inbox_items'] });
    },
  });
};
