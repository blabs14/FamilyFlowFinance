// src/services/inbox.ts
import { supabase } from '@/lib/supabaseClient';

export type InboxItem = {
  id: string;
  user_id: string;
  family_id: string | null;
  source_type: 'recurring_instance' | 'budget_threshold' | 'goal_deadline' | 'manual';
  source_id: string | null;
  title: string;
  body: string | null;
  due_at: string | null;
  status: 'pending' | 'snoozed' | 'done' | 'dismissed';
  snoozed_until: string | null;
  completed_at: string | null;
  created_at: string;
};

export const getInboxItems = async (
  userId: string,
  statusFilter: InboxItem['status'][] = ['pending', 'snoozed']
): Promise<{ data: InboxItem[]; error: unknown }> => {
  if (!userId || !userId.trim()) return { data: [], error: null };
  const { data, error } = await supabase
    .from('inbox_items')
    .select('*')
    .eq('user_id', userId)
    .in('status', statusFilter)
    .order('due_at', { ascending: true });
  return { data: (data as InboxItem[]) ?? [], error };
};

export const getInboxItem = async (
  id: string
): Promise<{ data: InboxItem | null; error: unknown }> => {
  const { data, error } = await supabase
    .from('inbox_items')
    .select('*')
    .eq('id', id)
    .limit(1)
    .then((r) => r);
  return { data: (data as InboxItem[] | null)?.[0] ?? null, error };
};

export const dismissInboxItem = async (
  item: InboxItem
): Promise<{ data: unknown; error: unknown }> => {
  if (item.source_type === 'recurring_instance' && item.source_id) {
    const { data, error } = await supabase.rpc('skip_recurring_instance', {
      p_instance_id: item.source_id,
    });
    return { data, error };
  }
  // For manual and other types: update directly
  const { data, error } = await supabase
    .from('inbox_items')
    .update({ status: 'dismissed', completed_at: new Date().toISOString() })
    .eq('id', item.id);
  return { data, error };
};

export const doneInboxItem = async (
  item: InboxItem
): Promise<{ data: unknown; error: unknown }> => {
  if (item.source_type === 'recurring_instance' && item.source_id) {
    const { data, error } = await supabase.rpc('confirm_recurring_instance', {
      p_instance_id: item.source_id,
    });
    return { data, error };
  }
  // For manual and other types: update directly
  const { data, error } = await supabase
    .from('inbox_items')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', item.id);
  return { data, error };
};
