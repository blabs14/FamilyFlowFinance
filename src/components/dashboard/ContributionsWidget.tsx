// src/components/dashboard/ContributionsWidget.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemberBalances } from '@/hooks/useFamilySplitsQuery';
import { useFamilyMembers } from '@/hooks/useFamilyMembersQuery';
import { LoadingSpinner } from '@/components/ui/loading-states';
import { Users } from 'lucide-react';

export const ContributionsWidget: React.FC = () => {
  const { data: balances = [], isLoading: balancesLoading } = useMemberBalances();
  const { data: members = [], isLoading: membersLoading } = useFamilyMembers();

  const isLoading = balancesLoading || membersLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Contribuições</CardTitle></CardHeader>
        <CardContent className="flex justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  const totalPaid = (balances as any[]).reduce((sum, b) => sum + b.paid_cents, 0);

  const rows = (members as any[])
    .filter((m) => m.status !== 'removed')
    .map((m) => {
      const balance = (balances as any[]).find((b) => b.user_id === m.user_id);
      const paid = balance?.paid_cents ?? 0;
      const pct = totalPaid > 0 ? Math.round((paid / totalPaid) * 100) : 0;
      return { userId: m.user_id, name: m.profiles?.nome ?? m.user_id, paid, pct };
    })
    .sort((a, b) => b.pct - a.pct);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Contribuições
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sem dados de contribuições
          </p>
        )}
        {rows.map((row) => (
          <div key={row.userId}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">{row.name}</span>
              <span className="text-muted-foreground">{row.pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${row.pct}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ContributionsWidget;
