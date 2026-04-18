import { describe, expect, it } from 'vitest';
import {
  passwordChangeSchema,
  personalSettingsSchema,
  profileDataSchema,
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
