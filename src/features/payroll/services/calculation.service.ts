import { PayrollContract, PayrollTimeEntry, PayrollOTPolicy, PayrollHoliday, PayrollMileageTrip, PayrollVacation, PayrollCalculation } from '../types';
import { calcMonth, validateTimeEntry, PreCalculatedOvertimeData } from '../lib/calc';
import { logger } from '@/shared/lib/logger';

/**
 * Calcula o último dia do mês corretamente
 * @param year Ano
 * @param month Mês (1-12)
 * @returns String no formato YYYY-MM-DD do último dia do mês
 */
function getLastDayOfMonth(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
}

/**
 * Função de hash simples compatível com o browser
 * @param str String para fazer hash
 * @returns Hash hexadecimal
 */
function simpleHash(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString(16);
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(16);
}

/**
 * Interface para o resultado do cálculo com cache
 */
export interface CalculationResult {
  calculation: PayrollCalculation;
  hash: string;
  timestamp: Date;
  isFromCache: boolean;
}

/**
 * Interface para os parâmetros de entrada do cálculo
 */
export interface CalculationInput {
  contract: PayrollContract;
  timeEntries: PayrollTimeEntry[];
  otPolicy: PayrollOTPolicy;
  holidays: PayrollHoliday[];
  mileageTrips?: PayrollMileageTrip[];
  mileageRateCents?: number;
  mealAllowanceConfig?: { excluded_months: number[]; daily_amount_cents?: number };
  vacations?: PayrollVacation[];
  deductionConfig?: { irs_percentage: number; social_security_percentage: number };
  preCalculatedData?: PreCalculatedOvertimeData;
}

/**
 * Interface para validação de entrada
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Cache em memória para cálculos (em produção seria substituído por Redis ou similar)
 */
class CalculationCache {
  private cache = new Map<string, { result: PayrollCalculation; timestamp: Date }>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutos

  set(hash: string, result: PayrollCalculation): void {
    this.cache.set(hash, {
      result: { ...result }, // Deep copy para evitar mutações
      timestamp: new Date()
    });
  }

