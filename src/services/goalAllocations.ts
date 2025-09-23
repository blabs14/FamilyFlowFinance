import { supabase } from '../lib/supabaseClient';
import { 
  GoalAllocation, 
  GoalAllocationInsert, 
  GoalAllocationUpdate 
} from '../integrations/supabase/types';

export const getGoalAllocations = async (goalId: string, userId: string): Promise<{ data: GoalAllocation[] | null; error: unknown }> => {
  try {
    // Primeiro, verificar se o objetivo é familiar
    const { data: goalData, error: goalError } = await supabase
      .from('goals')
      .select('family_id')
      .eq('id', goalId)
      .single();

    if (goalError) {
      return { data: null, error: goalError };
    }

    let query = supabase
      .from('goal_allocations')
      .select('*')
      .eq('goal_id', goalId);

    // Se o objetivo é familiar (family_id não é null), buscar alocações de todos os membros da família
    if (goalData.family_id) {
      // Para objetivos familiares, buscar alocações de qualquer membro da família
      // Usar uma subquery para obter os user_ids dos membros da família
      const { data: familyMembers, error: membersError } = await supabase
        .from('family_members')
        .select('user_id')
        .eq('family_id', goalData.family_id);

      if (membersError) {
        return { data: null, error: membersError };
      }

      const memberUserIds = familyMembers.map(member => member.user_id);
      query = query.in('user_id', memberUserIds);
    } else {
      // Para objetivos pessoais, filtrar apenas pelo user_id
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('data_alocacao', { ascending: false });

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getAllGoalAllocations = async (): Promise<{ data: GoalAllocation[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('goal_allocations')
      .select('*')
      .order('data_alocacao', { ascending: false });

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const createGoalAllocation = async (allocationData: GoalAllocationInsert, userId: string): Promise<{ data: GoalAllocation | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('goal_allocations')
      .insert([{ ...allocationData, user_id: userId }])
      .select()
      .single();

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const updateGoalAllocation = async (id: string, updates: GoalAllocationUpdate, userId: string): Promise<{ data: GoalAllocation | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('goal_allocations')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteGoalAllocation = async (id: string, userId: string): Promise<{ data: boolean | null; error: unknown }> => {
  try {
    const { error } = await supabase
      .from('goal_allocations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    return { data: !error, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getGoalAllocationsTotal = async (goalId: string, userId: string): Promise<{ data: number | null; error: unknown }> => {
  try {
    // Primeiro, verificar se o objetivo é familiar
    const { data: goalData, error: goalError } = await supabase
      .from('goals')
      .select('family_id')
      .eq('id', goalId)
      .single();

    if (goalError) {
      return { data: null, error: goalError };
    }

    let query = supabase
      .from('goal_allocations')
      .select('valor')
      .eq('goal_id', goalId);

    // Se o objetivo é familiar (family_id não é null), buscar alocações de todos os membros da família
    if (goalData.family_id) {
      // Para objetivos familiares, buscar alocações de qualquer membro da família
      const { data: familyMembers, error: membersError } = await supabase
        .from('family_members')
        .select('user_id')
        .eq('family_id', goalData.family_id);

      if (membersError) {
        return { data: null, error: membersError };
      }

      const memberUserIds = familyMembers.map(member => member.user_id);
      query = query.in('user_id', memberUserIds);
    } else {
      // Para objetivos pessoais, filtrar apenas pelo user_id
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }

    const rows = (data as { valor: number | null }[] | null) || [];
    const total = rows.reduce((sum, allocation) => sum + (allocation.valor || 0), 0);
    return { data: total, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const getAccountAllocationsTotal = async (accountId: string, userId: string): Promise<{ data: number | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('goal_allocations')
      .select('valor')
      .eq('account_id', accountId)
      .eq('user_id', userId);

    if (error) {
      return { data: null, error };
    }

    const rows = (data as { valor: number | null }[] | null) || [];
    const total = rows.reduce((sum, allocation) => sum + (allocation.valor || 0), 0);
    return { data: total, error: null };
  } catch (error) {
    return { data: null, error };
  }
}; 

export const deallocateFromGoal = async (
  goalId: string,
  accountId: string,
  amount: number,
  userId: string
): Promise<number> => {
  try {
    // Preparar payload para a função RPC

    if (authError || !authData.user) {
      throw new Error('Utilizador não autenticado');
    }

    // Validar parâmetros antes da chamada
    if (!goalId || !accountId || !userId) {
      throw new Error('Parâmetros obrigatórios em falta');
    }

    if (amount <= 0) {
      throw new Error('Montante deve ser positivo');
    }

    // Normalização defensiva similar à allocateToGoal
    const payload = {
      goal_id_param: goalId,
      account_id_param: accountId,
      amount_param: typeof amount === 'string' ? parseFloat(amount) : amount,
      user_id_param: userId
    };

    console.debug('[goalAllocations.deallocateFromGoal] RPC request deallocate_from_goal_with_transaction - params:', payload);

    const { data, error } = await supabase.rpc('deallocate_from_goal_with_transaction', payload);

    if (error) {
      const enriched = {
        code: (error as any)?.code,
        message: (error as any)?.message,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
      };
      console.error('[goalAllocations.deallocateFromGoal] RPC error', enriched);
      throw new Error(`Erro RPC: ${error.message} (${error.code})`);
    }

    // RPC executado com sucesso
    
    // A função RPC retorna um objeto JSON com amount_released
    const result = data as { amount_released: number } | null;
    if (!result || typeof result !== 'object') {
      console.warn('[goalAllocations.deallocateFromGoal] Resultado inesperado:', data);
      return 0;
    }
    return result.amount_released || 0;
  } catch (error) {
    console.error('❌ [DEBUG] deallocateFromGoal - Erro geral:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Erro desconhecido',
      errorStack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};