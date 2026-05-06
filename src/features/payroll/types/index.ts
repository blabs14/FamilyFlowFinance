// Tipos para o módulo de folha de pagamento
// Baseado nas tabelas criadas na migração payroll_migration_studio.sql

export interface PayrollContract {
  id: string;
  user_id: string;
  name: string;
  base_salary_cents: number;
  hourly_rate_cents: number | null;
  currency: string;
  weekly_hours: number;
  schedule_json: Record<string, any>;
  vacation_bonus_mode: string;
  christmas_bonus_mode: string;
  is_active: boolean;
  status?: 'active' | 'inactive';    // Unit 11: replaces is_active pattern
  account_id?: string | null;         // Unit 11: bank account for net salary
  job_category?: string;
  workplace_location?: string;
  duration?: number; // em meses
  has_probation_period?: boolean;
  probation_duration_days?: number;
  created_at: string;
  updated_at: string;
}

export interface PayrollOTPolicy {
  id: string;
  user_id: string;
  name: string;
  threshold_hours: number;
  multiplier: number;
  daily_limit_hours: number; // Limite diário de horas extras (padrão: 2h)
  annual_limit_hours: number; // Limite anual de horas extras (150h/175h/200h)
  weekly_limit_hours: number; // Limite semanal total incluindo extras (48h)
  day_multiplier: number; // Multiplicador primeira hora dia útil (1.5 = 50%)
  night_multiplier: number; // Multiplicador horas seguintes (1.75 = 75%)
  weekend_multiplier: number; // Multiplicador fim de semana (2.0 = 100%)
  holiday_multiplier: number; // Multiplicador feriados (2.0 = 100%)
  night_start_time: string; // Início período noturno
  night_end_time: string; // Fim período noturno
  rounding_minutes: number; // Arredondamento em minutos
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PayrollHoliday {
  id: string;
  user_id: string;
  name: string;
  date: string;
  holiday_type: 'national' | 'regional' | 'municipal' | 'company' | 'personal';
  is_paid: boolean;
  affects_overtime: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollTimeEntry {
  id: string;
  user_id: string;
  contract_id: string;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  description?: string;
  is_overtime: boolean;
  is_holiday?: boolean;
  is_sick?: boolean;
  is_vacation?: boolean;
  is_exception?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PayrollMileagePolicy {
  id: string;
  user_id: string;
  name: string;
  rate_cents_per_km: number;
  monthly_cap_cents?: number | null;
  requires_purpose?: boolean;
  requires_origin_destination?: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PayrollMileageTrip {
  id: string;
  user_id: string;
  policy_id: string;
  date: string;
  origin: string;
  destination: string;
  km: number;
  purpose: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollPeriod {
  id: string;
  user_id: string;
  contract_id: string;
  year: number;
  month: number;
  start_date: string;
  end_date: string;
  status: 'draft' | 'calculated' | 'approved' | 'paid';
  total_hours: number;
  overtime_hours: number;
  total_amount_cents: number;
  created_at: string;
  updated_at: string;
}

export interface PayrollItem {
  id: string;
  user_id: string;
  period_id: string;
  type: 'salary' | 'overtime' | 'bonus' | 'mileage' | 'deduction';
  description: string;
  amount_cents: number;
  quantity?: number;
  rate_cents?: number;
  created_at: string;
  updated_at: string;
}

export interface PayrollPayslip {
  id: string;
  user_id: string;
  period_id: string;
  employee_name: string;
  period_start: string;
  period_end: string;
  gross_pay_cents: number;
  deductions_cents: number;
  net_pay_cents: number;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

// Tipos para cálculos
export interface TimeSegment {
  start: Date;
  end: Date;
  isOvertime: boolean;
  hours: number;
  isNightShift?: boolean; // Indica se o segmento ocorre durante período noturno
}

export interface PlannedSchedule {
  date: string;
  plannedHours: number;
  isHoliday: boolean;
  holidayName?: string;
}

export interface PayrollCalculation {
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  overtimePayDay?: number; // Pagamento horas extras dia útil
  overtimePayNight?: number; // Pagamento horas extras noturnas
  overtimePayWeekend?: number; // Pagamento horas extras fim de semana
  overtimePayHoliday?: number; // Pagamento horas extras feriados
  mileageReimbursement: number;
  bonuses: number;
  grossPay: number;
  deductions: number;
  irsDeduction?: number; // Desconto de IRS
  socialSecurityDeduction?: number; // Desconto de Segurança Social
  irsSurchargeDeduction?: number; // Sobretaxa IRS
  solidarityContributionDeduction?: number; // Contribuição extraordinária de solidariedade
  netPay: number;
  validationErrors?: string[]; // Erros de validação de limites
  mealAllowance?: number; // Subsídio de refeição
}

// Tipos para UI
export interface TimesheetEntry {
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  description: string;
  isHoliday: boolean;
  isSick: boolean;
  isVacation?: boolean;
  isException?: boolean;
}

export interface WeeklyTimesheet {
  weekStart: string;
  weekEnd: string;
  entries: TimesheetEntry[];
  totalHours: number;
  overtimeHours: number;
}

export interface MileageEntry {
  date: string;
  origin: string;
  destination: string;
  distance: number;
  purpose: string;
  rate: number;
  amount: number;
}

// Enums
export enum PayrollItemType {
  SALARY = 'salary',
  OVERTIME = 'overtime',
  BONUS = 'bonus',
  MILEAGE = 'mileage',
  DEDUCTION = 'deduction'
}

export enum PayrollPeriodStatus {
  DRAFT = 'draft',
  CALCULATED = 'calculated',
  APPROVED = 'approved',
  PAID = 'paid'
}

// Tipos para formulários
export interface ContractFormData {
  name: string;
  base_salary_cents: number;
  weekly_hours: number;
  schedule_json: Record<string, any>;
  vacation_bonus_mode: string;
  christmas_bonus_mode: string;
  is_active: boolean;
  currency: string;
  job_category?: string;
  workplace_location?: string;
  duration?: number; // duração em meses
  has_probation_period?: boolean;
  probation_duration_days?: number;
}

export interface OTPolicyFormData {
  name: string;
  firstHourMultiplier: number;
  subsequentHoursMultiplier: number;
  weekendMultiplier: number;
  holidayMultiplier: number;
  nightStartTime: string;
  nightEndTime: string;
  roundingMinutes: number;
  dailyLimitHours: number;
  annualLimitHours: number;
  weeklyLimitHours: number;
}

export interface PayrollOTPolicyFormData {
  name: string;
  ot_type: 'daily' | 'weekly' | 'holiday' | 'weekend' | 'night';
  threshold_hours: number;
  multiplier: number;
  max_daily_ot_hours: number | null;
  max_weekly_ot_hours: number | null;
  max_annual_ot_hours: number | null;
  night_start_time: string;
  night_end_time: string;
  is_active: boolean;
  description: string;
}

export interface PayrollHolidayFormData {
  name: string;
  date: string;
  holiday_type: 'national' | 'regional' | 'municipal' | 'company' | 'personal';
  is_paid: boolean;
  affects_overtime: boolean;
  description?: string;
}

export interface HolidayFormData {
  name: string;
  date: string;
  is_paid: boolean;
}

export interface MileagePolicyFormData {
  name: string;
  rate_per_km: number; // em euros, será convertido para cents
}

export interface PayrollContractFormData {
  name: string;
  base_salary_cents: number;
  weekly_hours: number;
  schedule_json: Record<string, any>;
  vacation_bonus_mode: string;
  christmas_bonus_mode: string;
  is_active: boolean;
  currency: string;
  job_category?: string;
  workplace_location?: string;
  duration?: number; // duração em meses
  has_probation_period?: boolean;
  probation_duration_days?: number;
}

// Interfaces para o sistema de férias
export interface PayrollVacation {
  id: string;
  user_id: string;
  contract_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  year: number;
  description?: string;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface PayrollVacationFormData {
  start_date: string;
  end_date: string;
  description?: string;
}

// Tipos para método de pagamento do subsídio de alimentação
export type MealAllowancePaymentMethod = 'cash' | 'card';

// Interface para configuração de subsídio de alimentação
export interface PayrollMealAllowanceConfig {
  id: string;
  user_id: string;
  contract_id: string;
  daily_amount_cents: number;
  excluded_months: number[]; // Array de meses (1-12) onde não há pagamento
  payment_method: MealAllowancePaymentMethod; // Método de pagamento: 'cash' ou 'card'
  duodecimos_enabled: boolean; // Pagamento em duodécimos (distribuição anual em 12 meses)
  created_at: string;
  updated_at: string;
}

export interface PayrollMealAllowanceConfigFormData {
  dailyAmount: number;
  excluded_months: number[];
  paymentMethod: MealAllowancePaymentMethod;
  duodecimosEnabled: boolean;
}

// Interface para configuração de descontos (IRS e Segurança Social)
export interface PayrollDeductionConfig {
  id: string;
  user_id: string;
  contract_id: string;
  irs_percentage: number; // Percentagem de IRS (0-100)
  social_security_percentage: number; // Percentagem de Segurança Social (0-100)
  irs_surcharge_percentage?: number; // Sobretaxa IRS (0-5%) - aplicável a rendimentos superiores a €80.640
  solidarity_contribution_percentage?: number; // Contribuição extraordinária de solidariedade (0-5%) - aplicável a rendimentos superiores a €80.640
  created_at: string;
  updated_at: string;
}

export interface PayrollDeductionConfigFormData {
  irsPercentage: number;
  socialSecurityPercentage: number;
  irsSurchargePercentage?: number;
  solidarityContributionPercentage?: number;
}

// Tipos para licenças especiais e parentais
export interface PayrollLeave {
  id: string;
  user_id: string;
  contract_id: string;
  leave_type: 'maternity' | 'paternity' | 'parental' | 'adoption' | 'sick' | 'family_assistance' | 'bereavement' | 'marriage' | 'study' | 'unpaid' | 'compensatory_rest' | 'other';
  start_date: string;
  end_date: string;
  total_days: number;
  paid_days: number;
  unpaid_days: number;
  percentage_paid: number; // 0-100%
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed';
  reason?: string;
  medical_certificate: boolean;
  supporting_documents?: any; // JSON com URLs ou referências
  notes?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollLeaveFormData {
  leave_type: string;
  start_date: string;
  end_date: string;
  paid_days?: number;
  unpaid_days?: number;
  percentage_paid?: number;
  reason?: string;
  medical_certificate?: boolean;
  notes?: string;
}

// Constantes para tipos de licença
export const LEAVE_TYPES = {
  maternity: { label: 'Licença de Maternidade', defaultDays: 120, defaultPaid: 100 },
  paternity: { label: 'Licença de Paternidade', defaultDays: 20, defaultPaid: 100 },
  parental: { label: 'Licença Parental', defaultDays: 120, defaultPaid: 80 },
  adoption: { label: 'Licença por Adoção', defaultDays: 100, defaultPaid: 100 },
  sick: { label: 'Baixa Médica', defaultDays: 30, defaultPaid: 65 },
  family_assistance: { label: 'Assistência à Família', defaultDays: 15, defaultPaid: 65 },
  bereavement: { label: 'Luto', defaultDays: 5, defaultPaid: 100 },
  marriage: { label: 'Casamento', defaultDays: 15, defaultPaid: 100 },
  study: { label: 'Formação/Estudos', defaultDays: 0, defaultPaid: 0 },
  unpaid: { label: 'Licença sem Vencimento', defaultDays: 0, defaultPaid: 0 },
  compensatory_rest: { label: 'Descanso Compensatório', defaultDays: 1, defaultPaid: 100 },
  other: { label: 'Outras Licenças', defaultDays: 0, defaultPaid: 100 }
} as const;

// ============================================================================
// TIPOS PARA CÁLCULO AUTOMÁTICO DE DEDUÇÕES
// ============================================================================

// Interface para condições de dedução por contrato
export interface PayrollDeductionConditions {
  id: string;
  user_id: string;
  contract_id: string;
  year: number;
  region: 'continente' | 'acores' | 'madeira';
  marital_status: 'single' | 'married' | 'unido_de_facto';
  taxation_mode?: 'conjunta' | 'separada'; // Apenas relevante para married/unido_de_facto
  income_holders: 'one' | 'two';
  dependents: number;
  disability_worker: boolean;
  disability_dependents: boolean;
  residency: 'resident' | 'non_resident';
  overtime_rule: 'half_effective_rate' | 'none';
  duodecimos: boolean;
  meal_method: 'cash' | 'card';
  has_adse: boolean;
  adse_rate: number;
  union_rate: number;
  created_at: string;
  updated_at: string;
}

// Interface para tabelas legais versionadas
export interface LegalTable {
  id: string;
  year: number;
  region: 'continente' | 'acores' | 'madeira';
  domain: 'irs_withholding' | 'ss_rates' | 'meal_allowance_limits' | 'overtime_rules';
  payload: Record<string, any>; // JSON com os dados da tabela
  effective_from: string;
  effective_to: string;
  created_at: string;
  updated_at: string;
}

// Tipos para formulários das condições
export interface PayrollDeductionConditionsFormData {
  year: number;
  region: 'continente' | 'acores' | 'madeira';
  marital_status: 'single' | 'married' | 'unido_de_facto';
  taxation_mode?: 'conjunta' | 'separada'; // Apenas relevante para married/unido_de_facto
  income_holders: 'one' | 'two';
  dependents: number;
  disability_worker: boolean;
  disability_dependents: boolean;
  residency: 'resident' | 'non_resident';
  overtime_rule: 'half_effective_rate' | 'none';
  duodecimos: boolean;
  meal_method: 'cash' | 'card';
  has_adse: boolean;
  adse_rate: number;
  union_rate: number;
}

// Extensão da interface de configuração de descontos para incluir modo automático
export interface PayrollDeductionConfigExtended extends PayrollDeductionConfig {
  auto_deductions_enabled: boolean;
}

// Performance bonus types
export type {
  PerformanceBonusConfig,
  PerformanceBonusResult,
  PerformanceBonusConfigInput,
  PerformanceMetrics,
  PerformanceBonusCalculation,
  MetricType,
  ThresholdOperator,
  BonusType,
  EvaluationPeriod,
  CalculationStatus
} from './performanceBonus';

// Subsidy types (férias e Natal)
export type {
  SubsidyType,
  SubsidyStatus,
  SubsidyPaymentMethod,
  SubsidyConfig,
  VacationSubsidyConfig,
  ChristmasSubsidyConfig,
  SubsidyCalculation,
  SubsidyCalculationResult,
  SubsidyCalculationInput,
  SubsidyPaymentHistory,
  SubsidyReport,
  SubsidyValidationResult,
  MockSubsidyData,
  SubsidyConfigUnion,
  SubsidyTypeConfig
} from './subsidies';

export { SUBSIDY_CONSTANTS } from './subsidies';