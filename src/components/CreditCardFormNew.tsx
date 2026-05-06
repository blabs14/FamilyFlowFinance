// src/components/CreditCardFormNew.tsx
// Unit 5: form de criação/edição de cartão de crédito
// Substitui CreditCardForm.tsx (que misturava conta e cartão na mesma tabela accounts)
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { creditCardSchema, CreditCardSchema } from '../validation/accountSchema';
import { useAuth } from '../contexts/AuthContext';
import { useCreateCreditCard, useUpdateCreditCard } from '../hooks/useAccountsQuery';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { FormSubmitButton } from './ui/loading-button';

interface CreditCardFormNewProps {
  initialData?: {
    id?: string;
    nome?: string;
    credit_limit_cents?: number;
    closing_day?: number | null;
    payment_day?: number | null;
    apr?: number;
    annual_fee_cents?: number;
    currency?: string;
  };
  familyId?: string | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CreditCardFormNew: React.FC<CreditCardFormNewProps> = ({
  initialData,
  familyId,
  onSuccess,
  onCancel,
}) => {
  const { user } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditing = Boolean(initialData?.id);

  const createMutation = useCreateCreditCard();
  const updateMutation = useUpdateCreditCard();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreditCardSchema>({
    resolver: zodResolver(creditCardSchema),
    defaultValues: {
      nome: initialData?.nome ?? '',
      credit_limit_cents: initialData?.credit_limit_cents ?? 0,
      closing_day: initialData?.closing_day ?? null,
      payment_day: initialData?.payment_day ?? null,
      apr: initialData?.apr ?? 0,
      annual_fee_cents: initialData?.annual_fee_cents ?? 0,
      currency: initialData?.currency ?? 'EUR',
    },
  });

  const onSubmit = async (values: CreditCardSchema) => {
    if (!user?.id) return;
    setSubmitError(null);
    try {
      if (isEditing && initialData?.id) {
        const { error } = await updateMutation.mutateAsync({
          cardId: initialData.id,
          updates: values,
          userId: user.id,
        });
        if (error) throw error;
      } else {
        const { error } = await createMutation.mutateAsync({
          user_id: user.id,
          family_id: familyId ?? null,
          ...values,
        });
        if (error) throw error;
      }
      onSuccess?.();
    } catch (err: unknown) {
      setSubmitError((err as { message?: string })?.message ?? 'Erro ao guardar cartão');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {submitError && (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1">
        <Label htmlFor="nome">Nome do cartão</Label>
        <Input id="nome" {...register('nome')} placeholder="ex: Visa Platinum CGD" />
        {errors.nome && <p className="text-sm text-destructive">{errors.nome.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="credit_limit_cents">Limite de crédito (€)</Label>
        <Input
          id="credit_limit_cents"
          type="number"
          step="0.01"
          min="0"
          {...register('credit_limit_cents', {
            setValueAs: (v) => Math.round(parseFloat(v) * 100) || 0,
          })}
          placeholder="ex: 5000"
        />
        {errors.credit_limit_cents && (
          <p className="text-sm text-destructive">{errors.credit_limit_cents.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="closing_day">Dia de fecho</Label>
          <Input
            id="closing_day"
            type="number"
            min="1"
            max="28"
            {...register('closing_day', { setValueAs: (v) => (v === '' || v == null ? null : parseInt(v)) })}
            placeholder="ex: 25"
          />
          {errors.closing_day && (
            <p className="text-sm text-destructive">{errors.closing_day.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="payment_day">Dia de pagamento</Label>
          <Input
            id="payment_day"
            type="number"
            min="1"
            max="28"
            {...register('payment_day', { setValueAs: (v) => (v === '' || v == null ? null : parseInt(v)) })}
            placeholder="ex: 5"
          />
          {errors.payment_day && (
            <p className="text-sm text-destructive">{errors.payment_day.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="apr">Taxa de juro anual (APR)</Label>
          <Input
            id="apr"
            type="number"
            step="0.0001"
            min="0"
            max="1"
            {...register('apr', { setValueAs: (v) => parseFloat(v) || 0 })}
            placeholder="ex: 0.1999"
          />
          <p className="text-xs text-muted-foreground">0.1999 = 19.99%</p>
          {errors.apr && <p className="text-sm text-destructive">{errors.apr.message}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="annual_fee_cents">Anuidade (€)</Label>
          <Input
            id="annual_fee_cents"
            type="number"
            step="0.01"
            min="0"
            {...register('annual_fee_cents', {
              setValueAs: (v) => Math.round(parseFloat(v) * 100) || 0,
            })}
            placeholder="ex: 24.99"
          />
          {errors.annual_fee_cents && (
            <p className="text-sm text-destructive">{errors.annual_fee_cents.message}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <FormSubmitButton isLoading={isSubmitting}>
          {isEditing ? 'Guardar alterações' : 'Criar cartão'}
        </FormSubmitButton>
      </div>
    </form>
  );
};

export default CreditCardFormNew;
