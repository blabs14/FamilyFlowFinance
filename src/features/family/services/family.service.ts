import { supabase } from '../../../lib/supabaseClient';
import { mapInviteToSummary, mapMemberToSummary } from '../../../shared/types/family';

export const familyService = {
  async createFamily(name: string, description?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Utilizador não autenticado');
    const { data, error } = await supabase.rpc('create_family_with_member', {
      p_family_name: name,
      p_description: description || null,
    });
    if (error) throw error;
    return data;
  },

  async getFamilyData() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Utilizador não autenticado');

    // Verificar se há uma família selecionada no localStorage
    const currentFamilyId = localStorage.getItem('currentFamilyId');
    
    if (currentFamilyId) {
      // Verificar se o utilizador ainda pertence a esta família
      const { data: membership, error: membershipError } = await supabase
        .from('family_members')
        .select('role')
        .eq('family_id', currentFamilyId)
        .eq('user_id', user.id)
        .single();

      if (!membershipError && membership) {
        // Buscar dados da família específica
        const { data: familyData, error: familyError } = await supabase
          .from('families')
          .select('*')
          .eq('id', currentFamilyId)
          .single();

        if (!familyError && familyData) {
          // Contar membros, convites pendentes e metas
          const [membersCount, invitesCount, goalsCount] = await Promise.all([
            supabase.from('family_members').select('id', { count: 'exact' }).eq('family_id', currentFamilyId),
            supabase.from('family_invites').select('id', { count: 'exact' }).eq('family_id', currentFamilyId).eq('status', 'pending'),
            supabase.from('goals').select('id', { count: 'exact' }).eq('family_id', currentFamilyId)
          ]);

          return {
            family: familyData,
            user_role: membership.role,
            member_count: membersCount.count || 0,
            pending_invites_count: invitesCount.count || 0,
            shared_goals_count: goalsCount.count || 0
          };
        }
      }
      
      // Se a família armazenada não é válida, remover do localStorage
      localStorage.removeItem('currentFamilyId');
    }

    // Fallback para a função RPC original (primeira família)
    const { data, error } = await supabase.rpc('get_user_family_data');
    if (error) throw error;
    
    // Se encontrou uma família, armazenar no localStorage
    if (data && data.family && data.family.id) {
      localStorage.setItem('currentFamilyId', data.family.id);
    }
    
    return data;
  },

  async getMembers(familyId?: string) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Utilizador não autenticado');

    if (familyId) {
      const { data, error } = await supabase.rpc('get_family_members_with_profiles', { p_family_id: familyId });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      return rows.map(mapMemberToSummary);
    }
    const { data, error } = await supabase
      .from('family_members')
      .select(`*, profiles:user_id ( id, nome, foto_url )`)
      .order('joined_at', { ascending: true });
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    return rows.map(mapMemberToSummary);
  },

  async getPendingInvites(familyId?: string) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Utilizador não autenticado');

    if (familyId) {
      const { data, error } = await supabase.rpc('get_family_pending_invites', { p_family_id: familyId });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      return rows.map(mapInviteToSummary);
    }
    const { data, error } = await supabase.rpc('get_user_pending_family_invites');
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    return rows.map(mapInviteToSummary);
  },

  async getUserFamilies() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Utilizador não autenticado');

    const { data, error } = await supabase
      .from('family_members')
      .select(`
        families:family_id (
          id,
          nome,
          description,
          created_by,
          created_at,
          updated_at,
          settings
        )
      `)
      .eq('user_id', user.id);

    if (error) throw error;
    
    // Extrair apenas os dados das famílias
    const families = data
      ?.map(item => item.families)
      .filter(family => family !== null) || [];
    
    return families;
  },
};