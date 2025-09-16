/**
 * Data Factories - Geração de dados de teste consistentes
 * Criado como parte da nova estratégia de testes simplificada
 */

import { vi } from 'vitest';

// Tipos base para os dados de teste
export interface TestUser {
  id: string;
  email: string;
  user_metadata: {
    name: string;
    role?: string;
  };
}

export interface TestContract {
  id: string;
  user_id: string;
  name: string;
  hourly_rate: number;
  weekly_hours: number;
  start_date: string;
  end_date?: string;
  status: 'active' | 'inactive';
}

export interface TestTimesheetEntry {
  id: string;
  user_id: string;
  contract_id: string;
  date: string;
  hours_worked: number;
  overtime_hours?: number;
  description?: string;
}

export interface TestPayrollData {
  id: string;
  user_id: string;
  contract_id: string;
  period_start: string;
  period_end: string;
  regular_hours: number;
  overtime_hours: number;
  regular_pay: number;
  overtime_pay: number;
  total_pay: number;
  netSalary?: number;
  grossSalary?: number;
  warnings?: string[];
  status?: 'draft' | 'approved' | 'paid';
}

export interface TestOvertimePolicy {
  id: string;
  name: string;
  threshold_hours: number;
  multiplier: number;
  is_active: boolean;
}

// Factory para utilizadores
export const createTestUser = (overrides: Partial<TestUser> = {}): TestUser => ({
  id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  email: 'test@example.com',
  user_metadata: {
    name: 'Test User',
    role: 'employee'
  },
  ...overrides
});

// Factory para contratos
export const createTestContract = (overrides: Partial<TestContract> = {}): TestContract => ({
  id: `contract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  user_id: 'test-user-id',
  name: 'Test Contract',
  hourly_rate: 15.0,
  weekly_hours: 40,
  start_date: '2024-01-01',
  status: 'active',
  ...overrides
});

// Factory para entradas de timesheet
export const createTestTimesheetEntry = (overrides: Partial<TestTimesheetEntry> = {}): TestTimesheetEntry => ({
  id: `timesheet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  user_id: 'test-user-id',
  contract_id: 'test-contract-id',
  date: '2024-01-15',
  hours_worked: 8,
  overtime_hours: 0,
  description: 'Test work',
  ...overrides
});

// Factory para dados de payroll
export const createTestPayrollData = (overrides: Partial<TestPayrollData> = {}): TestPayrollData => ({
  id: `payroll-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  user_id: 'test-user-id',
  contract_id: 'test-contract-id',
  period_start: '2024-01-01',
  period_end: '2024-01-31',
  regular_hours: 160,
  overtime_hours: 10,
  regular_pay: 2400.0,
  overtime_pay: 225.0,
  total_pay: 2625.0,
  netSalary: 2625.0,
  grossSalary: 2625.0,
  warnings: [],
  status: 'draft',
  ...overrides
});

// Factory para políticas de horas extras
export const createTestOvertimePolicy = (overrides: Partial<TestOvertimePolicy> = {}): TestOvertimePolicy => ({
  id: `policy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Standard Overtime Policy',
  threshold_hours: 40,
  multiplier: 1.5,
  is_active: true,
  ...overrides
});

// Builder pattern para cenários complexos
export class PayrollScenarioBuilder {
  private user: TestUser;
  private contract: TestContract;
  private timesheetEntries: TestTimesheetEntry[] = [];
  private overtimePolicy: TestOvertimePolicy;

  constructor() {
    this.user = createTestUser();
    this.contract = createTestContract({ user_id: this.user.id });
    this.overtimePolicy = createTestOvertimePolicy();
  }

  withUser(userOverrides: Partial<TestUser>) {
    this.user = { ...this.user, ...userOverrides };
    return this;
  }

  withContract(contractOverrides: Partial<TestContract>) {
    this.contract = { ...this.contract, user_id: this.user.id, ...contractOverrides };
    return this;
  }

