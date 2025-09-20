import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { useCreateBudget, useUpdateBudget } from '../hooks/useBudgetsQuery';
import { useCategoriesDomain } from '../hooks/useCategoriesQuery';
import { budgetSchema } from '../validation/budgetSchema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormSubmitButton } from './ui/loading-button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { LoadingSpinner } from './ui/loading-states';
import { logger } from '@/shared/lib/logger';

// Estender o schema base para incluir campos específicos do formulário
const budgetFormSchema = budgetSchema.extend({
  periodo: z.enum(['mensal', 'anual']).default('mensal'),
  ano: z.number().min(2020).max(2030).default(new Date().getFullYear()),
  valor_limite: z.number().min(0.01, 'Valor deve ser maior que 0')
}).refine((data) => {
  // Se for mensal, o campo mes é obrigatório no formato YYYY-MM
  if (data.periodo === 'mensal') {
    const mesMatch = data.mes?.match(/^\d{4}-\d{2}$/);
    return !!mesMatch;
  }
  return true;
}, {
  message: 'Mês é obrigatório para orçamentos mensais',
  path: ['mes']
});

type BudgetFormData = z.infer<typeof budgetFormSchema>;

interface BudgetFormProps {
  initialData?: Partial<BudgetFormData> & { id?: string };
  onSuccess?: () => void;
  onCancel?: () => void;
}

const BudgetForm = ({ initialData, onSuccess, onCancel }: BudgetFormProps) => {
  const { user } = useAuth();
  
  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      categoria_id: initialData?.categoria_id || '',
      valor: initialData?.valor_limite || 0,
      valor_limite: initialData?.valor_limite || 0,
      periodo: (initialData?.periodo as 'mensal' | 'anual') || 'mensal',
      mes: initialData?.mes ? `${initialData.ano}-${String(initialData.mes).padStart(2, '0')}` : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      ano: initialData?.ano || new Date().getFullYear()
    }
  });
  
  // Observar mudanças no formulário para validações condicionais
  const watchedValues = form.watch();
  
  const createBudgetMutation = useCreateBudget();
  const updateBudgetMutation = useUpdateBudget();
  const { data: categories = [], isLoading: categoriesLoading } = useCategoriesDomain();
  
  const isSubmitting = createBudgetMutation.isPending || updateBudgetMutation.isPending || form.formState.isSubmitting;

  // Atualizar valores do formulário quando initialData mudar
  useEffect(() => {
    if (initialData) {
      form.reset({
        categoria_id: initialData.categoria_id || '',
        valor: initialData.valor_limite || 0,
        valor_limite: initialData.valor_limite || 0,
        periodo: (initialData.periodo as 'mensal' | 'anual') || 'mensal',
        mes: initialData.mes ? `${initialData.ano}-${String(initialData.mes).padStart(2, '0')}` : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        ano: initialData.ano || new Date().getFullYear()
      });
    }
  }, [initialData, form]);

  const handleSubmit = form.handleSubmit(async (data: BudgetFormData) => {
    try {
      // Preparar payload para a API
      const payload = {
        categoria_id: data.categoria_id,
        valor: data.valor_limite,
        mes: data.mes
      };
      
      if (initialData?.id) {
        await updateBudgetMutation.mutateAsync({ id: initialData.id, data: payload });
      } else {
        await createBudgetMutation.mutateAsync(payload);
      }
      
      if (onSuccess) onSuccess();
    } catch (err: any) {
      logger.error('Erro ao guardar orçamento:', err);
      // O erro já é tratado pelo hook useCrudMutation
    }
  });

  if (categoriesLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-2 sm:p-4">
        <FormField
          control={form.control}
          name="categoria_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar categoria" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="valor_limite"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor Limite (€)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="periodo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Período</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar período" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {watchedValues.periodo === 'mensal' && (
          <FormField
            control={form.control}
            name="mes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mês</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecionar mês" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={`${new Date().getFullYear()}-01`}>Janeiro</SelectItem>
                    <SelectItem value={`${new Date().getFullYear()}-02`}>Fevereiro</SelectItem>
                    <SelectItem value={`${new Date().getFullYear()}-03`}>Março</SelectItem>
                    <SelectItem value={`${new Date().getFullYear()}-04`}>Abril</SelectItem>
                    <SelectItem value={`${new Date().getFullYear()}-05`}>Maio</SelectItem>
                    <SelectItem value={`${new Date().getFullYear()}-06`}>Junho</SelectItem>
                    <SelectItem value={`${new Date().getFullYear()}-07`}>Julho</SelectItem>
                    <SelectItem value={`${new Date().getFullYear()}-08`}>Agosto</SelectItem>
                    <SelectItem value={`${new Date().getFullYear()}-09`}>Setembro</SelectItem>
                    <SelectItem value={`${new Date().getFullYear()}-10`}>Outubro</SelectItem>
                    <SelectItem value={`${new Date().getFullYear()}-11`}>Novembro</SelectItem>
                    <SelectItem value={`${new Date().getFullYear()}-12`}>Dezembro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="ano"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ano</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="2024"
                  min="2020"
                  max="2030"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col sm:flex-row gap-2">
          <FormSubmitButton 
            isSubmitting={isSubmitting}
            submitText={initialData?.id ? 'Atualizar' : 'Criar'}
            submittingText={initialData?.id ? 'A atualizar...' : 'A criar...'}
            className="w-full"
          />
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} className="w-full">
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
};

export default BudgetForm;