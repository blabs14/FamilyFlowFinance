import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePayroll } from '@/features/payroll/hooks/usePayroll';
import { useActiveContract } from '@/features/payroll/hooks/useActiveContract';

export default function PayrollCalculatorPage() {
  const router = useNavigate();
  const { calculatePayroll, getMonthlyTotals } = usePayroll();
  const { contract } = useActiveContract();

  const [baseSalary, setBaseSalary] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [overtimeHours, setOvertimeHours] = useState('');
  const [punctualityEnabled, setPunctualityEnabled] = useState(false);
  const [bonusAmount, setBonusAmount] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);

  const validate = () => {
    const errs: string[] = [];
    if (!baseSalary) errs.push('Salário base é obrigatório');
    if (!hoursWorked) errs.push('Horas trabalhadas é obrigatório');
    setErrors(errs);
    return errs.length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: any = {
      baseSalary: Number(baseSalary),
      hoursWorked: Number(hoursWorked),
      overtimeHours: Number(overtimeHours || 0),
      contractId: contract?.id,
    };
    if (punctualityEnabled) {
      payload.punctualityBonus = Number(bonusAmount || 0);
    }

    const resp = await calculatePayroll(payload);
    if (resp?.success) {
      // Guardar resultado para mostrar
      setResult(resp?.data ?? resp);
      // Atualizar resumo mensal
      await getMonthlyTotals?.();
    } else {
      setResult({ error: resp?.error || 'Erro no cálculo do payroll' });
    }
  };

  const viewHistory = () => {
    router('/app/payroll/history');
  };

  const displayGross = () => {
    const r = result;
    if (!r) return null;
    if (typeof r.grossSalary === 'number') return r.grossSalary;
    if (r?.totals?.totalGross) return r.totals.totalGross;
    if (r?.data?.totals?.totalGross) return r.data.totals.totalGross;
    return null;
  };

  const displayNet = () => {
    const r = result;
    if (!r) return null;
    if (typeof r.netSalary === 'number') return r.netSalary;
    if (r?.totals?.totalNet) return r.totals.totalNet;
    if (r?.data?.totals?.totalNet) return r.data.totals.totalNet;
    return null;
  };

  return (
    <div>
      <h1>Calculadora de Payroll</h1>

      <form onSubmit={onSubmit}>
        <div>
          <label htmlFor="baseSalary">Salário Base</label>
          <input id="baseSalary" value={baseSalary} onChange={(e)=>setBaseSalary(e.target.value)} />
        </div>
        <div>
          <label htmlFor="hoursWorked">Horas Trabalhadas</label>
          <input id="hoursWorked" value={hoursWorked} onChange={(e)=>setHoursWorked(e.target.value)} />
        </div>
        <div>
          <label htmlFor="overtimeHours">Horas Extra</label>
          <input id="overtimeHours" value={overtimeHours} onChange={(e)=>setOvertimeHours(e.target.value)} />
        </div>

        <div>
          <label>
            <input type="checkbox" checked={punctualityEnabled} onChange={(e)=>setPunctualityEnabled(e.target.checked)} />
            Bónus de pontualidade
          </label>
        </div>

        {punctualityEnabled && (
          <div>
            <label htmlFor="bonusAmount">Valor do bónus</label>
            <input id="bonusAmount" value={bonusAmount} onChange={(e)=>setBonusAmount(e.target.value)} />
          </div>
        )}

        <button type="submit">Calcular</button>
      </form>

      {errors.length > 0 && (
        <ul>
          {errors.map((e, i) => (<li key={i}>{e}</li>))}
        </ul>
      )}

      {result && !result.error && (
        <div>
          <h2>Resultado do Cálculo</h2>
          {displayGross() !== null && (<div>{String(displayGross())}</div>)}
          {displayNet() !== null && (<div>{String(displayNet())}</div>)}
          <button onClick={viewHistory}>Ver histórico</button>
        </div>
      )}

      {result && result.error && (
        <div>Erro no cálculo do payroll</div>
      )}
    </div>
  );
}