  withOvertimePolicy(policyOverrides: Partial<TestOvertimePolicy>) {
    this.overtimePolicy = { ...this.overtimePolicy, ...policyOverrides };
    return this;
  }

  addTimesheetEntry(entryOverrides: Partial<TestTimesheetEntry> = {}) {
    const entry = createTestTimesheetEntry({
      user_id: this.user.id,
      contract_id: this.contract.id,
      ...entryOverrides
    });
    this.timesheetEntries.push(entry);
    return this;
  }

  addWeekOfWork(startDate: string, hoursPerDay: number[] = [8, 8, 8, 8, 8]) {
    const start = new Date(startDate);
    hoursPerDay.forEach((hours, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      this.addTimesheetEntry({
        date: date.toISOString().split('T')[0],
        hours_worked: hours
      });
    });
    return this;
  }

  addOvertimeWeek(startDate: string, regularHours: number = 40, overtimeHours: number = 10) {
    const start = new Date(startDate);
    const dailyRegular = regularHours / 5;
    const dailyOvertime = overtimeHours / 5;
    
    for (let i = 0; i < 5; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      this.addTimesheetEntry({
        date: date.toISOString().split('T')[0],
        hours_worked: dailyRegular + dailyOvertime,
        overtime_hours: dailyOvertime
      });
    }
    return this;
  }

  build() {
    return {
      user: this.user,
      contract: this.contract,
      timesheetEntries: this.timesheetEntries,
      overtimePolicy: this.overtimePolicy,
      payrollData: createTestPayrollData({
        user_id: this.user.id,
        contract_id: this.contract.id
      })
    };
  }
}

// Cenários pré-definidos comuns
export const createBasicPayrollScenario = () => {
  return new PayrollScenarioBuilder()
    .withContract({ hourly_rate: 20, weekly_hours: 40 })
    .addWeekOfWork('2024-01-15')
    .build();
};

export const createOvertimePayrollScenario = () => {
  return new PayrollScenarioBuilder()
    .withContract({ hourly_rate: 20, weekly_hours: 40 })
    .withOvertimePolicy({ threshold_hours: 40, multiplier: 1.5 })
    .addOvertimeWeek('2024-01-15', 40, 10)
    .build();
};

export const createMultiWeekPayrollScenario = () => {
  const builder = new PayrollScenarioBuilder()
    .withContract({ hourly_rate: 25, weekly_hours: 40 });
  
  // Adicionar 4 semanas de trabalho
  for (let week = 0; week < 4; week++) {
    const startDate = new Date('2024-01-01');
    startDate.setDate(startDate.getDate() + (week * 7));
    builder.addWeekOfWork(startDate.toISOString().split('T')[0]);
  }
  
  return builder.build();
};

// Mock responses para serviços
export const createMockServiceResponses = () => ({
  payrollService: {
    calculatePayroll: vi.fn().mockResolvedValue(createTestPayrollData()),
    getPayrollHistory: vi.fn().mockResolvedValue([createTestPayrollData()]),
    savePayroll: vi.fn().mockResolvedValue({ success: true })
  },
  
  timesheetService: {
    getTimesheetEntries: vi.fn().mockResolvedValue([createTestTimesheetEntry()]),
    saveTimesheetEntry: vi.fn().mockResolvedValue({ success: true }),
    deleteTimesheetEntry: vi.fn().mockResolvedValue({ success: true })
  },
  
  contractService: {
    getActiveContracts: vi.fn().mockResolvedValue([createTestContract()]),
    getContractById: vi.fn().mockResolvedValue(createTestContract()),
    saveContract: vi.fn().mockResolvedValue({ success: true })
  },
  
  overtimeService: {
    getOvertimePolicy: vi.fn().mockResolvedValue(createTestOvertimePolicy()),
    calculateOvertime: vi.fn().mockResolvedValue({ overtime_hours: 10, overtime_pay: 300 }),
    saveOvertimePolicy: vi.fn().mockResolvedValue({ success: true })
  }
});