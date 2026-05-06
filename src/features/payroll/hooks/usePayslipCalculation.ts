// src/features/payroll/hooks/usePayslipCalculation.ts
import { useQuery } from '@tanstack/react-query';
import { calculatePayslip } from '../services/payrollService';
import type { PayslipCalculation } from '../types/payroll-core.types';

export const usePayslipCalculation = (
  contractId: string | null | undefined,
  period: string,
) => {
  return useQuery<PayslipCalculation, Error>({
    queryKey: ['payslip-calculation', contractId, period],
    queryFn: () => calculatePayslip(contractId!, period),
    enabled: !!contractId && !!period,
    staleTime: 5 * 60 * 1000,  // 5 minutes — calculation rarely changes
    retry: false,               // don't retry on CONTRACT_NOT_FOUND
  });
};
