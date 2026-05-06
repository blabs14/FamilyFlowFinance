export type PayslipStatus = 'draft' | 'posted' | 'void';

export interface PayslipComponent {
  label: string;
  amount_cents: number;
  sign: '+' | '-';
}

export interface PayslipCalculation {
  gross_cents: number;
  irs_cents: number;
  ss_cents: number;
  meal_cents: number;
  net_cents: number;
  working_days: number;
  components: PayslipComponent[];
}

/**
 * Application-layer payslip record mapped from DB row.
 * Naming convention: DB-derived financial columns keep snake_case to match
 * the RPC response directly; application-level identifiers use camelCase
 * (contractId, transactionId, createdAt) to distinguish them as mapped fields.
 */
export interface PayslipRecord {
  id: string;
  contractId: string;        // mapped from contract_id
  period: string;            // 'YYYY-MM'
  status: PayslipStatus;
  transactionId: string | null; // mapped from transaction_id
  gross_cents: number;
  irs_cents: number;
  ss_cents: number;
  meal_cents: number;        // mapped from meal_allowance_cents
  net_cents: number;
  working_days: number;
  components: PayslipComponent[];
  createdAt: string;         // mapped from created_at
}

export interface ActiveContractCore {
  id: string;
  name: string;
  base_salary_cents: number;
  account_id: string | null;
  status: string;
  vacation_bonus_mode: string;
  christmas_bonus_mode: string;
}
