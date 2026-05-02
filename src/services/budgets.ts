// src/services/budgets.ts
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../integrations/supabase/database.types';

type BudgetRow = Database['public']['Tables']['budgets']['Row'];
type BudgetInsert = Database['public']['Tables']['budgets']['Insert'];
type BudgetUpdate = Database['public']['Tables']['budgets']['Update'];
type BudgetInstanceRow = Database['public']['Tables']['budget_instances']['Row'];

export type BudgetStatus = {
  spent_cents: number;
  remaining_cents: number;
  projected_cents: number;
  percent_used: number;
  is_projected_over: boolean;
};

export type GetBudgetsRow = {
  instance_id: string;
  budget_id: string;
  categoria_id: string;
  categoria_nome: string;
  categoria_cor: string;
  period_type: string;
  period_key: string;
  period_start: string;
  period_end: string;
  budget_cents: number;
  spent_cents: number;
  remaining_cents: number;
  progresso_percentual: number;
  rollover_mode: string;
  cap_type: string;
  parent_id: string | null;
  is_projected_over: boolean;
  status: string;
};

// --- Templates CRUD ---

export const getBudgetTemplates = async (
  familyId?: string | null
): Promise<{ data: BudgetRow[] | null; error: unknown }> => {
  try {
    let q = supabase
      .from('budgets')
      .select('*')
      .eq('is_template', true)
      .order('created_at', { ascending: false });

    if (familyId) {
      q = q.eq('family_id', familyId);
    } else {
      q = q.is('family_id', null);
    }

    const { data, error } = await q;
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const createBudgetTemplate = async (
  payload: BudgetInsert
): Promise<{ data: BudgetRow | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('budgets')
      .insert([{ ...payload, is_template: true }])
      .select()
      .single();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const updateBudgetTemplate = async (
  id: string,
  updates: BudgetUpdate
): Promise<{ data: BudgetRow | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('budgets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteBudgetTemplate = async (
  id: string
): Promise<{ data: boolean | null; error: unknown }> => {
  try {
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    return { data: !error, error };
  } catch (error) {
    return { data: null, error };
  }
};

// --- Instances ---

export const getBudgetStatus = async (
  instanceId: string
): Promise<{ data: BudgetStatus | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_budget_status', {
      p_instance_id: instanceId,
    });
    return { data: (data as any)?.[0] ?? null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getBudgets = async (params: {
  familyId?: string | null;
  periodType?: string;
  periodKey?: string;
} = {}): Promise<{ data: GetBudgetsRow[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_budgets', {
      p_family_id: params.familyId ?? null,
      p_period_type: params.periodType ?? null,
      p_period_key: params.periodKey ?? null,
    });
    return { data: (data as unknown as GetBudgetsRow[]) ?? null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getBudgetInstances = async (
  budgetId: string
): Promise<{ data: BudgetInstanceRow[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('budget_instances')
      .select('*')
      .eq('budget_id', budgetId)
      .order('period_key', { ascending: false });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const setPersonalTarget = async (
  budgetId: string,
  targetCents: number
): Promise<{ error: unknown }> => {
  try {
    const { error } = await supabase.from('budget_personal_targets').upsert(
      { budget_id: budgetId, target_cents: targetCents },
      { onConflict: 'budget_id,user_id' }
    );
    return { error };
  } catch (error) {
    return { error };
  }
};

// Legacy re-exports for backward compat (PersonalBudgets/FamilyBudgets still in features/)
export type PersonalBudgetRPC = {
  id: string;
  user_id: string;
  categoria_id: string;
  categoria_nome: string;
  categoria_cor: string;
  mes: string;
  valor_orcamento: number;
  valor_gasto: number;
  valor_restante: number;
  progresso_percentual: number;
};

export const getPersonalBudgets = async (): Promise<{ data: PersonalBudgetRPC[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_personal_budgets');
    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getFamilyBudgets = async (): Promise<{ data: BudgetRow[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .not('family_id', 'is', null)
      .order('created_at', { ascending: false });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

// Legacy alias
export const createBudget = async (budgetData: BudgetInsert, userId: string) =>
  createBudgetTemplate({ ...budgetData, user_id: userId });

export const updateBudget = async (id: string, updates: BudgetUpdate, _userId: string) =>
  updateBudgetTemplate(id, updates);

export const deleteBudget = async (id: string, _userId: string) =>
  deleteBudgetTemplate(id);
