// Serviço de cálculo de folha de pagamento
// Funções puras para cálculos de horários, horas extras, subsídios e quilometragem

import {
  PayrollContract,
  PayrollOTPolicy,
  PayrollHoliday,
  PayrollTimeEntry,
  PayrollMileageTrip,
  PayrollVacation,
  TimeSegment,
  PlannedSchedule,
  PayrollCalculation
} from '../types';
import type { OtDayEntry, OtRates, OtAnnualLimits, OtScaledResult, TravelAllowanceCaps, LeaveRecord, LeaveImpact } from '../types/payroll-advanced.types';
import type { PayslipCalculation } from '../types/payroll-core.types';
import { formatDateLocal } from '@/lib/dateUtils';
import { logger } from '../../../shared/lib/logger';

/**
 * Verifica se o trabalho ocorre durante horário noturno
 * @param startTime Hora de início do trabalho
 * @param endTime Hora de fim do trabalho
 * @param nightStart Início do período noturno (ex: '22:00')
 * @param nightEnd Fim do período noturno (ex: '07:00')
 * @returns true se alguma parte do trabalho ocorre durante período noturno
 */
/**
 * Verifica se o trabalho ocorre durante horário noturno.
 * Aceita horários no formato "HH:MM".
 */
export function isWorkDuringNightHours(
  startTime: string,
  endTime: string,
  nightStart: string,
  nightEnd: string
): boolean {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const [nightStartHour, nightStartMinute] = nightStart.split(':').map(Number);
  const [nightEndHour, nightEndMinute] = nightEnd.split(':').map(Number);

  const workStartMinutes = startHour * 60 + startMinute;
  const workEndMinutes = endHour * 60 + endMinute;
  const nightStartMinutes = nightStartHour * 60 + nightStartMinute;
  const nightEndMinutes = nightEndHour * 60 + nightEndMinute;

  // Se o período noturno atravessa meia-noite (ex: 22:00-07:00)
  if (nightStartMinutes > nightEndMinutes) {
    // Night zone is [nightStart, midnight) ∪ [midnight, nightEnd)
    // Shift overlaps if it starts in the late-night zone OR ends/starts in the early-morning zone OR crosses midnight
    return (
      workStartMinutes >= nightStartMinutes ||  // starts at or after 22:00
      workEndMinutes <= nightEndMinutes ||       // ends before or at 07:00
      workStartMinutes < nightEndMinutes ||      // starts before 07:00
      workEndMinutes < workStartMinutes ||       // crosses midnight
      workEndMinutes > nightStartMinutes         // ends after 22:00 (same-day entry into night)
    );
  } else {
    // Período noturno não atravessa meia-noite
    return (workStartMinutes >= nightStartMinutes && workStartMinutes < nightEndMinutes) ||
           (workEndMinutes > nightStartMinutes && workEndMinutes <= nightEndMinutes) ||
           (workStartMinutes < nightStartMinutes && workEndMinutes > nightEndMinutes);
  }
}

/**
 * Constrói o cronograma planejado para um período específico
 * @param contract Contrato do funcionário
 * @param holidays Lista de feriados
 * @param startDate Data de início do período
 * @param endDate Data de fim do período
 * @returns Array de cronogramas planejados por dia
 */
export function buildPlannedSchedule(
  contract: PayrollContract,
  holidays: PayrollHoliday[],
  startDate: Date,
  endDate: Date
): PlannedSchedule[] {
  const schedule: PlannedSchedule[] = [];
  const current = new Date(startDate);
  const dailyHours = contract.weekly_hours / 7; // Distribuição uniforme

  while (current <= endDate) {
    const dateStr = formatDateLocal(current);
    const holiday = holidays.find(h => h.date === dateStr);
    
    schedule.push({
      date: dateStr,
      plannedHours: holiday ? 0 : dailyHours,
      isHoliday: !!holiday,
      holidayName: holiday?.name
    });

    current.setDate(current.getDate() + 1);
  }

  return schedule;
}

/**
 * Segmenta uma entrada de tempo em períodos regulares e de horas extras
 * @param entry Entrada de tempo
 * @param otPolicy Política de horas extras
 * @param dailyThreshold Limite diário de horas (padrão: 8h)
 * @returns Array de segmentos de tempo
 */
export function segmentEntry(
  entry: PayrollTimeEntry,
  otPolicy: PayrollOTPolicy | null | undefined,
  dailyThreshold: number = 8
): TimeSegment[] {
  const startTime = new Date(`${entry.date}T${entry.start_time}`);
  let endTime = new Date(`${entry.date}T${entry.end_time}`);
  
  // Se o horário de fim é menor que o de início, é um turno noturno (atravessa meia-noite)
  if (endTime <= startTime) {
    endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000); // Adiciona 1 dia
  }
  
  // Calcular total de horas trabalhadas (descontando pausa)
  const totalMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60) - entry.break_minutes;
  const totalHours = totalMinutes / 60;

  // Verificar se é trabalho noturno (22h-7h conforme legislação portuguesa)
  const nightStart = otPolicy?.night_start_time || '22:00';
  const nightEnd = otPolicy?.night_end_time || '07:00';
  const toHHMM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const isNightShift = isWorkDuringNightHours(toHHMM(startTime), toHHMM(endTime), nightStart, nightEnd);

  const segments: TimeSegment[] = [];

  if (totalHours <= dailyThreshold) {
    // Todas as horas são regulares
    segments.push({
      start: startTime,
      end: endTime,
      isOvertime: false,
      hours: totalHours,
      isNightShift
    });
  } else {
    // Dividir em horas regulares e extras
    const regularHours = dailyThreshold;
    const overtimeHours = totalHours - dailyThreshold;

    // Segmento regular
    const regularEndTime = new Date(startTime.getTime() + (regularHours * 60 * 60 * 1000));
    segments.push({
      start: startTime,
      end: regularEndTime,
      isOvertime: false,
      hours: regularHours,
      isNightShift: isWorkDuringNightHours(toHHMM(startTime), toHHMM(regularEndTime), nightStart, nightEnd)
    });

    // Segmento de horas extras
    segments.push({
      start: regularEndTime,
      end: endTime,
      isOvertime: true,
      hours: overtimeHours,
      isNightShift: isWorkDuringNightHours(toHHMM(regularEndTime), toHHMM(endTime), nightStart, nightEnd)
    });
  }

  return segments;
}

