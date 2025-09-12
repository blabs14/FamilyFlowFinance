import { supabase } from '../lib/supabaseClient';
import { familyService } from '../features/family/services/family.service';
import { logger } from '@/shared/lib/logger';

export const updateFamilySettings = async (familyId: string, settings: any) => {
  const { data, error } = await supabase.rpc('update_family_settings', {
    p_family_id: familyId,
    p_nome: '',
    p_settings: settings,
  });
  if (error) throw error;
  return data;
};

export const updateMemberRole = async (familyId: string, userId: string, newRole: string) => {
  const { data, error } = await supabase.rpc('update_member_role', {
    p_family_id: familyId,
    p_member_user_id: userId,
    p_new_role: newRole,
  });
  if (error) throw error;
  return data;
};

export const removeFamilyMember = async (familyId: string, userId: string) => {
  const { data, error } = await supabase.rpc('remove_family_member', {
    p_family_id: familyId,
    p_member_user_id: userId,
  });
  if (error) throw error;
  return data;
};

export const inviteFamilyMember = async (familyId: string, email: string, role: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Utilizador não autenticado');
  
  // Use the safer RPC function that returns structured responses
  const { data, error } = await supabase.rpc('invite_family_member_by_email_safe', {
    p_family_id: familyId,
    p_email: email.toLowerCase(),
    p_role: role,
  });
  
  if (error) {
    console.error('RPC error:', error);
    throw new Error('Erro de comunicação com o servidor');
  }
  
  // Handle structured response from the safe function
  if (data && typeof data === 'object' && 'success' in data) {
    if (!data.success) {
      // Handle specific error types
      switch (data.error) {
        case 'AUTHENTICATION_REQUIRED':
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        case 'INVALID_EMAIL':
          throw new Error('Email inválido');
        case 'INVALID_ROLE':
          throw new Error('Role inválido');
        case 'PERMISSION_DENIED':
          throw new Error('Não tem permissão para convidar membros');
        case 'USER_ALREADY_MEMBER':
          throw new Error('Este utilizador já é membro da família');
        case 'INVITE_ALREADY_EXISTS':
          throw new Error('Já existe um convite pendente para este email');
        case 'INTERNAL_ERROR':
        default:
          throw new Error(data.message || 'Erro interno do servidor');
      }
    }
    return data;
  }
  
  return data;
};

export const cancelFamilyInvite = async (inviteId: string) => {
  const { data, error } = await supabase.rpc('cancel_family_invite', {
    p_invite_id: inviteId,
  });
  if (error) throw error;
  return data;
};

export const acceptFamilyInvite = async (inviteId: string) => {
  const { data, error } = await supabase.rpc('accept_family_invite_by_email', {
    p_invite_id: inviteId,
  });
  if (error) throw error;
  return data;
};

export const shareGoalWithFamily = async (goalId: string, familyId: string) => {
  const { data, error } = await supabase
    .from('goals')
    .update({ family_id: familyId })
    .eq('id', goalId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const unshareGoalFromFamily = async (goalId: string) => {
  const { data, error } = await supabase
    .from('goals')
    .update({ family_id: null })
    .eq('id', goalId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const getFamilyStatistics = async (familyId: string) => {
  const members = await familyService.getMembers(familyId);
  const totalMembers = Array.isArray(members) ? members.length : 0;
  const activeMembers = Array.isArray(members) ? members.filter((m: any) => (m as any).status === 'active').length : 0;
  const totalFamilySpent = 0;
  const totalFamilySaved = 0;
  return { totalMembers, activeMembers, totalFamilySpent, totalFamilySaved };
};

export const getFamilyKPIs = async () => {
  const { data, error } = await supabase.rpc('get_family_kpis');
  if (error) {
    logger.error('Error fetching family KPIs:', error);
    throw error;
  }
  return {
    data: data?.[0] || {
      total_balance: 0,
      credit_card_debt: 0,
      top_goal_progress: 0,
      monthly_savings: 0,
      goals_account_balance: 0,
      total_goals_value: 0,
      goals_progress_percentage: 0,
      total_budget_spent: 0,
      total_budget_amount: 0,
      budget_spent_percentage: 0,
      total_members: 0,
      pending_invites: 0,
    },
    error: null,
  };
};

// Novo: KPIs com parâmetros (family_id e intervalo)
export const getFamilyKPIsRange = async (
  familyId: string,
  dateStart: string,
  dateEnd: string,
  excludeTransfers: boolean = true
) => {
  const { data, error } = await supabase.rpc('get_family_kpis', {
    p_family_id: familyId,
    p_date_start: dateStart,
    p_date_end: dateEnd,
    p_exclude_transfers: excludeTransfers,
  });
  if (error) {
    return { data: null as any, error };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { data: row, error: null } as { data: any; error: null };
};

// Breakdown por categoria (despesa/receita) via RPC
export const getFamilyCategoryBreakdown = async (
  familyId: string,
  dateStart: string,
  dateEnd: string,
  kind: 'despesa' | 'receita' | 'ambos' = 'despesa'
) => {
  const { data, error } = await supabase.rpc('get_family_category_breakdown', {
    p_family_id: familyId,
    p_date_start: dateStart,
    p_date_end: dateEnd,
    p_kind: kind,
  });
  if (error) {
    return { data: [] as any[], error };
  }
  const rows = Array.isArray(data) ? data : [];
  return { data: rows as Array<{ category_id: string | null; category_name: string | null; total: number; percentage: number }>, error: null };
};