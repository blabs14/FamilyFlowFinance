// src/components/goals/GoalFormSheet.tsx
import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateGoal, useUpdateGoal } from '@/hooks/useGoalsQuery';
import { useScope } from '@/features/scope';
import { useToast } from '@/hooks/use-toast';
import { goalSchema } from '@/validation/goalSchema';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import type { GoalWithBalance } from '@/services/goals';
import type { z } from 'zod';

type FormData = z.infer<typeof goalSchema>;

interface Props {
  goal: GoalWithBalance | null;
  open: boolean;
  onClose: () => void;
}

const GoalFormSheet: React.FC<Props> = ({ goal, open, onClose }) => {
  const { toast } = useToast();
  const { scope } = useScope();
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const isEditing = !!goal;

  const form = useForm<FormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      nome: goal?.nome ?? '',
      target_cents: goal?.target_cents ?? 10000,
      tipo: (goal?.tipo as 'savings' | 'amortization') ?? 'savings',
      prazo: goal?.prazo ?? '',
      priority: goal?.priority ?? 3,
      family_id: scope.kind === 'family' ? scope.familyId : null,
      ativa: true,
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      if (isEditing) {
        await update.mutateAsync({ id: goal.id, updates: data as any });
        toast({ title: 'Objetivo atualizado' });
      } else {
        await create.mutateAsync({
          ...data,
          user_id: '', // set by RLS/auth
        } as any);
        toast({ title: 'Objetivo criado' });
      }
      onClose();
    } catch {
      toast({ title: 'Erro ao guardar objetivo', variant: 'destructive' });
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar objetivo' : 'Novo objetivo'}</SheetTitle>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Férias Verão 2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="target_cents"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor objetivo (€)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="1000"
                      value={field.value / 100}
                      onChange={(e) =>
                        field.onChange(
                          Math.round(parseFloat(e.target.value || '0') * 100)
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="savings">Poupança</SelectItem>
                      <SelectItem value="amortization">Amortização</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="prazo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prazo (opcional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={create.isPending || update.isPending}
              >
                {isEditing ? 'Guardar' : 'Criar objetivo'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default GoalFormSheet;
