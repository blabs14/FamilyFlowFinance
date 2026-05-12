import { supabase } from '../lib/supabaseClient';

export interface UserPreferences {
  user_id: string;
  language: 'pt-PT' | 'en-US';
  currency: string;
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  compact_mode: boolean;
  show_currency_symbol: boolean;
  onboarding_completed_at: string | null;
  // Notification matrix — 12 events × 2 channels
  notif_goal_target_reached_email: boolean;
  notif_goal_target_reached_inapp: boolean;
  notif_goal_deadline_near_email: boolean;
  notif_goal_deadline_near_inapp: boolean;
  notif_budget_80pct_email: boolean;
  notif_budget_80pct_inapp: boolean;
  notif_budget_100pct_email: boolean;
  notif_budget_100pct_inapp: boolean;
  notif_recurring_needs_confirm_email: boolean;
  notif_recurring_needs_confirm_inapp: boolean;
  notif_recurring_posted_email: boolean;
  notif_recurring_posted_inapp: boolean;
  notif_card_statement_ready_email: boolean;
  notif_card_statement_ready_inapp: boolean;
  notif_family_invite_email: boolean;
  notif_family_invite_inapp: boolean;
  notif_family_audit_email: boolean;
  notif_family_audit_inapp: boolean;
  notif_large_inbound_email: boolean;
  notif_large_inbound_inapp: boolean;
  notif_large_outbound_email: boolean;
  notif_large_outbound_inapp: boolean;
  notif_import_completed_email: boolean;
  notif_import_completed_inapp: boolean;
  large_threshold_cents: number;
  updated_at: string;
}

export type UserPreferencesUpdate = Partial<Omit<UserPreferences, 'user_id' | 'updated_at'>>;

export const getUserPreferences = (userId: string) =>
  supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

export const updateUserPreferences = (userId: string, patch: UserPreferencesUpdate) =>
  supabase
    .from('user_preferences')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('*')
    .single();

export const upsertUserPreferences = (userId: string) =>
  supabase
    .from('user_preferences')
    .upsert({ user_id: userId }, { onConflict: 'user_id' })
    .select('*')
    .single();
