// src/hooks/useFamilySplitsQuery.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useScope } from '@/features/scope';
import {
  getMemberBalances,
  splitTransactionAmongMembers,
  settleBalance,
  type ExpenseSplit,
} from '@/services/family';

export const MEMBER_BALANCES_KEY = 'member-balances';

export function useMemberBalances() {
  const { scope } = useScope();
  const familyId = scope.kind === 'family' ? (scope as any).familyId as string : null;

  return useQuery({
    queryKey: [MEMBER_BALANCES_KEY, familyId],
    queryFn: () => getMemberBalances(familyId!),
    enabled: !!familyId,
  });
}

export function useSplitTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      transactionId,
      shares,
    }: { transactionId: string; shares: ExpenseSplit[] }) =>
      splitTransactionAmongMembers(transactionId, shares),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MEMBER_BALANCES_KEY] });
    },
  });
}

export function useSettleBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      familyId: string;
      fromUserId: string;
      toUserId: string;
      amountCents: number;
      fromAccountId: string;
      toAccountId: string;
    }) =>
      settleBalance(
        params.familyId,
        params.fromUserId,
        params.toUserId,
        params.amountCents,
        params.fromAccountId,
        params.toAccountId,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [MEMBER_BALANCES_KEY] });
    },
  });
}