/**
 * Calcula o pagamento por horas trabalhadas
 * @param hours Número de horas trabalhadas
 * @param hourlyRateCents Taxa horária em centavos
 * @param isOvertime Se são horas extras
 * @param isWeekend Se é fim de semana
 * @param isHoliday Se é feriado
 * @param isNightShift Se é turno noturno
 * @param isFirstOvertimeHour Se é a primeira hora extra do dia
 * @returns Pagamento em centavos
 */
export function calcHourly(
  hours: number,
  hourlyRateCents: number,
  isOvertime: boolean = false,
  isWeekend: boolean = false,
  isHoliday: boolean = false,
  isNightShift: boolean = false,
  isFirstOvertimeHour: boolean = false,
  otPolicy?: PayrollOTPolicy
): number {
  let multiplier = 1.0;
  
  if (isOvertime && otPolicy) {
    if (isHoliday) {
      multiplier = otPolicy.holiday_multiplier; // Multiplicador para feriados (padrão: 2.0 = 100%)
    } else if (isWeekend) {
      multiplier = otPolicy.weekend_multiplier; // Multiplicador para fins de semana (padrão: 2.0 = 100%)
    } else if (isFirstOvertimeHour) {
      multiplier = otPolicy.day_multiplier; // Multiplicador primeira hora dia útil (padrão: 1.5 = 50%)
    } else {
      multiplier = otPolicy.night_multiplier; // Multiplicador horas seguintes (padrão: 1.75 = 75%)
    }
  } else if (isNightShift) {
    multiplier = 1.25; // 25% adicional para trabalho noturno (legislação portuguesa)
  }
  
  return Math.round(hours * hourlyRateCents * multiplier);
}

/**
 * Calcula subsídio de refeição baseado nas horas trabalhadas e regras de precedência
 * @param date Data do dia (formato YYYY-MM-DD)
 * @param regularHours Horas regulares trabalhadas no dia
 * @param totalHours Total de horas trabalhadas no dia
 * @param mealAllowanceCents Valor do subsídio de refeição em centavos
 * @param excludedMonths Array de meses (1-12) onde não há pagamento de subsídio
 * @param isHoliday Se o dia é feriado
 * @param isVacation Se o dia é férias
 * @param isException Se é uma exceção (permite pagamento em feriados/férias)
 * @param minimumRegularHours Horas regulares mínimas para ter direito ao subsídio (padrão: 4h)
 * @param paymentMethod Método de pagamento: 'cash' (€6.00/dia) ou 'card' (€10.20/dia)
 * @param duodecimosEnabled Se o pagamento em duodécimos está ativo (distribui uniformemente por 12 meses)
 * @returns Valor do subsídio em centavos
 */
export function calcMeal(
  date: string,
  regularHours: number,
  totalHours: number,
  mealAllowanceCents: number = 1020, // €10.20 padrão conforme legislação 2025 (cartão)
  excludedMonths: number[] = [],
  isHoliday: boolean = false,
  isVacation: boolean = false,
  isException: boolean = false,
  minimumRegularHours: number = 4,
  paymentMethod: 'cash' | 'card' = 'card',
  duodecimosEnabled: boolean = false
): number {
  // Regra 0: Se o valor do subsídio é 0, não há pagamento
  if (mealAllowanceCents === 0) {
    return 0;
  }

  // Regra 1: Meses excluídos nunca pagam subsídio (exceto se duodécimos estiver ativo)
  const month = parseInt(date.split('-')[1], 10);
  if (!duodecimosEnabled && excludedMonths.includes(month)) {
    return 0;
  }

  // Aplicar limites de isenção fiscal baseados no método de pagamento (2025)
  const maxExemptionCash = 600; // €6.00/dia em centavos
  const maxExemptionCard = 1020; // €10.20/dia em centavos
  const maxExemption = paymentMethod === 'cash' ? maxExemptionCash : maxExemptionCard;
  
  // Aplicar o limite máximo de isenção ao valor configurado
  const effectiveAllowance = Math.min(mealAllowanceCents, maxExemption);

  // Se duodécimos estiver ativo, paga o valor diário configurado uniformemente
  if (duodecimosEnabled) {
    // Em duodécimos, paga sempre o valor diário configurado, independentemente de horas
    // e ignora meses excluídos (distribui ao longo de 12 meses)
    // Exceto se for um dia sem qualquer trabalho (0 horas)
    return (regularHours > 0 || totalHours > 0) ? effectiveAllowance : 0;
  }

  // Regra 2: Feriados e férias só pagam com isException e horas regulares ≥ 4h
  if (isHoliday || isVacation) {
    if (!isException || regularHours < minimumRegularHours) {
      return 0;
    }
    return effectiveAllowance;
  }

  // Regra 3: Fins-de-semana pagam com horas regulares ≥ 4h
  const dayOfWeek = new Date(date).getDay(); // 0 = domingo, 6 = sábado
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return regularHours >= minimumRegularHours ? effectiveAllowance : 0;
  }

  // Regra 4: Dias normais pagam com horas regulares ≥ 4h
  return regularHours >= minimumRegularHours ? effectiveAllowance : 0;
}

/**
 * Calcula bónus baseado em condições (performance, pontualidade, etc.)
 * @param baseAmount Valor base em centavos
 * @param multiplier Multiplicador do bónus
 * @param conditions Condições para aplicar o bónus
 * @returns Valor do bónus em centavos
 */
export function calcBonuses(
  baseAmount: number,
  multiplier: number = 1,
  conditions: { [key: string]: boolean } = {}
): number {
  // Verificar se todas as condições são atendidas
  const allConditionsMet = Object.values(conditions).every(condition => condition);
  
  return allConditionsMet ? Math.round(baseAmount * multiplier) : 0;
}

/**
 * Calcula subsídios obrigatórios (férias, Natal, refeição)
 * @param subsidyType Tipo de subsídio ('vacation', 'christmas', 'meal')
 * @param baseSalaryCents Salário base em centavos
 * @param workedMonths Meses trabalhados no ano
 * @param workingDays Dias de trabalho (para subsídio de refeição)
 * @param dailyMealAllowanceCents Valor diário do subsídio de refeição
 * @param proportional Se deve calcular proporcionalmente
 * @returns Valor do subsídio em centavos
 */
