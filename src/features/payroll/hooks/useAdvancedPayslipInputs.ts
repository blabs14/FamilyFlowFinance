// src/features/payroll/hooks/useAdvancedPayslipInputs.ts
/**
 * Aggregates advanced payslip inputs (OT, mileage, allowances, leaves)
 * and invalidates ['payslip-calculation', contractId, period] after any mutation.
 *
 * This hook is a thin coordinator — actual data fetching is done by the
 * two-phase calculatePayslip orchestrator in payrollService.ts.
 * Components that need to trigger a payslip recalculation should import this
 * hook and call invalidatePayslip() after mutations.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useTravelAllowances } from './useTravelAllowances';

export function useAdvancedPayslipInputs(contractId: string | null, period: string) {
  const qc = useQueryClient();
  const travelAllowances = useTravelAllowances(contractId, period);

  /** Call after any mutation that should trigger payslip recalculation */
  const invalidatePayslip = () => {
    qc.invalidateQueries({ queryKey: ['payslip-calculation', contractId, period] });
  };

  return {
    travelAllowances,
    invalidatePayslip,
  };
}
