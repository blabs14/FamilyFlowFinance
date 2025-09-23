import { supabase } from '../lib/supabaseClient';
import { 
  GoalAllocation, 
  GoalAllocationInsert, 
  GoalAllocationUpdate 
} from '../integrations/supabase/types';
import { retryWithBackoff, withTimeout } from '../config/rpcConfig';

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

    // Implementar retry logic com timeout configurável
    const result = await retryWithBackoff(async () => {
      const rpcCall = supabase.rpc('deallocate_from_goal_with_transaction', payload);
      const { data, error } = await withTimeout(rpcCall);

      if (error) {
        const enriched = {
          code: (error as any)?.code,
          message: (error as any)?.message,
          details: (error as any)?.details,
          hint: (error as any)?.hint,
        };
        console.error('[goalAllocations.deallocateFromGoal] RPC error', enriched);
        
        // Criar erro mais específico baseado no tipo
        if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_ABORTED')) {
          throw new Error(`Erro de conectividade: ${error.message}. Verifique a sua ligação à internet.`);
        }
        
        throw new Error(`Erro RPC: ${error.message} (${error.code})`);
      }

      return data;
    });

    // RPC executado com sucesso
    
    // A função RPC retorna um objeto JSON com amount_released
    const data = result as { amount_released: number } | null;
    if (!data || typeof data !== 'object') {
      console.warn('[goalAllocations.deallocateFromGoal] Resultado inesperado:', result);
      return 0;
    }
    
    console.log('✅ [deallocateFromGoal] Desalocação bem-sucedida:', data);
    return data.amount_released || 0;
  } catch (error) {
    // Melhorar mensagens de erro para o utilizador
    let userFriendlyMessage = 'Erro desconhecido na desalocação';
    
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('ERR_ABORTED')) {
        userFriendlyMessage = 'Problema de conectividade. Verifique a sua ligação à internet e tente novamente.';
      } else if (error.message.includes('Timeout após')) {
        userFriendlyMessage = 'A operação demorou muito tempo. Verifique a sua ligação à internet e tente novamente.';
      } else if (error.message.includes('Parâmetros obrigatórios')) {
        userFriendlyMessage = 'Dados inválidos para desalocação. Tente recarregar a página.';
      } else if (error.message.includes('Montante deve ser positivo')) {
        userFriendlyMessage = 'O montante a desalocar deve ser positivo.';
      } else {
        userFriendlyMessage = error.message;
      }
    }
    
    console.error('❌ [DEBUG] deallocateFromGoal - Erro geral:', {
      error,
      errorMessage: error instanceof Error ? error.message : 'Erro desconhecido',
      errorStack: error instanceof Error ? error.stack : undefined,
      userFriendlyMessage
    });
    
    // Lançar erro com mensagem amigável para o utilizador
    const enhancedError = new Error(userFriendlyMessage);
    (enhancedError as any).originalError = error;
    throw enhancedError;
  }
};