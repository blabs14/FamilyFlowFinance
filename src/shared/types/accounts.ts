import type { Account, AccountWithBalances } from '../../integrations/supabase/types';

export type AccountDomain = {
  id: string;
  name: string;
  type: string;
  currency: string;
  orderIndex: number | null;
  deletedAt: string | null;
  createdAt?: string | null;
};

export type AccountWithBalancesDomain = {
  accountId: string;
  name: string;
  type?: string | null;
  familyId?: string | null;
  currency: string;
  orderIndex: number | null;
  currentBalanceCents: number;
  currentBalance: number;       // euros, para display
  availableBalance: number;
  reservedTotal: number;
  isInDebt?: boolean | null;
};

// credit_cards
export type CreditCardDomain = {
  id: string;
  name: string;
  currency: string;
  orderIndex: number | null;
  familyId: string | null;
  creditLimitCents: number;
  currentBalanceCents: number;
  availableCents: number;
  utilizationPct: number;
  closingDay: number | null;
  paymentDay: number | null;
  apr: number;
  annualFeeCents: number;
};

export function mapAccountRowToDomain(row: Account): AccountDomain {
  return {
    id: row.id,
    name: row.nome,
    type: row.tipo,
    currency: (row as any).currency ?? 'EUR',
    orderIndex: (row as any).order_index ?? null,
    deletedAt: (row as any).deleted_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

export function mapAccountWithBalancesToDomain(row: AccountWithBalances): AccountWithBalancesDomain {
  const amountCents: number = (row as any).amount_cents ?? Math.round((row.saldo_atual ?? 0) * 100);
  return {
    accountId: row.account_id,
    name: row.nome,
    type: row.tipo ?? null,
    familyId: (row as any).family_id ?? null,
    currency: (row as any).currency ?? 'EUR',
    orderIndex: (row as any).order_index ?? null,
    currentBalanceCents: amountCents,
    currentBalance: row.saldo_atual,
    availableBalance: row.saldo_disponivel ?? row.saldo_atual,
    reservedTotal: row.total_reservado ?? 0,
    isInDebt: null,
  };
}

export function mapCreditCardRpcToDomain(row: {
  card_id: string;
  nome: string;
  credit_limit_cents: number;
  current_balance_cents: number;
  available_cents: number;
  utilization_pct: number;
  closing_day: number | null;
  payment_day: number | null;
  apr: number;
  annual_fee_cents: number;
  currency: string;
  order_index: number | null;
  family_id: string | null;
}): CreditCardDomain {
  return {
    id: row.card_id,
    name: row.nome,
    currency: row.currency,
    orderIndex: row.order_index,
    familyId: row.family_id,
    creditLimitCents: row.credit_limit_cents,
    currentBalanceCents: row.current_balance_cents,
    availableCents: row.available_cents,
    utilizationPct: row.utilization_pct,
    closingDay: row.closing_day,
    paymentDay: row.payment_day,
    apr: row.apr,
    annualFeeCents: row.annual_fee_cents,
  };
}
