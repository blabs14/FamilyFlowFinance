import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import {
  listFundingRules,
  createFundingRule,
  updateFundingRule,
  deleteFundingRule,
  listGoalLedgerEntries,
  GoalFundingRuleInsert,
  GoalFundingRuleUpdate
} from '../services/goalFunding';
import { showError } from '../lib/utils';
import { logger } from '@/shared/lib/logger';

export const useGoalFunding = (goalId: string | null | undefined) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const rules = useQuery({
    queryKey: ['goalFundingRules', user?.id, goalId || 'none'],
    queryFn: async () => {
      try {
        if (!goalId) return [] as any[];
        const { data, error } = await listFundingRules(goalId);
        if (error) throw error;
        return data || [];
      } catch (err: any) {
        logger.error('Failed to fetch goal funding rules', err);
        showError(err?.message || 'Falha ao obter regras de funding');
        return [] as any[];
      }
    },
    enabled: !!user?.id && !!goalId,
  });

  const contributions = useQuery({
    queryKey: ['goalLedgerEntries', user?.id, goalId || 'none'],
    queryFn: async () => {
      try {
        if (!goalId) return [] as any[];
        const { data, error } = await listGoalLedgerEntries(goalId, 20);
        if (error) throw error;
        return data || [];
      } catch (err: any) {
        logger.error('Failed to fetch goal ledger entries', err);
        showError(err?.message || 'Falha ao obter entradas do ledger');
        return [] as any[];
      }
    },
    enabled: !!user?.id && !!goalId,
  });

  const createRule = useMutation({
    mutationFn: (payload: GoalFundingRuleInsert) => createFundingRule(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goalFundingRules'] });
    },
    onError: (err: any) => {
      logger.error('Failed to create funding rule', err);
      showError(err?.message || 'Falha ao criar regra');
    }
  });

  const updateRule = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: GoalFundingRuleUpdate }) => updateFundingRule(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goalFundingRules'] });
    },
    onError: (err: any) => {
      logger.error('Failed to update funding rule', err);
      showError(err?.message || 'Falha ao atualizar regra');
    }
  });

  const removeRule = useMutation({
    mutationFn: (id: string) => deleteFundingRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goalFundingRules'] });
    },
    onError: (err: any) => {
      logger.error('Failed to delete funding rule', err);
      showError(err?.message || 'Falha ao eliminar regra');
    }
  });

  return {
    rules,
    contributions,
    createRule,
    updateRule,
    removeRule
  } as const;
};