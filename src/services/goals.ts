// src/services/goals.ts
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../integrations/supabase/database.types';
import { GoalDomain, mapGoalRowToDomain } from '../shared/types/goals';

type GoalRow = Database['public']['Tables']['goals']['Row'];
type GoalInsert = Database['public']['Tables']['goals']['Insert'];
type GoalUpdate = Database['public']['Tables']['goals']['Update'];

export type GoalWithBalance = {
  id: string;
  user_id: string;
  nome: string;
  prazo: string | null;
  tipo: string;
  priority: number;
  order_index: number;
  status: string | null;
  ativa: boolean | null;
  family_id: string | null;
  target_cents: number;
  valor_atual_cents: number;
  progress_percent: number;
  required_monthly_cents: number | null;
  is_behind_schedule: boolean;
  target_account_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CompleteGoalAction = 'transfer' | 'snowball' | 'spend' | 'keep';

export type CompleteGoalParams = {
  goalId: string;
  action: CompleteGoalAction;
  targetAccountId?: string | null;
  otherGoalId?: string | null;
};

export type AllocateGoalParams = {
  goalId: string;
  accountId: string;
  amountCents: number;
  description?: string;
};

// --- Query functions ---

export const getGoalsWithBalance = async (
  familyId?: string | null
): Promise<{ data: GoalWithBalance[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_goals_with_balance', {
      p_family_id: familyId ?? null,
    });
    return { data: (data as unknown as GoalWithBalance[]) ?? null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getGoalLedger = async (
  goalId: string
): Promise<{ data: any[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_goal_ledger', { p_goal_id: goalId });
    return { data: (data as any[]) ?? null, error };
  } catch (error) {
    return { data: null, error };
  }
};

// --- Allocation ---

export const allocateToGoal = async (
  params: AllocateGoalParams
): Promise<{ data: { id: string; amount_cents: number } | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('allocate_to_goal', {
      p_goal_id: params.goalId,
      p_account_id: params.accountId,
      p_amount: params.amountCents / 100, // legacy RPC takes euros
    });
    return { data: data as any, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const deallocateFromGoal = async (params: {
  goalId: string;
  accountId: string;
  amountCents: number;
}): Promise<{ data: { amount_released: number } | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('deallocate_from_goal_with_transaction', {
      goal_id_param: params.goalId,
      account_id_param: params.accountId,
      amount_param: params.amountCents / 100,
    });
    return { data: data as any, error };
  } catch (error) {
    return { data: null, error };
  }
};

// --- Completion ---

export const completeGoal = async (
  params: CompleteGoalParams
): Promise<{ data: any; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('complete_goal', {
      p_goal_id: params.goalId,
      p_action: params.action,
      p_target_account_id: params.targetAccountId ?? null,
      p_other_goal_id: params.otherGoalId ?? null,
    });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

// --- CRUD ---

export const createGoal = async (
  goalData: GoalInsert
): Promise<{ data: GoalRow | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('goals')
      .insert([goalData])
      .select()
      .single();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const updateGoal = async (
  id: string,
  updates: GoalUpdate
): Promise<{ data: GoalRow | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteGoal = async (
  id: string
): Promise<{ data: boolean | null; error: unknown }> => {
  try {
    const idempotencyKey = `${id}:delete`;
    const { data, error } = await supabase.rpc('delete_goal_with_restoration', {
      goal_id_param: id,
      idempotency_key: idempotencyKey,
    });
    if (error) return { data: null, error };
    return { data: Boolean(data), error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const setContributorTarget = async (
  goalId: string,
  targetCents: number | null
): Promise<{ error: unknown }> => {
  try {
    const { error } = await supabase.from('goal_contributors').upsert(
      { goal_id: goalId, target_cents: targetCents },
      { onConflict: 'goal_id,user_id' }
    );
    return { error };
  } catch (error) {
    return { error };
  }
};

// --- Legacy re-exports (backward compat) ---

export const getGoal = async (id: string, userId: string): Promise<{ data: GoalRow | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getGoals = async (userId: string) => {
  if (!userId || userId.trim() === '') return { data: [], error: null };
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .is('family_id', null)
    .order('created_at', { ascending: false });
  return { data, error };
};

export const getGoalsDomain = async (userId: string) => {
  if (!userId || userId.trim() === '') return { data: [], error: null };
  const { data, error } = await getGoals(userId);
  return { data: (data ?? []).map(mapGoalRowToDomain), error };
};

export const getGoalProgress = async (userId: string) => {
  if (!userId) return { data: null, error: new Error('User ID is required') };
  const { data, error } = await supabase.rpc('get_user_goal_progress', { user_id: userId });
  return { data, error };
};

export const getUserGoalProgress = async () => {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  const { data, error } = await supabase.rpc('get_user_goal_progress', { user_id: userId });
  if (error) return [];
  return data || [];
};

// Legacy no-op kept for hook consumers that import this
export const allocateFunds = async (_goalId: string, _amount: number) =>
  ({ data: null, error: null });

export const getPersonalGoals = async (userId: string) => {
  try {
    const { data, error } = await supabase.rpc('get_personal_goals', { p_user_id: userId });
    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getFamilyGoals = async (userId: string) => {
  try {
    const { data, error } = await supabase.rpc('get_family_goals', { p_user_id: userId });
    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};
