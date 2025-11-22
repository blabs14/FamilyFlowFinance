import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Tipos simples para compatibilidade com testes e wrappers
export interface MonthlyTotals {
  totalGross: number;
  totalNet: number;
  totalTax?: number;
  totalDeductions?: number;
}

export interface PayslipData {
  id: string;
  month?: number | string; // 1-12 ou 'MM' dentro de 'YYYY-MM'
  year?: number | string;
  period?: string; // 'YYYY-MM'
  grossSalary?: number;
  netSalary?: number;
  tax?: number;
  gross_salary?: number;
  net_salary?: number;
  deductions?: number;
}

interface CalculatePayload {
  baseSalary: number;
  hoursWorked: number;
  overtimeHours?: number;
  punctualityBonus?: number;
  contractId?: string;
}

// Estado global (em memória) para partilha entre componentes de preview
const store = {
  payslips: [] as PayslipData[],
  totals: { totalGross: 0, totalNet: 0, totalTax: 0 } as MonthlyTotals,
};

function computePayroll(payload: CalculatePayload) {
  const base = payload.baseSalary || 0;
  const overtime = (payload.overtimeHours || 0) * 10; // regra simples para preview
  const bonus = payload.punctualityBonus || 0;
  const gross = base + overtime + bonus;
  const tax = Math.round(gross * 0.2 * 100) / 100; // 20%
  const net = Math.round((gross - tax) * 100) / 100;
  return { gross, net, tax };
}

export function usePayroll() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotals | null>(store.totals);
  const [payslips, setPayslips] = useState<PayslipData[]>(store.payslips);

  useEffect(() => {
    // Sincronizar com store global em caso de atualizações fora
    setMonthlyTotals(store.totals);
    setPayslips(store.payslips);
  }, []);

  const calculatePayroll = async (payload: CalculatePayload) => {
    try {
      setLoading(true);
      const { gross, net, tax } = computePayroll(payload);
      // Atualizar totals
      store.totals = {
        totalGross: gross,
        totalNet: net,
        totalTax: tax,
        totalDeductions: tax,
      };
      setMonthlyTotals(store.totals);
      // Criar payslip simples do mês atual
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const slip: PayslipData = {
        id: String(Date.now()),
        period,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        grossSalary: gross,
        netSalary: net,
        tax,
      };
      store.payslips = [slip, ...store.payslips];
      setPayslips(store.payslips);
      return { success: true, data: { totals: store.totals, payslip: slip } };
    } catch (e: any) {
      setError(e?.message || 'Erro no cálculo');
      return { success: false, error: e?.message || 'Erro no cálculo' };
    } finally {
      setLoading(false);
    }
  };

  const getMonthlyTotals = async () => {
    return store.totals;
  };

  const exportPayslips = async (ids: string[], format: 'csv' | 'pdf' = 'csv') => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.functions.invoke('export-payslips', {
        body: { ids, format }
      });
      if (error) {
        setError(error.message || 'Falha na exportação');
        return { success: false, error: error.message };
      }
      if (data?.signedUrl) {
        // abrir numa nova aba (download controlado pelo browser)
        try { window.open(data.signedUrl, '_blank'); } catch {}
      }
      return { success: true, data };
    } catch (e: any) {
      setError(e?.message || 'Falha na exportação');
      return { success: false, error: e?.message };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    monthlyTotals,
    payslips,
    calculatePayroll,
    getMonthlyTotals,
    exportPayslips,
  };
}