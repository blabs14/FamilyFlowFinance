// src/components/budgets/BudgetProgressCard.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Edit, Trash2, TrendingUp } from 'lucide-react';
import { formatMoney } from '../../lib/money';
import type { GetBudgetsRow } from '../../services/budgets';

interface BudgetProgressCardProps {
  budget: GetBudgetsRow;
  children?: React.ReactNode;
  onEdit: (budget: GetBudgetsRow) => void;
  onDelete: (instanceId: string) => void;
}

const BudgetProgressCard: React.FC<BudgetProgressCardProps> = ({
  budget,
  children,
  onEdit,
  onDelete,
}) => {
  const pct = budget.progresso_percentual;

  const progressColorClass =
    pct >= 100
      ? 'bg-red-500'
      : pct >= 80
      ? 'bg-yellow-500'
      : 'bg-green-500';

  const statusBadge = () => {
    if (pct >= 100) return <Badge variant="destructive">Excedido</Badge>;
    if (pct >= 80) return <Badge className="bg-yellow-500 text-white">Atenção</Badge>;
    if (budget.is_projected_over)
      return (
        <Badge className="bg-orange-400 text-white" title="Projeção linear indica ultrapassagem">
          Projeção
        </Badge>
      );
    return null;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium truncate flex-1 mr-2">
          {budget.categoria_nome}
        </CardTitle>
        <div className="flex items-center gap-1">
          {statusBadge()}
          {budget.is_projected_over && pct < 80 && (
            <TrendingUp className="h-3 w-3 text-orange-400" aria-label="Projeção acima do orçamento" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Orçamento</span>
          <span className="font-medium">{formatMoney(budget.budget_cents)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Gasto</span>
          <span
            className={
              pct >= 100
                ? 'font-medium text-red-600'
                : pct >= 80
                ? 'font-medium text-yellow-600'
                : 'font-medium text-green-600'
            }
          >
            {formatMoney(budget.spent_cents)}
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span>{pct.toFixed(1)}%</span>
          </div>
          <Progress value={Math.min(pct, 100)} className={`h-2 ${progressColorClass}`} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Restante</span>
          <span>{formatMoney(budget.remaining_cents)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground capitalize">
          <span>Rollover</span>
          <span>{budget.rollover_mode}</span>
        </div>

        {children && (
          <div className="pl-3 border-l-2 border-muted space-y-2 mt-2">{children}</div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            aria-label="Editar orçamento"
            onClick={() => onEdit(budget)}
          >
            <Edit className="h-3 w-3 mr-1" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-red-600 hover:text-red-700"
            aria-label="Eliminar orçamento"
            onClick={() => onDelete(budget.instance_id)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Remover
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BudgetProgressCard;
