import { supabase } from '../lib/supabaseClient';
import { 
  Goal, 
  GoalInsert, 
  GoalUpdate,
  GoalProgressRPC
} from '../integrations/supabase/types';
import { GoalDomain, mapGoalRowToDomain } from '../shared/types/goals';
import { retryWithBackoff, withTimeout } from '../config/rpcConfig';

export const getGoals = async (userId: string): Promise<{ data: Goal[] | null; error: unknown }> => {
  try {
    // Validar userId antes de fazer a query
    if (!userId || userId.trim() === '') {
      console.warn('[getGoals] userId inválido ou vazio:', userId);
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .is('family_id', null) // Apenas objetivos pessoais
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error) {
    console.error('[getGoals] Erro ao buscar objetivos:', error);
    return { data: null, error };
  }
};

export const getGoalsDomain = async (userId: string): Promise<{ data: GoalDomain[]; error: unknown }> => {
  // Validar userId antes de fazer a query
  if (!userId || userId.trim() === '') {
    console.warn('[getGoalsDomain] userId inválido ou vazio:', userId);
    return { data: [], error: null };
  }

  const { data, error } = await getGoals(userId);
  return { data: (data || []).map(mapGoalRowToDomain), error };
};

export const getGoal = async (id: string, userId: string): Promise<{ data: Goal | null; error: unknown }> => {
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

export const createGoal = async (goalData: GoalInsert, userId?: string): Promise<{ data: Goal | null; error: unknown }> => {
  try {
    let resolvedUserId: string | undefined = userId ?? goalData.user_id;
    if (!resolvedUserId) {
      const { data: authData } = await supabase.auth.getUser();
      resolvedUserId = authData?.user?.id;
    }
    
    const { data, error } = await supabase
      .from('goals')
      .insert([{ ...goalData, user_id: resolvedUserId }])
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const updateGoal = async (id: string, updates: GoalUpdate, userId?: string): Promise<{ data: Goal | null; error: unknown }> => {
  try {
    let query = supabase
      .from('goals')
      .update(updates)
      .eq('id', id);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteGoal = async (id: string, userId?: string): Promise<{ data: { success: boolean; message?: string } | boolean | null; error: unknown }> => {
  try {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data: authData } = await supabase.auth.getUser();
      resolvedUserId = authData?.user?.id;
    }
    
    // Gerar idempotency_key determinística por (userId, goalId)
    const idempotencyKey = `${resolvedUserId}:${id}:delete`;
    const operationTag = `[goals.deleteGoal:${id}]`;
    console.info(`${operationTag} start`, { goalId: id, userId: resolvedUserId, idempotencyKey });

    const payload = {
      goal_id_param: id,
      user_id_param: resolvedUserId,
      idempotency_key: idempotencyKey
    };
    console.debug(`${operationTag} RPC request delete_goal_with_restoration`, payload);

    const { data, error } = await supabase.rpc('delete_goal_with_restoration', payload);

    if (error) {
      const enriched = {
        code: (error as any)?.code,
        message: (error as any)?.message,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
      };
      console.error(`${operationTag} RPC error`, enriched);
      return { data: null, error };
    }

    console.debug(`${operationTag} RPC response`, { data });

    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if ('success' in obj) {
        console.info(`${operationTag} success (object)`, obj);
        return { data: { success: Boolean(obj.success), message: typeof obj.message === 'string' ? obj.message : undefined }, error: null };
      }
    }

    const success = Boolean(data);
    console.info(`${operationTag} success (boolean)`, { success });
    return { data: success, error: null };
  } catch (error) {
    console.error(`[goals.deleteGoal:${id}] unexpected error`, error);
    return { data: null, error };
  }
};

export const allocateToGoal = async (
  goalId: string,
  accountId: string,
  amount: number,
  userId: string,
  description?: string
): Promise<{ data: { amount_allocated: number } | null; error: unknown }> => {
  try {
    // Validar parâmetros antes da chamada
    if (!goalId || !accountId || !userId) {
      throw new Error('Parâmetros obrigatórios em falta');
    }

    if (amount <= 0) {
      throw new Error('Montante deve ser positivo');
    }

    // Normalização defensiva para garantir que os parâmetros estão corretos
    const payload = {
      goal_id_param: goalId,
      account_id_param: accountId,
      amount_param: typeof amount === 'string' ? parseFloat(amount) : amount,
      user_id_param: userId,
      description_param: description,
    };

    console.debug('[goals.allocateToGoal] RPC request allocate_to_goal_with_transaction - params:', payload);

    // Implementar retry logic com timeout configurável
    const result = await retryWithBackoff(async () => {
      const rpcCall = supabase.rpc('allocate_to_goal_with_transaction', payload);
      const { data, error } = await withTimeout(rpcCall);

      if (error) {
        const enriched = {
          code: (error as any)?.code,
          message: (error as any)?.message,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
        };
        console.error('[goals.allocateToGoal] RPC error', enriched);
        
        // Criar erro mais específico baseado no tipo
        if ((error as any).message?.includes('Failed to fetch') || (error as any).message?.includes('ERR_ABORTED')) {
          throw new Error(`Erro de conectividade: ${(error as any).message}. Verifique a sua ligação à internet.`);
        }
        
        throw new Error(`Erro RPC: ${(error as any).message} (${(error as any).code})`);
      }

      return data;
    });

    // RPC executado com sucesso
    
    // A função RPC retorna um objeto JSON com amount_allocated
    const data = result as { amount_allocated: number } | null;
    if (!data || typeof data !== 'object') {
      console.warn('[goals.allocateToGoal] Resultado inesperado:', result);
      return { data: { amount_allocated: 0 }, error: null };
    }
    
    console.log('✅ [allocateToGoal] Alocação bem-sucedida:', data);
    return { data: { amount_allocated: data.amount_allocated || 0 }, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

// Compatibilidade com testes: alias simples para ser mockado nos testes
export const allocateFunds = async (
  goalId: string,
  amount: number
): Promise<{ data: unknown; error: unknown }> => {
  // Implementação real não é usada nos testes (mockada)
  return { data: null, error: null };
};

export const getGoalProgress = async (userId: string): Promise<{ data: GoalProgressRPC[] | null; error: unknown }> => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { data, error } = await supabase.rpc('get_user_goal_progress', { user_id: userId });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export async function getUserGoalProgress() {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  const { data, error } = await supabase.rpc('get_user_goal_progress', {
    user_id: userId,
  });

  if (error) {
    console.error('Error getting user goal progress:', error);
    return [];
  }

  return data || [];
}

export const getPersonalGoals = async (userId: string): Promise<{ data: Goal[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_personal_goals', {
      p_user_id: userId
    });

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getFamilyGoals = async (userId: string): Promise<{ data: Goal[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_family_goals', {
      p_user_id: userId
    });

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};