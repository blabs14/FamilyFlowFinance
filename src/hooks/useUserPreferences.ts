import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getUserPreferences, updateUserPreferences, type UserPreferencesUpdate } from '../services/userPreferences';

export const USER_PREFS_QUERY_KEY = (userId: string) => ['user_preferences', userId];

export function useUserPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: USER_PREFS_QUERY_KEY(user?.id ?? ''),
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await getUserPreferences(user.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}

export function useUpdateUserPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UserPreferencesUpdate) => {
      if (!user?.id) throw new Error('Not authenticated');
      return updateUserPreferences(user.id, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_PREFS_QUERY_KEY(user?.id ?? '') });
    },
  });
}
