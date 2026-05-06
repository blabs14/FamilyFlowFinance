import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before any imports
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabaseClient';
import {
  calculatePayslip,
  createPayslipDraft,
  postPayslip,
  savePayrollContractCore,
  getPostedPayslips,
} from '../payrollService';

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;
const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('calculatePayslip', () => {
  it('calls calculate_payslip RPC with correct params', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { gross_cents: 150000, irs_cents: 25808, ss_cents: 16500, meal_cents: 9840, net_cents: 117532, working_days: 16, components: [] },
      error: null,
    });

    const result = await calculatePayslip('contract-123', '2026-05');

    expect(mockRpc).toHaveBeenCalledWith('calculate_payslip', {
      p_contract_id: 'contract-123',
      p_period: '2026-05',
    });
    expect(result.gross_cents).toBe(150000);
    expect(result.net_cents).toBe(117532);
  });

  it('throws the RPC error object when error is returned', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'CONTRACT_NOT_FOUND' } });
    await expect(calculatePayslip('bad-id', '2026-05')).rejects.toMatchObject({ message: 'CONTRACT_NOT_FOUND' });
  });
});

describe('postPayslip', () => {
  it('calls post_payslip RPC and returns transaction_id', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { transaction_id: 'tx-abc', idempotent: false },
      error: null,
    });

    const result = await postPayslip('slip-123');

    expect(mockRpc).toHaveBeenCalledWith('post_payslip', { p_payslip_id: 'slip-123' });
    expect(result.transaction_id).toBe('tx-abc');
    expect(result.idempotent).toBe(false);
  });
});

describe('createPayslipDraft', () => {
  it('calls create_payslip_draft and returns payslip id', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'payslip-uuid-1', error: null });

    const id = await createPayslipDraft('contract-123', '2026-05');

    expect(mockRpc).toHaveBeenCalledWith('create_payslip_draft', {
      p_contract_id: 'contract-123',
      p_period: '2026-05',
    });
    expect(id).toBe('payslip-uuid-1');
  });
});

describe('savePayrollContractCore', () => {
  it('maps camelCase params to snake_case RPC params and returns new contract id', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'new-contract-uuid', error: null });

    const id = await savePayrollContractCore({
      name: 'Test Worker',
      baseSalaryCents: 120000,
      weeklyHours: 40,
      scheduleJson: { mon: 8 },
      vacationBonusMode: 'full',
      christmasBonusMode: 'full',
      accountId: 'account-uuid',
    });

    expect(mockRpc).toHaveBeenCalledWith('save_payroll_contract', {
      p_name:                 'Test Worker',
      p_base_salary_cents:    120000,
      p_weekly_hours:         40,
      p_schedule_json:        { mon: 8 },
      p_vacation_bonus_mode:  'full',
      p_christmas_bonus_mode: 'full',
      p_account_id:           'account-uuid',
    });
    expect(id).toBe('new-contract-uuid');
  });
});

describe('getPostedPayslips', () => {
  it('queries payroll_payslips filtered by contract_id and status=posted', async () => {
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(mockChain);

    const result = await getPostedPayslips('contract-123');

    expect(mockFrom).toHaveBeenCalledWith('payroll_payslips');
    expect(mockChain.eq).toHaveBeenCalledWith('contract_id', 'contract-123');
    expect(mockChain.eq).toHaveBeenCalledWith('status', 'posted');
    expect(result).toEqual([]);
  });
});
