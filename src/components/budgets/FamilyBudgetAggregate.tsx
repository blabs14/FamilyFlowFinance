// src/components/budgets/FamilyBudgetAggregate.tsx
// Vista agregada por utilizador para budgets família.
// Mostra metas pessoais de budget_personal_targets.
// Unit 12 irá injetar display_name via profiles.
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { formatMoney } from '../../lib/money';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/ui/loading-states';

interface FamilyBudgetAggregateProps {
  budgetId: string;
  familyId: string;
  budgetCents: number;
}

type MemberContribution = {
  user_id: string;
  display_name: string;
  spent_cents: number;
  personal_target_cents: number | null;
};

const FamilyBudgetAggregate: React.FC<FamilyBudgetAggregateProps> = ({
  budgetId,
  familyId,
  budgetCents,
}) => {
  const { data: contributions = [], isLoading } = useQuery<MemberContribution[]>({
    queryKey: ['family_budget_contributions', budgetId, familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_personal_targets')
        .select('user_id, target_cents')
        .eq('budget_id', budgetId);

      if (error) throw error;

      // Enrich with member data — Unit 12 will inject display_name via profiles
      return (data ?? []).map((row: any) => ({
        user_id: row.user_id,
        display_name: row.user_id, // placeholder until Unit 12 profile join
        spent_cents: 0,
        personal_target_cents: row.target_cents,
      }));
    },
    enabled: !!budgetId && !!familyId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (contributions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem metas pessoais definidas para este orçamento familiar.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Contribuições individuais
      </h4>
      {contributions.map((m) => {
        const target = m.personal_target_cents ?? budgetCents;
        const pct = target > 0 ? Math.min((m.spent_cents / target) * 100, 100) : 0;
        return (
          <div key={m.user_id} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{m.display_name}</span>
              <span className="text-muted-foreground">
                {formatMoney(m.spent_cents)}
                {m.personal_target_cents && (
                  <span> / {formatMoney(m.personal_target_cents)}</span>
                )}
              </span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
        );
      })}
    </div>
  );
};

export default FamilyBudgetAggregate;