export function calcSubsidies(
  subsidyType: 'vacation' | 'christmas' | 'meal',
  baseSalaryCents: number,
  workedMonths: number = 12,
  workingDays: number = 22,
  dailyMealAllowanceCents: number = 700, // €7.00
  proportional: boolean = true
): number {
  switch (subsidyType) {
    case 'vacation':
    case 'christmas':
      // Subsídios de férias e Natal = 1 salário base
      if (proportional && workedMonths < 12) {
        return Math.round((baseSalaryCents * workedMonths) / 12);
      }
      return baseSalaryCents;
    
    case 'meal':
      // Subsídio de refeição = valor diário × dias trabalhados
      return Math.round(dailyMealAllowanceCents * workingDays);
    
    default:
      return 0;
  }
}

/**
 * Calcula reembolso de quilometragem
 * @param trips Lista de viagens
 * @param ratePerKmCents Taxa por quilómetro em centavos
 * @returns Valor total do reembolso em centavos
 */
export function calcMileage(
  trips: PayrollMileageTrip[],
  ratePerKmCents: number
): number {
  return trips.reduce((total, trip) => {
    return total + Math.round(trip.km * ratePerKmCents);
  }, 0);
}

/**
 * Interface para dados pré-calculados da timesheet
 */
interface PreCalculatedOvertimeData {
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePayDay: number;
  overtimePayNight: number;
  overtimePayWeekend: number;
  overtimePayHoliday: number;
  totalOvertimePay: number;
}

/**
 * Calcula o total mensal de um funcionário
 * @param contract Contrato do funcionário
 * @param timeEntries Entradas de tempo do mês
 * @param otPolicy Política de horas extras
 * @param holidays Feriados do mês
 * @param mileageTrips Viagens do mês
 * @param mileageRateCents Taxa de quilometragem em centavos
 * @param mealAllowanceConfig Configuração de subsídio de alimentação
 * @param vacations Períodos de férias
 * @param preCalculatedData Dados pré-calculados da timesheet (opcional)
 * @returns Cálculo completo da folha de pagamento
 */
