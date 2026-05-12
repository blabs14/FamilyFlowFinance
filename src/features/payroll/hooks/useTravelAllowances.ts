// src/features/payroll/hooks/useTravelAllowances.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTravelAllowances,
  saveTravelAllowance,
  deleteTravelAllowance,
} from '../services/payrollAdvanced.service';
import type { TravelAllowanceInput, TravelAllowanceRecord } from '../types/payroll-advanced.types';

export function useTravelAllowances(contractId: string | null, period: string) {
  const qc = useQueryClient();
  const key = ['travel-allowances', contractId, period] as const;

  const query = useQuery<TravelAllowanceRecord[], Error>({
    queryKey: key,
    queryFn: () => fetchTravelAllowances(contractId!, period),
    enabled: !!contractId,
    staleTime: 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['payslip-calculation', contractId, period] });
  };

  const save = useMutation<TravelAllowanceRecord, Error, TravelAllowanceInput>({
    mutationFn: saveTravelAllowance,
    onSuccess: invalidate,
  });

  const remove = useMutation<void, Error, string>({
    mutationFn: deleteTravelAllowance,
    onSuccess: invalidate,
  });

  return {
    allowances: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    save,
    remove,
  };
}
