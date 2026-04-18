import { describe, expect, it } from 'vitest';

import {
  coerceDate,
  formatDateLocal,
  getReminderDate,
  getWeekStart,
  isSameDay,
  parseDateLocal,
} from '../dateUtils';

describe('dateUtils', () => {
  it('formats local dates as YYYY-MM-DD', () => {
    expect(formatDateLocal(new Date(2026, 3, 18, 10, 30))).toBe('2026-04-18');
    expect(formatDateLocal('2026-04-18T22:15:00')).toBe('2026-04-18');
  });

  it('returns an empty string for missing dates', () => {
    expect(formatDateLocal(null)).toBe('');
    expect(formatDateLocal(undefined)).toBe('');
  });

  it('parses YYYY-MM-DD into a local date', () => {
    const date = parseDateLocal('2026-04-18');

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(3);
    expect(date.getDate()).toBe(18);
  });

  it('calculates the monday of the same week', () => {
    expect(formatDateLocal(getWeekStart(new Date(2026, 3, 19)))).toBe('2026-04-13');
    expect(formatDateLocal(getWeekStart(new Date(2026, 3, 20)))).toBe('2026-04-20');
  });

  it('compares dates by day only', () => {
    expect(isSameDay('2026-04-18T08:00:00', '2026-04-18T23:59:59')).toBe(true);
    expect(isSameDay('2026-04-18', '2026-04-19')).toBe(false);
  });

  it('coerces supported values and rejects invalid ones', () => {
    expect(formatDateLocal(coerceDate('2026-04-18'))).toBe('2026-04-18');
    expect(coerceDate('not-a-date')).toBeNull();
    expect(coerceDate('')).toBeNull();
  });

  it('extracts reminder dates from heterogeneous keys', () => {
    expect(formatDateLocal(getReminderDate({ data_lembrete: '2026-05-01' }))).toBe('2026-05-01');
    expect(formatDateLocal(getReminderDate({ date: '2026-05-02' }))).toBe('2026-05-02');
    expect(getReminderDate({})).toBeNull();
  });
});
