// Pure formatting helpers — NO business logic, NO supabase calls.
// IRS calculation lives exclusively in the calculate_payslip DB RPC.

import type { PayslipComponent } from '../types/payroll-core.types';

export const formatCents = (cents: number): string =>
  (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

const PT_MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export const periodLabel = (period: string): string => {
  const [year, month] = period.split('-');
  return `${PT_MONTHS[+month - 1]} de ${year}`;
};

export const currentPeriod = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/** Returns periods from current month going back monthsBack months, descending. */
export const availablePeriods = (monthsBack = 12): string[] => {
  const periods: string[] = [];
  const now = new Date();
  for (let i = 0; i <= monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return periods;
};

export interface EnrichedComponent extends PayslipComponent {
  formatted: string;
  isDeduction: boolean;
}

export const enrichComponents = (components: PayslipComponent[]): EnrichedComponent[] =>
  components.map(c => ({
    ...c,
    formatted: formatCents(Math.abs(c.amount_cents)),
    isDeduction: c.sign === '-',
  }));
