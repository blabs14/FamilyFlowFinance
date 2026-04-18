import { describe, expect, it } from 'vitest';
import { settingsSchema } from '../settingsSchema';

describe('settingsSchema', () => {
  const valid = {
    moeda: 'EUR' as const,
    idioma: 'pt' as const,
    tema: 'sistema' as const,
    notificacoes: true,
  };

  it('accepts a valid payload', () => {
    expect(() => settingsSchema.parse(valid)).not.toThrow();
  });

  it('rejects a payload missing a required field', () => {
    const { moeda: _moeda, ...rest } = valid;
    const result = settingsSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid field types', () => {
    const result = settingsSchema.safeParse({ ...valid, idioma: 'de' });
    expect(result.success).toBe(false);
  });
});