  get(hash: string): PayrollCalculation | null {
    const cached = this.cache.get(hash);
    
    if (!cached) {
      return null;
    }

    // Verificar se o cache expirou
    const now = new Date();
    if (now.getTime() - cached.timestamp.getTime() > this.TTL_MS) {
      this.cache.delete(hash);
      return null;
    }

    return { ...cached.result }; // Deep copy para evitar mutações
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Serviço de cálculo idempotente para folha de pagamento
 */
export class PayrollCalculationService {
  private cache = new CalculationCache();

  /**
   * Gera um hash único baseado nos parâmetros de entrada
   * @param input Parâmetros de entrada
   * @returns Hash SHA-256
   */
  private async generateHash(input: CalculationInput): Promise<string> {
    // Normalizar os dados para garantir consistência no hash
    const normalizedInput = {
      contract: {
        id: input.contract.id,
        base_salary_cents: input.contract.base_salary_cents,
        hourly_rate_cents: input.contract.hourly_rate_cents,
        weekly_hours: input.contract.weekly_hours,
        schedule_json: input.contract.schedule_json
      },
      timeEntries: input.timeEntries
        .map(entry => ({
          date: entry.date,
          start_time: entry.start_time,
          end_time: entry.end_time,
          break_minutes: entry.break_minutes || 0,
          entry_type: entry.entry_type
        }))
        .sort((a, b) => a.date.localeCompare(b.date)), // Ordenar para consistência
      otPolicy: input.otPolicy ? {
        multiplier: input.otPolicy.multiplier,
        daily_limit_hours: input.otPolicy.daily_limit_hours,
        weekly_limit_hours: input.otPolicy.weekly_limit_hours,
        night_start: input.otPolicy.night_start,
        night_end: input.otPolicy.night_end,
        night_multiplier: input.otPolicy.night_multiplier
      } : null,
      holidays: input.holidays
        .map(holiday => ({
          date: holiday.date,
          name: holiday.name
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      mileageTrips: (input.mileageTrips || [])
        .map(trip => ({
          date: trip.date,
          km: trip.km,
          purpose: trip.purpose
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      mileageRateCents: input.mileageRateCents || 36,
      deductionConfig: input.deductionConfig || null
    };

    const dataString = JSON.stringify(normalizedInput);

    // Preferir Web Crypto API quando disponível (browser/Node >= 15)
    try {
      const subtle = globalThis?.crypto?.subtle;
      if (subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(dataString);
        const digest = await subtle.digest('SHA-256', data);
        const hex = Array.from(new Uint8Array(digest))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        return hex;
      }
    } catch (_) {
      // Ignorar e tentar fallback
    }

    // Fallback: usar hash simples para compatibilidade

    return simpleHash(dataString);
  }

  /**
   * Valida os parâmetros de entrada
   * @param input Parâmetros de entrada
   * @returns Resultado da validação
   */
  private validateInput(input: CalculationInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar contrato
    if (!input.contract) {
      errors.push('Contrato é obrigatório');
    } else {
      if (!input.contract.base_salary_cents || input.contract.base_salary_cents <= 0) {
        errors.push('Salário base deve ser maior que zero');
      }
      
      // Validação do salário mínimo nacional (€870 para 2025)
      if (input.contract.base_salary_cents < 87000) {
        errors.push('Salário base não pode ser inferior ao salário mínimo nacional (€870 - 2025)');
      }
      
      // Calcular taxa horária se não estiver definida
      let hourlyRateCents = input.contract.hourly_rate_cents;
      if (!hourlyRateCents || hourlyRateCents <= 0) {
        // Calcular taxa horária baseada no salário base e horas semanais
        const weeklyHours = input.contract.weekly_hours || 40; // Default 40 horas
        const monthlyHours = (weeklyHours * 52) / 12; // Horas mensais médias
        hourlyRateCents = Math.round(input.contract.base_salary_cents / monthlyHours);
        
        if (hourlyRateCents <= 0) {
          errors.push('Taxa horária calculada deve ser maior que zero');
        }
      }
      
      // Validação das horas semanais conforme Código do Trabalho
      if (input.contract.weekly_hours && input.contract.weekly_hours > 40) {
        warnings.push('Horário semanal superior a 40 horas pode requerer acordo específico');
      }
    }

    // Validar política de horas extras (opcional)
    if (input.otPolicy) {
      if (input.otPolicy.multiplier <= 1) {
        warnings.push('Multiplicador de horas extras é menor ou igual a 1');
      }
      
      // Validações específicas do Código do Trabalho português
      if (input.otPolicy.daily_limit_hours && input.otPolicy.daily_limit_hours > 12) {
        errors.push('Limite diário de trabalho não pode exceder 12 horas (incluindo horas extras)');
      }
      
      if (input.otPolicy.weekly_limit_hours && input.otPolicy.weekly_limit_hours > 48) {
        errors.push('Limite semanal de trabalho não pode exceder 48 horas (incluindo horas extras)');
      }
      
      // Validar multiplicadores mínimos conforme legislação
      if (input.otPolicy.multiplier < 1.25) {
        warnings.push('Multiplicador de horas extras inferior ao mínimo legal (25%)');
      }
    } else {
      warnings.push('Política de horas extras não configurada - horas extras não serão calculadas');
    }

    // Validar entradas de tempo
    if (!input.timeEntries || input.timeEntries.length === 0) {
      warnings.push('Nenhuma entrada de tempo fornecida');
    } else {
      input.timeEntries.forEach((entry, index) => {
        const validation = validateTimeEntry(entry);
        if (!validation.isValid) {
          errors.push(`Entrada ${index + 1}: ${validation.errors.join(', ')}`);
        }
      });
    }

    // Validar feriados
    if (!input.holidays) {
      input.holidays = [];
    }

    // Validar subsídio de alimentação conforme limites fiscais 2025
    if (input.mealAllowanceConfig && input.mealAllowanceConfig.daily_amount_cents) {
      if (input.mealAllowanceConfig.daily_amount_cents > 1020) {
        warnings.push('Subsídio de alimentação superior ao limite de isenção fiscal (€10.20/dia)');
      }
    }
    
    // Validar taxa de quilometragem conforme limites fiscais 2025
    if (input.mileageRateCents && input.mileageRateCents > 40) {
      warnings.push('Taxa de quilometragem superior ao limite de isenção fiscal (€0.40/km)');
    }
    
    // Validar viagens de quilometragem
    if (input.mileageTrips) {
      input.mileageTrips.forEach((trip, index) => {
        if (!trip.km || trip.km <= 0) {
          errors.push(`Viagem ${index + 1}: Distância deve ser maior que zero`);
        }
        if (!trip.date) {
          errors.push(`Viagem ${index + 1}: Data é obrigatória`);
        }
      });
    }

    // Validar configuração de descontos (IRS e Segurança Social)
    if (input.deductionConfig) {
      if (input.deductionConfig.irs_percentage < 0 || input.deductionConfig.irs_percentage > 100) {
        errors.push('Percentagem de IRS deve estar entre 0% e 100%');
      }
      
      if (input.deductionConfig.social_security_percentage < 0 || input.deductionConfig.social_security_percentage > 100) {
        errors.push('Percentagem de Segurança Social deve estar entre 0% e 100%');
      }
      
      // Validar percentagens típicas conforme legislação portuguesa
      if (input.deductionConfig.social_security_percentage > 11) {
        warnings.push('Percentagem de Segurança Social superior ao típico (11%)');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calcula a folha de pagamento de forma idempotente
   * @param input Parâmetros de entrada
   * @returns Resultado do cálculo com informações de cache
   */
  async calculate(input: CalculationInput): Promise<CalculationResult> {
    // Validar entrada
    const validation = this.validateInput(input);
    if (!validation.isValid) {
      throw new Error(`Parâmetros inválidos: ${validation.errors.join(', ')}`);
    }

    // Gerar hash dos parâmetros
    const hash = await this.generateHash(input);

    // Verificar cache
    const cachedResult = this.cache.get(hash);
    if (cachedResult) {
      return {
        calculation: cachedResult,
        hash,
        timestamp: new Date(),
        isFromCache: true
      };
    }

    // Calcular resultado
    const calculation = calcMonth(
      input.contract,
      input.timeEntries,
      input.otPolicy,
      input.holidays,
      input.mileageTrips || [],
      input.mileageRateCents || 36,
      input.mealAllowanceConfig,
      input.vacations || [],
      undefined, // weeklyHours
      undefined, // annualOvertimeHours
      input.deductionConfig
    );

    // Armazenar no cache
    this.cache.set(hash, calculation);

    return {
      calculation,
      hash,
      timestamp: new Date(),
      isFromCache: false
    };
  }

  /**
   * Limpa o cache de cálculos
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Retorna estatísticas do cache
   */
  getCacheStats(): { size: number; ttlMs: number } {
    return {
      size: this.cache.size(),
      ttlMs: 5 * 60 * 1000
    };
  }

  /**
   * Calcula múltiplos períodos de forma eficiente
   * @param inputs Array de parâmetros de entrada
   * @returns Array de resultados
   */
  async calculateBatch(inputs: CalculationInput[]): Promise<CalculationResult[]> {
    const results: CalculationResult[] = [];

    for (const input of inputs) {
      try {
        const result = await this.calculate(input);
        results.push(result);
      } catch (error) {
        // Em caso de erro, adicionar um resultado com erro
        results.push({
          calculation: {
            regularHours: 0,
            overtimeHours: 0,
            regularPay: 0,
            overtimePay: 0,
            mealAllowance: 0,
            mileageReimbursement: 0,
            bonuses: 0,
            grossPay: 0,
            deductions: 0,
            netPay: 0
          },
          hash: '',
          timestamp: new Date(),
          isFromCache: false
        });
      }
    }

    return results;
  }
}

// Instância singleton do serviço
export const payrollCalculationService = new PayrollCalculationService();

/**
 * Função de conveniência para calcular folha de pagamento
 * @param userId ID do utilizador
 * @param contractId ID do contrato
 * @param year Ano
 * @param month Mês
 * @param preCalculatedData Dados pré-calculados da timesheet (opcional)
 * @returns Resultado do cálculo
 */
export async function calculatePayroll(
  userId: string, 
  contractId: string, 
  year: number, 
  month: number,
  preCalculatedData?: PreCalculatedOvertimeData
): Promise<CalculationResult> {
  // Importar serviços necessários
  const { payrollService } = await import('./payrollService');
  
  try {
    // Buscar primeiro o contrato para obter workplace_location
    const contract = await payrollService.getContract(contractId, userId);

    // Buscar dados necessários em paralelo (dependentes do contrato acima)
    const [otPolicy, holidays, timeEntries, mileageTrips, mileagePolicy, mealAllowanceConfig, vacations, deductionConfig] = await Promise.all([
      payrollService.getActiveOTPolicy(userId, contractId),
      payrollService.getHolidays(userId, year, contractId, contract?.workplace_location),
      payrollService.getTimeEntriesByContract(userId, contractId, `${year}-${month.toString().padStart(2, '0')}-01`, getLastDayOfMonth(year, month)),
      payrollService.getMileageTrips(userId, `${year}-${month.toString().padStart(2, '0')}-01`, getLastDayOfMonth(year, month), contractId),
      payrollService.getActiveMileagePolicy(userId, contractId),
      payrollService.getMealAllowanceConfig(userId, contractId),
      payrollService.getVacations(userId, contractId, year),
      payrollService.getDeductionConfig(userId, contractId)
    ]);

    if (!contract) throw new Error('Contrato não encontrado');
    // Política de horas extras é opcional - se não existir, horas extras não serão calculadas

    // Calcular taxa horária se necessário
    let contractWithHourlyRate = { ...contract };
    if (!contract.hourly_rate_cents || contract.hourly_rate_cents <= 0) {
      const weeklyHours = contract.weekly_hours || 40;
      const monthlyHours = (weeklyHours * 52) / 12;
      contractWithHourlyRate.hourly_rate_cents = Math.round(contract.base_salary_cents / monthlyHours);
    }

    // Preparar input para o cálculo
    const input: CalculationInput = {
      contract: contractWithHourlyRate,
      timeEntries,
      otPolicy,
      holidays,
      mileageTrips: mileageTrips || [],
      mileageRateCents: mileagePolicy?.rate_cents_per_km || 36,
      mealAllowanceConfig: mealAllowanceConfig ? { excluded_months: mealAllowanceConfig.excluded_months, daily_amount_cents: mealAllowanceConfig.daily_amount_cents } : undefined,
      vacations: vacations || [],
      deductionConfig: deductionConfig ? { irs_percentage: deductionConfig.irs_percentage, social_security_percentage: deductionConfig.social_security_percentage } : undefined,
      preCalculatedData
    };

    // Calcular usando o serviço
    return await payrollCalculationService.calculate(input);
    
  } catch (error) {
    logger.error('Erro no cálculo da folha de pagamento:', error);
    throw error;
  }
}