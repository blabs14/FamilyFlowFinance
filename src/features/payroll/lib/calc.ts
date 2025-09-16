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
function isWorkDuringNightHours(
  startTime: Date,
  endTime: Date,
  nightStart: string,
  nightEnd: string
): boolean {
  const startHour = startTime.getHours();
  const startMinute = startTime.getMinutes();
  const endHour = endTime.getHours();
  const endMinute = endTime.getMinutes();
  
  const [nightStartHour, nightStartMinute] = nightStart.split(':').map(Number);
  const [nightEndHour, nightEndMinute] = nightEnd.split(':').map(Number);
  
  const workStartMinutes = startHour * 60 + startMinute;
  const workEndMinutes = endHour * 60 + endMinute;
  const nightStartMinutes = nightStartHour * 60 + nightStartMinute;
  const nightEndMinutes = nightEndHour * 60 + nightEndMinute;
  
  // Se o período noturno atravessa meia-noite (ex: 22:00-07:00)
  if (nightStartMinutes > nightEndMinutes) {
    // Trabalho noturno se:
    // - Começa depois das 22h OU
    // - Termina antes das 7h OU
    // - Atravessa meia-noite
    return workStartMinutes >= nightStartMinutes || 
           workEndMinutes <= nightEndMinutes ||
           workEndMinutes < workStartMinutes; // Atravessa meia-noite
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
  const isNightShift = isWorkDuringNightHours(startTime, endTime, nightStart, nightEnd);

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
      isNightShift: isWorkDuringNightHours(startTime, regularEndTime, nightStart, nightEnd)
    });

    // Segmento de horas extras
    segments.push({
      start: regularEndTime,
      end: endTime,
      isOvertime: true,
      hours: overtimeHours,
      isNightShift: isWorkDuringNightHours(regularEndTime, endTime, nightStart, nightEnd)
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