export function calcMonth(
  contract: PayrollContract,
  timeEntries: PayrollTimeEntry[],
  otPolicy: PayrollOTPolicy | null | undefined,
  holidays: PayrollHoliday[],
  mileageTrips: PayrollMileageTrip[] = [],
  mileageRateCents: number = 40, // €0.40 por km padrão (2025)
  mealAllowanceConfig?: { excluded_months: number[]; daily_amount_cents?: number },
  vacations: PayrollVacation[] = [],
  weeklyHours?: number,
  annualOvertimeHours?: number,
  deductionConfig?: { irs_percentage: number; social_security_percentage: number; irs_surcharge_percentage?: number; solidarity_contribution_percentage?: number },
  preCalculatedData?: PreCalculatedOvertimeData
): PayrollCalculation {
  // Validar limites semanais e anuais se fornecidos
  const validationErrors: string[] = [];
  
  if (weeklyHours !== undefined && annualOvertimeHours !== undefined && otPolicy) {
    const limitsValidation = validateOvertimeLimits(
      weeklyHours,
      annualOvertimeHours,
      otPolicy.weekly_limit_hours || 48,
      otPolicy.annual_limit_hours || 150
    );
    
    if (!limitsValidation.isValid) {
      validationErrors.push(...limitsValidation.errors);
    }
  }
  
  let regularHours = 0;
  let overtimeHours = 0;
  let regularPay = 0;
  let overtimePayDay = 0;
  let overtimePayNight = 0;
  let overtimePayWeekend = 0;
  let overtimePayHoliday = 0;
  let overtimePay = 0;

  // Se temos dados pré-calculados da timesheet, usar esses valores
  if (preCalculatedData) {
    regularHours = preCalculatedData.regularHours;
    overtimeHours = preCalculatedData.overtimeHours;
    regularPay = preCalculatedData.regularPay;
    overtimePayDay = preCalculatedData.overtimePayDay;
    overtimePayNight = preCalculatedData.overtimePayNight;
    overtimePayWeekend = preCalculatedData.overtimePayWeekend;
    overtimePayHoliday = preCalculatedData.overtimePayHoliday;
    overtimePay = preCalculatedData.totalOvertimePay;
  } else if (!otPolicy) {
    // Sem política de horas extra: considerar todas as horas como regulares (OT=0)
    timeEntries.forEach(entry => {
      const entryDate = new Date(entry.date);
      const isWeekend = entryDate.getDay() === 0 || entryDate.getDay() === 6;
      const isHoliday = holidays.some(h => h.date === entry.date);
      const segments = segmentEntry(entry, otPolicy);

      segments.forEach(segment => {
        // Somar todas as horas como regulares
        regularHours += segment.hours;

        const segmentPay = calcHourly(
          segment.hours,
          contract.hourly_rate_cents,
          false, // nunca tratar como OT
          isWeekend,
          isHoliday,
          segment.isNightShift,
          false,
          undefined
        );
        regularPay += segmentPay;
      });
    });

    // Garantir que todos os campos de OT ficam a zero
    overtimeHours = 0;
    overtimePay = 0;
    overtimePayDay = 0;
    overtimePayNight = 0;
    overtimePayWeekend = 0;
    overtimePayHoliday = 0;
  } else {
    // Processar todas as entradas de tempo (método tradicional)
    timeEntries.forEach(entry => {
      // Validar entrada de tempo individual (incluindo limite diário de horas extras)
      const entryValidation = validateTimeEntry(
        entry,
        contract.weekly_hours / 5, // Horas contratuais por dia (assumindo 5 dias úteis)
        otPolicy?.daily_limit_hours || 2 // Limite diário de horas extras da política
      );
      
      if (!entryValidation.isValid) {
        validationErrors.push(...entryValidation.errors);
      }
      
      // Verificar descanso compensatório para trabalho ao domingo
      const entryDate = new Date(entry.date);
      const totalHours = calculateHours(entry.start_time, entry.end_time, entry.break_minutes);
      const compensatoryCheck = checkCompensatoryRest(entryDate, totalHours);
      
      if (compensatoryCheck.isRequired) {
        validationErrors.push(`${compensatoryCheck.reason} - ${compensatoryCheck.compensatoryHours.toFixed(2)} horas de descanso compensatório necessárias para ${entry.date}`);
      }
      
      const segments = segmentEntry(entry, otPolicy);
      
      segments.forEach(segment => {
        if (segment.isOvertime) {
          overtimeHours += segment.hours;
        } else {
          regularHours += segment.hours;
        }
      });
    });

    // Calcular pagamentos com multiplicadores corretos (método tradicional)
    // Para horas regulares, precisamos calcular por segmento para aplicar adicional noturno
    timeEntries.forEach(entry => {
      const entryDate = new Date(entry.date);
      const isWeekend = entryDate.getDay() === 0 || entryDate.getDay() === 6;
      const isHoliday = holidays.some(h => h.date === entry.date);
      
      const segments = segmentEntry(entry, otPolicy);
      
      segments.forEach(segment => {
        if (!segment.isOvertime) {
          const segmentPay = calcHourly(
            segment.hours,
            contract.hourly_rate_cents,
            false,
            isWeekend,
            isHoliday,
            segment.isNightShift,
            false,
            otPolicy
          );
          
          regularPay += segmentPay;
        }
      });
    });
    
    // Para horas extras, precisamos calcular por segmento para aplicar multiplicadores corretos
    timeEntries.forEach(entry => {
      const entryDate = new Date(entry.date);
      const isWeekend = entryDate.getDay() === 0 || entryDate.getDay() === 6;
      const isHoliday = holidays.some(h => h.date === entry.date);
      
      const segments = segmentEntry(entry, otPolicy);
      let dailyOvertimeHours = 0;
      
      segments.forEach(segment => {
        if (segment.isOvertime) {
          const isFirstOvertimeHour = dailyOvertimeHours === 0;
          const segmentPay = calcHourly(
            segment.hours,
            contract.hourly_rate_cents,
            true,
            isWeekend,
            isHoliday,
            segment.isNightShift,
            isFirstOvertimeHour,
            otPolicy
          );
          
          overtimePay += segmentPay;
          
          // Categorizar por tipo de hora extra
          if (isHoliday) {
            overtimePayHoliday += segmentPay;
          } else if (isWeekend) {
            overtimePayWeekend += segmentPay;
          } else if (segment.isNightShift) {
            overtimePayNight += segmentPay;
          } else {
            overtimePayDay += segmentPay;
          }
          
          dailyOvertimeHours += segment.hours;
        }
      });
    });
  }

  // Calcular subsídios de refeição por dia trabalhado
  let mealAllowance = 0;
  const processedDates = new Set<string>();
  
  timeEntries.forEach(entry => {
    if (!processedDates.has(entry.date)) {
      processedDates.add(entry.date);
      
      // Calcular horas regulares e totais para este dia
      const dayEntries = timeEntries.filter(e => e.date === entry.date);
      let dayRegularHours = 0;
      let dayTotalHours = 0;
      
      dayEntries.forEach(dayEntry => {
        const segments = segmentEntry(dayEntry, otPolicy);
        segments.forEach(segment => {
          if (segment.isOvertime) {
            dayTotalHours += segment.hours;
          } else {
            dayRegularHours += segment.hours;
            dayTotalHours += segment.hours;
          }
        });
      });
      
      // Verificar se é feriado
      const isHoliday = holidays.some(h => h.date === entry.date);
      
      // Verificar se é férias
      const isVacation = vacations.some(v => {
        const entryDate = new Date(entry.date);
        const startDate = new Date(v.start_date);
        const endDate = new Date(v.end_date);
        return entryDate >= startDate && entryDate <= endDate;
      });
      
      // Por agora, assumimos que não há exceções (será implementado na UI)
      const isException = false;
      
      // Usar meses excluídos da configuração
      const excludedMonths = mealAllowanceConfig?.excluded_months || [];
      
      mealAllowance += calcMeal(
        entry.date,
        !otPolicy ? dayTotalHours : dayRegularHours, // sem política, considerar todas as horas como "regulares" para subsídio
        dayTotalHours,
        mealAllowanceConfig?.daily_amount_cents ?? 1020,
        excludedMonths,
        isHoliday,
        isVacation,
        isException,
        4, // minimumRegularHours
        mealAllowanceConfig?.payment_method || 'card', // paymentMethod
        mealAllowanceConfig?.duodecimos_enabled || false // duodecimosEnabled
      );
    }
  });
  
  // Calcular quilometragem
  const mileageReimbursement = calcMileage(mileageTrips, mileageRateCents);
  
  // Calcular bónus (exemplo: bónus de pontualidade)
  const punctualityBonus = calcBonuses(
    regularPay * 0.05, // 5% do salário base
    1,
    { punctual: timeEntries.length >= 20 } // Exemplo: trabalhou pelo menos 20 dias
  );

  const grossPay = regularPay + overtimePay + mealAllowance + mileageReimbursement + punctualityBonus;
  
  // Validar configuração de deduções
  const deductionValidation = validateDeductions(grossPay, deductionConfig);
  if (!deductionValidation.isValid) {
    validationErrors.push(...deductionValidation.errors);
  }

  // Calcular deduções usando as percentagens configuradas
  const irsPercentage = (deductionConfig?.irs_percentage || 0) / 100;
  const socialSecurityPercentage = (deductionConfig?.social_security_percentage || 11) / 100; // Default 11% se não configurado
  const irsSurchargePercentage = (deductionConfig?.irs_surcharge_percentage || 0) / 100;
  const solidarityContributionPercentage = (deductionConfig?.solidarity_contribution_percentage || 0) / 100;

  // Calcular Segurança Social primeiro (sobre o bruto total)
  const socialSecurityDeduction = Math.round(grossPay * socialSecurityPercentage);
  
  // Calcular base para IRS (Bruto - SS trabalhador)
  const irsBase = grossPay - socialSecurityDeduction;
  
  // Calcular IRS sobre a base corrigida
  const irsDeduction = Math.round(irsBase * irsPercentage);
  const irsSurchargeDeduction = Math.round(irsBase * irsSurchargePercentage);
  const solidarityContributionDeduction = Math.round(irsBase * solidarityContributionPercentage);
  const deductions = irsDeduction + socialSecurityDeduction + irsSurchargeDeduction + solidarityContributionDeduction;
  
  const netPay = grossPay - deductions;

  return {
    regularHours,
    overtimeHours,
    regularPay,
    overtimePay,
    overtimePayDay,
    overtimePayNight,
    overtimePayWeekend,
    overtimePayHoliday,
    mealAllowance,
    mileageReimbursement,
    bonuses: punctualityBonus,
    grossPay,
    deductions,
    irsDeduction,
    socialSecurityDeduction,
    irsSurchargeDeduction,
    solidarityContributionDeduction,
    netPay,
    validationErrors: validationErrors.length > 0 ? validationErrors : undefined
  };
}

