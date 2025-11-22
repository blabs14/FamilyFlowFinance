import React from 'react';
import { usePayroll } from '@/features/payroll/hooks/usePayroll';

const monthNamePt = (month: number) => {
  const date = new Date(2024, month - 1, 1);
  return date.toLocaleDateString('pt-PT', { month: 'long' });
};

const formatMonthYear = (p: any) => {
  if (p?.month && p?.year) {
    return `${monthNamePt(Number(p.month))} ${p.year}`;
  }
  if (typeof p?.period === 'string') {
    const [year, month] = p.period.split('-').map(Number);
    return `${monthNamePt(month)} ${year}`;
  }
  return 'Período desconhecido';
};

export default function PayrollSummaryPage() {
  const { monthlyTotals, payslips, loading, error } = usePayroll();

  if (loading) {
    return <div>A carregar dados do payroll</div>;
  }

  if (error) {
    return <div>Erro ao carregar dados do payroll</div>;
  }

  const noData = !monthlyTotals && (!payslips || payslips.length === 0);

  return (
    <div>
      <h1>Resumo do Payroll</h1>

      {noData ? (
        <div>Nenhum dado de payroll encontrado</div>
      ) : (
        <div>
          {monthlyTotals && (
            <div>
              <div>Bruto Total: {monthlyTotals.totalGross}</div>
              <div>Líquido Total: {monthlyTotals.totalNet}</div>
              <div>Impostos Totais: {monthlyTotals.totalTax ?? monthlyTotals.totalDeductions ?? 0}</div>
            </div>
          )}

          {payslips && payslips.length > 0 && (
            <table>
              <tbody>
                {payslips.map((p: any) => (
                  <tr key={p.id} data-testid={`payslip-${p.id}`}>
                    <td>{formatMonthYear(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}