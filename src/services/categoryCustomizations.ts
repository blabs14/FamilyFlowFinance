import { supabase } from '../lib/supabaseClient';
import { CategoryCustomization, CategoryCustomizationInsert, CategoryCustomizationUpdate } from '../integrations/supabase/types';

/**
 * Obter personalização de uma categoria específica para um utilizador
 */
export const getCategoryCustomization = async (
  userId: string, 
  categoryId: string
): Promise<{ data: CategoryCustomization | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('category_customizations')
      .select('*')
      .eq('user_id', userId)
      .eq('category_id', categoryId)
      .single();

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

/**
 * Obter todas as personalizações de um utilizador
 */
export const getUserCategoryCustomizations = async (
  userId: string
): Promise<{ data: CategoryCustomization[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('category_customizations')
      .select('*')
      .eq('user_id', userId);

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

/**
 * Criar ou atualizar personalização de categoria
 */
export const upsertCategoryCustomization = async (
  customization: CategoryCustomizationInsert
): Promise<{ data: CategoryCustomization | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('category_customizations')
      .upsert(customization, {
        onConflict: 'user_id,category_id'
      })
      .select()
      .single();

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

/**
 * Eliminar personalização de categoria
 */
export const deleteCategoryCustomization = async (
  userId: string,
  categoryId: string
): Promise<{ error: unknown }> => {
  try {
    const { error } = await supabase
      .from('category_customizations')
      .delete()
      .eq('user_id', userId)
      .eq('category_id', categoryId);

    return { error };
  } catch (error) {
    return { error };
  }
};