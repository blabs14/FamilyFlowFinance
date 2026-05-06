// src/components/goals/GoalCompletionModal.tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCompleteGoal, useGoalsWithBalance } from '@/hooks/useGoalsQuery';
import { useAccounts } from '@/hooks/useAccountsQuery';
import { useToast } from '@/hooks/use-toast';
import { formatMoney } from '@/lib/money';
import type { GoalWithBalance, CompleteGoalAction } from '@/services/goals';

interface Props {
  goal: GoalWithBalance;
  open: boolean;
  onClose: () => void;
}

const GoalCompletionModal: React.FC<Props> = ({ goal, open, onClose }) => {
  const { toast } = useToast();
  const complete = useCompleteGoal();
  const { data: accounts = [] } = useAccounts();
  const { data: otherGoals = [] } = useGoalsWithBalance();

  const [selectedAction, setSelectedAction] = useState<CompleteGoalAction | null>(null);
  const [targetAccountId, setTargetAccountId] = useState('');
  const [otherGoalId, setOtherGoalId] = useState('');

  const handleComplete = async (action: CompleteGoalAction) => {
    setSelectedAction(action);
    if (action === 'keep' || action === 'spend') {
      await executeComplete(action);
    }
  };

  const executeComplete = async (action: CompleteGoalAction) => {
    try {
      await complete.mutateAsync({
        goalId: goal.id,
        action,
        targetAccountId: action === 'transfer' ? targetAccountId : null,
        otherGoalId: action === 'snowball' ? otherGoalId : null,
      });
      toast({ title: `Objetivo "${goal.nome}" concluído!` });
      onClose();
    } catch {
      toast({ title: 'Erro ao concluir objetivo', variant: 'destructive' });
    }
  };

  const remainingGoals = (otherGoals as GoalWithBalance[]).filter(
    (g) => g.id !== goal.id && g.ativa
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🎉 Objetivo concluído!</DialogTitle>
          <p className="text-sm text-muted-foreground">
            <strong>{goal.nome}</strong> — {formatMoney(goal.valor_atual_cents)} reservados.
            O que queres fazer com este dinheiro?
          </p>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Option 1: Transfer */}
          <div className="rounded-lg border p-3 space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setSelectedAction('transfer')}
            >
              💸 Transferir para conta
            </Button>
            {selectedAction === 'transfer' && (
              <div className="space-y-2 pl-2">
                <Select value={targetAccountId} onValueChange={setTargetAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolhe conta destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {(accounts as any[]).map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => executeComplete('transfer')}
                  disabled={!targetAccountId || complete.isPending}
                >
                  Confirmar transferência
                </Button>
              </div>
            )}
          </div>

          {/* Option 2: Snowball */}
          {remainingGoals.length > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setSelectedAction('snowball')}
              >
                🎯 Passar para outro objetivo
              </Button>
              {selectedAction === 'snowball' && (
                <div className="space-y-2 pl-2">
                  <Select value={otherGoalId} onValueChange={setOtherGoalId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolhe objetivo destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {remainingGoals.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => executeComplete('snowball')}
                    disabled={!otherGoalId || complete.isPending}
                  >
                    Confirmar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Option 3: Spend */}
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleComplete('spend')}
            disabled={complete.isPending}
          >
            🛍️ Registar gasto
          </Button>

          {/* Option 4: Keep */}
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleComplete('keep')}
            disabled={complete.isPending}
          >
            🔒 Manter reservado
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GoalCompletionModal;
