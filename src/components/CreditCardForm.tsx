import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUpdateAccount, useCreateAccount } from '../hooks/useAccountsQuery';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { FormSubmitButton } from './ui/loading-button';
import { Alert, AlertDescription } from './ui/alert';
import { CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/shared/lib/logger';

interface CreditCardFormData {
  id: string;
  nome: string;
  tipo: string;
  saldoAtual?: number;
  ajusteSaldo?: number | string;
}

interface CreditCardFormProps {
  initialData: CreditCardFormData;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CreditCardForm = ({ initialData, onSuccess, onCancel }: CreditCardFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreditCardFormData>(initialData);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const initialCurrentBalance = Number(initialData.saldoAtual || 0);
  const targetChanged = typeof form.saldoAtual === 'number' && Number(form.saldoAtual) !== initialCurrentBalance;
  const hasManualAdjustment = !!Number(form.ajusteSaldo);
  
  const updateAccountMutation = useUpdateAccount();
  const createAccountMutation = useCreateAccount();
  
  const isEditing = Boolean(initialData.id);
  const isSubmitting = isEditing ? updateAccountMutation.isPending : createAccountMutation.isPending;

  const fetchAccountBalance = useCallback(async () => {
    try {
      if (!initialData.id) return; // evitar uuid inválido
      const { data, error } = await supabase
        .from('account_balances')
        .select('saldo_atual')
        .eq('account_id', initialData.id)
        .single();
      if (error) {
        logger.error('[CreditCardForm] Error fetching account balance:', error);
        return;
      }
      setForm(prev => ({ ...prev, saldoAtual: data?.saldo_atual || 0 }));
    } catch (error) {
      logger.error('[CreditCardForm] Error fetching account balance:', error);
    }
  }, [initialData.id]);

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    }
  }, [initialData]);

  const toNegative = (n: number) => (n > 0 ? -n : n);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'saldoAtual' || name === 'ajusteSaldo') {
      // Permitir valores vazios
      if (value === '' || value === '-') {
        setForm({ ...form, [name]: value === '' ? 0 : value });
        return;
      }
      // Permitir números negativos, positivos e vírgula/ponto
      const numericValue = value.replace(/[^\d.,-]/g, '').replace(',', '.');
      const parsedValue = parseFloat(numericValue);
      if (!isNaN(parsedValue)) {
        const normalized = toNegative(parsedValue);
        if (name === 'saldoAtual') {
          setForm({ ...form, saldoAtual: normalized, ajusteSaldo: 0 });
        } else {
          // No ajuste permitimos positivo ou negativo
          setForm({ ...form, ajusteSaldo: parsedValue });
        }
      } else if (value === '-') {
        setForm({ ...form, [name]: value });
      }
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    const errors: Record<string, string> = {};
    if (!form.nome.trim()) {
      errors.nome = 'Nome obrigatório';
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      // Parsing seguro e normalização
      let saldoAtual = 0;
      let ajusteSaldo = 0;
      if (form.saldoAtual !== undefined && form.saldoAtual !== null) {
        saldoAtual = typeof form.saldoAtual === 'string' ? (parseFloat(form.saldoAtual) || 0) : (Number(form.saldoAtual) || 0);
      }
      if (form.ajusteSaldo !== undefined && form.ajusteSaldo !== null) {
        ajusteSaldo = typeof form.ajusteSaldo === 'string' ? (parseFloat(form.ajusteSaldo) || 0) : (Number(form.ajusteSaldo) || 0);
      }
      saldoAtual = toNegative(saldoAtual);
      // ajuste pode ser positivo ou negativo
      // Se o resultado final (saldoAtual + ajuste) ficar > 0, limitar o ajuste para não passar de 0
      let saldoFinal = saldoAtual + ajusteSaldo;
      if (saldoFinal > 0) {
        ajusteSaldo = -saldoAtual; // para que saldoFinal = 0
        saldoFinal = 0;
      }
      if (saldoAtual > 0) saldoAtual = 0; // cartões nunca positivos

      const payload = {
        nome: form.nome.trim(),
        tipo: 'cartão de crédito',
      } as const;

      if (isEditing) {
        // Enviar sempre ambos num único update para garantir saldo final correto (inclui caso 0)
        const base: any = { id: form.id, nome: payload.nome, tipo: payload.tipo };
        await updateAccountMutation.mutateAsync(base);
        await updateAccountMutation.mutateAsync({ id: form.id, saldoAtual, ajusteSaldo });
      } else {
        const created = await createAccountMutation.mutateAsync(payload as any);
        if (created?.id) {
          await updateAccountMutation.mutateAsync({ id: created.id, saldoAtual, ajusteSaldo });
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accountsWithBalances', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['personal', 'accounts', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['personal', 'kpis', user?.id] })
      ]);

      toast({ title: isEditing ? 'Cartão atualizado' : 'Cartão criado', description: isEditing ? 'Dados do cartão atualizados com sucesso.' : 'Novo cartão criado com sucesso.' });
      onSuccess?.();
    } catch (err: any) {
      logger.error('Erro ao guardar cartão de crédito:', err);
      toast({ title: 'Erro ao guardar cartão', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-2 sm:p-4">
      <Input
        name="nome"
        placeholder="Nome do Cartão"
        value={form.nome}
        onChange={handleChange}
        required
        className="w-full"
        aria-invalid={!!validationErrors.nome}
        aria-describedby={validationErrors.nome ? 'nome-error' : undefined}
      />
      {validationErrors.nome && <div id="nome-error" className="text-red-600 text-sm">{validationErrors.nome}</div>}
      
      <Alert>
        <CreditCard className="h-4 w-4" />
        <AlertDescription>
          Cartões de crédito começam com saldo 0€. O saldo negativo representa o valor em dívida.
        </AlertDescription>
      </Alert>
      
      <div className="space-y-1">
        <Input
          name="saldoAtual"
          type="text"
          placeholder="Saldo Atual (€) - Opcional"
          value={form.saldoAtual?.toString() || ''}
          onChange={handleChange}
          className="w-full"
          disabled={hasManualAdjustment}
          aria-invalid={!!validationErrors.saldoAtual}
          aria-describedby={validationErrors.saldoAtual ? 'saldoAtual-error' : undefined}
        />
        {validationErrors.saldoAtual && <div id="saldoAtual-error" className="text-red-600 text-sm">{validationErrors.saldoAtual}</div>}
        {!validationErrors.saldoAtual && (
          <p className="text-xs text-muted-foreground">
            Para cartões, valores negativos representam dívida. Será criada uma regularização própria de cartão pela diferença para atingir este saldo.
            {targetChanged && (
              <> Diferença: {((Number(form.saldoAtual) || 0) - initialCurrentBalance).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</>
            )}
            {hasManualAdjustment && (
              <span className="block">Desativado porque definiu um ajuste manual.</span>
            )}
          </p>
        )}
      </div>
       
      <div className="space-y-1">
        <Input
          name="ajusteSaldo"
          type="text"
          placeholder="Ajuste de Saldo (+/- €) - Opcional"
          value={form.ajusteSaldo?.toString() || ''}
          onChange={handleChange}
          className="w-full"
          aria-invalid={!!validationErrors.ajusteSaldo}
          aria-describedby={validationErrors.ajusteSaldo ? 'ajusteSaldo-error' : undefined}
        />
        {validationErrors.ajusteSaldo && <div id="ajusteSaldo-error" className="text-red-600 text-sm">{validationErrors.ajusteSaldo}</div>}
        {!validationErrors.ajusteSaldo && (
          <p className="text-xs text-muted-foreground">
            O ajuste cria uma transação de regularização: valores positivos registam receita; valores negativos registam despesa. {targetChanged && 'Desativado porque definiu um novo saldo alvo.'}
          </p>
        )}
      </div>
        
      <div className="flex flex-col sm:flex-row gap-2">
        <FormSubmitButton 
          isSubmitting={isSubmitting}
          submitText={isEditing ? "Atualizar" : "Criar Cartão"}
          submittingText={isEditing ? "A atualizar..." : "A criar..."}
          className="w-full"
        />
        <Button type="button" variant="outline" onClick={onCancel} className="w-full">Cancelar</Button>
      </div>
    </form>
  );
};

export default CreditCardForm;