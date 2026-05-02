// src/hooks/useBudgetsQuery.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getBudgets,
  getBudgetTemplates,
  getBudgetStatus,
  getBudgetInstances,
  createBudgetTemplate,
  updateBudgetTemplate,
  deleteBudgetTemplate,
  setPersonalTarget,
  type BudgetStatus,
  type GetBudgetsRow,
} from '../services/budgets';
import { useAuth } from '../contexts/AuthContext';
import { useScope } from '../features/scope';
import { useCrudMutation } from './useMutationWithFeedback';

const BUDGETS_KEY = 'budgets_v2';
const TEMPLATES_KEY = 'budget_templates';

// Hook principal: instâncias do período corrente (scope-aware)
export const useBudgetInstances = (params?: {
  periodType?: string;
  periodKey?: string;
}) => {
  const { user } = useAuth();
  const { scope } = useScope();
  const familyId = scope.kind === 'family' ? scope.familyId : null;

  return useQuery<GetBudgetsRow[] | null>({
    queryKey: [BUDGETS_KEY, familyId, params?.periodType, params?.periodKey],
    queryFn: async () => {
      const { data, error } = await getBudgets({
        familyId,
        periodType: params?.periodType,
        periodKey: params?.periodKey,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

// Hook: templates (para gestão de orçamentos)
export const useBudgetTemplates = () => {
  const { user } = useAuth();
  const { scope } = useScope();
  const familyId = scope.kind === 'family' ? scope.familyId : null;

  return useQuery({
    queryKey: [TEMPLATES_KEY, familyId],
    queryFn: async () => {
      const { data, error } = await getBudgetTemplates(familyId);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
};

// Hook: status de uma instância específica
export const useBudgetStatus = (instanceId?: string) => {
  return useQuery<BudgetStatus | null>({
    queryKey: ['budget_status', instanceId],
    queryFn: async () => {
      if (!instanceId) return null;
      const { data, error } = await getBudgetStatus(instanceId);
      if (error) throw error;
      return data;
    },
    enabled: !!instanceId,
    staleTime: 30_000, // 30s — projections change frequently
  });
};

// Hook: histórico de instâncias de um template
export const useBudgetHistory = (budgetId?: string) => {
  return useQuery({
    queryKey: ['budget_instances', budgetId],
    queryFn: async () => {
      if (!budgetId) return null;
      const { data, error } = await getBudgetInstances(budgetId);
      if (error) throw error;
      return data;
    },
    enabled: !!budgetId,
  });
};

// Mutations
export const useCreateBudget = () => {
  const queryClient = useQueryClient();
  return useCrudMutation(
    createBudgetTemplate,
    {
      operation: 'create',
      entityName: 'Orçamento',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY] });
        queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY] });
      },
    }
  );
};

export const useUpdateBudget = () => {
  const queryClient = useQueryClient();
  return useCrudMutation(
    ({ id, updates }: { id: string; updates: Parameters<typeof updateBudgetTemplate>[1] }) =>
      updateBudgetTemplate(id, updates),
    {
      operation: 'update',
      entityName: 'Orçamento',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY] });
        queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY] });
      },
    }
  );
};

export const useDeleteBudget = () => {
  const queryClient = useQueryClient();
  return useCrudMutation(
    deleteBudgetTemplate,
    {
      operation: 'delete',
      entityName: 'Orçamento',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY] });
        queryClient.invalidateQueries({ queryKey: [TEMPLATES_KEY] });
      },
    }
  );
};

export const useSetPersonalTarget = () => {
  const queryClient = useQueryClient();
  return useCrudMutation(
    ({ budgetId, targetCents }: { budgetId: string; targetCents: number }) =>
      setPersonalTarget(budgetId, targetCents),
    {
      operation: 'update',
      entityName: 'Meta pessoal',
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [BUDGETS_KEY] });
      },
    }
  );
};

// Legacy aliases for backward compat
export const useBudgets = useBudgetInstances;
