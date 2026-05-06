// src/components/goals/GoalAllocationModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAllocateToGoal } from '@/hooks/useGoalsQuery';
import { useAccounts } from '@/hooks/useAccountsQuery';
import { useToast } from '@/hooks/use-toast';
import type { GoalWithBalance } from '@/services/goals';

interface Props {
  goal: GoalWithBalance;
  open: boolean;
  onClose: () => void;
}

const GoalAllocationModal: React.FC<Props> = ({ goal, open, onClose }) => {
  const { toast } = useToast();
  const { data: accounts = [] } = useAccounts();
  const allocate = useAllocateToGoal();

  const [accountId, setAccountId] = useState('');
  const [amountEuros, setAmountEuros] = useState('');

  // Auto-select first account when only one is available
  useEffect(() => {
    if ((accounts as any[]).length === 1 && !accountId) {
      setAccountId((accounts as any[])[0].id);
    }
  }, [accounts, accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountEuros);
    if (!accountId || isNaN(amount) || amount <= 0) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    try {
      await allocate.mutateAsync({
        goalId: goal.id,
        accountId,
        amountCents: Math.round(amount * 100),
      });
      toast({ title: 'Alocação realizada com sucesso' });
      setAmountEuros('');
      setAccountId('');
      onClose();
    } catch {
      toast({ title: 'Erro ao alocar', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alocar para {goal.nome}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Conta de origem</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolhe uma conta" />
              </SelectTrigger>
              <SelectContent>
                {(accounts as any[]).map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor (€)</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Valor a alocar"
              value={amountEuros}
              onChange={(e) => setAmountEuros(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={allocate.isPending}>
              Alocar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GoalAllocationModal;