/**
 * Converte valor de euros para centavos
 * @param euros Valor em euros
 * @returns Valor em centavos
 */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

/**
 * Converte valor de centavos para euros
 * @param cents Valor em centavos
 * @returns Valor em euros
 */
export function centsToEuros(cents: number): number {
  return cents / 100;
}



/**
 * Calcula o número de horas entre duas datas/horas
 * @param start Data/hora de início
 * @param end Data/hora de fim
 * @param breakMinutes Minutos de pausa a descontar
 * @returns Número de horas
 */
export function calculateHours(
  start: string | Date,
  end: string | Date,
  breakMinutes: number = 0
): number {
  let startTime: Date;
  let endTime: Date;

  // Helper: converte string de tempo (H:MM, HH:MM, H:MM:SS, HH:MM:SS) para Date fixa
  const toDateFromTimeString = (timeStr: string): Date => {
    const [h, m, s] = timeStr.split(":");
    const hh = (h ?? "0").padStart(2, "0");
    const mm = (m ?? "0").padStart(2, "0");
    const ss = (s ?? "00").padStart(2, "0");
    return new Date(`1970-01-01T${hh}:${mm}:${ss}`);
  };

  const isTimeOnly = (val: string) => /^\d{1,2}:\d{2}(?::\d{2})?$/.test(val);

  if (typeof start === 'string') {
    if (isTimeOnly(start)) {
      startTime = toDateFromTimeString(start);
    } else {
      startTime = new Date(start);
    }
  } else {
    startTime = start;
  }

  if (typeof end === 'string') {
    if (isTimeOnly(end)) {
      endTime = toDateFromTimeString(end);
      // Se o horário de fim é menor/igual ao de início, considerar turno a atravessar a meia-noite
      if (endTime <= startTime) {
        endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
      }
    } else {
      endTime = new Date(end);
    }
  } else {
    endTime = end;
  }

  // Guardas contra datas inválidas
  const startMs = startTime?.getTime?.();
  const endMs = endTime?.getTime?.();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    logger.warn('[calculateHours] Horas inválidas recebidas', { start, end });
    return 0;
  }

  const diffMs = (endMs as number) - (startMs as number);
  const bm = Number.isFinite(Number(breakMinutes)) ? Number(breakMinutes) : 0;
  const diffMinutes = diffMs / (1000 * 60) - bm;

  // Evitar NaN
  const hours = diffMinutes / 60;
  return Number.isFinite(hours) && hours > 0 ? hours : 0;
}

/**
 * Calcula a taxa horária baseada no salário base e horas efetivas de trabalho
 * @param baseSalaryCents Salário base em centavos
 * @param scheduleJson Horário de trabalho semanal
 * @returns Taxa horária em centavos
 */
export function calculateHourlyRate(
  baseSalaryCents: number,
  scheduleJson: Record<string, any>
): number {
  // Calcular total de horas efetivas por semana
  let totalWeeklyMinutes = 0;
  
  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  for (const day of daysOfWeek) {
    const daySchedule = scheduleJson[day];
    if (daySchedule && daySchedule.enabled) {
      const startTime = daySchedule.start || '09:00';
      const endTime = daySchedule.end || '18:00';
      const breakMinutes = daySchedule.break_minutes || 0;
      
      // Calcular minutos trabalhados no dia
      const dayMinutes = calculateHours(startTime, endTime, breakMinutes) * 60;
      totalWeeklyMinutes += dayMinutes;
    }
  }
  
  // Converter para horas
  const totalWeeklyHours = totalWeeklyMinutes / 60;
  
  if (totalWeeklyHours === 0) {
    return 0;
  }
  
  // Calcular salário semanal (assumindo 4.33 semanas por mês)
  const weeklySalaryCents = baseSalaryCents / 4.33;
  
  // Calcular taxa horária
  const hourlyRateCents = Math.round(weeklySalaryCents / totalWeeklyHours);
  
  return hourlyRateCents;
}

/**
 * Valida se uma entrada de tempo é válida
 * @param entry Entrada de tempo
 * @param contractHours Horas contratuais diárias (padrão: 8h)
 * @param maxOvertimeHours Máximo de horas extras diárias permitidas (padrão: 2h)
 * @returns Objeto com resultado da validação e mensagens de erro
 */
