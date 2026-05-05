// src/hooks/useInsightsQuery.ts
import { useQuery } from '@tanstack/react-query';
import { useScope } from '@/features/scope';
import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';

export type DashboardInsight = {
  type: 'mom_change' | 'top_category' | 'budget_risk' | 'projected_over';
  title: string;
  value: number;
  detail: Record<string, unknown>;
};

export const useDashboardInsights = () => {
  const { scope } = useScope();
  const scopeFamilyId = scope.kind === 'family' ? (scope as any).familyId : null;

  return useQuery<DashboardInsight[]>({
    queryKey: ['dashboard', 'insights', scopeFamilyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_insights', {
        scope_family_id: scopeFamilyId,
      });
      if (error) {
        logger.error('get_dashboard_insights error:', error);
        throw error;
      }
      return (Array.isArray(data) ? data : []) as DashboardInsight[];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
};
