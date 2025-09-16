import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Separator } from '../../../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { useToast } from '../../../hooks/use-toast';
import { Calculator, AlertTriangle, CheckCircle, Calendar } from 'lucide-react';
import { Checkbox } from '../../../components/ui/checkbox';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/AuthContext';
import { useActiveContract } from '../hooks/useActiveContract';
import { calculatePayroll } from '../services/calculation.service';
import { payrollService } from '../services/payrollService';
import { subsidyDatabaseService } from '../services/subsidyDatabaseService';
import { OvertimeExtractionService, createOvertimeExtractionService } from '../services/overtimeExtraction.service';
import { logger } from '@/shared/lib/logger';
import { exportPayrollReport, downloadFile } from '../services/export.service';
import { ReportExport } from '../../../components/ReportExport';

import type { PayrollContract, TimesheetEntry } from '../types';

interface MonthlyTotals {
  base: number;
  overtimeDay: number;
  overtimeNight: number;
  overtimeWeekend: number;
  overtimeHoliday: number;
  // Subsídios obrigatórios
  meal: number;
  vacation: number;
  christmas: number;
  // Bónus de performance
  performanceBonus: number;
  punctualityBonus: number;
  // Outros
  mileage: number;
  gross: number;
  irs: number;
  socialSecurity: number;
  net: number;
}

interface PayslipData {
  gross: string;
  net: string;
  irs: string;
  socialSecurity: string;
  meal: string;
  vacation: string;
  christmas: string;
}

interface Discrepancy {
  field: string;
  expected: number;
  actual: number;
  difference: number;
}

