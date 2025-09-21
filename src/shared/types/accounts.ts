import type { Account, AccountWithBalances } from '../../integrations/supabase/types';

export type AccountDomain = {
  id: string;
  name: string;
  type: string;
  createdAt?: string | null;
};

export type AccountWithBalancesDomain = {
  accountId: string;
  name: string;
  type?: string | null;
  familyId?: string | null;
  currentBalance: number;
  availableBalance?: number | null;
  reservedTotal?: number | null;
  isInDebt?: boolean | null;
};

export function mapAccountRowToDomain(row: Account): AccountDomain {
  return {
    id: row.id,
    name: row.nome,
    type: row.tipo,
    createdAt: row.created_at ?? null,
  };
}

export function mapAccountWithBalancesToDomain(row: AccountWithBalances): AccountWithBalancesDomain {
  return {
    accountId: row.account_id,
    name: row.nome,
    type: row.tipo ?? null,
    familyId: (row as any).family_id ?? null,
    currentBalance: row.saldo_atual,
    availableBalance: row.saldo_disponivel ?? null,
    reservedTotal: row.total_reservado ?? null,
    isInDebt: null,
  };
}