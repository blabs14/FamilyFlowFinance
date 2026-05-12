// src/components/goals/GoalCard.tsx
import React from 'react';
import { formatMoney } from '@/lib/money';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GoalWithBalance } from '@/services/goals';

interface GoalCardProps {
  goal: GoalWithBalance;
  onAllocate: (goal: GoalWithBalance) => void;
  onEdit: (goal: GoalWithBalance) => void;
  onDelete: (goalId: string) => void;
  onComplete?: (goal: GoalWithBalance) => void;
}

const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  onAllocate,
  onEdit,
  onDelete,
  onComplete,
}) => {
  const pct = Math.min(goal.progress_percent ?? 0, 100);
  const isComplete = pct >= 100;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">{goal.nome}</h3>
          {goal.prazo && (
            <p className="text-xs text-muted-foreground">
              Prazo: {new Date(goal.prazo).toLocaleDateString('pt-PT')}
            </p>
          )}
        </div>
        <div className="flex gap-1 items-center flex-shrink-0">
          {goal.is_behind_schedule && (
            <Badge variant="destructive" className="text-xs">Atraso</Badge>
          )}
          {goal.tipo === 'amortization' && (
            <Badge variant="outline" className="text-xs">Amortização</Badge>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {formatMoney(goal.valor_atual_cents)} / {formatMoney(goal.target_cents)}
          </span>
          <span className={`font-medium ${isComplete ? 'text-green-600' : ''}`}>
            {pct.toFixed(0)}%
          </span>
        </div>
        <Progress
          value={pct}
          className={`h-2 ${isComplete ? '[&>div]:bg-green-500' : goal.is_behind_schedule ? '[&>div]:bg-red-500' : ''}`}
        />
      </div>

      {/* Required monthly */}
      {goal.required_monthly_cents != null && !isComplete && (
        <p className="text-xs text-muted-foreground">
          Necessário: <span className="font-medium text-foreground">
            {formatMoney(goal.required_monthly_cents)}/mês
          </span>
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {isComplete && onComplete ? (
          <Button
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={() => onComplete(goal)}
          >
            Concluir
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onAllocate(goal)}
          >
            Alocar
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => onEdit(goal)}>
          Editar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(goal.id)}
        >
          Apagar
        </Button>
      </div>
    </div>
  );
};

export default GoalCard;
