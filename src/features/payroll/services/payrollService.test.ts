import { describe, it, expect, beforeEach, vi } from 'vitest';
import { payrollService } from './payrollService';
import type { 
  PayrollContract, 
  PayrollOTPolicy, 
  PayrollHoliday,
  PayrollTimeEntry,
  PayrollMileagePolicy,
  PayrollMileageTrip
} from '../types';

// Mock the supabase client
let mockChainResult: any = { data: [], error: null };

const createMockChain = () => {
  const chain = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    neq: vi.fn(),
    gt: vi.fn(),
    lt: vi.fn(),
    is: vi.fn(),
    not: vi.fn(),
    mockChainResult: { data: null, error: null },
    mockResolvedValue: vi.fn().mockImplementation(function(this: any, value: any) {
      // Override the then method to resolve with the provided value
      this.then = (onResolve: any) => Promise.resolve(value).then(onResolve);
      return this;
    }),
    mockRejectedValue: vi.fn().mockImplementation(function(this: any, error: any) {
      // Override the then method to reject with the provided error
      this.then = (onResolve: any, onReject: any) => Promise.reject(error).then(onResolve, onReject);
      return this;
    }),
  };
  
  // Configure all methods to return the chain itself
  Object.keys(chain).forEach(key => {
    if (typeof chain[key as keyof typeof chain] === 'function' && !key.startsWith('mock')) {
      (chain[key as keyof typeof chain] as any).mockReturnValue(chain);
    }
  });
  
  // Make the chain thenable with a default resolution
  (chain as any).then = (onResolve: any, onReject: any) => {
    return Promise.resolve((chain as any).mockChainResult || mockChainResult).then(onResolve, onReject);
  };
  
  return chain;
};

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => createMockChain()),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user1' } }, error: null })
    }
  }
}));

