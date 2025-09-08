import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUpdateAccount } from '../hooks/useAccountsQuery';
import { useConfirmation } from '../hooks/useConfirmation';
import { ConfirmationDialog } from './ui/confirmation-dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { FormSubmitButton } from './ui/loading-button';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from './ui/select';
import { logger } from '@/shared/lib/logger';

interface RegularAccountFormData {
  id: string;
  nome: string;
  tipo: string;
  saldoAtual?: number;
  ajusteSaldo?: number | string;
}

interface RegularAccountFormProps {
  initialData: RegularAccountFormData;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const tiposConta = [
  { value: 'corrente', label: 'Conta Corrente' },
  { value: 'poupança', label: 'Conta Poupança' },
  { value: 'investimento', label: 'Conta Investimento' },
  { value: 'outro', label: 'Outro' },
];

const RegularAccountForm = ({ initialData, onSuccess, onCancel }: RegularAccountFormProps) => {
  const { user } = useAuth();
  const [form, setForm] = useState<RegularAccountFormData>(initialData);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const initialCurrentBalance = Number(initialData.saldoAtual || 0);
  const targetChanged = typeof form.saldoAtual === 'number' && Number(form.saldoAtual) !== initialCurrentBalance;
  const hasManualAdjustment = !!Number(form.ajusteSaldo);
  
  const updateAccountMutation = useUpdateAccount();
  const confirmation = useConfirmation();
  
  const isSubmitting = updateAccountMutation.isPending;

  // Debug: initialData, form state, isSubmitting

  useEffect(() => {
    // Debug: useEffect triggered with initialData
    if (initialData) {
      // Debug: Setting form with initialData
      setForm(initialData);
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Debug: handleChange
    
    if (name === 'saldoAtual' || name === 'ajusteSaldo') {
      // Permitir valores vazios
      if (value === '' || value === '-') {
        setForm({ ...form, [name]: value === '' ? 0 : value });
        return;
      }
      
      // Permitir números negativos, positivos e vírgula/ponto
      const numericValue = value.replace(/[^\d.,-]/g, '').replace(',', '.');
      
      // Verificar se é um número válido
      const parsedValue = parseFloat(numericValue);
      if (!isNaN(parsedValue)) {
        if (name === 'saldoAtual') {
          setForm({ ...form, saldoAtual: parsedValue, ajusteSaldo: 0 });
        } else {
          setForm({ ...form, ajusteSaldo: parsedValue });
        }
      } else if (value === '-') {
        // Manter o sinal negativo se o utilizador acabou de digitar
        setForm({ ...form, [name]: value });
      }
    } else {
      // Debug: Updating form
      setForm({ ...form, [name]: value });
    }
  };

  const handleTipoChange = (value: string) => {
    setForm((prev) => ({ ...prev, tipo: value }));
  };

  const doUpdate = async () => {
    const numericAjuste = targetChanged ? 0 : (typeof form.ajusteSaldo === 'string' ? (parseFloat(form.ajusteSaldo) || 0) : (Number(form.ajusteSaldo) || 0));
    const payloadBase: Record<string, unknown> = {
      nome: form.nome.trim(),
      tipo: form.tipo,
    };
    if ((Number(form.saldoAtual) || 0) !== (Number(initialData.saldoAtual) || 0)) {
      payloadBase.saldoAtual = Number(form.saldoAtual) || 0;
    }
    if (numericAjuste !== 0) {
      payloadBase.ajusteSaldo = numericAjuste;
    }
    const payload = payloadBase;
    await updateAccountMutation.mutateAsync({ id: form.id, ...(payload as any) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    
    // Validação manual para campos obrigatórios
    const errors: Record<string, string> = {};
    
    if (!form.nome.trim()) {
      errors.nome = 'Nome obrigatório';
    }
    
    if (!form.tipo) {
      errors.tipo = 'Tipo obrigatório';
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    try {
      const requiresConfirm = targetChanged || (Number(form.ajusteSaldo) || 0) !== 0;
      if (requiresConfirm) {
        confirmation.confirm(
          {
            title: 'Aplicar ajuste de saldo',
            message: 'Será criada uma transação de ajuste pela diferença para refletir a alteração de saldo. Deseja continuar?',
            confirmText: 'Continuar',
            cancelText: 'Cancelar',
          },
          () => { void doUpdate().then(() => onSuccess?.()); }
        );
        return;
      }
      await doUpdate();
      onSuccess?.();
    } catch (err: any) {
      logger.error('Erro ao guardar conta:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-2 sm:p-4">
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
      
      <Select value={form.tipo} onValueChange={(value) => setValue('tipo', value as 'corrente' | 'poupanca' | 'investimento' | 'cartao_credito')}>
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
        <div className="text-xs text-muted-foreground">
          Ao guardar, será aplicada uma transação de ajuste pela diferença para atingir este saldo.
          {targetChanged && (
            <> Diferença: {((Number(form.saldoAtual) || 0) - initialCurrentBalance).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</>
          )}
          {hasManualAdjustment && (
            <span className="block">Desativado porque definiu um ajuste manual.</span>
          )}
        </div>
      </div>
      
      <div className="space-y-1">
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
      </div>
      
      <div className="flex flex-col sm:flex-row gap-2">
        <FormSubmitButton 
          isSubmitting={isSubmitting}
          submitText="Atualizar"
          submittingText="A atualizar..."
          className="w-full"
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

export default RegularAccountForm;