import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { 
  upsertCategoryCustomization, 
  deleteCategoryCustomization 
} from '../services/categoryCustomizations';
import { CategoryCustomizationInsert } from '../types';
import { logger } from '@/shared/lib/logger';
import { toast } from 'sonner';

export const useUpsertCategoryCustomization = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<CategoryCustomizationInsert, 'user_id'>) => {
      if (!user?.id) {
        throw new Error('Utilizador não autenticado');
      }

      return upsertCategoryCustomization({
        ...data,
        user_id: user.id
      });
    },
    onSuccess: () => {
      // Invalidar queries de categorias para refletir as personalizações
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Personalização guardada com sucesso');
    },
    onError: (error: any) => {
      logger.error('Erro ao guardar personalização:', error);
      toast.error('Erro ao guardar personalização');
    }
  });
};

export const useDeleteCategoryCustomization = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      if (!user?.id) {
        throw new Error('Utilizador não autenticado');
      }

      return deleteCategoryCustomization(user.id, categoryId);
    },
    onSuccess: () => {
      // Invalidar queries de categorias para refletir as alterações
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Personalização removida com sucesso');
    },
    onError: (error: any) => {
      logger.error('Erro ao remover personalização:', error);
      toast.error('Erro ao remover personalização');
    }
  });
};