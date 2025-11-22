import React, { useMemo, useState } from 'react';
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

export default function PayrollHistoryPage() {
  const { payslips, loading, exportPayslips, error } = usePayroll();

  const [yearFilter, setYearFilter] = useState<string>('');
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exportMsg, setExportMsg] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'csv'|'pdf'>('csv');
  const [exporting, setExporting] = useState(false);

  const years = useMemo(() => {
    const ys = new Set<string>();
    (payslips || []).forEach((p: any) => {
      if (p.year) ys.add(String(p.year));
      else if (typeof p.period === 'string') ys.add(p.period.split('-')[0]);
    });
    return Array.from(ys).sort();
  }, [payslips]);

  const filtered = useMemo(() => {
    if (!yearFilter) return payslips || [];
    return (payslips || []).filter((p: any) => {
      const y = p.year ? String(p.year) : String((p.period || '').split('-')[0]);
      return y === yearFilter;
    });
  }, [payslips, yearFilter]);

  const toggleId = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const onExport = async () => {
    setExportMsg('');
    setExporting(true);
    try {
      const resp = await exportPayslips?.(selectedIds, exportFormat);
      if (resp?.success) {
        setExportMsg('Payslips exportados com sucesso');
      }
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div>A carregar dados do payroll</div>;
  }

  return (
    <div>
      <h1>Histórico de Payroll</h1>

      <div>
        <label htmlFor="yearFilter">Filtrar por Ano</label>
        <select id="yearFilter" value={yearFilter} onChange={(e)=>setYearFilter(e.target.value)}>
          <option value="">Todos</option>
          {years.map(y => (<option key={y} value={y}>{y}</option>))}
        </select>
      </div>

      <div>
        <label htmlFor="exportFormat">Formato</label>
        <select id="exportFormat" value={exportFormat} onChange={(e)=>setExportFormat(e.target.value as 'csv'|'pdf')}>
          <option value="csv">CSV</option>
          <option value="pdf">PDF</option>
        </select>
      </div>

      <table>
        <tbody>
          {filtered.map((p: any) => (
            <tr key={p.id} onClick={() => setSelectedPayslip(p)}>
              <td>{formatMonthYear(p)}</td>
              <td>
                <input
                  type="checkbox"
                  role="checkbox"
                  checked={selectedIds.includes(p.id)}
                  onChange={() => toggleId(p.id)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={onExport} disabled={exporting || selectedIds.length === 0} aria-busy={exporting}>
        {exporting ? 'A exportar…' : 'Exportar'}
      </button>
      {exportMsg && (<div>{exportMsg}</div>)}
      {error && (<div role="alert" style={{ color: 'red' }}>{error}</div>)}

      {selectedPayslip && (
        <div>
          <h2>Detalhes do Payslip</h2>
          <div>Salário Bruto: {String(selectedPayslip.grossSalary ?? selectedPayslip.gross_salary ?? '')}</div>
          <div>Salário Líquido: {String(selectedPayslip.netSalary ?? selectedPayslip.net_salary ?? '')}</div>
          <div>Impostos: {String(selectedPayslip.tax ?? selectedPayslip.deductions ?? '')}</div>
        </div>
      )}
    </div>
  );
}