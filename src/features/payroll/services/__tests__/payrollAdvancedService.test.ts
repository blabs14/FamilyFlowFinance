// src/features/payroll/services/__tests__/payrollAdvancedService.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  fetchTaxRates,
  _clearTaxRateCache,
  fetchTravelAllowances,
  saveTravelAllowance,
  deleteTravelAllowance,
  updateOtYtd,
} from '../payrollAdvanced.service';

// Mock Supabase — must use the same alias as the source file
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabaseClient';

const TAX_ROWS = [
  {
    type: 'ot_rates',
    data: {
      up_to_100h: { first_hour_pct: 0.25, next_hours_pct: 0.375, rest_day_pct: 0.50 },
      above_100h: { first_hour_pct: 0.50, next_hours_pct: 0.75, rest_day_pct: 1.00 },
      night_work_pct: 0.25, night_start: '22:00', night_end: '07:00',
    },
  },
  {
    type: 'ot_annual_limits',
    data: { mpe_hours: 175, others_hours: 150, irct_max_hours: 200, daily_max_hours: 2 },
  },
  {
    type: 'ot_irs_withholding',
    data: { autonomous_rate_of_base: 0.50, since: '2025-01-01' },
  },
  {
    type: 'mileage_caps',
    data: { cents_per_km: 40 },
  },
  {
    type: 'travel_allowance_caps',
    data: {
      national_general_cents: 6589, national_admin_cents: 7265,
      foreign_general_cents: 15636, foreign_admin_cents: 17542,
      breakdown: { lunch: 0.25, dinner: 0.25, sleep: 0.50 },
    },
  },
];

/**
 * Creates a Supabase chain mock.
 *
 * All chainable methods return `this` so the full builder chain works.
 * The chain object is also thenable (has a `.then` method) so it can be
 * `await`ed directly when it is the last expression in the service function
 * (e.g. `await supabase.from(...).delete().eq(...)`).
 * Methods that Supabase-JS always makes terminal (.single) are also resolved.
 */
function mockChain(returnData: any, returnError: any = null) {
  const resolved = { data: returnData, error: returnError };
  // Make the chain itself a thenable so `await chain` works at any point
  const promise = Promise.resolve(resolved);
  const chain: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    gte:    vi.fn().mockReturnThis(),
    lte:    vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolved),
    // Thenable — allows `await chain` and `await chain.someMethod(...)`
    then:   (onFulfilled: any, onRejected: any) => promise.then(onFulfilled, onRejected),
    catch:  (onRejected: any) => promise.catch(onRejected),
    finally: (onFinally: any) => promise.finally(onFinally),
  };
  (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

// ── fetchTaxRates ─────────────────────────────────────────────────────────────

describe('fetchTaxRates', () => {
  beforeEach(() => _clearTaxRateCache());
  afterEach(() => vi.clearAllMocks());

  it('returns correct rates from DB', async () => {
    mockChain(TAX_ROWS);
    const rates = await fetchTaxRates(2026);
    expect(rates.otRates.up_to_100h.first_hour_pct).toBe(0.25);
    expect(rates.mileageCaps.cents_per_km).toBe(40);
    expect(rates.travelCaps.national_general_cents).toBe(6589);
    expect(rates.otIrsWithholding.autonomous_rate_of_base).toBe(0.50);
  });

  it('caches results — only one DB call on second fetch', async () => {
    mockChain(TAX_ROWS);
    await fetchTaxRates(2026);
    await fetchTaxRates(2026);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('fetches again after cache is cleared', async () => {
    mockChain(TAX_ROWS);
    await fetchTaxRates(2026);
    _clearTaxRateCache();
    mockChain(TAX_ROWS); // re-mock for the second call
    await fetchTaxRates(2026);
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });

  it('throws when a required type is missing from DB', async () => {
    // Remove ot_rates from the rows
    const partial = TAX_ROWS.filter(r => r.type !== 'ot_rates');
    mockChain(partial);
    await expect(fetchTaxRates(2026)).rejects.toThrow('Missing ot_rates');
  });
});

// ── fetchTravelAllowances ─────────────────────────────────────────────────────

describe('fetchTravelAllowances', () => {
  afterEach(() => vi.clearAllMocks());

  it('queries by contract and period date range', async () => {
    const records = [
      {
        id: 'a', contract_id: 'c1', type: 'deslocacao_nacional',
        date_start: '2026-01-10', days: 2, km: null, role: 'general',
        declared_cents: 13178, taxable_excess_cents: 0, operation_id: 'op1', created_at: '',
      },
    ];
    const chain = mockChain(records);
    const result = await fetchTravelAllowances('c1', '2026-01');
    expect(supabase.from).toHaveBeenCalledWith('payroll_travel_allowances');
    expect(chain.gte).toHaveBeenCalledWith('date_start', '2026-01-01');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns empty array when no records', async () => {
    mockChain([]);
    const result = await fetchTravelAllowances('c1', '2026-02');
    expect(result).toEqual([]);
  });
});

// ── saveTravelAllowance ───────────────────────────────────────────────────────

describe('saveTravelAllowance', () => {
  afterEach(() => vi.clearAllMocks());

  it('inserts into payroll_travel_allowances and returns record', async () => {
    const inserted = {
      id: 'new-id', contract_id: 'c1', type: 'deslocacao_nacional',
      date_start: '2026-01-10', days: 2, km: null, role: 'general',
      declared_cents: 13178, taxable_excess_cents: 0, operation_id: 'op-1', created_at: '',
    };
    const chain = mockChain(inserted);
    const result = await saveTravelAllowance({
      contract_id: 'c1', type: 'deslocacao_nacional', date_start: '2026-01-10',
      days: 2, role: 'general', declared_cents: 13178, taxable_excess_cents: 0, operation_id: 'op-1',
    });
    expect(supabase.from).toHaveBeenCalledWith('payroll_travel_allowances');
    expect(chain.insert).toHaveBeenCalled();
    expect(result.id).toBe('new-id');
  });

  it('propagates Supabase error', async () => {
    mockChain(null, { message: 'DB error', code: '23505' });
    await expect(saveTravelAllowance({
      contract_id: 'c1', type: 'deslocacao_nacional', date_start: '2026-01-10',
      role: 'general', declared_cents: 100, taxable_excess_cents: 0, operation_id: 'op-2',
    })).rejects.toThrow();
  });
});

// ── deleteTravelAllowance ─────────────────────────────────────────────────────

describe('deleteTravelAllowance', () => {
  afterEach(() => vi.clearAllMocks());

  it('calls DELETE with correct id', async () => {
    const chain = mockChain(null);
    await deleteTravelAllowance('record-id');
    expect(supabase.from).toHaveBeenCalledWith('payroll_travel_allowances');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'record-id');
  });
});

// ── updateOtYtd ───────────────────────────────────────────────────────────────

describe('updateOtYtd', () => {
  afterEach(() => vi.clearAllMocks());

  it('updates ot_hours_ytd on payroll_ot_policies', async () => {
    const chain = mockChain(null);
    await updateOtYtd('contract-1', 52.5);
    expect(supabase.from).toHaveBeenCalledWith('payroll_ot_policies');
    expect(chain.update).toHaveBeenCalledWith({ ot_hours_ytd: 52.5 });
    expect(chain.eq).toHaveBeenCalledWith('contract_id', 'contract-1');
  });
});
