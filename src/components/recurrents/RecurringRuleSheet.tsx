// src/components/recurrents/RecurringRuleSheet.tsx
// Full form with execution_mode + amount_mode fields
import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCreateRecurringRule, useUpdateRecurringRule } from '@/hooks/useRecurrentsQuery';
import { useToast } from '@/hooks/use-toast';

interface Props {
  rule: Record<string, unknown> | null;
  open: boolean;
  onClose: () => void;
}

const RecurringRuleSheet: React.FC<Props> = ({ rule, open, onClose }) => {
  const { toast } = useToast();
  const create = useCreateRecurringRule();
  const update = useUpdateRecurringRule();
  const isEditing = !!rule;

  const [description, setDescription] = React.useState(String(rule?.description ?? rule?.payee ?? ''));
  const [amountEuros, setAmountEuros]   = React.useState(String(((rule?.amount_cents as number) ?? 0) / 100));
  const [intervalUnit, setIntervalUnit] = React.useState(String(rule?.interval_unit ?? 'month'));
  const [execMode, setExecMode]         = React.useState(String(rule?.execution_mode ?? 'confirm'));
  const [amountMode, setAmountMode]     = React.useState(String(rule?.amount_mode ?? 'fixed'));
  const [ruleType, setRuleType]         = React.useState(String(rule?.type ?? 'expense'));
  const [startDate, setStartDate]       = React.useState(String(rule?.start_date ?? new Date().toISOString().slice(0, 10)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      description,
      payee: description,
      amount_cents: Math.round(parseFloat(amountEuros || '0') * 100),
      interval_unit: intervalUnit as any,
      interval_count: 1,
      start_date: startDate,
      next_run_date: startDate,
      execution_mode: execMode as any,
      amount_mode: amountMode as any,
      type: ruleType as any,
      schedule_type: intervalUnit === 'month' ? 'monthly' :
                     intervalUnit === 'week'  ? 'weekly'  :
                     intervalUnit === 'year'  ? 'yearly'  : 'daily',
      status: 'active' as const,
      currency: 'EUR',
      scope: 'personal' as const,
    };
    try {
      if (isEditing) {
        await update.mutateAsync({ id: String(rule!.id), data: payload });
        toast({ title: 'Regra atualizada' });
      } else {
        await create.mutateAsync(payload as any);
        toast({ title: 'Regra criada' });
      }
      onClose();
    } catch {
      toast({ title: 'Erro ao guardar', variant: 'destructive' });
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar regra' : 'Nova regra recorrente'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <Label>Descrição / Payee</Label>
            <Input
              placeholder="Ex: Netflix, Renda"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label>Valor (€)</Label>
            <Input
              type="number" min="0.01" step="0.01"
              value={amountEuros}
              onChange={(e) => setAmountEuros(e.target.value)}
            />
          </div>
          <div>
            <Label>Frequência</Label>
            <Select value={intervalUnit} onValueChange={setIntervalUnit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Diário</SelectItem>
                <SelectItem value="week">Semanal</SelectItem>
                <SelectItem value="month">Mensal</SelectItem>
                <SelectItem value="year">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Modo de execução</Label>
            <Select value={execMode} onValueChange={setExecMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="confirm">Confirmação manual</SelectItem>
                <SelectItem value="auto">Automático</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Modo do valor</Label>
            <Select value={amountMode} onValueChange={setAmountMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixo</SelectItem>
                <SelectItem value="estimated">Estimado</SelectItem>
                <SelectItem value="variable">Variável</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={ruleType} onValueChange={setRuleType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Despesa</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="transfer">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data de início</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit" className="flex-1"
              disabled={create.isPending || update.isPending}
            >
              {isEditing ? 'Guardar' : 'Criar regra'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default RecurringRuleSheet;