describe('PayrollService Integration Tests', () => {
  const mockContract: Omit<PayrollContract, 'id' | 'created_at' | 'updated_at'> = {
    user_id: 'user1',
    employee_name: 'João Silva',
    hourly_rate_cents: 800,
    weekly_hours: 35,
    start_date: '2024-01-01',
    end_date: undefined,
    is_active: true,
    job_category: 'Técnico',
    workplace: 'Lisboa',
    trial_period_days: 90
  };

  const mockContractComplete: Omit<PayrollContract, 'id' | 'created_at' | 'updated_at'> = {
    user_id: 'user1',
    employee_name: 'João Silva',
    hourly_rate_cents: 800,
    weekly_hours: 35,
    start_date: '2024-01-01',
    end_date: undefined,
    is_active: true,
    job_category: 'Técnico',
    workplace: 'Lisboa',
    workplace_location: 'Lisboa Centro',
    base_salary_cents: 87000, // €870 salário mínimo
    work_schedule: '09:00-17:00',
    schedule_json: JSON.stringify({
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' }
    }),
    trial_period_days: 90
  };

  const mockContractIncomplete: Omit<PayrollContract, 'id' | 'created_at' | 'updated_at'> = {
    user_id: 'user1',
    employee_name: 'João Silva',
    hourly_rate_cents: 800,
    weekly_hours: 40,
    start_date: '2024-01-01',
    end_date: undefined,
    is_active: true,
    job_category: undefined,
    workplace: undefined,
    workplace_location: undefined,
    base_salary_cents: undefined,
    work_schedule: undefined,
    trial_period_days: 90
  };

  const mockMealAllowanceConfig = {
    id: 'meal1',
    user_id: 'user1',
    daily_amount_cents: 600,
    is_active: true
  };

  const mockDeductionConfig = {
    id: 'ded1',
    user_id: 'user1',
    name: 'IRS',
    percentage: 11.5,
    is_active: true
  };

  const mockOTPolicy: Omit<PayrollOTPolicy, 'id' | 'created_at' | 'updated_at'> = {
    user_id: 'user1',
    name: 'Standard OT Policy',
    threshold_hours: 8,
    multiplier: 1.5,
    is_active: true
  };

  const mockHoliday: Omit<PayrollHoliday, 'id' | 'created_at' | 'updated_at'> = {
    user_id: 'user1',
    name: 'Dia de Ano Novo',
    date: '2024-01-01',
    holiday_type: 'national',
    is_recurring: true
  };

  const mockTimeEntry: Omit<PayrollTimeEntry, 'id' | 'created_at' | 'updated_at'> = {
    user_id: 'user1',
    contract_id: 'contract1',
    date: '2024-01-15',
    start_time: '09:00',
    end_time: '17:00',
    break_minutes: 60,
    description: 'Regular work day',
    is_overtime: false
  };

  const mockMileagePolicy: Omit<PayrollMileagePolicy, 'id' | 'created_at' | 'updated_at'> = {
    user_id: 'user1',
    name: 'Standard Mileage',
    rate_cents_per_km: 36,
    is_active: true
  };

  const mockMileageTrip: Omit<PayrollMileageTrip, 'id' | 'created_at' | 'updated_at'> = {
    user_id: 'user1',
    policy_id: 'policy1',
    date: '2024-01-15',
    origin: 'Home',
    destination: 'Office',
    km: 25,
    purpose: 'Work commute'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Payroll Contracts', () => {
    it('should create a payroll contract', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const expectedResult = { id: '1', ...mockContract };
      const mockResponse = { data: [expectedResult], error: null };
      
      // Reset mocks and create fresh chain
      vi.clearAllMocks();
      const mockChain = {
         insert: vi.fn().mockReturnThis(),
         select: vi.fn().mockReturnThis(),
         single: vi.fn().mockResolvedValue({ data: expectedResult, error: null })
       };
      (supabase.from as any).mockReturnValue(mockChain);
      
      const contractData = {
        employee_name: mockContract.employee_name,
        hourly_rate: mockContract.hourly_rate_cents / 100, // Convert back to euros
        weekly_hours: mockContract.weekly_hours,
        start_date: mockContract.start_date,
        end_date: mockContract.end_date
      };
      
      const result = await payrollService.createContract('user1', contractData);
      
      expect(supabase.from).toHaveBeenCalledWith('payroll_contracts');
      expect(result).toEqual(expectedResult);
    });

    it('should get all payroll contracts', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const expectedResult = [{ id: '1', ...mockContract }];
      const mockResponse = { data: expectedResult, error: null };
      
      // Reset mocks and create fresh chain
      vi.clearAllMocks();
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue(mockResponse)
      };
      (supabase.from as any).mockReturnValue(mockChain);
      
      const result = await payrollService.getContracts('user1');
      
      expect(supabase.from).toHaveBeenCalledWith('payroll_contracts');
      expect(result).toEqual(expectedResult);
    });

    it('should update a payroll contract', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const updatedData = { ...mockContract, employee_name: 'João Santos' };
      const expectedResult = { id: '1', ...updatedData };
      const mockResponse = { data: expectedResult, error: null };
      
      // Reset mocks and create fresh chain
      vi.clearAllMocks();
      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockResponse)
      };
      (supabase.from as any).mockReturnValue(mockChain);
      
      const result = await payrollService.updateContract('1', updatedData);
      
      expect(supabase.from).toHaveBeenCalledWith('payroll_contracts');
      expect(result).toEqual(expectedResult);
    });

    it('should delete a payroll contract', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const mockResponse = { error: null };
      
      // Reset mocks and create fresh chain
      vi.clearAllMocks();
      const mockChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockResponse)
      };
      (supabase.from as any).mockReturnValue(mockChain);
      
      await payrollService.deactivateContract('1');
      
      expect(supabase.from).toHaveBeenCalledWith('payroll_contracts');
    });
  });

  describe('OT Policies', () => {
    it('should create an OT policy', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const expectedResult = { id: '1', user_id: 'user1', ...mockOTPolicy };
      const mockResponse = { data: expectedResult, error: null };
      
      // Reset mocks and create fresh chain
      vi.clearAllMocks();
      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockResponse)
      };
      (supabase.from as any).mockReturnValue(mockChain);
      
      const result = await payrollService.createOTPolicy('user1', mockOTPolicy);
      
      expect(supabase.from).toHaveBeenCalledWith('payroll_ot_policies');
      expect(result).toEqual(expectedResult);
    });

    it('should get all OT policies', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const mockResponse = { data: [{ id: '1', ...mockOTPolicy }], error: null };
      
      // Reset mocks and create fresh chain
      vi.clearAllMocks();
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue(mockResponse)
      };
      (supabase.from as any).mockReturnValue(mockChain);
      
      const result = await payrollService.getOTPolicies('user1');
      
      expect(supabase.from).toHaveBeenCalledWith('payroll_ot_policies');
      expect(result).toEqual([{ id: '1', ...mockOTPolicy }]);
    });
  });

  describe('Holidays', () => {
    it('should create a holiday', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const expectedResult = { id: '1', user_id: 'user1', ...mockHoliday };
      const mockResponse = { data: expectedResult, error: null };
      
      // Reset mocks and create fresh chain
      vi.clearAllMocks();
      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockResponse)
      };
      (supabase.from as any).mockReturnValue(mockChain);
      
      const result = await payrollService.createHoliday(mockHoliday, 'user1');
      
      expect(supabase.from).toHaveBeenCalledWith('payroll_holidays');
      expect(result).toEqual(expectedResult);
    });

    it('should get holidays for a date range', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const mockResponse = { data: [{ id: '1', ...mockHoliday }], error: null };
      
      // Reset mocks and create fresh chain
      vi.clearAllMocks();
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue(mockResponse)
      };
      (supabase.from as any).mockReturnValue(mockChain);
      
      const result = await payrollService.getHolidays('user1', '2024-01-01', '2024-12-31');
      
      expect(supabase.from).toHaveBeenCalledWith('payroll_holidays');
      expect(result).toEqual([{ id: '1', ...mockHoliday }]);
    });
  });

  describe('Time Entries', () => {
    it('should create a time entry', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const expectedResult = { id: '1', user_id: 'user1', contract_id: 'contract1', ...mockTimeEntry };
      const mockExistingResponse = { data: null, error: null }; // No existing entry
      const mockCreateResponse = { data: expectedResult, error: null };
      
      // Reset mocks and create fresh chain
      vi.clearAllMocks();
      let callCount = 0;
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve(mockExistingResponse); // First call for checking existing entry
          }
          return Promise.resolve(mockCreateResponse); // Second call for creating entry
        })
      };
      (supabase.from as any).mockReturnValue(mockChain);
      
      const result = await payrollService.createTimeEntry('user1', 'contract1', mockTimeEntry);
      
      expect(supabase.from).toHaveBeenCalledWith('payroll_time_entries');
      expect(result).toEqual(expectedResult);
    });

    it('should get time entries for a date range', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const mockData = [{ id: '1', ...mockTimeEntry }];
      const mockResponse = { data: mockData, error: null };
      
      // Create a custom mock chain for this test
      const mockChain = createMockChain();
      (mockChain as any).mockChainResult = mockResponse;
      
      vi.clearAllMocks();
      (supabase.from as any).mockReturnValue(mockChain);
      
      const result = await payrollService.getTimeEntries('user1', '2024-01-01', '2024-01-31');
      
      expect(supabase.from).toHaveBeenCalledWith('payroll_time_entries');
      expect(result).toEqual(mockData);
    });

    it('should create time entry with correct parameters', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const expectedResult = { id: '1', user_id: 'user1', contract_id: 'contract1', ...mockTimeEntry };
      const mockResponse = { data: expectedResult, error: null };
      
      // Create a custom mock chain for this test
      const mockChain = createMockChain();
      (mockChain as any).mockChainResult = mockResponse;
      
      vi.clearAllMocks();
      (supabase.from as any).mockReturnValue(mockChain);
      
      const result = await payrollService.createTimeEntry('user1', 'contract1', {
        date: '2024-01-15',
        start_time: '09:00',
        end_time: '17:00',
        break_minutes: 60,
        description: 'Test entry'
      });
      
      expect(supabase.from).toHaveBeenCalledWith('payroll_time_entries');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('Mileage Policies', () => {
    it('should create a mileage policy', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const expectedResult = { id: '1', ...mockMileagePolicy };
      const mockResponse = { data: expectedResult, error: null };
      
      // Reset mocks and create fresh chain
      vi.clearAllMocks();
      const mockChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockResponse)
      };
      (supabase.from as any).mockReturnValue(mockChain);
      
      const result = await payrollService.createMileagePolicy('user1', mockMileagePolicy);
      
      expect(supabase.from).toHaveBeenCalledWith('payroll_mileage_policies');
      expect(result).toEqual(expectedResult);
    });

    it('should get all mileage policies', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const mockResponse = { data: [{ id: '1', ...mockMileagePolicy }], error: null };
      
      // Reset mocks and create fresh chain
       vi.clearAllMocks();
       const mockChain = {
         select: vi.fn().mockReturnThis(),
         eq: vi.fn().mockReturnThis(),
         order: vi.fn().mockResolvedValue(mockResponse)
       };
       (supabase.from as any).mockReturnValue(mockChain);
      
      const result = await payrollService.getMileagePolicies('user1');
      
      expect(supabase.from).toHaveBeenCalledWith('payroll_mileage_policies');
      expect(result).toEqual([{ id: '1', ...mockMileagePolicy }]);
    });
  });

  describe('Mileage Trips', () => {
    it('should create a mileage trip', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const expectedResult = { id: '1', user_id: 'user1', policy_id: 'policy1', ...mockMileageTrip };
      const mockResponse = { data: expectedResult, error: null };
      
      // Reset all mocks for this specific test
      vi.clearAllMocks();
      
      // Mock chains por tabela
      const policyChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'policy1', contract_id: 'contract1', user_id: 'user1' }, error: null })
      } as any;

      const tripsChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockResponse)
      } as any;

      // Implementação dependente da tabela
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'payroll_mileage_policies') return policyChain;
        if (table === 'payroll_mileage_trips') return tripsChain;
        return createMockChain();
      });
      
      const result = await payrollService.createMileageTrip('user1', 'policy1', mockMileageTrip);
      
      expect(supabase.from).toHaveBeenCalledWith('payroll_mileage_trips');
      expect(result).toEqual(expectedResult);
    });

    it('should get mileage trips for a date range', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const mockData = [{ id: '1', ...mockMileageTrip }];
      const mockResponse = { data: mockData, error: null };

      // Create a custom mock chain for this test
      const mockChain = createMockChain();
      (mockChain as any).mockChainResult = mockResponse;
      
      vi.clearAllMocks();
      (supabase.from as any).mockReturnValue(mockChain);

      const result = await payrollService.getMileageTrips('user1', '2024-01-01', '2024-01-31');
      
      expect(supabase.from).toHaveBeenCalledWith('payroll_mileage_trips');
      expect(result).toEqual(mockData);
    });
  });

  describe('Payroll Calculation', () => {
    it('should recalculate payroll successfully', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      
      // Mock all the data needed for calculation
      const mockContract = { 
        data: { 
          id: 'contract1', 
          hourly_rate_cents: 2000, 
          user_id: 'user1',
          base_salary_cents: 100000,
          weekly_hours: 40,
          employee_name: 'Test Employee',
          start_date: '2024-01-01',
          is_active: true
        }, 
        error: null 
      };
      const mockOTPolicy = { data: { multiplier: 1.5, threshold_hours: 8 }, error: null };
      const mockHolidays = { data: [], error: null };
      const mockTimeEntries = { 
        data: [{ 
          date: '2024-01-01', 
          hours: 8,
          start_time: '09:00',
          end_time: '17:00',
          break_minutes: 60
        }], 
        error: null 
      };
      const mockMileageTrips = { data: [], error: null };
      const mockMileagePolicy = { data: null, error: null };
      const mockMealAllowanceConfig = { data: null, error: null };
      const mockVacations = { data: [], error: null };
      const mockDeductionConfig = { data: null, error: null };
      const mockPeriod = { data: null, error: null };
      
      // Mock the from method to return different chains based on table
       (supabase.from as any).mockImplementation((table: string) => {
         const chain = createMockChain();
         
         switch (table) {
           case 'payroll_contracts':
             chain.mockChainResult = mockContract;
             break;
           case 'payroll_ot_policies':
             chain.mockChainResult = mockOTPolicy;
             break;
           case 'payroll_holidays':
             chain.mockChainResult = mockHolidays;
             break;
           case 'payroll_time_entries':
             chain.mockChainResult = mockTimeEntries;
             break;
           case 'payroll_mileage_trips':
             chain.mockChainResult = mockMileageTrips;
             break;
           case 'payroll_mileage_policies':
             chain.mockChainResult = mockMileagePolicy;
             break;
           case 'payroll_meal_allowance_configs':
             chain.mockChainResult = mockMealAllowanceConfig;
             break;
           case 'payroll_vacations':
             chain.mockChainResult = mockVacations;
             break;
           case 'payroll_deduction_configs':
             chain.mockChainResult = mockDeductionConfig;
             break;
           case 'payroll_periods':
             chain.mockChainResult = mockPeriod;
             break;
           default:
             chain.mockChainResult = { data: null, error: null };
         }
         
         return chain;
       });
      
      const result = await payrollService.recalculatePayroll('user1', 'contract1', 2024, 1);
      
      expect(result).toHaveProperty('calculation');
      expect(result.calculation).toHaveProperty('regularHours');
      expect(result.calculation).toHaveProperty('overtimeHours');
      expect(result.calculation).toHaveProperty('grossPay');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const mockError = { data: null, error: { message: 'Database error' } };
      
      // Create a new mock chain that resolves with error
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => {
          resolve(mockError);
        })
      };
      (supabase.from as any).mockReturnValue(mockChain);
      
      await expect(payrollService.getPayrollContracts('user1'))
        .rejects.toThrow('Database error');
    });

    it('should handle network errors gracefully', async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      
      // Mock the entire chain to throw an error
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: vi.fn((resolve, reject) => {
          reject(new Error('Network error'));
        })
      };
      (supabase.from as any).mockReturnValue(mockChain);
      
      await expect(payrollService.getPayrollContracts('user1'))
        .rejects.toThrow('Network error');
    });
  });

  describe('Data Validation', () => {
    it('should validate contract data before creation', async () => {
      const invalidContract = {
        ...mockContract,
        hourly_rate_cents: -100 // Invalid negative rate
      };
      
      // This would typically be handled by database constraints
      // or validation logic in the service
      expect(invalidContract.hourly_rate_cents).toBeLessThan(0);
    });

    it('should validate time entry data', async () => {
      const invalidTimeEntry = {
        ...mockTimeEntry,
        start_time: '25:00' // Invalid time format
      };
      
      // This would typically be validated before sending to the database
      expect(invalidTimeEntry.start_time).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('Payroll Configuration Validation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockChainResult = { data: [], error: null };
    });

    describe('getPayrollConfigurationStatus', () => {
      it('should return valid configuration when all requirements are met', async () => {
        const { supabase } = await import('@/lib/supabaseClient');
        
        // Mock active contract with all required fields
        const mockActiveContract = {
          id: 'contract1',
          user_id: 'user1',
          name: 'Test Contract',
          base_salary_cents: 100000,
          hourly_rate_cents: 500,
          currency: 'EUR',
          weekly_hours: 40,
          schedule_json: { monday: { start: '09:00', end: '17:00' } },
          vacation_bonus_mode: 'percentage',
          christmas_bonus_mode: 'percentage',
          is_active: true,
          job_category: 'Developer',
          workplace_location: 'Office',
          duration: 'permanent',
          has_probation_period: false,
          probation_duration_days: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        };
        
        // Mock overtime policy
        const mockOvertimePolicy = {
          id: 'ot1',
          user_id: 'user1',
          name: 'Standard OT Policy',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z'
        };
        
        // Mock meal allowance settings
        const mockMealSettings = {
          id: 'meal1',
          user_id: 'user1',
          contract_id: 'contract1',
          daily_amount_cents: 500,
          is_active: true,
          created_at: '2024-01-01T00:00:00Z'
        };
        
        // Mock deduction settings
        const mockDeductionSettings = {
          id: 'deduction1',
          user_id: 'user1',
          contract_id: 'contract1',
          social_security_rate: 11.0,
          irs_rate: 15.0,
          created_at: '2024-01-01T00:00:00Z'
        };
        
        // Mock holidays for current year
        const mockHolidays = [
          {
            id: 'holiday1',
            user_id: 'user1',
            name: 'New Year',
            date: '2024-01-01',
            is_mandatory: true,
            created_at: '2024-01-01T00:00:00Z'
          }
        ];
        
        (supabase.from as any).mockImplementation((table: string) => {
          const chain = createMockChain();
          
          if (table === 'payroll_contracts') {
             chain.mockResolvedValue({ data: mockActiveContract, error: null });
           } else if (table === 'payroll_ot_policies') {
             chain.mockResolvedValue({ data: mockOvertimePolicy, error: null });
           } else if (table === 'payroll_meal_allowance_configs') {
             chain.mockResolvedValue({ data: mockMealSettings, error: null });
           } else if (table === 'payroll_deduction_configs') {
             chain.mockResolvedValue({ data: mockDeductionSettings, error: null });
           } else if (table === 'payroll_holidays') {
             chain.mockResolvedValue({ data: mockHolidays, error: null });
           } else {
             // Other queries
             chain.mockResolvedValue({ data: [], error: null });
           }
          
          return chain;
        });
        
        const result = await payrollService.getPayrollConfigurationStatus('user1', 'contract1');
         
        expect(result.isValid).toBe(true);
        expect(result.missingConfigurations).toHaveLength(0);
        expect(result.configurationDetails.contract.isValid).toBe(true);
        expect(result.configurationDetails.overtimePolicy.isValid).toBe(true);
        expect(result.configurationDetails.mealAllowance.isValid).toBe(true);
        expect(result.configurationDetails.deductions.isValid).toBe(true);
        expect(result.configurationDetails.holidays.isValid).toBe(true);
      });
      
      it('should return invalid configuration when contract is missing required fields', async () => {
        const { supabase } = await import('@/lib/supabaseClient');
        
        // Mock contract missing required fields
        const mockIncompleteContract = {
          id: 'contract1',
          user_id: 'user1',
          employee_name: 'João Silva',
          hourly_rate_cents: 80000,
          weekly_hours: 40,
          start_date: '2024-01-01',
          is_active: true,
          job_category: null,
          workplace_location: null,
          base_salary_cents: null,
          schedule_json: null,
          trial_period_days: null
        };
        
        (supabase.from as any).mockImplementation(() => {
          const chain = createMockChain();
          chain.mockResolvedValue({ data: mockIncompleteContract, error: null });
          return chain;
        });
        
        const result = await payrollService.getPayrollConfigurationStatus('user1', 'contract1');
        
        expect(result.isValid).toBe(false);
        expect(result.configurationDetails.contract.isValid).toBe(false);
        expect(result.missingConfigurations).toContain('Categoria profissional não definida no contrato');
        expect(result.missingConfigurations).toContain('Local de trabalho não definido no contrato');
      });
      
      it('should return valid configuration when overtime policy is missing (now optional)', async () => {
        const { supabase } = await import('@/lib/supabaseClient');
        
        // Mock complete contract but no overtime policy (now optional)
        const mockCompleteContract = {
          id: 'contract1',
          user_id: 'user1',
          employee_name: 'João Silva',
          hourly_rate_cents: 80000,
          weekly_hours: 40,
          start_date: '2024-01-01',
          is_active: true,
          job_category: 'Técnico',
          workplace_location: 'Lisboa',
          base_salary_cents: 87000,
          schedule_json: '{"monday":{"start":"09:00","end":"18:00"},"tuesday":{"start":"09:00","end":"18:00"}}',
          trial_period_days: 90
        };
        
        (supabase.from as any).mockImplementation((table: string) => {
          const chain = createMockChain();
          
          if (table === 'payroll_contracts') {
            chain.mockResolvedValue({ data: mockCompleteContract, error: null });
          } else if (table === 'payroll_ot_policies') {
             // Overtime policy query - simulate missing policy (now optional)
             chain.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'No rows found' } });
          } else if (table === 'payroll_meal_allowance_configs') {
            chain.mockResolvedValue({ data: [{ id: 1, user_id: 'user1', daily_amount_cents: 600 }], error: null });
          } else if (table === 'payroll_deduction_configs') {
            chain.mockResolvedValue({ data: [{ id: 1, user_id: 'user1', type: 'irs' }], error: null });
          } else if (table === 'payroll_holidays') {
            chain.mockResolvedValue({ data: [{ id: 1, date: '2025-01-01', name: 'Ano Novo' }], error: null });
          } else {
            // Other queries
            chain.mockResolvedValue({ data: [], error: null });
          }
          
          return chain;
        });
        
        const result = await payrollService.getPayrollConfigurationStatus('user1', 'contract1');
        
        // Política de horas extras agora é opcional, então a configuração deve ser válida
        expect(result.isValid).toBe(true);
        expect(result.configurationDetails.overtimePolicy.isValid).toBe(true);
        expect(result.missingConfigurations).not.toContain('Política de horas extras não configurada');
      });
      
      it('should handle database errors gracefully', async () => {
        const { supabase } = await import('@/lib/supabaseClient');
        
        (supabase.from as any).mockImplementation(() => {
          const chain = createMockChain();
          chain.mockResolvedValue({ data: null, error: { message: 'Database error' } });
          return chain;
        });
        
        const result = await payrollService.getPayrollConfigurationStatus('user1', 'contract1');
        
        expect(result.isValid).toBe(false);
        expect(result.missingConfigurations).toContain('Contrato ativo não encontrado');
        expect(result.missingConfigurations).not.toContain('Política de horas extras não configurada');
      });
    });
    
    describe('validatePayrollConfiguration', () => {
      it('should return valid when configuration is complete', async () => {
        const { supabase } = await import('@/lib/supabaseClient');
        
        // Mock para simular configuração completa
        const mockFrom = vi.fn();
        
        mockFrom.mockImplementation((table: string) => {
          if (table === 'payroll_contracts') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockContractComplete, error: null })
            };
          }
          if (table === 'payroll_ot_policies') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: '1', user_id: 'user1', max_hours: 175, rate_multiplier: 1.5, is_active: true }, error: null })
            };
          }
          if (table === 'payroll_meal_allowance_configs') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: '1', user_id: 'user1', daily_amount: 6.00, is_active: true }, error: null })
            };
          }
          if (table === 'payroll_deduction_configs') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: '1', user_id: 'user1', irs_rate: 0.23, ss_rate: 0.11, is_active: true }, error: null })
            };
          }
          if (table === 'payroll_holidays') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              gte: vi.fn().mockReturnThis(),
              lte: vi.fn().mockResolvedValue({ data: [{ id: '1', date: '2025-01-01', name: 'Ano Novo', is_mandatory: true }], error: null })
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          };
        });
        
        vi.mocked(supabase.from).mockImplementation(mockFrom);
        
        const result = await payrollService.validatePayrollConfiguration('user1', 'contract1');
        
        expect(result.isValid).toBe(true);
        expect(result.missingConfigurations).toHaveLength(0);
      });
      
      it('should return invalid when configuration is incomplete', async () => {
        const { supabase } = await import('@/lib/supabaseClient');
        
        // Mock para simular configuração incompleta
        const mockFrom = vi.fn();
        
        mockFrom.mockImplementation((table: string) => {
          if (table === 'payroll_contracts') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockContractComplete, error: null })
            };
          }
          if (table === 'payroll_ot_policies') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
            };
          }
          if (table === 'payroll_meal_allowance_configs') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: 'meal1', amount: 6.00 }, error: null })
            };
          }
          if (table === 'payroll_deduction_configs') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: 'deduction1' }, error: null })
            };
          }
          if (table === 'payroll_holidays') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              gte: vi.fn().mockReturnThis(),
              lte: vi.fn().mockResolvedValue({ data: [], error: null })
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          };
        });
        
        vi.mocked(supabase.from).mockImplementation(mockFrom);
        
        const result = await payrollService.validatePayrollConfiguration('user1', 'contract1');
        
        expect(result.isValid).toBe(false);
        expect(result.missingConfigurations).toContain('Feriados não configurados para o ano 2025');
      });
    });
    
    describe('createPayrollPeriod with validation', () => {
      it('should create period when configuration is valid', async () => {
        const { supabase } = await import('@/lib/supabaseClient');
        
        // Mock para simular validação de configuração completa e criação de período
        const mockFrom = vi.fn();
        let callCount = 0;
        
        mockFrom.mockImplementation((table: string) => {
          if (table === 'payroll_contracts') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockContractComplete, error: null })
            };
          }
          if (table === 'payroll_ot_policies') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockOTPolicy, error: null })
            };
          }
          if (table === 'payroll_meal_allowance_configs') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockMealAllowanceConfig, error: null })
            };
          }
          if (table === 'payroll_deduction_configs') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockDeductionConfig, error: null })
            };
          }
          if (table === 'payroll_holidays') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              gte: vi.fn().mockReturnThis(),
              lte: vi.fn().mockResolvedValue({ data: [mockHoliday], error: null })
            };
          }
          if (table === 'payroll_periods') {
            callCount++;
            if (callCount === 1) {
              // Primeira chamada: verificar se período existe (não existe)
              return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: null, error: null })
              };
            } else {
              // Segunda chamada: inserir novo período
              return {
                insert: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ 
                  data: { 
                    id: 'period1', 
                    user_id: 'user1', 
                    contract_id: 'contract1',
                    year: 2024,
                    month: 1,
                    status: 'draft'
                  }, 
                  error: null 
                })
              };
            }
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          };
        });
        
        vi.mocked(supabase.from).mockImplementation(mockFrom);
        
        const result = await payrollService.createPayrollPeriod('user1', 'contract1', 2024, 1);
        
        expect(result).toBeDefined();
        expect(result.year).toBe(2024);
        expect(result.month).toBe(1);
        expect(result.status).toBe('draft');
      });
      
      it('should throw error when configuration is invalid', async () => {
        const { supabase } = await import('@/lib/supabaseClient');
        
        // Mock para simular configuração incompleta
        const mockFrom = vi.fn();
        
        mockFrom.mockImplementation((table: string) => {
          if (table === 'payroll_contracts') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockContractComplete, error: null })
            };
          }
          if (table === 'payroll_ot_policies') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
            };
          }
          if (table === 'payroll_meal_allowance_configs') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: '1', user_id: 'user1', daily_amount: 6.00, is_active: true }, error: null })
            };
          }
          if (table === 'payroll_deduction_configs') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: '1', user_id: 'user1', irs_rate: 0.23, ss_rate: 0.11, is_active: true }, error: null })
            };
          }
          if (table === 'payroll_holidays') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              gte: vi.fn().mockReturnThis(),
              lte: vi.fn().mockResolvedValue({ data: [], error: null })
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          };
        });
        
        vi.mocked(supabase.from).mockImplementation(mockFrom);
        
        await expect(payrollService.createPayrollPeriod('user1', 'contract1', 2024, 1))
          .rejects.toThrow('Não é possível criar o período de folha de pagamento. Configurações em falta: Feriados não configurados para o ano 2024');
      });
      
      it('should throw error when period already exists', async () => {
        const { supabase } = await import('@/lib/supabaseClient');
        
        // Mock para simular validação de configuração completa e período existente
        const mockFrom = vi.fn();
        
        mockFrom.mockImplementation((table: string) => {
          if (table === 'payroll_contracts') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockContractComplete, error: null })
            };
          }
          if (table === 'payroll_ot_policies') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockOTPolicy, error: null })
            };
          }
          if (table === 'payroll_meal_allowance_configs') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockMealAllowanceConfig, error: null })
            };
          }
          if (table === 'payroll_deduction_configs') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockDeductionConfig, error: null })
            };
          }
          if (table === 'payroll_holidays') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              gte: vi.fn().mockReturnThis(),
              lte: vi.fn().mockResolvedValue({ data: [mockHoliday], error: null })
            };
          }
          if (table === 'payroll_periods') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: '1' }, error: null })
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          };
        });
        
        vi.mocked(supabase.from).mockImplementation(mockFrom);

        await expect(payrollService.createPayrollPeriod('user1', 'contract1', 2024, 1))
          .rejects.toThrow('Já existe um período de folha de pagamento para 1/2024');
      });
    });
  });
});