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

export interface PayslipRecord {
  id: string;
  contractId: string;
  period: string;            // 'YYYY-MM'
  status: PayslipStatus;
  transactionId: string | null;
  gross_cents: number;
  irs_cents: number;
  ss_cents: number;
  meal_cents: number;
  net_cents: number;
  working_days: number;
  components: PayslipComponent[];
  createdAt: string;
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