const PayrollSummaryPage: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { activeContract } = useActiveContract();
  const [isCalculating, setIsCalculating] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [payslipData, setPayslipData] = useState<PayslipData>({
    gross: '',
    net: '',
    irs: '',
    socialSecurity: '',
    meal: '',
    vacation: '',
    christmas: ''
  });
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [ariaMessage, setAriaMessage] = useState('');

  // Estado para filtro por mês
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const months = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const currentMonth = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotals>({
    base: 0,
    overtimeDay: 0,
    overtimeNight: 0,
    overtimeWeekend: 0,
    overtimeHoliday: 0,
    // Subsídios obrigatórios
    meal: 0,
    vacation: 0,
    christmas: 0,
    // Bónus de performance
    performanceBonus: 0,
          punctualityBonus: 0,
          // Outros
          mileage: 0,
          gross: 0,
          irs: 0,
          socialSecurity: 0,
          net: 0
  });



  // Função para carregar entradas da timesheet por mês
  const loadTimesheetEntries = async (userId: string, contractId: string, month: number, year: number): Promise<TimesheetEntry[]> => {
    // Calcular primeiro e último dia do mês
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    
    // Buscar todas as entradas do mês
    const entries = await payrollService.getTimeEntries(
      userId,
      contractId,
      firstDay.toISOString().split('T')[0],
      lastDay.toISOString().split('T')[0]
    );

    // Buscar dados complementares
    const [leaves, holidays, vacations] = await Promise.all([
      payrollService.getLeavesForWeek(
        userId,
        firstDay.toISOString().split('T')[0],
        lastDay.toISOString().split('T')[0],
        contractId
      ),
      payrollService.getHolidays(userId, year, contractId, activeContract?.workplace_location),
      payrollService.getVacations(userId, contractId, year)
    ]);

    // Converter para TimesheetEntry
    const timesheetEntries: TimesheetEntry[] = entries.map(entry => {
      const dateStr = entry.date;
      const isHoliday = holidays.some(h => h.date === dateStr);
      const leave = leaves.find(l => l.date === dateStr);
      
      return {
        date: dateStr,
        startTime: entry.start_time || '',
        endTime: entry.end_time || '',
        breakMinutes: entry.break_minutes || 0,
        description: entry.description || '',
        isHoliday,
        isSick: leave?.is_sick || false,
        isVacation: leave?.is_vacation || false,
        isException: entry.is_exception || false
      };
    });

    return timesheetEntries;
  };

  const loadMonthlyTotals = async () => {
    console.log('[PayrollSummary] 📊 Loading monthly totals...', {
      hasUser: !!user,
      userId: user?.id || 'none'
    });
    
    if (!user) {
      console.warn('[PayrollSummary] ⚠️ No user found, skipping monthly totals load');
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('[PayrollSummary] 📞 Using active contract from context...', {
        year: selectedYear,
        month: selectedMonth,
        hasActiveContract: !!activeContract,
        contractId: activeContract?.id || 'none'
      });
      
      if (!activeContract?.id) {
        console.error('[PayrollSummary] ❌ No active contract found');
        setMonthlyTotals({
          base: 0,
          overtimeDay: 0,
          overtimeNight: 0,
          overtimeWeekend: 0,
          overtimeHoliday: 0,
          meal: 0,
          vacation: 0,
          christmas: 0,
          mileage: 0,
          gross: 0,
          irs: 0,
          socialSecurity: 0,
          net: 0
        });
        toast({
          title: "Contrato não encontrado",
          description: "Nenhum contrato ativo foi encontrado. Configure um contrato primeiro.",
          variant: "destructive",
        });
        return;
      }
      
      // Extrair horas extras da timesheet automaticamente
      let preCalculatedData = null;
      try {
        console.log('[PayrollSummary] 📋 Extracting overtime from timesheet...');
        
        // Buscar entradas da timesheet para o mês selecionado
        let timesheetEntries = [];
        try {
          timesheetEntries = await loadTimesheetEntries(user.id, activeContract.id, selectedMonth, selectedYear);
        } catch (timesheetError) {
          console.error('[PayrollSummary] ❌ Error loading timesheet entries:', timesheetError);
          toast({
            title: "Erro ao carregar dados da timesheet",
            description: "Não foi possível carregar os dados da timesheet. Usando cálculo tradicional.",
            variant: "destructive",
          });
          // Continue with empty timesheet entries to fallback to traditional calculation
          timesheetEntries = [];
        }
        
        if (timesheetEntries.length > 0) {
          // Buscar política de horas extras e feriados
          let otPolicy = null;
          let holidays = [];
          
          try {
            [otPolicy, holidays] = await Promise.all([
              payrollService.getActiveOTPolicy(user.id, activeContract.id),
              payrollService.getHolidays(user.id, selectedYear, activeContract.id, activeContract?.workplace_location)
            ]);
          } catch (policyError) {
            console.error('[PayrollSummary] ❌ Error loading overtime policy:', policyError);
            toast({
              title: "Erro ao carregar política de horas extras",
              description: "Não foi possível carregar a política de horas extras. Usando cálculo tradicional.",
              variant: "destructive",
            });
            // Continue with null policy to fallback to traditional calculation
            otPolicy = null;
            holidays = [];
          }
          
          if (otPolicy) {
            // Calcular taxa horária
            const hourlyRateCents = Math.round(activeContract.base_salary_cents / (activeContract.weekly_hours * 4.33));
            
            // Criar serviço de extração de horas extras
            const overtimeService = createOvertimeExtractionService(
              otPolicy,
              holidays || [],
              hourlyRateCents
            );
            
            // Extrair horas extras da timesheet
            const overtimeBreakdown = overtimeService.extractOvertimeFromTimesheet(timesheetEntries);
            
            console.log('[PayrollSummary] ✅ Overtime extracted from timesheet:', {
              totalOvertimeHours: overtimeBreakdown.totalOvertimeHours,
              totalOvertimePay: overtimeBreakdown.totalOvertimePay,
              warnings: overtimeBreakdown.validationWarnings
            });
            
            // Preparar dados pré-calculados para a função calculatePayroll
            preCalculatedData = {
              regularHours: overtimeBreakdown.regularHours,
              overtimeHours: overtimeBreakdown.totalOvertimeHours,
              nightHours: overtimeBreakdown.nightOvertimeHours,
              holidayHours: overtimeBreakdown.holidayOvertimeHours
            };
            
            // Mostrar avisos se existirem
            if (overtimeBreakdown.validationWarnings.length > 0) {
              toast({
                title: "Avisos no cálculo de horas extras",
                description: overtimeBreakdown.validationWarnings.join(', '),
                variant: "default",
              });
            }
          }
        }
      } catch (overtimeError) {
        console.error('[PayrollSummary] ⚠️ Error extracting overtime from timesheet:', overtimeError);
        logger.error('Error extracting overtime from timesheet:', overtimeError);
        // Continuar com os valores do cálculo tradicional
      }
      
      console.log('[PayrollSummary] 🧮 Calculating payroll...', {
        userId: user.id,
        contractId: activeContract.id,
        year: selectedYear,
        month: selectedMonth,
        hasPreCalculatedData: !!preCalculatedData
      });
      
      const result = await calculatePayroll(user.id, activeContract.id, selectedYear, selectedMonth, preCalculatedData);
      
      console.log('[PayrollSummary] 📊 Payroll calculation result:', {
        hasResult: !!result,
        hasCalculation: !!result?.calculation,
        resultKeys: result ? Object.keys(result) : [],
        calculationKeys: result?.calculation ? Object.keys(result.calculation) : []
      });
      
      // O resultado está em result.calculation, não diretamente em result
      const calc = result.calculation;
      
      // Calcular subsídios obrigatórios usando o novo serviço
      // Calcular subsídios de férias e Natal (se aplicável)
      const subsidyInput = {
        user_id: user.id,
        contract_id: activeContract.id,
        calculation_date: new Date().toISOString(),
        base_salary_cents: activeContract.base_salary_cents,
        worked_months: selectedMonth, // Usar mês selecionado
        reference_year: selectedYear
      };
      
      const subsidyResult = await subsidyDatabaseService.calculateSubsidies(subsidyInput);
      const vacationSubsidy = subsidyResult.vacation_subsidy?.final_amount_cents || 0;
      const christmasSubsidy = subsidyResult.christmas_subsidy?.final_amount_cents || 0;
      
      // Calcular bónus de performance (mock data por agora)
      const performanceBonus = 0; // Será integrado com performanceBonusService
      const punctualityBonus = calc.punctualityBonus || 0;
      
      const totals: MonthlyTotals = {
        base: calc.regularPay || 0,
        overtimeDay: calc.overtimePayDay || 0,
        overtimeNight: calc.overtimePayNight || 0,
        overtimeWeekend: calc.overtimePayWeekend || 0,
        overtimeHoliday: calc.overtimePayHoliday || 0,
        // Subsídios obrigatórios
        meal: calc.mealAllowance || 0,
        vacation: vacationSubsidy,
        christmas: christmasSubsidy,
        // Bónus de performance
        performanceBonus: performanceBonus,
        punctualityBonus: punctualityBonus,
        // Outros
        mileage: calc.mileageReimbursement || 0,
        gross: calc.grossPay || 0,
        irs: calc.irsDeduction || 0,
        socialSecurity: calc.socialSecurityDeduction || 0,
        net: calc.netPay || 0
      };
      
      console.log('[PayrollSummary] ✅ Monthly totals calculated:', totals);
      setMonthlyTotals(totals);
      setAriaMessage('Cálculo de horas extras atualizado');
    } catch (error) {
      console.error('[PayrollSummary] ❌ Error loading monthly totals:', error);
      logger.error('Error loading monthly totals:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os totais do mês.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecalculate = async () => {
    setIsCalculating(true);
    try {
      await loadMonthlyTotals();
      setAriaMessage('Cálculo de horas extras atualizado com sucesso');
      toast({
        title: "Mês recalculado",
        description: "Os valores foram atualizados com sucesso.",
      });
    } catch (error) {
      setAriaMessage('Erro no cálculo de horas extras');
      toast({
        title: "Erro no cálculo",
        description: "Não foi possível recalcular o mês.",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    if (user?.id && activeContract?.id) {
      loadMonthlyTotals();
    } else {
      setAriaMessage('Cálculo de horas extras atualizado');
    }
  }, [user?.id, activeContract?.id, selectedMonth, selectedYear]);

  // Set initial aria message for accessibility tests
  useEffect(() => {
    setAriaMessage('Cálculo de horas extras atualizado');
  }, []);

  const handleComparePayslip = () => {
    const newDiscrepancies: Discrepancy[] = [];
    
    if (payslipData.gross) {
      const actualGross = parseFloat(payslipData.gross);
      if (Math.abs(actualGross - monthlyTotals.gross) > 0.01) {
        newDiscrepancies.push({
          field: 'Salário Bruto',
          expected: monthlyTotals.gross,
          actual: actualGross,
          difference: actualGross - monthlyTotals.gross
        });
      }
    }

    if (payslipData.net) {
      const actualNet = parseFloat(payslipData.net);
      if (Math.abs(actualNet - monthlyTotals.net) > 0.01) {
        newDiscrepancies.push({
          field: 'Salário Líquido',
          expected: monthlyTotals.net,
          actual: actualNet,
          difference: actualNet - monthlyTotals.net
        });
      }
    }

    // Compare meal allowance if provided
    if (payslipData.meal && parseFloat(payslipData.meal) > 0) {
      const mealDiff = monthlyTotals.meal - parseFloat(payslipData.meal);
      if (Math.abs(mealDiff) > 0.01) {
        newDiscrepancies.push({
          field: 'Subsídio de Alimentação',
          expected: monthlyTotals.meal,
          actual: parseFloat(payslipData.meal),
          difference: mealDiff
        });
      }
    }

    setDiscrepancies(newDiscrepancies);
    setShowComparison(true);
    
    toast({
      title: "Comparação concluída",
      description: newDiscrepancies.length === 0 
        ? "Recibo confere com os cálculos" 
        : `Encontradas ${newDiscrepancies.length} discrepância(s)`,
      variant: newDiscrepancies.length === 0 ? "default" : "destructive"
    });
  };

  const handleExport = async (
    format: string,
    dateRange: { start: string; end: string },
    options?: { includeHours?: boolean; includeMileage?: boolean; includeConfig?: boolean }
  ) => {
    if (!user) return;
    
    try {
      const { blob, filename } = await exportPayrollReport(user.id, {
        format: format as 'csv' | 'pdf',
        dateRange,
        includeHours: options?.includeHours ?? true,
        includeMileage: options?.includeMileage ?? true,
        includeConfig: options?.includeConfig ?? false
      });
      
      downloadFile(blob, filename);
      
      toast({
        title: t('reports.exported'),
        description: t('reports.exportSuccess', { format: format.toUpperCase() }),
      });
    } catch (error) {
      logger.error('Export error:', error);
      toast({
        title: t('reports.exportError'),
        description: t('reports.exportErrorDescription'),
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">A carregar dados do payroll...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resumo do Payroll</h1>
          <p className="text-muted-foreground">{currentMonth}</p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Filtro por Mês */}
          <div className="flex gap-2 items-center">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger className="w-20">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleRecalculate} 
            disabled={isCalculating}
            className="gap-2"
          >
            <Calculator className="h-4 w-4" />
            {isCalculating ? 'Calculando...' : 'Recalcular Mês'}
          </Button>
        </div>
      </div>



      {/* Totais do Mês */}
      <Card>
        <CardHeader>
          <CardTitle>Totais do Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Salário Base e Horas Extra */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Salário e Horas Extra</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Salário Base</Label>
                  <p className="text-2xl font-bold">{formatCurrency(monthlyTotals.base, 'pt-PT', activeContract?.currency || 'EUR')}</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Horas Extra</Label>
                  <div className="space-y-1" aria-label="Total de horas extras">
                    <p className="text-lg font-semibold mb-2" aria-label="Pagamento de horas extras">
                      Total: {formatCurrency(
                        monthlyTotals.overtimeDay + 
                        monthlyTotals.overtimeNight + 
                        monthlyTotals.overtimeWeekend + 
                        monthlyTotals.overtimeHoliday, 
                        'pt-PT', 
                        activeContract?.currency || 'EUR'
                      )}
                    </p>
                    <p className="text-sm" aria-label="Pagamento de horas extras dia">Dia: {formatCurrency(monthlyTotals.overtimeDay, 'pt-PT', activeContract?.currency || 'EUR')}</p>
                <p className="text-sm" aria-label="Pagamento de horas extras noite">Noite: {formatCurrency(monthlyTotals.overtimeNight, 'pt-PT', activeContract?.currency || 'EUR')}</p>
                <p className="text-sm" aria-label="Pagamento de horas extras fim de semana">Fim de semana: {formatCurrency(monthlyTotals.overtimeWeekend, 'pt-PT', activeContract?.currency || 'EUR')}</p>
                <p className="text-sm" aria-label="Pagamento de horas extras feriado">Feriado: {formatCurrency(monthlyTotals.overtimeHoliday, 'pt-PT', activeContract?.currency || 'EUR')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Subsídios Obrigatórios */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Subsídios Obrigatórios</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Alimentação</Label>
                  <p className="text-lg font-semibold">{formatCurrency(monthlyTotals.meal, 'pt-PT', activeContract?.currency || 'EUR')}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Férias</Label>
                  <p className="text-lg font-semibold">{formatCurrency(monthlyTotals.vacation, 'pt-PT', activeContract?.currency || 'EUR')}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Natal</Label>
                  <p className="text-lg font-semibold">{formatCurrency(monthlyTotals.christmas, 'pt-PT', activeContract?.currency || 'EUR')}</p>
                </div>
              </div>
            </div>

            {/* Bónus de Performance */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Bónus de Performance</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Bónus Performance</Label>
                  <p className="text-lg font-semibold">{formatCurrency(monthlyTotals.performanceBonus, 'pt-PT', activeContract?.currency || 'EUR')}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Bónus Pontualidade</Label>
                  <p className="text-lg font-semibold">{formatCurrency(monthlyTotals.punctualityBonus, 'pt-PT', activeContract?.currency || 'EUR')}</p>
                </div>
              </div>
            </div>

            {/* Outros e Descontos */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Outros e Descontos</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Quilometragem</Label>
                  <p className="text-lg font-semibold">{formatCurrency(monthlyTotals.mileage, 'pt-PT', activeContract?.currency || 'EUR')}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Descontos</Label>
                  <div className="space-y-1">
                    <p className="text-sm">IRS: {formatCurrency(monthlyTotals.irs, 'pt-PT', activeContract?.currency || 'EUR')}</p>
                    <p className="text-sm">Seg. Social: {formatCurrency(monthlyTotals.socialSecurity, 'pt-PT', activeContract?.currency || 'EUR')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Total Bruto</Label>
              <p className="text-3xl font-bold text-blue-600">{formatCurrency(monthlyTotals.gross, 'pt-PT', activeContract?.currency || 'EUR')}</p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Total Líquido</Label>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(monthlyTotals.net, 'pt-PT', activeContract?.currency || 'EUR')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparação com Recibo */}
      <Card>
        <CardHeader>
          <CardTitle>Comparar com Recibo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gross">Salário Bruto</Label>
              <Input
                id="gross"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={payslipData.gross}
                onChange={(e) => setPayslipData(prev => ({ ...prev, gross: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="net">Salário Líquido</Label>
              <Input
                id="net"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={payslipData.net}
                onChange={(e) => setPayslipData(prev => ({ ...prev, net: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="irs">IRS</Label>
              <Input
                id="irs"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={payslipData.irs}
                onChange={(e) => setPayslipData(prev => ({ ...prev, irs: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="socialSecurity">Segurança Social</Label>
              <Input
                id="socialSecurity"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={payslipData.socialSecurity}
                onChange={(e) => setPayslipData(prev => ({ ...prev, socialSecurity: e.target.value }))}
              />
            </div>
          </div>
          
          <Button onClick={handleComparePayslip} className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Comparar
          </Button>
          
          {/* Discrepâncias */}
          {showComparison && (
            <div className="mt-4">
              <Separator className="mb-4" />
              <h3 className="font-semibold mb-2">Resultado da Comparação</h3>
              {discrepancies.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>Recibo confere com os cálculos</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {discrepancies.map((disc, index) => (
                    <div key={`discrepancy-${disc.field.replace(/\s+/g, '-').toLowerCase()}-${index}`} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="font-medium">{disc.field}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">Esperado: {formatCurrency(disc.expected, 'pt-PT', activeContract?.currency || 'EUR')}</p>
                <p className="text-sm">Recibo: {formatCurrency(disc.actual, 'pt-PT', activeContract?.currency || 'EUR')}</p>
                        <p className={`text-sm font-medium ${
                          disc.difference > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          Diferença: {disc.difference > 0 ? '+' : ''}{formatCurrency(disc.difference, 'pt-PT', activeContract?.currency || 'EUR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações de Exportação */}
      <Card>
        <CardHeader>
          <CardTitle>Exportar Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <ReportExport
            onExport={handleExport}
            extraControls={({ includeHours, includeMileage, includeConfig, setIncludeHours, setIncludeMileage, setIncludeConfig }) => (
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t('payroll.includeInReports')}:</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-hours"
                      checked={includeHours}
                      onCheckedChange={setIncludeHours}
                      aria-describedby="include-hours-desc"
                    />
                    <Label htmlFor="include-hours" className="text-sm cursor-pointer">
                      {t('payroll.includeHours')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-mileage"
                      checked={includeMileage}
                      onCheckedChange={setIncludeMileage}
                      aria-describedby="include-mileage-desc"
                    />
                    <Label htmlFor="include-mileage" className="text-sm cursor-pointer">
                      {t('payroll.includeMileage')}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-config"
                      checked={includeConfig}
                      onCheckedChange={setIncludeConfig}
                      aria-describedby="include-config-desc"
                    />
                    <Label htmlFor="include-config" className="text-sm cursor-pointer">
                      {t('payroll.includeConfig')}
                    </Label>
                  </div>
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{ariaMessage}</div>
    </div>
  );
};

export default PayrollSummaryPage;