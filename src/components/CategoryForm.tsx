import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import type { CategoryDomain } from '../shared/types/categories';

interface CategoryFormData {
  id?: string;
  nome: string;
  cor: string;
  icone?: string;
  descricao?: string;
  user_id?: string;
}

interface CategoryFormProps {
  initialData?: CategoryFormData | CategoryDomain;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CategoryForm = ({ initialData, onSuccess, onCancel }: CategoryFormProps) => {
  const { user } = useAuth();
  
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      nome: '',
      cor: '#3B82F6',
      icone: '📊',
      ...initialData
    }
  });
  
  const { register, handleSubmit, reset, watch, formState: { errors } } = form;
  
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

  // Configurar valores padrão quando initialData muda
  useEffect(() => {
    if (initialData) {
      const values = {
        nome: initialData.nome || '',
        cor: initialData.cor || '#3B82F6',
        icone: initialData.icone || 'circle'
      };
      reset(values);
    } else {
      reset({
        nome: '',
        cor: '#3B82F6',
        icone: 'circle'
      });
    }
  }, [initialData, reset]);

  const handleResetCustomization = async () => {
    if (!initialData?.id) return;
    
    try {
      await deleteCustomizationMutation.mutateAsync(initialData.id);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      logger.error('Erro ao resetar personalização:', err);
    }
  };

  const onSubmit = async (data: CategoryFormData) => {
    try {
      if (isEditing && isDefaultCategory) {
        // Para categorias padrão, criar/atualizar personalização
        await upsertCustomizationMutation.mutateAsync({
          category_id: initialData!.id!,
          custom_color: data.cor,
          custom_icon: data.icone
        });
      } else if (isEditing) {
        // Para categorias do utilizador, atualizar normalmente
        const payload = {
          nome: data.nome,
          cor: data.cor,
          icone: data.icone,
        };
        await updateCategoryMutation.mutateAsync({ id: initialData!.id!, data: payload });
      } else {
        // Criar nova categoria
        const payload = {
          nome: data.nome,
          cor: data.cor,
          icone: data.icone,
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
    <FormTransition>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="nome">
            Nome da Categoria
          </label>
          <input
            {...register('nome')}
            id="nome"
            type="text"
            className="w-full p-2 border rounded"
            placeholder="Nome da categoria"
          />
          {errors.nome && <p className="text-red-500 text-sm">{errors.nome.message}</p>}
        </div>

        <div>
          <label htmlFor="cor">
            Cor
          </label>
          <input
            {...register('cor')}
            id="cor"
            type="color"
            className="w-full h-10 border rounded cursor-pointer"
          />
          {errors.cor && <p className="text-red-500 text-sm">{errors.cor.message}</p>}
        </div>

        <div>
          <label htmlFor="icone">
            Ícone
          </label>
          <input
            {...register('icone')}
            id="icone"
            type="text"
            className="w-full p-2 border rounded"
            placeholder="Ícone da categoria"
          />
          {errors.icone && <p className="text-red-500 text-sm">{errors.icone.message}</p>}
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