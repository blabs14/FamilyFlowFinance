import { vi } from 'vitest';

// Interfaces para os dados de payroll
export interface PayslipData {
  id: string;
  employee_name: string;
  position: string;
  base_salary: number;
  overtime_hours: number;
  overtime_rate: number;
  overtime_amount: number;
  subsidies: number;
  deductions: number;
  gross_salary: number;
  net_salary: number;
  period: string;
}

export interface MonthlyTotals {
  totalGross: number;
  totalNet: number;
  totalEmployees: number;
  totalOvertime: number;
  totalSubsidies: number;
  totalDeductions: number;
}

export interface PayrollCalculationResult {
  success: boolean;
  data?: {
    totals: MonthlyTotals;
    items: PayslipData[];
  };
  error?: string;
}

// Factory para criar dados de payslip
export const createPayslipData = (overrides: Partial<PayslipData> = {}): PayslipData => ({
  id: `payslip-${Math.random().toString(36).substr(2, 9)}`,
  employee_name: 'João Silva',
  position: 'Desenvolvedor',
  base_salary: 3000,
  overtime_hours: 10,
  overtime_rate: 1.5,
  overtime_amount: 450,
  subsidies: 200,
  deductions: 500,
  gross_salary: 3650,
  net_salary: 3150,
  period: '2024-01',
  ...overrides,
});

// Factory para criar múltiplos payslips
export const createPayslipList = (count: number = 3): PayslipData[] => {
  return Array.from({ length: count }, (_, index) => 
    createPayslipData({
      id: `payslip-${index + 1}`,
      employee_name: `Funcionário ${index + 1}`,
      base_salary: 3000 + (index * 500),
    })
  );
};

// Factory para criar totais mensais
export const createMonthlyTotals = (overrides: Partial<MonthlyTotals> = {}): MonthlyTotals => ({
  totalGross: 10950,
  totalNet: 9450,
  totalEmployees: 3,
  totalOvertime: 1350,
  totalSubsidies: 600,
  totalDeductions: 1500,
  ...overrides,
});

// Factory para criar resultado de cálculo de payroll
export const createPayrollCalculationResult = (
  overrides: Partial<PayrollCalculationResult> = {}
): PayrollCalculationResult => ({
  success: true,
  data: {
    totals: createMonthlyTotals(),
    items: createPayslipList(),
  },
  ...overrides,
});

// Factory para criar resultado de erro
export const createPayrollErrorResult = (errorMessage: string = 'Erro no cálculo'): PayrollCalculationResult => ({
  success: false,
  error: errorMessage,
});

// Factory para dados de contrato
export interface ContractData {
  id: string;
  company_name: string;
  employee_name: string;
  position: string;
  salary: number;
  start_date: string;
  end_date?: string;
  is_active: boolean;
}

export const createContractData = (overrides: Partial<ContractData> = {}): ContractData => ({
  id: `contract-${Math.random().toString(36).substr(2, 9)}`,
  company_name: 'Empresa Teste Lda',
  employee_name: 'João Silva',
  position: 'Desenvolvedor',
  salary: 3000,
  start_date: '2024-01-01',
  is_active: true,
  ...overrides,
});

// Factory para dados de utilizador
export interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
}

export const createUserData = (overrides: Partial<UserData> = {}): UserData => ({
  id: `user-${Math.random().toString(36).substr(2, 9)}`,
  email: 'test@example.com',
  name: 'Utilizador Teste',
  role: 'admin',
  ...overrides,
});

// Factory para dados de subsídio
export interface SubsidyData {
  id: string;
  name: string;
  amount: number;
  type: 'fixed' | 'percentage';
  is_active: boolean;
}

export const createSubsidyData = (overrides: Partial<SubsidyData> = {}): SubsidyData => ({
  id: `subsidy-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Subsídio de Alimentação',
  amount: 200,
  type: 'fixed',
  is_active: true,
  ...overrides,
});

// Utility para resetar todos os mocks
export const resetAllMocks = () => {
  vi.clearAllMocks();
};

// Utility para criar delay em testes
export const createDelay = (ms: number = 100) => 
  new Promise(resolve => setTimeout(resolve, ms));

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock calculatePayroll function
export const mockCalculatePayroll = vi.fn().mockReturnValue(createPayrollCalculationResult());

// Mock do calculatePayroll service
export const createMockCalculatePayroll = () => 
  vi.fn().mockResolvedValue(createPayrollCalculationResult());

// Mock do payrollService com factories (definido no final para evitar problemas de hoisting)
export const createMockPayrollService = () => ({
  recalculatePayroll: vi.fn().mockResolvedValue(createPayrollCalculationResult()),
  getActiveContract: vi.fn().mockResolvedValue(createContractData()),
  getPayrollConfigurationStatus: vi.fn().mockResolvedValue({ isComplete: true }),
  getPayrollSummary: vi.fn().mockResolvedValue(createPayrollCalculationResult()),
  exportPayroll: vi.fn().mockResolvedValue({ success: true }),
  validatePayrollData: vi.fn().mockResolvedValue({ valid: true }),
});