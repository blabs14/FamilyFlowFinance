// src/hooks/useDashboardQuery.ts
import { useQuery } from '@tanstack/react-query';
import { useScope } from '@/features/scope';
import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';

export type KpiResult = {
  totalBalanceCents: number;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  goalsProgressPercentage: number;
  budgetSpentPercentage: number;
  budgetsAtRisk: number;
  reservedCents: number;
  inboxPendingCount: number;
};

export const useDashboardData = () => {
  const { scope } = useScope();
  const scopeFamilyId = scope.kind === 'family' ? (scope as any).familyId : null;

  return useQuery<KpiResult>({
    queryKey: ['dashboard', 'kpis', scopeFamilyId],
    queryFn: async () => {
      const today = new Date();
      const dateStart = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString().slice(0, 10);
      const dateEnd = today.toISOString().slice(0, 10);

      const { data, error } = await supabase.rpc('get_kpis', {
        scope_family_id: scopeFamilyId,
        date_start: dateStart,
        date_end: dateEnd,
        exclude_transfers: true,
      });

      if (error) {
        logger.error('get_kpis error:', error);
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;
      return {
        totalBalanceCents:        Number(row?.total_balance_cents)       || 0,
        incomeCents:              Number(row?.income_cents)              || 0,
        expenseCents:             Number(row?.expense_cents)             || 0,
        netCents:                 Number(row?.net_cents)                 || 0,
        goalsProgressPercentage:  Number(row?.goals_progress_percentage) || 0,
        budgetSpentPercentage:    Number(row?.budget_spent_percentage)   || 0,
        budgetsAtRisk:            Number(row?.budgets_at_risk)           || 0,
        reservedCents:            Number(row?.reserved_cents)            || 0,
        inboxPendingCount:        Number(row?.inbox_pending_count)       || 0,
      };
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};
