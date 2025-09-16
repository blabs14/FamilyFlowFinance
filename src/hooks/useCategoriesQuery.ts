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
  
  // Buscar categorias padrão (user_id IS NULL)
  const defaultCategoriesQuery = useQuery({
    queryKey: ['categories', 'default', tipo],
    queryFn: async () => {
      const result = await getCategoriesDomain(undefined, tipo);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    staleTime: 0, // Forçar atualização imediata
    refetchOnMount: true,
  });

  // Buscar categorias do usuário (se estiver logado)
  const userCategoriesQuery = useQuery({
    queryKey: ['categories', 'user', user?.id, tipo],
    queryFn: async () => {
      const result = await getCategoriesDomain(user?.id, tipo);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    enabled: !!user?.id,
    staleTime: 0, // Forçar atualização imediata
    refetchOnMount: true,
  });

  // Combinar as categorias usando useMemo
  const combinedCategories = useMemo(() => {
    const defaultData = defaultCategoriesQuery.data || [];
    const userData = userCategoriesQuery.data || [];

    // Debug temporário
    console.log('useCategoriesDomain - defaultData:', defaultData);
    console.log('useCategoriesDomain - userData:', userData);
    console.log('useCategoriesDomain - user:', user);

    // Criar um Set com os nomes das categorias do usuário para deduplicação
    const userCategoryNames = new Set(userData.map(cat => cat.nome));

    // Filtrar categorias padrão que não existem nas categorias do usuário
    const filteredDefaultCategories = defaultData.filter(cat => !userCategoryNames.has(cat.nome));

    // Combinar: categorias do usuário primeiro, depois categorias padrão filtradas
    const combined = [...userData, ...filteredDefaultCategories];

    return combined;
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