export function validateTimeEntry(
  entry: Partial<PayrollTimeEntry>,
  contractHours: number = 8,
  maxOvertimeHours: number = 2
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!entry.date) {
    errors.push('Data é obrigatória');
  }

  if (!entry.start_time) {
    errors.push('Hora de início é obrigatória');
  }

  if (!entry.end_time) {
    errors.push('Hora de fim é obrigatória');
  }

  if (entry.start_time && entry.end_time) {
    const start = new Date(`${entry.date}T${entry.start_time}`);
    const end = new Date(`${entry.date}T${entry.end_time}`);
    
    if (end <= start) {
      errors.push('Hora de fim deve ser posterior à hora de início');
    }

    const totalHours = calculateHours(start, end, entry.break_minutes || 0);
    if (totalHours > 16) {
      errors.push('Não é possível trabalhar mais de 16 horas por dia');
    }

    // Validar limite diário de horas extras (legislação portuguesa: máximo 2h/dia)
    const overtimeHours = Math.max(0, totalHours - contractHours);
    if (overtimeHours > maxOvertimeHours) {
      errors.push(`As horas extras não podem exceder ${maxOvertimeHours} horas por dia (atual: ${overtimeHours.toFixed(2)}h)`);
    }
  }

  if (entry.break_minutes !== undefined) {
    if (entry.break_minutes < 0) {
      errors.push('Minutos de pausa não podem ser negativos');
    }
    
    // Verificar se os minutos de pausa não excedem o tempo total de trabalho
    if (entry.start_time && entry.end_time && entry.break_minutes > 0) {
      const start = new Date(`${entry.date}T${entry.start_time}`);
      const end = new Date(`${entry.date}T${entry.end_time}`);
      const totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      
      if (entry.break_minutes >= totalMinutes) {
        errors.push('Minutos de pausa não podem ser iguais ou superiores ao tempo total de trabalho');
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Verifica se é necessário descanso compensatório para trabalho em domingo
 * @param workDate Data do trabalho
 * @param hoursWorked Horas trabalhadas
 * @returns Objeto indicando se é necessário descanso compensatório
 */
export function checkCompensatoryRest(
  workDate: Date,
  hoursWorked: number
): {
  isRequired: boolean;
  reason: string;
  compensatoryHours: number;
} {
  const dayOfWeek = workDate.getDay(); // 0 = domingo, 6 = sábado
  
  // Trabalho em domingo requer descanso compensatório obrigatório
  if (dayOfWeek === 0 && hoursWorked > 0) {
    return {
      isRequired: true,
      reason: 'Trabalho em domingo requer descanso compensatório obrigatório',
      compensatoryHours: hoursWorked
    };
  }
  
  return {
    isRequired: false,
    reason: '',
    compensatoryHours: 0
  };
}

/**
 * Valida limites semanais e anuais de horas extras
 * @param weeklyHours Total de horas trabalhadas na semana
 * @param annualOvertimeHours Total de horas extras no ano
 * @param maxWeeklyHours Limite semanal total (padrão: 48h)
 * @param maxAnnualOvertimeHours Limite anual de horas extras (padrão: 150h)
 * @returns Objeto com resultado da validação e mensagens de erro
 */
export function validateOvertimeLimits(
  weeklyHours: number,
  annualOvertimeHours: number,
  maxWeeklyHours: number = 48,
  maxAnnualOvertimeHours: number = 150
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validar limite semanal de 48 horas totais
  if (weeklyHours > maxWeeklyHours) {
    errors.push(`O limite semanal de ${maxWeeklyHours} horas foi excedido (atual: ${weeklyHours.toFixed(2)}h)`);
  }

  // Validar limite anual de horas extras
  if (annualOvertimeHours > maxAnnualOvertimeHours) {
    errors.push(`O limite anual de ${maxAnnualOvertimeHours} horas extras foi excedido (atual: ${annualOvertimeHours.toFixed(2)}h)`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Valida as percentagens de deduções conforme a legislação portuguesa
 * @param grossPayCents Salário bruto em cêntimos
 * @param deductionConfig Configuração das deduções
 * @returns Resultado da validação
 */
export function validateDeductions(
  grossPayCents: number,
  deductionConfig?: { 
    irs_percentage: number; 
    social_security_percentage: number; 
    irs_surcharge_percentage?: number; 
    solidarity_contribution_percentage?: number 
  }
): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!deductionConfig) {
    return { isValid: true, errors: [] };
  }

  // Validar Segurança Social (11% obrigatório)
  if (deductionConfig.social_security_percentage !== 11) {
    errors.push(`Segurança Social deve ser 11%, configurado: ${deductionConfig.social_security_percentage}%`);
  }

  // Validar IRS (0-48% aproximadamente, dependendo dos escalões)
  if (deductionConfig.irs_percentage < 0 || deductionConfig.irs_percentage > 48) {
    errors.push(`IRS deve estar entre 0% e 48%, configurado: ${deductionConfig.irs_percentage}%`);
  }

  // Validar sobretaxa IRS (aplicável apenas a rendimentos superiores a €80.000 anuais)
  const annualGrossEuros = (grossPayCents * 12) / 100; // Converter para euros anuais
  if (deductionConfig.irs_surcharge_percentage && deductionConfig.irs_surcharge_percentage > 0) {
    if (annualGrossEuros <= 80000) {
      errors.push(`Sobretaxa IRS só se aplica a rendimentos anuais superiores a €80.000. Rendimento anual estimado: €${annualGrossEuros.toFixed(2)}`);
    }
    if (deductionConfig.irs_surcharge_percentage > 5) {
      errors.push(`Sobretaxa IRS não pode exceder 5%, configurado: ${deductionConfig.irs_surcharge_percentage}%`);
    }
  }

  // Validar contribuição extraordinária de solidariedade (aplicável apenas a rendimentos superiores a €80.000 anuais)
  if (deductionConfig.solidarity_contribution_percentage && deductionConfig.solidarity_contribution_percentage > 0) {
    if (annualGrossEuros <= 80000) {
      errors.push(`Contribuição de solidariedade só se aplica a rendimentos anuais superiores a €80.000. Rendimento anual estimado: €${annualGrossEuros.toFixed(2)}`);
    }
    if (deductionConfig.solidarity_contribution_percentage > 5) {
      errors.push(`Contribuição de solidariedade não pode exceder 5%, configurado: ${deductionConfig.solidarity_contribution_percentage}%`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ── Unit 12a: OT Day Entry Builder ────────────────────────────────────────────

/**
 * Converts an array of PayrollTimeEntry records into OtDayEntry objects.
 * Only returns entries where actual OT (duration > thresholdMinutes) occurred.
 *
 * @param entries Raw time entries for the period
 * @param thresholdMinutes Daily threshold after which OT starts (e.g. 480 for 8h)
 */
export function buildOtDayEntries(
  entries: Array<{
    date: string;
    start_time?: string | null;
    end_time?: string | null;
    duration_minutes: number;
    planned_minutes?: number | null;
    is_holiday?: boolean | null;
    is_sunday?: boolean | null;
  }>,
  thresholdMinutes: number,
): OtDayEntry[] {
  // Group entries by date
  const byDate = new Map<string, typeof entries>();
  for (const e of entries) {
    const list = byDate.get(e.date) ?? [];
    list.push(e);
    byDate.set(e.date, list);
  }

  const result: OtDayEntry[] = [];

  for (const [date, dayEntries] of byDate) {
    const totalMinutes = dayEntries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0);
    const otMinutes = Math.max(0, totalMinutes - thresholdMinutes);
    if (otMinutes === 0) continue;

    const isRestDay = dayEntries.some(e => e.is_holiday || e.is_sunday);

    // Estimate night OT minutes: use proportional OT per entry
    let nightMinutes = 0;
    for (const e of dayEntries) {
      if (!e.start_time || !e.end_time) continue;
      if (isWorkDuringNightHours(e.start_time, e.end_time, '22:00', '07:00')) {
        // Proportion of this entry's duration relative to day total, applied to OT
        const entryOtFraction = totalMinutes > 0 ? (e.duration_minutes ?? 0) / totalMinutes : 0;
        nightMinutes += Math.round(otMinutes * entryOtFraction);
      }
    }
    nightMinutes = Math.min(nightMinutes, otMinutes); // never exceed total OT

    result.push({ date, otMinutes, isRestDay, nightMinutes });
  }

  return result;
}

// ── Unit 12a: calcOtScaled ────────────────────────────────────────────────────

/**
 * Calculates scaled OT pay (Lei 13/2023 — duas escalas).
 *
 * Scale transition at 100 YTD hours:
 *   - Escala 1 (E1): hours 0–100 → lower rates
 *   - Escala 2 (E2): hours above 100 → higher rates
 *
 * Component labels encode 'E1' or 'E2' so callers can detect the scale
 * without extra state (e.g. label.includes('E2')).
 *
 * @param entries          OtDayEntry[] for the current payroll period
 * @param baseMinuteCents  Employee's base rate per MINUTE in cents
 * @param ytdHoursBefore   YTD OT hours accumulated BEFORE this period
 * @param rates            OtRates from tax_tables
 * @param limits           OtAnnualLimits from tax_tables
 * @param isMPE            True if company is MPE (micro/small) — uses 175h limit
 */
export function calcOtScaled(
  entries: OtDayEntry[],
  baseMinuteCents: number,   // cents per MINUTE
  ytdHoursBefore: number,
  rates: OtRates,
  limits: OtAnnualLimits,
  isMPE: boolean,
): OtScaledResult {
  const annualLimit = isMPE ? limits.mpe_hours : limits.others_hours;
  let ytdHours = ytdHoursBefore;
  let otPayCents = 0;
  let nightBonusCents = 0;
  let otHoursThisMonth = 0;
  let dailyLimitWarning = false;

  const components: OtScaledResult['components'] = [];

  for (const entry of entries) {
    const otMins = entry.otMinutes;
    if (otMins <= 0) continue;

    const otHours = otMins / 60;
    otHoursThisMonth += otHours;

    // Check daily limit (max 2h OT per day)
    if (otMins > limits.daily_max_hours * 60) {
      dailyLimitWarning = true;
    }

    // How many minutes remain in E1 (before 100h threshold)?
    const scaleBreakMinutes = Math.max(0, (100 - ytdHours) * 60);

    let e1Cents = 0;
    let e2Cents = 0;

    if (entry.isRestDay) {
      const e1Mins = Math.min(otMins, scaleBreakMinutes);
      const e2Mins = otMins - e1Mins;
      if (e1Mins > 0) {
        e1Cents = Math.round(e1Mins * baseMinuteCents * (1 + rates.up_to_100h.rest_day_pct));
      }
      if (e2Mins > 0) {
        e2Cents = Math.round(e2Mins * baseMinuteCents * (1 + rates.above_100h.rest_day_pct));
      }
    } else {
      // Regular day: first 60 min at first_hour_pct, remainder at next_hours_pct
      // E1 portion (up to scaleBreakMinutes minutes)
      const e1TotalMins = Math.min(otMins, scaleBreakMinutes);
      if (e1TotalMins > 0) {
        const e1First = Math.min(e1TotalMins, 60);
        const e1Next  = e1TotalMins - e1First;
        e1Cents += Math.round(e1First * baseMinuteCents * (1 + rates.up_to_100h.first_hour_pct));
        if (e1Next > 0) {
          e1Cents += Math.round(e1Next * baseMinuteCents * (1 + rates.up_to_100h.next_hours_pct));
        }
      }
      // E2 portion — continue from where E1 left off in the first-hour budget
      const firstHourBudgetLeft = Math.max(0, 60 - Math.min(e1TotalMins, 60));
      const e2TotalMins = otMins - e1TotalMins;
      if (e2TotalMins > 0) {
        const e2First = Math.min(e2TotalMins, firstHourBudgetLeft);
        const e2Next  = e2TotalMins - e2First;
        if (e2First > 0) {
          e2Cents += Math.round(e2First * baseMinuteCents * (1 + rates.above_100h.first_hour_pct));
        }
        if (e2Next > 0) {
          e2Cents += Math.round(e2Next * baseMinuteCents * (1 + rates.above_100h.next_hours_pct));
        }
      }
    }

    // Night bonus
    if (entry.nightMinutes > 0) {
      const nightBonus = Math.round(entry.nightMinutes * baseMinuteCents * rates.night_work_pct);
      nightBonusCents += nightBonus;
      components.push({ label: `Night Bonus ${entry.date}`, amount_cents: nightBonus, sign: '+' });
    }

    otPayCents += e1Cents + e2Cents;

    if (e1Cents > 0) {
      components.push({ label: `OT E1 ${entry.date}`, amount_cents: e1Cents, sign: '+' });
    }
    if (e2Cents > 0) {
      components.push({ label: `OT E2 ${entry.date}`, amount_cents: e2Cents, sign: '+' });
    }

    ytdHours += otHours;
  }

  const newYtdHours = ytdHoursBefore + otHoursThisMonth;
  const annualLimitExceeded = newYtdHours >= annualLimit;
  const annualLimitWarning  = !annualLimitExceeded && (newYtdHours >= annualLimit - 10);

  return {
    otPayCents: otPayCents + nightBonusCents,
    otHoursThisMonth,
    newYtdHours,
    nightBonusCents,
    dailyLimitWarning,
    annualLimitWarning,
    annualLimitExceeded,
    components,
  };
}

// ── Unit 12a Task 5: Motor Fiscal PT — Pure Functions ─────────────────────────

/**
 * Calculates IRS withholding on overtime pay.
 * Portuguese law: OT withholding = otPay × baseIrsRate × withholdingRateOfBase (typically 50%).
 */
export function calcOtIrsWithholding(
  otPayCents: number,
  baseIrsRateFraction: number,
  withholdingRateOfBase: number,
): number {
  return Math.round(otPayCents * baseIrsRateFraction * withholdingRateOfBase);
}

/**
 * Splits mileage reimbursement into AT-exempt and taxable portions.
 * Amounts above the official cap per km are taxable.
 */
export function calcMileageCap(
  trips: { km: number; rateCentsPerKm: number }[],
  capCentsPerKm: number,
): { exemptCents: number; taxableCents: number; totalCents: number } {
  let exemptCents = 0;
  let taxableCents = 0;
  for (const trip of trips) {
    exemptCents  += Math.round(trip.km * Math.min(trip.rateCentsPerKm, capCentsPerKm));
    taxableCents += Math.round(trip.km * Math.max(0, trip.rateCentsPerKm - capCentsPerKm));
  }
  return { exemptCents, taxableCents, totalCents: exemptCents + taxableCents };
}

/**
 * Calculates exempt vs. taxable portions of a travel allowance (ajudas de custo).
 * Delegates viatura própria to calcMileageCap; uses cap table for all other types.
 */
export function calcTravelAllowance(
  allowance: {
    type: 'alojamento' | 'deslocacao_nacional' | 'deslocacao_estrangeiro' | 'deslocacao_viatura_propria';
    days?: number;
    km?: number;
    role: 'general' | 'admin';
    declaredCents: number;
  },
  caps: TravelAllowanceCaps,
  mileageCapCentsPerKm: number,
): { exemptCents: number; taxableExcessCents: number } {
  if (allowance.type === 'deslocacao_viatura_propria') {
    const km = allowance.km ?? 0;
    const ratePerKm = km > 0 ? allowance.declaredCents / km : 0;
    const r = calcMileageCap([{ km, rateCentsPerKm: ratePerKm }], mileageCapCentsPerKm);
    return { exemptCents: r.exemptCents, taxableExcessCents: r.taxableCents };
  }

  const capMap: Record<string, number> = {
    deslocacao_nacional_general:    caps.national_general_cents,
    deslocacao_nacional_admin:      caps.national_admin_cents,
    deslocacao_estrangeiro_general: caps.foreign_general_cents,
    deslocacao_estrangeiro_admin:   caps.foreign_admin_cents,
    alojamento_general: Math.round(caps.national_general_cents * caps.breakdown.sleep),
    alojamento_admin:   Math.round(caps.national_admin_cents   * caps.breakdown.sleep),
  };

  const capDaily = capMap[`${allowance.type}_${allowance.role}`] ?? 0;
  const maxExempt = (allowance.days ?? 1) * capDaily;
  const exemptCents = Math.min(allowance.declaredCents, maxExempt);
  return { exemptCents, taxableExcessCents: Math.max(0, allowance.declaredCents - exemptCents) };
}

/**
 * Computes the payroll impact of leave records (sick, unpaid, maternity, vacation subsidy).
 */
export function calcLeaveImpact(
  leaves: LeaveRecord[],
  grossDailyCents: number,
): LeaveImpact {
  let unpaidDeductionCents = 0;
  let subsidyAdjustmentCents = 0;
  const components: { label: string; amount_cents: number; sign: '+' | '-' }[] = [];

  for (const leave of leaves) {
    if (leave.leaveType === 'sick') {
      const employerDays = Math.min(leave.totalDays, leave.employerDays);
      if (employerDays > 0) {
        components.push({ label: `Baixa (empregador, ${employerDays}d)`, amount_cents: 0, sign: '+' });
      }
      if (leave.totalDays > leave.employerDays) {
        components.push({ label: `Baixa (SS, ${leave.totalDays - leave.employerDays}d)`, amount_cents: 0, sign: '+' });
      }
    } else if (leave.leaveType === 'unpaid') {
      const d = leave.totalDays * grossDailyCents;
      unpaidDeductionCents += d;
      components.push({ label: `Licença não remunerada (${leave.totalDays}d)`, amount_cents: d, sign: '-' });
    } else if (leave.leaveType === 'maternity' || leave.leaveType === 'paternity') {
      const d = leave.totalDays * grossDailyCents;
      unpaidDeductionCents += d;
      components.push({ label: `Licença parental (SS, ${leave.totalDays}d)`, amount_cents: d, sign: '-' });
    } else if (leave.leaveType === 'vacation' && leave.affectsSubsidy) {
      const d = leave.totalDays * grossDailyCents;
      subsidyAdjustmentCents += d;
      components.push({ label: `Subsídio férias pro-rata (${leave.totalDays}d)`, amount_cents: d, sign: '-' });
    }
  }

  return { unpaidDeductionCents, subsidyAdjustmentCents, components };
}

/**
 * Merges OT, mileage, travel allowance, and leave components into a base PayslipCalculation.
 * Returns a new object — does NOT mutate base.
 */
export function mergeComponents(
  base: PayslipCalculation,
  otResult: OtScaledResult,
  otIrsCents: number,
  mileage: { exemptCents: number; taxableCents: number; totalCents: number },
  allowances: { exemptCents: number; taxableExcessCents: number }[],
  leaveImpact: LeaveImpact,
): PayslipCalculation {
  const extra: { label: string; amount_cents: number; sign: '+' | '-' }[] = [
    ...otResult.components,
    ...(otIrsCents > 0 ? [{ label: 'IRS s/ Horas Extra', amount_cents: otIrsCents, sign: '-' as const }] : []),
    ...(mileage.exemptCents > 0 ? [{ label: 'Quilometragem (isento)', amount_cents: mileage.exemptCents, sign: '+' as const }] : []),
    ...(mileage.taxableCents > 0 ? [{ label: 'Quilometragem (tributável)', amount_cents: mileage.taxableCents, sign: '+' as const }] : []),
    ...allowances.flatMap(a => [
      ...(a.exemptCents > 0 ? [{ label: 'Ajudas Custo (isento)', amount_cents: a.exemptCents, sign: '+' as const }] : []),
      ...(a.taxableExcessCents > 0 ? [{ label: 'Ajudas Custo (tributável)', amount_cents: a.taxableExcessCents, sign: '+' as const }] : []),
    ]),
    ...leaveImpact.components,
  ];
  const netDelta = extra.reduce(
    (acc, c) => acc + (c.sign === '+' ? c.amount_cents : -c.amount_cents),
    0,
  );
  return { ...base, components: [...base.components, ...extra], net_cents: base.net_cents + netDelta };
}