// src/components/TransferForm.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { createTransfer } from '../services/transfers';
import { useReferenceData } from '../hooks/useCache';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../hooks/use-toast';
import { euroToCents } from '../lib/money';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { FormSubmitButton } from './ui/loading-button';
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from './ui/select';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from './ui/form';

const today = () => new Date().toISOString().slice(0, 10);

const transferSchema = z.object({
  from_account_id: z.string().min(1, 'Conta de origem obrigatória'),
  to_account_id:   z.string().min(1, 'Conta de destino obrigatória'),
  amount:          z.coerce.number().positive('Valor deve ser positivo'),
  date:            z.string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
                    .refine(d => d <= today(), 'Não é possível usar data futura'),
  description:     z.string().max(255).optional(),
}).refine(d => d.from_account_id !== d.to_account_id, {
  message: 'Conta de origem e destino devem ser diferentes',
  path: ['to_account_id'],
});

type TransferFormData = z.infer<typeof transferSchema>;

interface TransferFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const TransferForm = ({ onSuccess, onCancel }: TransferFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { accounts } = useReferenceData();

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      from_account_id: '',
      to_account_id: '',
      amount: undefined,
      date: today(),
      description: '',
    },
  });

  const onSubmit = async (values: TransferFormData) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const { error } = await createTransfer({
        user_id: user.id,
        from_account_id: values.from_account_id,
        to_account_id: values.to_account_id,
        amount_cents: euroToCents(values.amount),
        date: values.date,
        description: values.description || null,
      });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['transfers'] });
      await queryClient.invalidateQueries({ queryKey: ['accountsWithBalances'] });

      toast({ title: 'Transferência registada com sucesso' });
      form.reset();
      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao registar transferência';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // accounts is a React Query object — use accounts.data
  const accountsList = Array.isArray(accounts.data) ? accounts.data : [];
  const bankAccounts = accountsList.filter(
    (a: { tipo?: string }) => (a.tipo || '').toLowerCase() !== 'cartão de crédito'
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="from_account_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conta de origem</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {bankAccounts.map((acc: { account_id: string; nome: string }) => (
                    <SelectItem key={acc.account_id} value={acc.account_id}>{acc.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="to_account_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conta de destino</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {bankAccounts.map((acc: { account_id: string; nome: string }) => (
                    <SelectItem key={acc.account_id} value={acc.account_id}>{acc.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor (€)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0.01" placeholder="0,00" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data</FormLabel>
              <FormControl>
                <Input type="date" max={today()} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição (opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Poupanças de Abril" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 justify-end pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <FormSubmitButton isSubmitting={isSubmitting}>
            Registar transferência
          </FormSubmitButton>
        </div>
      </form>
    </Form>
  );
};

export default TransferForm;
