import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCategories, getCategoriesDomain, createCategory, updateCategory, deleteCategory, isCategoryInUse, isDefaultCategory, getCategoriesWithCustomizations } from '../services/categories';
import { useAuth } from '../contexts/AuthContext';
import type { CategoryDomain } from '../shared/types/categories';
import type { Category, CategoryInsert, CategoryUpdate } from '../integrations/supabase/types';
import { showError } from '../lib/utils';
import { logger } from '@/shared/lib/logger';

export const useCategories = (tipo?: string) => {
  const { user } = useAuth();
  
  return useQuery<Category[]>({
    queryKey: ['categories', user?.id, tipo],
    queryFn: async () => {
      if (!user?.id) {
        // Se não há utilizador, retornar apenas categorias padrão
        const { data, error } = await getCategories(undefined, tipo);
        if (error) throw error;
        return data || [];
      }
      
      // Usar a nova função que aplica personalizações
      const { data, error } = await getCategoriesWithCustomizations(user.id, tipo);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
};

export const useCategoriesDomain = (tipo?: string) => {
  const { user } = useAuth();

  const defaultCategoriesQuery = useQuery<CategoryDomain[]>({
    queryKey: ['categories-domain', 'default', tipo],
    queryFn: async () => {
      try {
        const { data, error } = await getCategoriesDomain(undefined, tipo);
        if (error) {
          logger.error('Failed to fetch default categories', error);
          throw error;
        }
        return data || [];
      } catch (err) {
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const userCategoriesQuery = useQuery<CategoryDomain[]>({
    queryKey: ['categories-domain', user?.id, tipo],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }
      try {
        const { data, error } = await getCategoriesDomain(user.id, tipo);
        if (error) {
          logger.error('Failed to fetch user categories', error);
          throw error;
        }
        return data || [];
      } catch (err) {
        throw err;
      }
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const combinedCategories = useMemo(() => {
    const defaultCategories = defaultCategoriesQuery.data || [];
    const userCategories = userCategoriesQuery.data || [];
    
    return [...defaultCategories, ...userCategories];
  }, [defaultCategoriesQuery.data, userCategoriesQuery.data, user?.id]);

  return {
    data: combinedCategories,
    isLoading: defaultCategoriesQuery.isLoading || userCategoriesQuery.isLoading,
    isError: defaultCategoriesQuery.isError || userCategoriesQuery.isError,
    error: defaultCategoriesQuery.error || userCategoriesQuery.error,
  };
};

export const useCreateCategory = (onSuccess?: (created: Category) => void) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (payload: CategoryInsert) => {
      const body = { ...payload, user_id: payload.user_id || user?.id } as CategoryInsert;
      const { data, error } = await createCategory(body);
      if (error) throw error;
      return data as Category;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories-domain'] });
      onSuccess?.(data as Category);
    },
    onError: (err: any) => {
      // Se for violação de unique (409) devolve mensagem clara
      if (err?.code === '23505' || String(err?.message||'').toLowerCase().includes('duplicate')) {
        throw new Error('Já existe uma categoria com esse nome (ignora maiúsculas/minúsculas/acentos).');
      }
      throw err;
    }
  });
};

export const useUpdateCategory = (onSuccess?: (updated: Category) => void) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CategoryUpdate }) => {
      const { data: result, error } = await updateCategory(id, data);
      if (error) throw error;
      return result as Category;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories-domain'] });
      onSuccess?.(data as Category);
    },
  });
};

export const useDeleteCategory = (onSuccess?: () => void) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Verificar se é uma categoria padrão
      const { data: isDefault, error: defaultError } = await isDefaultCategory(id);
      if (defaultError) throw defaultError;
      
      if (isDefault) {
        throw new Error('Não é possível eliminar categorias padrão do sistema.');
      }

      // Verificar se a categoria está em uso
      const { data: inUse, error: useError } = await isCategoryInUse(id);
      if (useError) throw useError;
      
      if (inUse) {
        throw new Error('Não é possível eliminar uma categoria que está a ser utilizada em transações.');
      }

      // Se passou nas validações, proceder com a eliminação
      const { data, error } = await deleteCategory(id);
      if (error) throw error as any;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories-domain'] });
      onSuccess?.();
    },
  });
};