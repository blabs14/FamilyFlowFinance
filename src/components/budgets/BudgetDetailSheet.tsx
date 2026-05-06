// src/components/budgets/BudgetDetailSheet.tsx
import React, { useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/ui/loading-states';
import { formatMoney } from '../../lib/money';
import { useBudgetStatus } from '../../hooks/useBudgetsQuery';
import { useTransactions } from '../../hooks/useTransactionsQuery';
import type { GetBudgetsRow } from '../../services/budgets';

interface BudgetDetailSheetProps {
  open: boolean;
  budget: GetBudgetsRow | null;
  onClose: () => void;
}

const BudgetDetailSheet: React.FC<BudgetDetailSheetProps> = ({ open, budget, onClose }) => {
  const { data: status, isLoading: statusLoading } = useBudgetStatus(
    open && budget ? budget.instance_id : undefined
  );

  const { data: allTransactions = [] } = useTransactions();

  // Filter transactions for this category in this period
  const periodTransactions = useMemo(() => {
    if (!budget) return [];
    return (allTransactions as any[]).filter((t) => {
      const d = new Date(t.data);
      const tKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return (
        t.tipo === 'despesa' &&
        t.categoria_id === budget.categoria_id &&
        tKey === budget.period_key
      );
    });
  }, [allTransactions, budget]);

  if (!budget) return null;

  const pct = budget.progresso_percentual;
  const progressColorClass =
    pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{budget.categoria_nome}</SheetTitle>
          <SheetDescription>
            {budget.period_key} · {budget.period_type === 'monthly' ? 'Mensal' : 'Anual'}
          </SheetDescription>
        </SheetHeader>

        {statusLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Orçamento</p>
                <p className="text-lg font-bold">{formatMoney(budget.budget_cents)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Gasto</p>
                <p className={`text-lg font-bold ${pct >= 100 ? 'text-red-600' : ''}`}>
                  {formatMoney(status?.spent_cents ?? budget.spent_cents)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Restante</p>
                <p className="text-lg font-bold">
                  {formatMoney(status?.remaining_cents ?? budget.remaining_cents)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Projeção fim do período</p>
                <p className={`text-lg font-bold ${status?.is_projected_over ? 'text-orange-500' : ''}`}>
                  {formatMoney(status?.projected_cents ?? 0)}
                </p>
                {status?.is_projected_over && (
                  <Badge className="bg-orange-400 text-white text-xs mt-1">Acima do orçamento</Badge>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span>{(status?.percent_used ?? pct).toFixed(1)}%</span>
              </div>
              <Progress
                value={Math.min(status?.percent_used ?? pct, 100)}
                className={`h-3 ${progressColorClass}`}
              />
            </div>

            {/* Transaction list */}
            <div>
              <h3 className="font-medium text-sm mb-2">
                Transações do período ({periodTransactions.length})
              </h3>
              {periodTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem transações neste período.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {periodTransactions.map((t: any) => (
                    <div key={t.id} className="flex justify-between text-sm border-b pb-1">
                      <span className="truncate flex-1 mr-2">{t.descricao || 'Sem descrição'}</span>
                      <span className="text-muted-foreground text-xs mr-2">{t.data}</span>
                      <span className="font-medium text-red-600 shrink-0">
                        {formatMoney(t.amount_cents ?? Math.round(t.valor * 100))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default BudgetDetailSheet;
