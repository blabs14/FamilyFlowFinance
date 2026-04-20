import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';

export type MyFamily = {
  id: string;
  nome: string;
};

export const useMyFamilies = () => {
  const { user } = useAuth();

  return useQuery<MyFamily[]>({
    queryKey: ['scope', 'my-families', user?.id ?? null],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }

      const { data, error } = await supabase
        .from('family_members')
        .select('family_id, family:families(id, nome)')
        .eq('user_id', user.id)
        .order('family_id', { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? [])
        .map((row: { family: MyFamily | null }) => row.family)
        .filter((family): family is MyFamily => family !== null);
    },
    staleTime: 5 * 60 * 1000,
  });
};
