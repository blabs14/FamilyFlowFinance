import { supabase } from '../lib/supabaseClient';
import { Category, CategoryInsert, CategoryUpdate } from '../integrations/supabase/types';
import { CategoryDomain, mapCategoryRowToDomain } from '../shared/types/categories';
import { getUserCategoryCustomizations } from './categoryCustomizations';

export const getCategories = async (userId?: string, tipo?: string): Promise<{ data: Category[] | null; error: unknown }> => {
  try {
    // Debug temporário
    console.log('getCategories - userId:', userId, 'tipo:', tipo);
    
    let query = supabase
      .from('categories')
      .select('*');

    if (userId === undefined) {
      // Quando userId é undefined, queremos categorias padrão (user_id IS NULL)
      console.log('getCategories - buscando categorias padrão (user_id IS NULL)');
      query = query.is('user_id', null);
    } else if (userId && userId.trim() !== '') {
      // Quando userId é fornecido e não é string vazia, filtramos por esse user_id específico
      console.log('getCategories - buscando categorias do usuário:', userId);
      query = query.eq('user_id', userId);
    } else {
      // Se userId for string vazia ou só espaços, retornamos array vazio
      console.log('getCategories - userId vazio, retornando array vazio');
      return { data: [], error: null };
    }

    if (tipo) {
      // A coluna 'tipo' pode existir em esquemas anteriores; aplicamos cast controlado para manter compatibilidade
      query = query.eq('tipo', tipo);
    }

    const { data, error } = await query.order('nome');

    // Debug temporário
    console.log('getCategories - resultado:', { data: data?.length, error });
    if (data) {
      console.log('getCategories - primeiras 3 categorias:', data.slice(0, 3));
    }

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getCategoriesDomain = async (userId?: string, tipo?: string): Promise<{ data: CategoryDomain[]; error: unknown }> => {
  const { data, error } = await getCategories(userId, tipo);
  return { data: (data || []).map(row => mapCategoryRowToDomain(row)), error };
};

export const getCategory = async (id: string): Promise<{ data: Category | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const createCategory = async (categoryData: CategoryInsert): Promise<{ data: Category | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert([categoryData])
      .select()
      .single();

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const updateCategory = async (id: string, updates: CategoryUpdate): Promise<{ data: Category | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteCategory = async (id: string): Promise<{ data: boolean | null; error: unknown }> => {
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    return { data: !error, error };
  } catch (error) {
    return { data: null, error };
  }
};

// Função para garantir que existe uma categoria de transferências
export const ensureTransferCategory = async (userId: string): Promise<{ data: Category | null; error: unknown }> => {
  try {
    // Verificar se já existe uma categoria de transferências
    const { data: existingCategories, error: fetchError } = await supabase
      .from('categories')
      .select('*')
      .or(`nome.ilike.%transferência%,nome.ilike.%transfer%`)
      .eq('user_id', userId)
      .limit(1);

    if (fetchError) {
      return { data: null, error: fetchError };
    }

    // Se já existe, retornar a primeira encontrada
    if (existingCategories && existingCategories.length > 0) {
      return { data: existingCategories[0], error: null };
    }

    // Se não existe, criar uma nova categoria de transferências
    const transferCategory: CategoryInsert = {
      nome: 'Transferências',
      cor: '#3B82F6', // Azul
      user_id: userId,
    };

    const { data: newCategory, error: createError } = await createCategory(transferCategory);
    return { data: newCategory, error: createError };
  } catch (error) {
    return { data: null, error };
  }
};

export const isCategoryInUse = async (categoryId: string): Promise<{ data: boolean; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('id')
      .eq('categoria_id', categoryId)
      .limit(1);

    if (error) {
      return { data: false, error };
    }

    return { data: (data && data.length > 0), error: null };
  } catch (error) {
    return { data: false, error };
  }
};

export const isDefaultCategory = async (categoryId: string): Promise<{ data: boolean; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('user_id')
      .eq('id', categoryId)
      .single();

    if (error) {
      return { data: false, error };
    }

    // Categoria padrão tem user_id null
    return { data: data.user_id === null, error: null };
  } catch (error) {
    return { data: false, error };
  }
};

/**
 * Obter categorias com personalizações aplicadas para um utilizador específico
 * Combina categorias padrão (user_id null) com categorias personalizadas do utilizador,
 * aplicando as personalizações de cor quando existem
 */
export const getCategoriesWithCustomizations = async (
  userId: string, 
  tipo?: string
): Promise<{ data: Category[] | null; error: unknown }> => {
  try {
    // 1. Obter categorias padrão (user_id null)
    const { data: defaultCategories, error: defaultError } = await getCategories(undefined, tipo);
    if (defaultError) {
      return { data: null, error: defaultError };
    }

    // 2. Obter categorias personalizadas do utilizador
    const { data: userCategories, error: userError } = await getCategories(userId, tipo);
    if (userError) {
      return { data: null, error: userError };
    }

    // 3. Obter personalizações do utilizador
    const { data: customizations, error: customError } = await getUserCategoryCustomizations(userId);
    if (customError) {
      return { data: null, error: customError };
    }

    // 4. Aplicar personalizações às categorias padrão
    const customizedDefaultCategories = (defaultCategories || []).map(category => {
      const customization = (customizations || []).find(c => c.category_id === category.id);
      if (customization) {
        return {
          ...category,
          cor: customization.custom_color
        };
      }
      return category;
    });

    // 5. Combinar categorias padrão (com personalizações) e categorias do utilizador
    const allCategories = [
      ...customizedDefaultCategories,
      ...(userCategories || [])
    ];

    // 6. Ordenar por nome
    allCategories.sort((a, b) => a.nome.localeCompare(b.nome));

    return { data: allCategories, error: null };
  } catch (error) {
    return { data: null, error };
  }
};