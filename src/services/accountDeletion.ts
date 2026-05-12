import { supabase } from '../lib/supabaseClient';

/** Creates a deletion_token (30-day cooling-off period). */
export async function requestAccountDeletion(userId: string) {
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('deletion_tokens')
    .insert({ user_id: userId, token, expires_at: expires })
    .select('id, expires_at')
    .single();
  return { data, error };
}

/** Cancels a pending deletion by removing the token. */
export async function cancelAccountDeletion(userId: string) {
  return supabase
    .from('deletion_tokens')
    .delete()
    .eq('user_id', userId);
}

/** Checks if there is a pending deletion token. */
export async function getPendingDeletion(userId: string) {
  return supabase
    .from('deletion_tokens')
    .select('id, expires_at')
    .eq('user_id', userId)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();
}
