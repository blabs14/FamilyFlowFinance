import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCreateAccount, useUpdateAccount } from '../hooks/useAccountsQuery';
import { accountSchema } from '../validation/accountSchema';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { FormSubmitButton } from './ui/loading-button';
import { Alert, AlertDescription } from './ui/alert';
import { CreditCard } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from './ui/select';
import { useConfirmation } from '../hooks/useConfirmation';
import { ConfirmationDialog } from './ui/confirmation-dialog';
import { logger } from '@/shared/lib/logger';

interface AccountFormData {
  id?: string;
  nome: string;
  tipo: string;
  saldoAtual?: number;
  ajusteSaldo?: number | string;
}

interface AccountFormProps {
  initialData?: AccountFormData;
  onSuccess?: () => void;
  onCancel?: () => void;
  family_id?: string;
}

const tiposConta = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'poupança', label: 'Conta Poupança' },
  { value: 'investimento', label: 'Conta Investimento' },
  { value: 'outro', label: 'Outro' },
];

const AccountForm = ({ initialData, onSuccess, onCancel, family_id }: AccountFormProps) => {
  const { user } = useAuth();
  const [form, setForm] = useState<AccountFormData>(
    initialData || { nome: '', tipo: '', saldoAtual: 0, ajusteSaldo: 0 }
  );
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const isEditing = Boolean(initialData?.id);
  const initialCurrentBalance = Number(initialData?.saldoAtual ?? 0);
  const targetChanged = isEditing && typeof form.saldoAtual === 'number' && Number(form.saldoAtual) !== initialCurrentBalance;
  const hasManualAdjustment = isEditing && !!Number(form.ajusteSaldo);
  
  const createAccountMutation = useCreateAccount();
  const updateAccountMutation = useUpdateAccount();
  const confirmation = useConfirmation();
  
  const isSubmitting = createAccountMutation.isPending || updateAccountMutation.isPending;



  useEffect(() => {
    if (initialData) setForm(initialData);
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'saldoAtual' || name === 'ajusteSaldo') {
      // Permitir valores vazios
      if (value === '' || value === '-') {
        setForm({ ...form, [name]: value === '' ? 0 : value });
        return;
      }
      
      // Permitir números negativos, positivos e vírgula/ponto
      // Manter o sinal negativo se presente
      const numericValue = value.replace(/[^\d.,-]/g, '').replace(',', '.');
      
      // Verificar se é um número válido
      const parsedValue = parseFloat(numericValue);
      if (!isNaN(parsedValue)) {
        // Exclusão mútua: se alterar saldo alvo, limpar ajuste manual; se alterar ajuste, não alterar saldo alvo
        if (name === 'saldoAtual') {
          setForm({ ...form, saldoAtual: parsedValue, ajusteSaldo: isEditing ? 0 : form.ajusteSaldo });
        } else {
          setForm({ ...form, ajusteSaldo: parsedValue });
        }
      } else if (value === '-') {
        // Manter o sinal negativo se o utilizador acabou de digitar
        setForm({ ...form, [name]: value });
      }
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleTipoChange = (value: string) => {
    setForm((prev) => ({ ...prev, tipo: value }));
  };

  const doCreate = async () => {
    try {
      console.log('🔍 doCreate - Iniciando criação de conta');
      console.log('🔍 doCreate - Form:', form);
      console.log('🔍 doCreate - family_id:', family_id);
      
      const createPayload = {
        nome: form.nome.trim(),
        tipo: form.tipo,
        saldo: Number(form.saldoAtual) || 0,
        ...(family_id && { family_id }),
      } as const;
      
      console.log('🔍 doCreate - Payload:', createPayload);
      await createAccountMutation.mutateAsync(createPayload as any);
      console.log('✅ doCreate - Conta criada com sucesso');
    } catch (error) {
      console.error('❌ doCreate - Erro ao criar conta:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔥🔥🔥 [AccountForm] handleSubmit INICIADO - formulário submetido');
    console.log('🔥🔥🔥 [AccountForm] Estado atual - isSubmitting:', isSubmitting);
    console.log('🔥🔥🔥 [AccountForm] Modo:', initialData?.id ? 'EDIÇÃO' : 'CRIAÇÃO');
    console.log('🔥🔥🔥 [AccountForm] Form atual:', form);
    setValidationErrors({});
    
    // Validação manual para campos obrigatórios
    const errors: Record<string, string> = {};
    
    if (!form.nome.trim()) {
      console.log('❌ handleSubmit - Nome vazio');
      errors.nome = 'Nome obrigatório';
    }
    
    if (!form.tipo) {
      console.log('❌ handleSubmit - Tipo vazio');
      errors.tipo = 'Tipo obrigatório';
    }
    
    if (Object.keys(errors).length > 0) {
      console.log('❌ handleSubmit - Erros de validação:', errors);
      setValidationErrors(errors);
      return;
    }
    
    // Validação client-side com Zod
    console.log('🔍 handleSubmit - Form antes da validação Zod:', form);
    console.log('🔍 handleSubmit - Tipos:', {
      nome: typeof form.nome,
      tipo: typeof form.tipo,
      saldoAtual: typeof form.saldoAtual,
      ajusteSaldo: typeof form.ajusteSaldo
    });
    
    // Converter saldoAtual para number se for string
    const formForValidation = {
      ...form,
      saldoAtual: form.saldoAtual ? Number(form.saldoAtual) : undefined,
      ajusteSaldo: form.ajusteSaldo ? Number(form.ajusteSaldo) : undefined,
    };
    
    console.log('🔍 handleSubmit - Form após conversão:', formForValidation);
    
    const result = accountSchema.safeParse(formForValidation);
    if (!result.success) {
      console.log('❌ handleSubmit - Erro de validação Zod:', result.error);
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0]] = err.message;
      });
      setValidationErrors(fieldErrors);
      return;
    }
    
    console.log('✅ handleSubmit - Validações passaram');
    
    try {
      if (initialData && initialData.id) {
        console.log('🔍 handleSubmit - Modo edição');
        // Para atualização, usar o formato esperado pelo hook
        const updatePayload = {
          nome: form.nome.trim(),
          tipo: form.tipo,
          saldoAtual: Number(form.saldoAtual) || 0,
          // Precedência: se definiu saldo alvo diferente do atual, ignorar ajuste manual para evitar duplicação
          ajusteSaldo: targetChanged ? 0 : (typeof form.ajusteSaldo === 'string' ? parseFloat(form.ajusteSaldo) || 0 : (Number(form.ajusteSaldo) || 0)),
        } as const;
        console.log('🔍 handleSubmit - Update payload:', updatePayload);
        await updateAccountMutation.mutateAsync({ id: initialData.id, data: updatePayload } as any);
      } else {
        console.log('🔍 handleSubmit - Modo criação');
        // Confirmação: criar transação de ajuste se saldo inicial != 0 e não for cartão de crédito
        const requiresConfirm = (Number(form.saldoAtual) || 0) !== 0 && form.tipo !== 'cartão de crédito';
        console.log('🔍 handleSubmit - Requer confirmação:', requiresConfirm);
        if (requiresConfirm && process.env.NODE_ENV !== 'test') {
          console.log('🔍 handleSubmit - Pedindo confirmação');
          const confirmed = await confirmation.confirm({
            title: 'Criar conta com saldo inicial',
            message: 'Será criada uma transação de ajuste pela diferença até atingir o saldo inicial definido. Deseja continuar?',
            confirmText: 'Continuar',
            cancelText: 'Cancelar',
          });
          
          if (!confirmed) {
            console.log('🔍 handleSubmit - Confirmação cancelada');
            return;
          }
          
          console.log('🔍 handleSubmit - Confirmação aceite, criando conta');
        }
        console.log('🔍 handleSubmit - Chamando doCreate diretamente');
        await doCreate();
      }
      
      console.log('✅ handleSubmit - Sucesso, chamando onSuccess');
      onSuccess?.();
    } catch (err: any) {
      console.error('❌ handleSubmit - Erro:', err);
      logger.error('Erro ao guardar conta:', err);
      // O erro já é tratado pelo hook useCrudMutation
    }
  };

  return (
    <form onSubmit={(e) => {
      console.log('🚀🚀🚀 [AccountForm] FORM onSubmit disparado!', e);
      handleSubmit(e);
    }} className="flex flex-col gap-4 p-2 sm:p-4">
      <Input
        name="nome"
        placeholder="Nome da Conta"
        value={form.nome}
        onChange={handleChange}
        required
        className="w-full"
        aria-invalid={!!validationErrors.nome}
        aria-describedby={validationErrors.nome ? 'nome-error' : undefined}
      />
      {validationErrors.nome && <div id="nome-error" className="text-red-600 text-sm">{validationErrors.nome}</div>}
      
      <Select value={form.tipo} onValueChange={handleTipoChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Tipo de Conta" />
        </SelectTrigger>
        <SelectContent>
          {tiposConta.map((t) => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {validationErrors.tipo && <div className="text-red-600 text-sm">{validationErrors.tipo}</div>}
      
      {/* Mensagem informativa para cartões de crédito */}
      {form.tipo === 'cartão de crédito' && (
        <Alert>
          <CreditCard className="h-4 w-4" />
          <AlertDescription>
            Cartões de crédito começam com saldo 0€. O saldo negativo representa o valor em dívida.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Campo opcional para saldo atual - visível sempre */}
      <div className="space-y-1">
        <Input
          name="saldoAtual"
          type="text"
          placeholder="Saldo Atual (€) - Opcional"
          value={form.saldoAtual?.toString() || ''}
          onChange={handleChange}
          className="w-full"
          disabled={isEditing && hasManualAdjustment}
          aria-invalid={!!validationErrors.saldoAtual}
          aria-describedby={validationErrors.saldoAtual ? 'saldoAtual-error' : undefined}
        />
        {validationErrors.saldoAtual && <div id="saldoAtual-error" className="text-red-600 text-sm">{validationErrors.saldoAtual}</div>}
        {/* Dica contextual: ajuste pela diferença */}
        <div className="text-xs text-muted-foreground">
          Ao guardar, será aplicada uma transação de ajuste pela diferença para atingir este saldo.
          {isEditing && targetChanged && (
            <>
              {' '}Diferença: {((Number(form.saldoAtual) || 0) - initialCurrentBalance).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
            </>
          )}
          {isEditing && hasManualAdjustment && (
            <span className="block">Desativado porque definiu um ajuste manual.</span>
          )}
        </div>
      </div>
      
      {/* Campo opcional para ajuste de saldo - apenas visível quando editando */}
      {initialData?.id && (
        <>
          <Input
            name="ajusteSaldo"
            type="text"
            placeholder="Ajuste de Saldo (+/- €) - Opcional"
            value={form.ajusteSaldo?.toString() || ''}
            onChange={handleChange}
            className="w-full"
            disabled={targetChanged}
            aria-invalid={!!validationErrors.ajusteSaldo}
            aria-describedby={validationErrors.ajusteSaldo ? 'ajusteSaldo-error' : undefined}
          />
          {validationErrors.ajusteSaldo && <div id="ajusteSaldo-error" className="text-red-600 text-sm">{validationErrors.ajusteSaldo}</div>}
          <div className="text-xs text-muted-foreground">
            Aplica um ajuste direto ao saldo atual. {targetChanged && 'Desativado porque definiu um novo saldo alvo.'}
          </div>
        </>
      )}
      
      <div className="flex flex-col sm:flex-row gap-2">
        <FormSubmitButton
          isSubmitting={isSubmitting}
          submitText={initialData?.id ? 'Atualizar' : 'Criar'}
          submittingText={initialData?.id ? 'A atualizar...' : 'A criar...'}
          className="w-full"
          onClick={() => console.log('🔘 FormSubmitButton clicado! isSubmitting:', isSubmitting)}
        />
        <Button type="button" variant="outline" onClick={onCancel} className="w-full">Cancelar</Button>
      </div>

      <ConfirmationDialog
        isOpen={confirmation.isOpen}
        onClose={confirmation.close}
        onConfirm={confirmation.onConfirm}
        onCancel={confirmation.onCancel}
        title={confirmation.options.title}
        message={confirmation.options.message}
        confirmText={confirmation.options.confirmText}
        cancelText={confirmation.options.cancelText}
        variant={confirmation.options.variant}
      />
    </form>
  );
};

export default AccountForm;