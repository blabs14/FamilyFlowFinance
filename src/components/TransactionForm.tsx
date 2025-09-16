import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { useCreateTransaction, useUpdateTransaction } from '../hooks/useTransactionsQuery';
import { useReferenceData } from '../hooks/useCache';
import { useCreateCategory, useCategoriesDomain } from '../hooks/useCategoriesQuery';
import { transactionSchema } from '../validation/transactionSchema';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { FormSubmitButton } from './ui/loading-button';
import { LoadingSpinner } from './ui/loading-states';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form';
import { useQueryClient } from '@tanstack/react-query';
import { payCreditCardFromAccount } from '../services/transactions';
import { useToast } from '../hooks/use-toast';
import { logger } from '@/shared/lib/logger';

// Esquema estendido para incluir campos específicos do formulário
const transactionFormSchema = transactionSchema.extend({
  // Campos opcionais para operações de cartão de crédito
  operation: z.enum(['compra', 'pagamento']).optional(),
  fromBankAccountId: z.string().optional(),
  // Campo para nova categoria
  newCategoryName: z.string().optional(),
  newCategoryColor: z.string().optional(),
  isCreatingNewCategory: z.boolean().optional(),
}).refine((data) => {
  // Validação condicional para pagamento de cartão
  if (data.operation === 'pagamento' && !data.fromBankAccountId) {
    return false;
  }
  // Validação para nova categoria
  if (data.isCreatingNewCategory && !data.newCategoryName?.trim()) {
    return false;
  }
  return true;
}, {
  message: "Campos obrigatórios em falta",
  path: ["root"]
});

type TransactionFormData = z.infer<typeof transactionFormSchema>;

interface TransactionFormProps {
  initialData?: Partial<TransactionFormData>;
  onSuccess?: (data?: TransactionFormData) => void;
  onCancel?: () => void;
  submitMode?: 'internal' | 'external';
}

