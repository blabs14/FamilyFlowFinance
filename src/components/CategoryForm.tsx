import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCreateCategory, useUpdateCategory } from '../hooks/useCategoriesQuery';
import { useUpsertCategoryCustomization, useDeleteCategoryCustomization } from '../hooks/useCategoryCustomizationsQuery';
import { categorySchema } from '../validation/categorySchema';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { FormSubmitButton } from './ui/loading-button';
import { FormTransition } from './ui/transition-wrapper';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from './ui/select';
import { logger } from '@/shared/lib/logger';

interface CategoryFormData {
  nome: string;
  cor: string;
  icone?: string;
  descricao?: string;
  user_id?: string;
}

interface CategoryFormProps {
  initialData?: CategoryFormData;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CategoryForm = ({ initialData, onSuccess, onCancel }: CategoryFormProps) => {
  const { user } = useAuth();
  const [form, setForm] = useState<CategoryFormData>({
    nome: '',
    cor: '#3B82F6',
    icone: '📊',
    ...initialData
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const upsertCustomizationMutation = useUpsertCategoryCustomization();
  const deleteCustomizationMutation = useDeleteCategoryCustomization();
  
  const isSubmitting = createCategoryMutation.isPending || 
                      updateCategoryMutation.isPending || 
                      upsertCustomizationMutation.isPending ||
                      deleteCustomizationMutation.isPending;

  // Determinar se é categoria default (user_id é null)
  const isDefaultCategory = initialData?.user_id === null;
  const isEditing = !!initialData?.id;

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleResetCustomization = async () => {
    if (!initialData?.id) return;
    
    try {
      await deleteCustomizationMutation.mutateAsync(initialData.id);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      logger.error('Erro ao resetar personalização:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    
    // Validação client-side com Zod
    const result = categorySchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0]] = err.message;
      });
      setValidationErrors(fieldErrors);
      return;
    }
    
    try {
      if (isEditing && isDefaultCategory) {
        // Para categorias padrão, criar/atualizar personalização
        await upsertCustomizationMutation.mutateAsync({
          category_id: initialData!.id!,
          custom_color: form.cor,
          custom_icon: form.icone
        });
      } else if (isEditing) {
        // Para categorias do utilizador, atualizar normalmente
        const payload = {
          nome: form.nome,
          cor: form.cor,
          icone: form.icone,
        };
        await updateCategoryMutation.mutateAsync({ id: initialData!.id!, data: payload });
      } else {
        // Criar nova categoria
        const payload = {
          nome: form.nome,
          cor: form.cor,
          icone: form.icone,
        };
        await createCategoryMutation.mutateAsync(payload);
      }
      
      if (onSuccess) onSuccess();
    } catch (err: any) {
      logger.error('Erro ao guardar categoria:', err);
      // O erro já é tratado pelos hooks
    }
  };

  return (
    <FormTransition isVisible={true}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-2 sm:p-4" data-testid="category-form">
        <div className="space-y-2">
          <label htmlFor="nome">Nome</label>
          <Input
            id="nome"
            name="nome"
            placeholder="Nome da categoria"
            value={form.nome}
            onChange={handleChange}
            required
            autoFocus
            className="w-full"
            disabled={isEditing && isDefaultCategory} // Desabilitar nome para categorias default em edição
            aria-invalid={!!validationErrors.nome}
            aria-describedby={validationErrors.nome ? 'nome-error' : undefined}
          />
          {validationErrors.nome && <div id="nome-error" className="text-red-600 text-sm">{validationErrors.nome}</div>}
          {isEditing && isDefaultCategory && (
            <div className="text-sm text-muted-foreground">
              O nome das categorias padrão não pode ser alterado. Apenas a cor e ícone podem ser personalizados.
            </div>
          )}
        </div>



        <div className="space-y-2">
          <label htmlFor="cor">Cor</label>
          <Input
            id="cor"
            name="cor"
            type="color"
            value={form.cor}
            onChange={handleChange}
            className="w-full h-12"
            aria-invalid={!!validationErrors.cor}
            aria-describedby={validationErrors.cor ? 'cor-error' : undefined}
          />
          {validationErrors.cor && <div id="cor-error" className="text-red-600 text-sm">{validationErrors.cor}</div>}
        </div>

        <div className="space-y-2">
          <label htmlFor="icone">Ícone</label>
          <Input
            id="icone"
            name="icone"
            placeholder="Emoji ou ícone"
            value={form.icone}
            onChange={handleChange}
            className="w-full"
            aria-invalid={!!validationErrors.icone}
            aria-describedby={validationErrors.icone ? 'icone-error' : undefined}
          />
          {validationErrors.icone && <div id="icone-error" className="text-red-600 text-sm">{validationErrors.icone}</div>}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <FormSubmitButton 
            isSubmitting={isSubmitting}
            submitText={isEditing && isDefaultCategory ? 'Personalizar' : (initialData?.id ? 'Atualizar' : 'Criar')}
            submittingText={isEditing && isDefaultCategory ? 'A personalizar...' : (initialData?.id ? 'A atualizar...' : 'A criar...')}
            className="w-full"
          />
          {isEditing && isDefaultCategory && (
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleResetCustomization}
              disabled={isSubmitting}
              className="w-full"
            >
              Resetar Personalização
            </Button>
          )}
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} className="w-full">
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </FormTransition>
  );
};

export default CategoryForm;