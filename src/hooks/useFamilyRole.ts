import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

export function useFamilyRole(familyId?: string | null) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['family-role', familyId, user?.id],
    queryFn: async () => {
      if (!familyId || !user?.id) return null;
      const { data } = await supabase
        .from('family_members')
        .select('role')
        .eq('family_id', familyId)
        .eq('user_id', user.id)
        .single();
      return data?.role as string | null;
    },
    enabled: !!familyId && !!user?.id,
  });
  return data ?? null;
}
