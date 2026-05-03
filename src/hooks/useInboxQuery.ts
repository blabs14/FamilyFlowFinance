// src/hooks/useInboxQuery.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getInboxItems,
  dismissInboxItem,
  doneInboxItem,
  type InboxItem,
} from '@/services/inbox';

const INBOX_KEY = 'inbox_items';

export const useInboxItems = (
  statusFilter: InboxItem['status'][] = ['pending', 'snoozed']
) => {
  const { user } = useAuth();
  return useQuery<InboxItem[]>({
    queryKey: [INBOX_KEY, user?.id, statusFilter],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await getInboxItems(user.id, statusFilter);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000, // 1 min — inbox should be relatively fresh
  });
};

export const useDismissInboxItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: InboxItem) => {
      const result = await dismissInboxItem(item);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INBOX_KEY] }),
  });
};

export const useDoneInboxItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: InboxItem) => {
      const result = await doneInboxItem(item);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [INBOX_KEY] }),
  });
};
