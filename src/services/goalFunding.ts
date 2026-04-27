import { supabase } from '../lib/supabaseClient';

export type FundingRuleType = 'income_percent' | 'fixed_monthly' | 'roundup_expense';

export interface GoalFundingRule {
	id: string;
	goal_id: string;
	type: FundingRuleType;
	enabled: boolean;
	percent_bp?: number | null;
	fixed_cents?: number | null;
	day_of_month?: number | null;
	category_id?: string | null;
	min_amount_cents?: number | null;
	currency: string;
	created_at: string;
	updated_at: string;
}

export interface GoalFundingRuleInsert {
	goal_id: string;
	type: FundingRuleType;
	enabled?: boolean;
	percent_bp?: number | null;
	fixed_cents?: number | null;
	day_of_month?: number | null;
	category_id?: string | null;
	min_amount_cents?: number | null;
	currency?: string;
}

export interface GoalFundingRuleUpdate extends Partial<GoalFundingRuleInsert> {}

export async function listFundingRules(goalId: string) {
	return supabase
		.from('goal_funding_rules')
		.select('*')
		.eq('goal_id', goalId)
		.order('created_at', { ascending: false });
}

export async function createFundingRule(rule: GoalFundingRuleInsert) {
	return supabase
		.from('goal_funding_rules')
		.insert([{ ...rule }])
		.select('*')
		.single();
}

export async function updateFundingRule(id: string, updates: GoalFundingRuleUpdate) {
	return supabase
		.from('goal_funding_rules')
		.update({ ...updates })
		.eq('id', id)
		.select('*')
		.single();
}

export async function deleteFundingRule(id: string) {
	return supabase
		.from('goal_funding_rules')
		.delete()
		.eq('id', id);
}

export async function listGoalLedgerEntries(goalId: string, limit = 20) {
	return supabase
		.from('goal_ledger')
		.select('*')
		.eq('goal_id', goalId)
		.order('created_at', { ascending: false })
		.limit(limit);
}