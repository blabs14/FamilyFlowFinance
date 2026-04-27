import { supabase } from '../lib/supabaseClient';
import { retryWithBackoff, withTimeout } from '../config/rpcConfig';

export const getGoalBalance = async (goalId: string): Promise<{ data: { valor_atual_cents: number } | null; error: unknown }> => {
  const { data, error } = await supabase
    .from('goals_with_balance')
    .select('valor_atual_cents')
    .eq('id', goalId)
    .single();
  return { data: data || null, error };
};

export const deallocateFromGoal = async (
  goalId: string,
  accountId: string,
  amount: number,
  userId: string
): Promise<number> => {
  const payload = {
    goal_id_param: goalId,
    account_id_param: accountId,
    amount_param: typeof amount === 'string' ? parseFloat(amount) : amount,
    user_id_param: userId,
  };

  const result = await retryWithBackoff(async () => {
    const rpcCall = supabase.rpc('deallocate_from_goal_with_transaction', payload);
    const { data, error } = await withTimeout(rpcCall);
    if (error) throw new Error(`Erro RPC: ${(error as any).message}`);
    return data;
  });

  const data = result as { amount_released: number } | null;
  return data?.amount_released || 0;
};
