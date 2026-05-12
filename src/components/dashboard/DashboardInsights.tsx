// src/components/dashboard/DashboardInsights.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, TrendingUp, AlertTriangle, Wallet } from 'lucide-react';
import { useDashboardInsights, DashboardInsight } from '@/hooks/useInsightsQuery';

const icons: Record<string, React.ReactNode> = {
  mom_change:     <TrendingDown className="h-4 w-4" />,
  top_category:   <Wallet className="h-4 w-4" />,
  budget_risk:    <AlertTriangle className="h-4 w-4 text-amber-500" />,
  projected_over: <AlertTriangle className="h-4 w-4 text-red-500" />,
};

function InsightCard({ insight }: { insight: DashboardInsight }) {
  const isNegative = insight.type === 'mom_change' && insight.value < 0;
  const isPositive = insight.type === 'mom_change' && insight.value >= 0;

  const icon = insight.type === 'mom_change'
    ? (isNegative
        ? <TrendingDown className="h-4 w-4 text-green-500" />
        : <TrendingUp className="h-4 w-4 text-red-500" />)
    : icons[insight.type];

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{insight.title}</p>
        {insight.type === 'mom_change' && (
          <Badge variant={isNegative ? 'destructive' : 'secondary'} className="mt-1 text-xs">
            {isPositive ? '+' : ''}{insight.value}%
          </Badge>
        )}
        {insight.type === 'top_category' && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {(insight.detail as { categoria_nome?: string }).categoria_nome ?? '—'}
          </p>
        )}
        {(insight.type === 'budget_risk' || insight.type === 'projected_over') && (
          <p className="text-xs text-amber-600 mt-0.5">
            {insight.value} {insight.value === 1 ? 'orçamento' : 'orçamentos'} em risco
          </p>
        )}
      </div>
    </div>
  );
}

export function DashboardInsights() {
  const { data: insights = [], isLoading } = useDashboardInsights();

  if (isLoading || insights.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((ins, i) => (
          <InsightCard key={`${ins.type}-${i}`} insight={ins} />
        ))}
      </CardContent>
    </Card>
  );
}
