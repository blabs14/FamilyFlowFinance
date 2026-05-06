// src/hooks/useCashflowQuery.ts
import { useQuery } from '@tanstack/react-query';
import { useScope } from '@/features/scope';
import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';

export type CashflowTimelineEvent = {
  eventDate: string;
  amountCents: number;
  direction: 'in' | 'out';
  sourceType: string;
  sourceId: string;
  description: string;
  isProjected: boolean;
  needsConfirm: boolean;
};

export const useCashflowTimeline = ({
  daysBefore = 30,
  daysAfter = 60,
  accountIds,
}: {
  daysBefore?: number;
  daysAfter?: number;
  accountIds?: string[];
} = {}) => {
  const { scope } = useScope();
  const scopeFamilyId = scope.kind === 'family' ? (scope as any).familyId : null;

  const today = new Date();
  const dateStart = new Date(today);
  dateStart.setDate(today.getDate() - daysBefore);
  const dateEnd = new Date(today);
  dateEnd.setDate(today.getDate() + daysAfter);

  return useQuery<CashflowTimelineEvent[]>({
    queryKey: ['cashflow', 'timeline', scopeFamilyId, daysBefore, daysAfter, accountIds],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cashflow_timeline', {
        scope_family_id: scopeFamilyId,
        date_start: dateStart.toISOString().slice(0, 10),
        date_end: dateEnd.toISOString().slice(0, 10),
        account_ids: accountIds ?? null,
      });
      if (error) {
        logger.error('get_cashflow_timeline error:', error);
        throw error;
      }
      return ((Array.isArray(data) ? data : []) as Record<string, unknown>[]).map(r => ({
        eventDate:    r.event_date as string,
        amountCents:  Number(r.amount_cents) || 0,
        direction:    r.direction as 'in' | 'out',
        sourceType:   r.source_type as string,
        sourceId:     r.source_id as string,
        description:  r.description as string,
        isProjected:  Boolean(r.is_projected),
        needsConfirm: Boolean(r.needs_confirm),
      }));
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
};
