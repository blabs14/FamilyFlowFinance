import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCreateGoal, useUpdateGoal } from '../hooks/useGoalsQuery';
import { goalSchema } from '../validation/goalSchema';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { FormSubmitButton } from './ui/loading-button';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from './ui/select';

interface GoalFormData {
  id?: string;
  nome: string;
  valor_objetivo: number;
  prazo?: string;
  valor_atual?: number;
  account_id?: string;
  family_id?: string;
  status?: string;
}

interface GoalFormProps {
  initialData?: GoalFormData;
  onSuccess?: () => void;
  onCancel?: () => void;
  familyId?: string; // Para objetivos familiares
}

const GoalForm = ({ initialData, onSuccess, onCancel, familyId }: GoalFormProps) => {
  const { user } = useAuth();
  const createGoalMutation = useCreateGoal();
  const updateGoalMutation = useUpdateGoal();
  const [form, setForm] = useState<GoalFormData>({
    nome: '',
    valor_objetivo: 0,
    prazo: '',
    ...initialData
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  const isSubmitting = createGoalMutation.isPending || updateGoalMutation.isPending;

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (name === 'valor_objetivo') {
      // Permitir apenas números e vírgula/ponto
      const numericValue = value.replace(/[^\d.,]/g, '').replace(',', '.');
      setForm(prev => ({ ...prev, [name]: numericValue ? parseFloat(numericValue) || 0 : 0 }));
    } else {
      setForm(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      }));
    }
  };

  const handleSelectChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    
    // Validação manual simples
    const errors: Record<string, string> = {};
    if (!form.nome.trim()) {
      errors.nome = 'Nome obrigatório';
    }
    if (!form.valor_objetivo || form.valor_objetivo <= 0) {
      errors.valor_objetivo = 'Valor objetivo obrigatório';
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    try {
      const payload = {
        nome: form.nome,
        valor_objetivo: form.valor_objetivo,
        prazo: form.prazo || null, // Opcional
        valor_atual: 0, // Inicializar com 0
        user_id: user?.id || '',
        ...(familyId && { family_id: familyId })
      } as const;
      
      if (initialData && initialData.id) {
        const updatePayload = {
          nome: form.nome,
          valor_objetivo: form.valor_objetivo,
          prazo: form.prazo || null
        };
        await updateGoalMutation.mutateAsync({ id: initialData.id, data: updatePayload });
      } else {
        await createGoalMutation.mutateAsync(payload);
      }
      
      if (onSuccess) onSuccess();
    } catch (err: any) {
      // O erro já é tratado pelo hook useGoals
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-2 sm:p-4">
      <div className="space-y-2">
        <label htmlFor="nome">Nome do Objetivo</label>
        <Input
          id="nome"
          name="nome"
          placeholder="Ex: Férias no Algarve"
          value={form.nome}
          onChange={handleChange}
          required
          autoFocus
          className="w-full"
          aria-invalid={!!validationErrors.nome}
          aria-describedby={validationErrors.nome ? 'nome-error' : undefined}
        />
        {validationErrors.nome && <div id="nome-error" className="text-red-600 text-sm">{validationErrors.nome}</div>}
      </div>

      <div className="space-y-2">
        <label htmlFor="valor_objetivo">Valor Objetivo (€)</label>
        <Input
          id="valor_objetivo"
          name="valor_objetivo"
          type="text"
          placeholder="0,00"
          value={form.valor_objetivo?.toString() || '0'}
          onChange={handleChange}
          required
          className="w-full"
          aria-invalid={!!validationErrors.valor_objetivo}
          aria-describedby={validationErrors.valor_objetivo ? 'valor_objetivo-error' : undefined}
        />
        {validationErrors.valor_objetivo && <div id="valor_objetivo-error" className="text-red-600 text-sm">{validationErrors.valor_objetivo}</div>}
      </div>

      <div className="space-y-2">
        <label htmlFor="prazo">Data Limite (Opcional)</label>
        <Input
          id="prazo"
          name="prazo"
          type="date"
          value={form.prazo}
          onChange={handleChange}
          className="w-full"
          aria-invalid={!!validationErrors.prazo}
          aria-describedby={validationErrors.prazo ? 'prazo-error' : undefined}
        />
        {validationErrors.prazo && <div id="prazo-error" className="text-red-600 text-sm">{validationErrors.prazo}</div>}
      </div>

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
  );
};

export default GoalForm;