import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));

vi.mock('../../services/payrollService', () => ({
  calculatePayslip: vi.fn(),
  createPayslipDraft: vi.fn(),
  postPayslip: vi.fn(),
  getPostedPayslips: vi.fn(),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

import { calculatePayslip, createPayslipDraft, postPayslip, getPostedPayslips } from '../../services/payrollService';
import PayslipPreview from '../PayslipPreview';

const mockCalc = vi.mocked(calculatePayslip);
const mockDraft = vi.mocked(createPayslipDraft);
const mockPost = vi.mocked(postPayslip);
const mockHistory = vi.mocked(getPostedPayslips);

const makeQC = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const mockCalculation = {
  gross_cents: 150000,
  irs_cents: 25808,
  ss_cents: 16500,
  meal_cents: 9840,
  net_cents: 117532,
  working_days: 16,
  components: [
    { label: 'Vencimento Base', amount_cents: 150000, sign: '+' as const },
    { label: 'IRS (retenção)', amount_cents: 25808, sign: '-' as const },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockHistory.mockResolvedValue([]);
});

const renderComponent = (contractId = 'contract-1', period = '2026-05') => {
  const qc = makeQC();
  return render(
    <QueryClientProvider client={qc}>
      <PayslipPreview contractId={contractId} defaultPeriod={period} />
    </QueryClientProvider>,
  );
};

describe('PayslipPreview', () => {
  it('shows loading skeleton while calculating', async () => {
    mockCalc.mockReturnValue(new Promise(() => {})); // never resolves
    renderComponent();
    expect(screen.getByTestId('payslip-skeleton')).toBeTruthy();
  });

  it('displays calculated values when ready', async () => {
    mockCalc.mockResolvedValue(mockCalculation);
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/Vencimento Base/i)).toBeTruthy();
    });
    expect(screen.getByText(/Lançar Recibo/i)).toBeTruthy();
  });

  it('disables Lançar button when period is already posted', async () => {
    mockCalc.mockResolvedValue(mockCalculation);
    mockHistory.mockResolvedValue([{
      id: 'slip-1', contractId: 'contract-1', period: '2026-05',
      status: 'posted', transactionId: 'tx-1',
      gross_cents: 150000, irs_cents: 25808, ss_cents: 16500,
      meal_cents: 9840, net_cents: 117532, working_days: 16,
      components: [], createdAt: '2026-05-01',
    }]);
    renderComponent();
    // Both queries must resolve before checking posted state — keep all assertions inside waitFor
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Lançar Recibo/i })).toBeNull();
      expect(screen.getByText(/já lançado/i)).toBeTruthy();
    });
  });

  it('calls createPayslipDraft then postPayslip on Lançar click and shows success toast', async () => {
    mockToast.mockClear();
    mockCalc.mockResolvedValue(mockCalculation);
    mockDraft.mockResolvedValue('payslip-uuid-1');
    mockPost.mockResolvedValue({ transaction_id: 'tx-new', idempotent: false });

    renderComponent();
    await waitFor(() => screen.getByText(/Lançar Recibo/i));

    fireEvent.click(screen.getByText(/Lançar Recibo/i));

    await waitFor(() => {
      expect(mockDraft).toHaveBeenCalledWith('contract-1', '2026-05');
      expect(mockPost).toHaveBeenCalledWith('payslip-uuid-1');
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Recibo lançado' }));
    });
  });

  it('shows "já existia" toast when postPayslip returns idempotent=true', async () => {
    mockToast.mockClear();
    mockCalc.mockResolvedValue(mockCalculation);
    mockDraft.mockResolvedValue('payslip-uuid-existing');
    mockPost.mockResolvedValue({ transaction_id: 'tx-existing', idempotent: true });

    renderComponent();
    await waitFor(() => screen.getByText(/Lançar Recibo/i));
    fireEvent.click(screen.getByText(/Lançar Recibo/i));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Recibo já existia' }));
    });
  });

  it('shows error toast when postPayslip fails', async () => {
    mockToast.mockClear();

    mockCalc.mockResolvedValue(mockCalculation);
    mockDraft.mockResolvedValue('payslip-uuid-1');
    mockPost.mockRejectedValue(new Error('NO_ACCOUNT_CONFIGURED'));

    renderComponent();
    await waitFor(() => screen.getByText(/Lançar Recibo/i));
    fireEvent.click(screen.getByText(/Lançar Recibo/i));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' }),
      );
    });
  });
});
