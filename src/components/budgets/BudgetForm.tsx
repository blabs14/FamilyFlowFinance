// src/components/budgets/BudgetForm.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { FormSubmitButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { budgetTemplateBaseSchema, type BudgetTemplateFormData } from '../../validation/budgetSchema';
import { useCategoriesDomain } from '../../hooks/useCategoriesQuery';
import { useCreateBudget, useUpdateBudget, useBudgetTemplates } from '../../hooks/useBudgetsQuery';
import { euroToCents, centsToEuro } from '../../lib/money';
import { useScope } from '../../features/scope';
import type { GetBudgetsRow } from '../../services/budgets';

// Extended schema that includes montante_euros field for the form
const formSchema = budgetTemplateBaseSchema.extend({
  montante_euros: z.number({ invalid_type_error: 'Valor inválido' }).min(0.01, 'Valor deve ser positivo'),
});

type FormData = BudgetTemplateFormData & { montante_euros: number };

interface BudgetFormSheetProps {
  open: boolean;
  editingBudget: GetBudgetsRow | null;
  onClose: () => void;
}

const BudgetFormSheet: React.FC<BudgetFormSheetProps> = ({
  open,
  editingBudget,
  onClose,
}) => {
  const { scope } = useScope();
  const familyId = scope.kind === 'family' ? scope.familyId : null;

  const { data: categories = [], isLoading: catLoading } = useCategoriesDomain();
  const { data: templates = [] } = useBudgetTemplates();
  const createMutation = useCreateBudget();
  const updateMutation = useUpdateBudget();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      categoria_id: editingBudget?.categoria_id ?? '',
      amount_cents: editingBudget?.budget_cents ?? 0,
      montante_euros: editingBudget ? centsToEuro(editingBudget.budget_cents) : 0,
      period_type: (editingBudget?.period_type as 'monthly' | 'annual') ?? 'monthly',
      rollover_mode: (editingBudget?.rollover_mode as 'reset' | 'accumulate' | 'transfer_to_goal') ?? 'reset',
      cap_type: (editingBudget?.cap_type as 'flexible' | 'hard') ?? 'flexible',
      parent_id: editingBudget?.parent_id ?? null,
      target_goal_id: null,
      family_id: familyId,
    },
  });

  const rolloverMode = form.watch('rollover_mode');
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = form.handleSubmit(async (data) => {
    const payload = {
      categoria_id: data.categoria_id,
      amount_cents: euroToCents(data.montante_euros),
      period_type: data.period_type,
      rollover_mode: data.rollover_mode,
      cap_type: data.cap_type,
      parent_id: data.parent_id ?? null,
      target_goal_id: data.target_goal_id ?? null,
      family_id: familyId,
      is_template: true,
    };

    if (editingBudget) {
      await updateMutation.mutateAsync({ id: editingBudget.budget_id, updates: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onClose();
  });

  // Budgets sem parent (para o dropdown de hierarquia)
  const parentCandidates = (templates ?? []).filter(
    (t: any) => !t.parent_id && t.id !== editingBudget?.budget_id
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editingBudget ? 'Editar Orçamento' : 'Novo Orçamento'}</SheetTitle>
          <SheetDescription>
            {editingBudget
              ? 'Atualiza os parâmetros do template de orçamento.'
              : 'Define o envelope de despesa por categoria.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
            {/* Categoria */}
            <FormField
              control={form.control}
              name="categoria_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={catLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(categories as any[]).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Montante */}
            <FormField
              control={form.control}
              name="montante_euros"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montante (€)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0,00"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Período */}
            <FormField
              control={form.control}
              name="period_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Período</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="annual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Rollover */}
            <FormField
              control={form.control}
              name="rollover_mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rollover (fim de período)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="reset">Reset (começa do zero)</SelectItem>
                      <SelectItem value="accumulate">Acumular (não-gasto passa para próximo mês)</SelectItem>
                      <SelectItem value="transfer_to_goal">Transferir para Objetivo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cap type */}
            <FormField
              control={form.control}
              name="cap_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de limite</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="flexible">Flexível (apenas alertas)</SelectItem>
                      <SelectItem value="hard">Rígido (aviso destacado)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Budget pai (hierarquia) */}
            {parentCandidates.length > 0 && (
              <FormField
                control={form.control}
                name="parent_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget pai (opcional)</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}
                      value={field.value ?? '__none__'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Nenhum (nível de topo)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhum</SelectItem>
                        {(parentCandidates as any[]).map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.categoria_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Objetivo (só com transfer_to_goal) */}
            {rolloverMode === 'transfer_to_goal' && (
              <FormField
                control={form.control}
                name="target_goal_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Objetivo (destino do rollover)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="UUID do objetivo"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex gap-2 pt-2">
              <FormSubmitButton
                isSubmitting={isSubmitting}
                submitText={editingBudget ? 'Guardar' : 'Criar'}
                submittingText={editingBudget ? 'A guardar...' : 'A criar...'}
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default BudgetFormSheet;
