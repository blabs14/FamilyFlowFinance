import { describe, it, expect } from 'vitest';
import {
  buildPlannedSchedule,
  segmentEntry,
  calcHourly,
  calcMeal,
  calcBonuses,
  calcSubsidies,
  calcMileage,
  calcMonth,
  centsToEuros,
  eurosToCents,
  calculateHours,
  validateTimeEntry
} from './calc';
import { formatCurrency } from '@/lib/utils';
import type { 
  PayrollContract, 
  PayrollOTPolicy, 
  PayrollTimeEntry, 
  PayrollMileagePolicy,
  PayrollMileageTrip,
  PlannedSchedule 
} from '../types';

describe('Payroll Calculation Functions', () => {
  // Mock data for tests
  const mockContract: PayrollContract = {
    id: '1',
    user_id: 'user1',
    employee_name: 'João Silva',
    base_salary_cents: 120000, // €1200 (acima do salário mínimo €870)
  hourly_rate_cents: 800, // €8.00
    overtime_rate_cents: 1200, // €12.00
    transport_allowance_cents: 0,
    other_allowances_cents: 0,
    work_hours_per_day: 8,
    work_days_per_week: 5,
    start_time: '09:00',
    end_time: '17:00',
    lunch_break_minutes: 60,
    is_active: true,
    notes: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const mockOTPolicy: PayrollOTPolicy = {
    id: '1',
    user_id: 'user1',
    name: 'Standard OT Policy',
    overtime_type: 'daily',
    daily_limit_hours: 8,
    weekly_limit_hours: 40,
    overtime_multiplier: 1.5,
    max_daily_overtime_hours: 4,
    max_weekly_overtime_hours: 12,
    night_shift_start: '22:00',
    night_shift_end: '06:00',
    night_shift_multiplier: 1.25,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const mockTimeEntry: PayrollTimeEntry = {
    id: '1',
    user_id: 'user1',
    contract_id: '1',
    date: '2024-01-15',
    start_time: '09:00',
    end_time: '17:30',
    break_minutes: 60,
    description: 'Regular work day',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const mockMileagePolicy: PayrollMileagePolicy = {
    id: '1',
    user_id: 'user1',
    name: 'Standard Mileage',
    rate_cents_per_km: 36, // €0.36
    monthly_limit_km: 1000,
    requires_receipt: false,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const mockMileageTrip: PayrollMileageTrip = {
    id: '1',
    user_id: 'user1',
    policy_id: '1',
    date: '2024-01-15',
    from_location: 'Home',
    to_location: 'Office',
    km: 25,
    purpose: 'Work commute',
    has_receipt: false,
    receipt_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  describe('Currency Conversion Functions', () => {
    it('should convert euros to cents correctly', () => {
      expect(eurosToCents(10.50)).toBe(1050);
      expect(eurosToCents(0)).toBe(0);
      expect(eurosToCents(1.23)).toBe(123);
    });

    it('should convert cents to euros correctly', () => {
      expect(centsToEuros(1050)).toBe(10.50);
      expect(centsToEuros(0)).toBe(0);
      expect(centsToEuros(123)).toBe(1.23);
    });

    it('should format currency correctly', () => {
      expect(formatCurrency(1050)).toMatch(/10,50\s*€/);
      expect(formatCurrency(0)).toMatch(/0,00\s*€/);
      expect(formatCurrency(123)).toMatch(/1,23\s*€/);
      expect(formatCurrency(100000)).toMatch(/1000,00\s*€/);
    });
  });

  describe('Time Calculation Functions', () => {
    it('should calculate hours between times correctly', () => {
      expect(calculateHours('09:00', '17:00')).toBe(8);
      expect(calculateHours('09:30', '17:30')).toBe(8);
      expect(calculateHours('22:00', '06:00')).toBe(8); // Overnight
      expect(calculateHours('14:00', '14:30')).toBe(0.5);
    });

    it('should validate time entries correctly', () => {
      const validEntry = {
        date: '2024-01-15',
        start_time: '09:00',
        end_time: '17:00',
        break_minutes: 60
      };
      expect(validateTimeEntry(validEntry).isValid).toBe(true);

      const invalidEntry = {
        date: '2024-01-15',
        start_time: '17:00',
        end_time: '09:00', // End before start
        break_minutes: 60
      };
      expect(validateTimeEntry(invalidEntry).isValid).toBe(false);
    });
  });

  describe('Planned Schedule Functions', () => {
    it('should build planned schedule correctly', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-07');
      const schedule = buildPlannedSchedule(mockContract, [], startDate, endDate);
      
      expect(schedule).toHaveLength(7); // 7 days
      expect(schedule[0].date).toBe('2024-01-01');
      expect(schedule[0].plannedHours).toBe(mockContract.weekly_hours / 7);
      expect(schedule[0].isHoliday).toBe(false);
    });
  });

  describe('Time Segmentation Functions', () => {
    it('should segment regular time entry correctly', () => {
      const segments = segmentEntry(mockTimeEntry, mockOTPolicy, 8);
      
      expect(segments).toHaveLength(1);
      expect(segments[0].isOvertime).toBe(false);
      expect(segments[0].hours).toBe(7.5); // 8.5 hours - 1 hour break
    });

    it('should segment overtime entry correctly', () => {
      const overtimeEntry: PayrollTimeEntry = {
        ...mockTimeEntry,
        start_time: '09:00',
        end_time: '19:00', // 10 hours total
        break_minutes: 60
      };
      
      const segments = segmentEntry(overtimeEntry, mockOTPolicy, 8);
      
      expect(segments).toHaveLength(2);
      expect(segments[0].isOvertime).toBe(false);
      expect(segments[0].hours).toBe(8);
      expect(segments[1].isOvertime).toBe(true);
      expect(segments[1].hours).toBe(1);
    });
  });

  describe('Payment Calculation Functions', () => {
    it('should calculate hourly payment correctly', () => {
      const segments = [{
        type: 'regular' as const,
        hours: 8,
        rate_cents: 800,
        start_time: '09:00',
        end_time: '17:00'
      }];
      
      const payment = calcHourly(8, 800); // 8 hours * €8.00
      expect(payment).toBe(6400);
    });

    it('should calculate meal allowance correctly', () => {
      const allowance = calcMeal(
        '2025-01-15', // date
        8, // regularHours
        8, // totalHours
        650, // mealAllowanceCents (€6.50)
        [], // excludedMonths
        false, // isHoliday
        false, // isVacation
        false, // isException
        4, // minimumRegularHours
        'card', // paymentMethod
        false // duodecimosEnabled
      );
      expect(allowance).toBe(650);
    });

    it('should apply cash payment method exemption limit (€6.00/day)', () => {
      const allowance = calcMeal(
        '2025-01-15', // date
        8, // regularHours
        8, // totalHours
        800, // mealAllowanceCents (€8.00 - exceeds cash limit)
        [], // excludedMonths
        false, // isHoliday
        false, // isVacation
        false, // isException
        4, // minimumRegularHours
        'cash', // paymentMethod
        false // duodecimosEnabled
      );
      expect(allowance).toBe(600); // Should be capped at €6.00
    });

    it('should apply card payment method exemption limit (€10.20/day)', () => {
      const allowance = calcMeal(
        '2025-01-15', // date
        8, // regularHours
        8, // totalHours
        1200, // mealAllowanceCents (€12.00 - exceeds card limit)
        [], // excludedMonths
        false, // isHoliday
        false, // isVacation
        false, // isException
        4, // minimumRegularHours
        'card', // paymentMethod
        false // duodecimosEnabled
      );
      expect(allowance).toBe(1020); // Should be capped at €10.20
    });

    it('should calculate duodecimos correctly (uniform distribution)', () => {
      // Test duodecimos with excluded months - should ignore exclusions
      const allowanceWithExclusions = calcMeal(
        '2025-08-15', // August (normally excluded)
        8, // regularHours
        8, // totalHours
        1000, // mealAllowanceCents (€10.00)
        [8], // excludedMonths (August)
        false, // isHoliday
        false, // isVacation
        false, // isException
        4, // minimumRegularHours
        'card', // paymentMethod
        true // duodecimosEnabled
      );
      // With duodecimos: (€10.00 * 22 working days) / 22 = €10.00 per day
      expect(allowanceWithExclusions).toBe(1000);

      // Test duodecimos without excluded months
      const allowanceNormal = calcMeal(
        '2025-01-15', // January
        8, // regularHours
        8, // totalHours
        1000, // mealAllowanceCents (€10.00)
        [], // excludedMonths
        false, // isHoliday
        false, // isVacation
        false, // isException
        4, // minimumRegularHours
        'card', // paymentMethod
        true // duodecimosEnabled
      );
      expect(allowanceNormal).toBe(1000);
    });

    it('should calculate bonuses correctly', () => {
      const bonuses = calcBonuses(100, 1.75, { eligible: true }); // €1.00 * 1.75
      expect(bonuses).toBe(175); // Total €1.75
    });

    it('should calculate vacation subsidy correctly', () => {
      const vacationSubsidy = calcSubsidies('vacation', 95000, 12); // €950 for 12 months
      expect(vacationSubsidy).toBe(95000); // Full salary
    });

    it('should calculate vacation subsidy proportionally', () => {
      const vacationSubsidy = calcSubsidies('vacation', 95000, 6, 22, 700, true); // 6 months worked
      expect(vacationSubsidy).toBe(47500); // Half salary
    });

    it('should calculate christmas subsidy correctly', () => {
      const christmasSubsidy = calcSubsidies('christmas', 95000, 12); // €950 for 12 months
      expect(christmasSubsidy).toBe(95000); // Full salary
    });

    it('should calculate christmas subsidy proportionally', () => {
      const christmasSubsidy = calcSubsidies('christmas', 95000, 8, 22, 700, true); // 8 months worked
      expect(christmasSubsidy).toBe(63333); // 8/12 of salary
    });

    it('should calculate meal subsidy correctly', () => {
      const mealSubsidy = calcSubsidies('meal', 95000, 12, 22, 700); // 22 working days at €7/day
      expect(mealSubsidy).toBe(15400); // 22 * €7.00
    });

    it('should return 0 for invalid subsidy type', () => {
      const invalidSubsidy = calcSubsidies('invalid' as any, 95000, 12);
      expect(invalidSubsidy).toBe(0);
    });

    it('should calculate mileage reimbursement correctly', () => {
      const trips = [mockMileageTrip];
      const reimbursement = calcMileage(trips, mockMileagePolicy.rate_cents_per_km);
      expect(reimbursement).toBe(900); // 25 km * €0.36
    });
  });

  describe('Monthly Total Calculation', () => {
    it('should calculate monthly total correctly', () => {
      const timeEntries = [mockTimeEntry];
      const mileageTrips = [mockMileageTrip];
      
      const total = calcMonth(
        mockContract,
        timeEntries,
        mockOTPolicy,
        [],
        mileageTrips,
        36
      );
      
      expect(total.regularHours).toBe(7.5);
      expect(total.overtimeHours).toBe(0);
      expect(total.mileageReimbursement).toBeGreaterThan(0);
      expect(total.regularPay).toBe(6000); // 7.5 hours * €8.00
      expect(total.overtimePay).toBe(0);
      expect(total.mileageReimbursement).toBe(900);
      expect(total.grossPay).toBeGreaterThan(0);
      expect(total.netPay).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays gracefully', () => {
      const total = calcMonth(
        mockContract,
        [], // No time entries
        mockOTPolicy,
        [], // No holidays
        [], // No mileage trips
        36
      );
      
      expect(total.regularPay).toBe(0);
      expect(total.overtimePay).toBe(0);
      expect(total.mileageReimbursement).toBe(0);
      expect(total.grossPay).toBe(0);
      expect(total.netPay).toBe(0);
    });

    it('should handle calculations without overtime policy (all hours as regular)', () => {
      const longWorkEntry: PayrollTimeEntry = {
        ...mockTimeEntry,
        start_time: '08:00',
        end_time: '19:00', // 10 hours (would be OT with policy)
        break_minutes: 60
      };
      
      const total = calcMonth(
        mockContract,
        [longWorkEntry],
        null, // No overtime policy
        [], // No holidays
        [], // No mileage trips
        36
      );
      
      // All hours should be treated as regular
      expect(total.regularHours).toBe(10);
      expect(total.overtimeHours).toBe(0);
      expect(total.regularPay).toBe(8000); // 10 hours * €8.00
      expect(total.overtimePay).toBe(0);
      expect(total.overtimePayDay).toBe(0);
      expect(total.overtimePayNight).toBe(0);
      expect(total.overtimePayWeekend).toBe(0);
      expect(total.overtimePayHoliday).toBe(0);
      expect(total.grossPay).toBeGreaterThan(8000); // Should include meal allowance
    });

    it('should handle calculations without overtime policy (undefined)', () => {
      const longWorkEntry: PayrollTimeEntry = {
        ...mockTimeEntry,
        start_time: '08:00',
        end_time: '20:00', // 11 hours (would be OT with policy)
        break_minutes: 60
      };
      
      const total = calcMonth(
        mockContract,
        [longWorkEntry],
        undefined, // Undefined overtime policy
        [], // No holidays
        [], // No mileage trips
        36
      );
      
      // All hours should be treated as regular
      expect(total.regularHours).toBe(11);
      expect(total.overtimeHours).toBe(0);
      expect(total.regularPay).toBe(8800); // 11 hours * €8.00
      expect(total.overtimePay).toBe(0);
      expect(total.overtimePayDay).toBe(0);
      expect(total.overtimePayNight).toBe(0);
      expect(total.overtimePayWeekend).toBe(0);
      expect(total.overtimePayHoliday).toBe(0);
    });

    it('should handle overnight shifts correctly', () => {
      const overnightEntry: PayrollTimeEntry = {
        ...mockTimeEntry,
        start_time: '22:00',
        end_time: '06:00',
        break_minutes: 0
      };
      
      const segments = segmentEntry(overnightEntry, mockOTPolicy);
      expect(segments[0].hours).toBe(8);
    });

    it('should handle zero rates gracefully', () => {
      const zeroRateContract = {
        ...mockContract,
        hourly_rate_cents: 0
      };
      
      const total = calcMonth(
        zeroRateContract,
        [mockTimeEntry],
        mockOTPolicy,
        [], // No holidays
        [], // No mileage trips
        36
      );
      
      expect(total.regularPay).toBe(0);
      expect(total.mealAllowance).toBe(1020); // Default meal allowance value
    });

    it('should handle very large numbers correctly', () => {
      const largeAmount = 999999999; // €9,999,999.99
      expect(centsToEuros(largeAmount)).toBe(9999999.99);
      expect(formatCurrency(largeAmount)).toMatch(/9\s*999\s*999,99\s*€/);
    });
  });

  describe('Validation Functions', () => {
    it('should validate correct time format', () => {
      const result = validateTimeEntry({
        date: '2024-01-15',
        start_time: '09:00',
        end_time: '17:00',
        break_minutes: 60
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid time entries', () => {
      const result = validateTimeEntry({
        date: '2024-01-15',
        start_time: '17:00',
        end_time: '09:00',
        break_minutes: 60
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Hora de fim deve ser posterior à hora de início');
    });

    it('should reject negative break minutes', () => {
      const result = validateTimeEntry({
        date: '2024-01-15',
        start_time: '09:00',
        end_time: '17:00',
        break_minutes: -30
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Minutos de pausa não podem ser negativos');
    });

    it('should reject excessive break minutes', () => {
      const result = validateTimeEntry({
        date: '2024-01-15',
        start_time: '09:00',
        end_time: '17:00',
        break_minutes: 600 // 10 hours break for 8 hour shift
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Minutos de pausa não podem ser iguais ou superiores ao tempo total de trabalho');
    });
  });
});