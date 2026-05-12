// src/features/payroll/hooks/usePayslips.ts
import { useQuery } from '@tanstack/react-query';
import { getPostedPayslips } from '../services/payrollService';
import type { PayslipRecord } from '../types/payroll-core.types';

export const usePayslips = (contractId: string | null | undefined) => {
  return useQuery<PayslipRecord[], Error>({
    queryKey: ['payroll-payslips', contractId],
    queryFn: () => getPostedPayslips(contractId!),
    enabled: !!contractId,
    staleTime: 30 * 1000,  // 30 seconds
  });
};