const TransactionForm = ({ initialData, onSuccess, onCancel, submitMode = 'internal' }: TransactionFormProps) => {
  const { user } = useAuth();
  const { accounts } = useReferenceData();
  const { data: categories = [], isLoading: categoriesLoading } = useCategoriesDomain();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Configuração do react-hook-form com zodResolver
  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      account_id: '',
      categoria_id: '',
      tipo: 'despesa',
      valor: 0,
      descricao: '',
      data: new Date().toISOString().split('T')[0],
      operation: 'compra',
      fromBankAccountId: '',
      newCategoryName: '',
      newCategoryColor: '#3B82F6',
      isCreatingNewCategory: false,
      ...initialData
    }
  });
  
  const watchedValues = form.watch();
  const { account_id, operation, isCreatingNewCategory } = watchedValues;
  
  const createTransactionMutation = useCreateTransaction();
  const updateTransactionMutation = useUpdateTransaction();
  const createCategoryMutation = useCreateCategory();
  const isSubmitting = createTransactionMutation.isPending || updateTransactionMutation.isPending || createCategoryMutation.isPending || form.formState.isSubmitting;

  const dataLoading = accounts.isLoading || categoriesLoading;
  const accountsList = Array.isArray(accounts.data) ? accounts.data : [];
  const categoriesList = Array.isArray(categories) ? categories : [];

  const selectedAccount = accountsList.find(a => a.account_id === account_id);
  const isCreditCard = (accTipo?: string) => (accTipo || '').toLowerCase() === 'cartão de crédito';
  const isSelectedAccountCreditCard = isCreditCard(selectedAccount?.tipo);
  const bankLikeAccounts = accountsList.filter(a => !isCreditCard(a.tipo));

  // Verificar se a categoria já existe
  const existingCategory = categoriesList.find(cat => 
    cat.nome.toLowerCase() === (watchedValues.newCategoryName || '').toLowerCase()
  );

  // Função para criar nova categoria
  const handleCreateCategory = async () => {
    const newCategoryName = form.getValues('newCategoryName');
    const newCategoryColor = form.getValues('newCategoryColor');
    
    if (!newCategoryName?.trim() || existingCategory) {
      return;
    }
    
    try {
      const newCategory = await createCategoryMutation.mutateAsync({
        nome: newCategoryName.trim(),
        cor: newCategoryColor || '#3B82F6'
      });
      
      // Selecionar a nova categoria criada
      form.setValue('categoria_id', newCategory.id);
      form.setValue('newCategoryName', '');
      form.setValue('isCreatingNewCategory', false);
    } catch (error) {
      const message = (error as { message?: string })?.message || 'Erro ao criar categoria';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (initialData) {
      form.reset({ ...form.getValues(), ...initialData });
    }
  }, [initialData, form]);

  useEffect(() => {
    // Ao mudar a conta, se for cartão, default para 'compra'; senão limpar modo pagamento
    if (isSelectedAccountCreditCard) {
      form.setValue('operation', 'compra');
    } else {
      form.setValue('operation', 'compra');
      form.setValue('fromBankAccountId', '');
    }
  }, [account_id, isSelectedAccountCreditCard, form]);

  // Função auxiliar para processar valor numérico
  const processNumericValue = (value: string): number => {
    const numericValue = value.replace(/[^\d.,-]/g, '').replace(',', '.');
    return numericValue ? parseFloat(numericValue) || 0 : 0;
  };

  const handleSubmit = async (data: TransactionFormData) => {

    try {
      // Pagamento de cartão via transferência (RPC)
      if (submitMode === 'internal' && isSelectedAccountCreditCard && data.operation === 'pagamento') {
        const { data: result, error } = await payCreditCardFromAccount(
          user?.id || '',
          data.account_id,
          data.fromBankAccountId || '',
          Math.abs(data.valor),
          data.data,
          data.descricao || undefined
        );
        if (error) {
          const message = (error as { message?: string })?.message || 'Erro ao pagar cartão';
          toast({ title: 'Erro no pagamento', description: message, variant: 'destructive' });
          form.setError('root', { message });
          return;
        }
        const efetivo = result?.amountPaid ?? 0;
        if (efetivo <= 0) {
          toast({ title: 'Sem pagamento necessário', description: 'O cartão já estava liquidado.' });
        } else if (efetivo < Math.abs(data.valor)) {
          toast({ title: 'Pagamento ajustado', description: `Foram pagos €${efetivo.toFixed(2)} (ajustado ao necessário).` });
        } else {
          toast({ title: 'Pagamento realizado', description: 'Pagamento do cartão efetuado com sucesso.' });
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['transactions'] }),
          queryClient.invalidateQueries({ queryKey: ['accountsWithBalances', user?.id] }),
          queryClient.invalidateQueries({ queryKey: ['creditCardSummary', data.account_id, user?.id] })
        ]);
        onSuccess?.();
        return;
      }

      let categoriaId = data.categoria_id;
      
      // Se está a criar uma nova categoria, criar primeiro
      if (data.isCreatingNewCategory && data.newCategoryName?.trim()) {
        const newCategory = await createCategoryMutation.mutateAsync({
          nome: data.newCategoryName.trim(),
          cor: data.newCategoryColor || '#3B82F6'
        });
        
        if (newCategory?.id) {
          categoriaId = newCategory.id;
        } else {
          throw new Error('Falha ao criar categoria');
        }
      }
      
      // Normalizar sinal para cartões (compra -> valor positivo, pagamento -> valor positivo)
      // O sentido é controlado pelo campo "tipo"; a BD impõe valor >= 0
      let normalizedValor = data.valor;
      if (isSelectedAccountCreditCard) {
        normalizedValor = Math.abs(data.valor);
      }

      // Preparar payload da transação
      const payload = {
        account_id: data.account_id,
        categoria_id: categoriaId,
        valor: normalizedValor,
        // Para compras no cartão, forçar 'despesa'
        tipo: isSelectedAccountCreditCard ? 'despesa' : data.tipo,
        data: data.data,
        descricao: data.descricao || '',
        user_id: user?.id || ''
      };
      
      if (submitMode === 'external') {
        onSuccess?.({ ...payload, __meta: { operation: data.operation, fromBankAccountId: data.fromBankAccountId } } as any);
        return;
      }
      
      if (initialData?.id) {
        const updatePayload = {
          account_id: data.account_id,
          categoria_id: categoriaId,
          valor: normalizedValor,
          // Para compras no cartão, forçar 'despesa'
          tipo: isSelectedAccountCreditCard ? 'despesa' : data.tipo,
          data: data.data,
          descricao: data.descricao || ''
        };
        await updateTransactionMutation.mutateAsync({ id: initialData.id, data: updatePayload });
        toast({ title: 'Transação atualizada', description: 'A transação foi atualizada com sucesso.' });
      } else {
        await createTransactionMutation.mutateAsync(payload);
        toast({ title: 'Transação criada', description: isSelectedAccountCreditCard ? 'Compra no cartão registada.' : 'Transação criada com sucesso.' });
      }
      
      onSuccess?.();
    } catch (err) {
      const message = (err as { message?: string })?.message || 'Erro ao salvar transação';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      form.setError('root', { message });
    }
  };

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="lg" />
        <span className="ml-2">A carregar dados...</span>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4 p-2 sm:p-4">
        
        <FormField
          control={form.control}
          name="account_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conta</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar conta" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {accountsList.map((account) => (
                    <SelectItem key={account.account_id} value={account.account_id}>
                      {account.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {isSelectedAccountCreditCard && (
          <FormField
            control={form.control}
            name="operation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Operação</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecionar operação" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="compra">Compra no cartão</SelectItem>
                    <SelectItem value="pagamento">Pagamento (transferência)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {!isSelectedAccountCreditCard || watchedValues.operation === 'compra' ? (
          <FormField
            control={form.control}
            name="categoria_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                
                {!watchedValues.isCreatingNewCategory ? (
                  <div className="space-y-2">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecionar categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categoriesList.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => form.setValue('isCreatingNewCategory', true)}
                      className="w-full"
                    >
                      + Criar nova categoria
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <FormField
                        control={form.control}
                        name="newCategoryName"
                        render={({ field: nameField }) => (
                          <Input
                            placeholder="Nome da nova categoria"
                            {...nameField}
                            className="flex-1"
                          />
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="newCategoryColor"
                        render={({ field: colorField }) => (
                          <input
                            type="color"
                            {...colorField}
                            className="w-12 h-10 rounded border"
                            title="Cor da categoria"
                          />
                        )}
                      />
                    </div>
                    
                    {existingCategory && (
                      <div className="text-sm text-amber-600">
                        Categoria "{existingCategory.nome}" já existe
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateCategory}
                        disabled={!watchedValues.newCategoryName?.trim() || Boolean(existingCategory) || createCategoryMutation.isPending}
                        className="flex-1"
                      >
                        {createCategoryMutation.isPending ? 'A criar...' : 'Criar Categoria'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          form.setValue('isCreatingNewCategory', false);
                          form.setValue('newCategoryName', '');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
                
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {isSelectedAccountCreditCard && watchedValues.operation === 'pagamento' && (
          <FormField
            control={form.control}
            name="fromBankAccountId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Conta de origem (banco)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecionar conta de origem" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {bankLikeAccounts.map((account) => (
                      <SelectItem key={account.account_id} value={account.account_id}>
                        {account.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="tipo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Select onValueChange={field.onChange} value={isSelectedAccountCreditCard ? 'despesa' : field.value} disabled={isSelectedAccountCreditCard}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="valor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor (€)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  {...field}
                  onChange={(e) => field.onChange(processNumericValue(e.target.value))}
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="descricao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição (Opcional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Descrição da transação"
                  {...field}
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="data"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  {...field}
                  className="w-full"
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

export default TransactionForm;