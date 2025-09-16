import { supabase } from '@/lib/supabaseClient';
import { z } from 'zod';

export const recurringRuleSchema = z.object({
  scope: z.enum(['personal','family']),
  user_id: z.string().uuid(),
  family_id: z.string().uuid().nullable().optional(),
  payee: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  amount_cents: z.number().int().positive(),
  currency: z.string().default('EUR'),
  interval_unit: z.enum(['day','week','month','year']),
  interval_count: z.number().int().positive().default(1),
  start_date: z.string(),
  end_date: z.string().optional().nullable(),
  next_run_date: z.string(),
  last_run_date: z.string().optional().nullable(),
  status: z.enum(['active','paused','canceled']).default('active'),
  is_subscription: z.boolean().default(false),
  vendor: z.string().optional().nullable(),
  trial_end_date: z.string().optional().nullable(),
  cancel_at_period_end: z.boolean().optional().nullable(),
  payment_method: z.string().optional().nullable(),
  // Campos para transferências
  transaction_type: z.enum(['expense', 'income', 'transfer']).default('expense'),
  from_account_id: z.string().uuid().optional().nullable(),
  to_account_id: z.string().uuid().optional().nullable(),
  metadata: z.record(z.any()).optional()
});

export type RecurringRule = z.infer<typeof recurringRuleSchema> & { id?: string };

// Alias sem tipos para usar tabelas/RPCs ainda não presentes em database.types
const sb = supabase;

export async function listRecurringRules(scope: 'personal'|'family', familyId?: string) {
  let query = sb.from('recurring_rules').select('*').order('created_at', { ascending: false });
  if (scope === 'family') query = query.eq('family_id', familyId);
  else query = query.is('family_id', null);
  return query;
}

export async function createRecurringRule(input: RecurringRule) {
  const parsed = recurringRuleSchema.parse(input);
  return sb.from('recurring_rules').insert([parsed]).select('*').single();
}

export async function updateRecurringRule(id: string, input: Partial<RecurringRule>) {
  const parsed = recurringRuleSchema.partial().parse(input);
  return sb.from('recurring_rules').update(parsed).eq('id', id).select('*').single();
}

export async function pauseRecurringRule(id: string) {
  return sb.rpc('rr_pause_rule', { rule_id: id });
}
export async function resumeRecurringRule(id: string) {
  return sb.rpc('rr_resume_rule', { rule_id: id });
}
export async function cancelAtPeriodEnd(id: string) {
  return sb.rpc('rr_cancel_at_period_end', { rule_id: id });
}
export async function skipNextOccurrence(id: string) {
  return sb.rpc('rr_skip_next', { rule_id: id });
}

export async function listRecurringInstances(ruleId?: string) {
  let q = sb.from('recurring_instances').select('*').order('due_date');
  if (ruleId) q = q.eq('rule_id', ruleId);
  return q;
}

export async function deleteRecurringRule(id: string) {
  return sb.from('recurring_rules').delete().eq('id', id);
}