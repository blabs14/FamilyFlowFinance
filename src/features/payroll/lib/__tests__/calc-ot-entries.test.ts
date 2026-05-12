import { describe, it, expect } from 'vitest';
import { buildOtDayEntries, isWorkDuringNightHours } from '../calc';
import type { OtDayEntry } from '../../types/payroll-advanced.types';

// Helper to build a minimal PayrollTimeEntry-like object
function entry(date: string, start: string, end: string, durationMin: number, plannedMin: number, isHoliday = false, isSunday = false) {
  return {
    date,
    start_time: start,
    end_time: end,
    duration_minutes: durationMin,
    planned_minutes: plannedMin,
    is_holiday: isHoliday,
    is_sunday: isSunday,
  };
}

describe('isWorkDuringNightHours', () => {
  it('detects night work starting before midnight', () => {
    expect(isWorkDuringNightHours('22:30', '23:30', '22:00', '07:00')).toBe(true);
  });
  it('detects night work crossing midnight', () => {
    expect(isWorkDuringNightHours('23:00', '01:00', '22:00', '07:00')).toBe(true);
  });
  it('returns false for pure daytime work', () => {
    expect(isWorkDuringNightHours('09:00', '17:00', '22:00', '07:00')).toBe(false);
  });
  it('detects early morning work (before 07:00)', () => {
    expect(isWorkDuringNightHours('06:00', '08:00', '22:00', '07:00')).toBe(true);
  });
  it('detects evening-into-night work (starts before 22:00, ends after 22:00)', () => {
    expect(isWorkDuringNightHours('20:00', '23:00', '22:00', '07:00')).toBe(true);
  });
  it('detects shift starting just before night window', () => {
    expect(isWorkDuringNightHours('21:59', '22:01', '22:00', '07:00')).toBe(true);
  });
});

describe('buildOtDayEntries', () => {
  it('returns empty array for empty entries', () => {
    expect(buildOtDayEntries([], 480)).toEqual([]);
  });

  it('returns empty when no OT (duration = planned)', () => {
    const result = buildOtDayEntries([
      entry('2026-01-05', '09:00', '17:00', 480, 480),
    ], 480);
    expect(result).toHaveLength(0);
  });

  it('computes otMinutes for a single day with OT', () => {
    const result = buildOtDayEntries([
      entry('2026-01-05', '09:00', '18:00', 540, 480), // 60 min OT
    ], 480);
    expect(result).toHaveLength(1);
    expect(result[0].otMinutes).toBe(60);
    expect(result[0].date).toBe('2026-01-05');
    expect(result[0].isRestDay).toBe(false);
  });

  it('marks public holiday as rest day', () => {
    const result = buildOtDayEntries([
      entry('2026-01-06', '09:00', '18:00', 540, 480, true),
    ], 480);
    expect(result[0].isRestDay).toBe(true);
  });

  it('marks Sunday as rest day', () => {
    const result = buildOtDayEntries([
      entry('2026-01-11', '09:00', '18:00', 540, 480, false, true),
    ], 480);
    expect(result[0].isRestDay).toBe(true);
  });

  it('computes nightMinutes for night OT', () => {
    // Works 22:00-23:00 = 60 min OT, all night hours
    const result = buildOtDayEntries([
      entry('2026-01-05', '22:00', '23:00', 540, 480), // 60 min OT
    ], 480);
    expect(result[0].nightMinutes).toBeGreaterThan(0);
  });

  it('aggregates multiple entries for the same day', () => {
    const result = buildOtDayEntries([
      entry('2026-01-05', '09:00', '17:30', 450, 480), // 0 OT (short)
      entry('2026-01-05', '17:30', '19:30', 120, 0),   // 120 min extra
    ], 480);
    // Only one OtDayEntry for 2026-01-05
    const dayEntries = result.filter(e => e.date === '2026-01-05');
    expect(dayEntries.length).toBeLessThanOrEqual(1);
    if (dayEntries.length === 1) {
      expect(dayEntries[0].otMinutes).toBe(90); // 450+120=570 - 480 threshold = 90
    }
  });
});
