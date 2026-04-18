import { describe, expect, it } from 'vitest';
import {
  formatPhoneNumber,
  passwordChangeSchema,
  personalSettingsSchema,
  profileDataSchema,
  safeValidatePasswordChange,
  safeValidatePersonalSettings,
  safeValidateProfileData,
  validateAndFormatPhone,
  validatePasswordChange,
  validatePersonalSettings,
  validateProfileData,
} from '../personalSettingsSchema';

describe('personalSettingsSchema', () => {
  const valid = {
    theme: 'dark' as const,
    language: 'pt-PT' as const,
    currency: 'EUR',
    notifications: {
      email: true,
      push: true,
      goal_reminders: true,
      budget_alerts: false,
      transaction_alerts: true,
    },
    appearance: {
      theme: 'system' as const,
      compact_mode: false,
      show_currency_symbol: true,
    },
  };

  it('accepts a valid payload', () => {
    expect(() => personalSettingsSchema.parse(valid)).not.toThrow();
  });

  it('rejects a payload missing a required field', () => {
    const { notifications: _notifications, ...rest } = valid;
    const result = personalSettingsSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid field types', () => {
    const result = personalSettingsSchema.safeParse({ ...valid, currency: 'EURO' });
    expect(result.success).toBe(false);
  });
});

describe('profileDataSchema', () => {
  const valid = {
    first_name: 'Ana',
    last_name: 'Silva',
    phone: '+351 912345678',
    birth_date: '1990-04-18',
  };

  it('accepts a valid payload', () => {
    expect(() => profileDataSchema.parse(valid)).not.toThrow();
  });

  it('rejects underage birth dates', () => {
    const result = profileDataSchema.safeParse({ ...valid, birth_date: '2018-01-01' });
    expect(result.success).toBe(false);
  });
});

describe('passwordChangeSchema', () => {
  const valid = {
    currentPassword: 'Atual123',
    newPassword: 'NovaPassword1',
    confirmPassword: 'NovaPassword1',
  };

  it('accepts a valid payload', () => {
    expect(() => passwordChangeSchema.parse(valid)).not.toThrow();
  });

  it('rejects mismatched confirmation passwords', () => {
    const result = passwordChangeSchema.safeParse({ ...valid, confirmPassword: 'OutraPassword1' });
    expect(result.success).toBe(false);
  });
});

describe('personalSettingsSchema helpers', () => {
  const validSettings = {
    theme: 'light' as const,
    language: 'en-US' as const,
    currency: 'USD',
    notifications: {
      email: true,
      push: false,
      goal_reminders: true,
      budget_alerts: true,
      transaction_alerts: false,
    },
    appearance: {
      theme: 'dark' as const,
      compact_mode: true,
      show_currency_symbol: true,
    },
  };

  const validProfile = {
    first_name: 'Joao',
    last_name: 'Silva',
    phone: '+351 912345678',
    birth_date: '1990-01-01',
  };

  const validPasswordChange = {
    currentPassword: 'Atual123',
    newPassword: 'NovaPassword1',
    confirmPassword: 'NovaPassword1',
  };

  it('exposes parse helpers for valid payloads', () => {
    expect(validatePersonalSettings(validSettings).currency).toBe('USD');
    expect(validateProfileData(validProfile).first_name).toBe('Joao');
    expect(validatePasswordChange(validPasswordChange).newPassword).toBe('NovaPassword1');
  });

  it('exposes safe parse helpers for invalid payloads', () => {
    expect(safeValidatePersonalSettings({ ...validSettings, currency: 'US' }).success).toBe(false);
    expect(safeValidateProfileData({ ...validProfile, phone: '123' }).success).toBe(false);
    expect(safeValidatePasswordChange({ ...validPasswordChange, confirmPassword: 'NaoCoincide1' }).success).toBe(false);
  });

  it('formats portuguese phone numbers when possible', () => {
    expect(formatPhoneNumber('912345678')).toBe('+351 912 345 678');
    expect(formatPhoneNumber('+351912345678')).toBe('+351 912 345 678');
    expect(formatPhoneNumber('123')).toBe('123');
  });

  it('validates and formats phone numbers safely', () => {
    expect(validateAndFormatPhone('912345678')).toBe('+351 912 345 678');
    expect(validateAndFormatPhone('')).toBeNull();
    expect(validateAndFormatPhone('123')).toBeNull();
  });
});
