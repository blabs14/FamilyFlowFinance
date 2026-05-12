// src/features/payroll/services/payrollAdvanced.service.ts
import { supabase } from '../../../lib/supabaseClient';
import type { TaxRates, TravelAllowanceRecord, TravelAllowanceInput } from '../types/payroll-advanced.types';

// ── Tax rate cache (1h TTL) ────────────────────────────────────────────────────

const taxRateCache = new Map<number, { data: TaxRates; expiresAt: number }>();

export async function fetchTaxRates(year: number): Promise<TaxRates> {
  const cached = taxRateCache.get(year);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const { data, error } = await supabase
    .from('payroll_fiscal_params')
    .select('type, data')
    .eq('effective_year', year);
  if (error) throw error;

  const byType = Object.fromEntries((data ?? []).map((r: any) => [r.type, r.data]));

  const rates: TaxRates = {
    otRates:          byType['ot_rates']          ?? (() => { throw new Error('Missing ot_rates'); })(),
    otLimits:         byType['ot_annual_limits']  ?? (() => { throw new Error('Missing ot_annual_limits'); })(),
    otIrsWithholding: byType['ot_irs_withholding'] ?? (() => { throw new Error('Missing ot_irs_withholding'); })(),
    mileageCaps:      byType['mileage_caps']       ?? (() => { throw new Error('Missing mileage_caps'); })(),
    travelCaps:       byType['travel_allowance_caps'] ?? (() => { throw new Error('Missing travel_allowance_caps'); })(),
  };

  taxRateCache.set(year, { data: rates, expiresAt: Date.now() + 60 * 60 * 1000 });
  return rates;
}

// Exported for testing only — clears the in-memory cache
export function _clearTaxRateCache() { taxRateCache.clear(); }

// ── Travel allowances CRUD ─────────────────────────────────────────────────────

/** Returns travel allowances for a contract where date_start falls within period (YYYY-MM). */
export async function fetchTravelAllowances(
  contractId: string,
  period: string, // 'YYYY-MM'
): Promise<TravelAllowanceRecord[]> {
  const [year, month] = period.split('-').map(Number);
  const dateStart = `${period}-01`;
  const dateEnd   = new Date(year, month, 0).toISOString().split('T')[0]; // last day

  const { data, error } = await supabase
    .from('payroll_travel_allowances')
    .select('*')
    .eq('contract_id', contractId)
    .gte('date_start', dateStart)
    .lte('date_start', dateEnd)
    .order('date_start', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TravelAllowanceRecord[];
}

export async function saveTravelAllowance(input: TravelAllowanceInput): Promise<TravelAllowanceRecord> {
  const { data, error } = await supabase
    .from('payroll_travel_allowances')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as TravelAllowanceRecord;
}

export async function deleteTravelAllowance(id: string): Promise<void> {
  const { error } = await supabase
    .from('payroll_travel_allowances')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── OT YTD tracker ────────────────────────────────────────────────────────────

export async function updateOtYtd(contractId: string, newYtdHours: number): Promise<void> {
  const { error } = await supabase
    .from('payroll_ot_policies')
    .update({ ot_hours_ytd: newYtdHours })
    .eq('contract_id', contractId);
  if (error) throw error;
}
