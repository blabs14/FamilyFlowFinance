import { describe, expect, it } from 'vitest';
import { reminderSchema } from '../reminderSchema';

describe('reminderSchema', () => {
  const valid = {
    titulo: 'Pagar seguro',
    descricao: 'Renovar apolice',
    data_lembrete: '2026-05-01',
    hora_lembrete: '09:30',
    repetir: 'mensal' as const,
    ativo: true,
  };

  it('accepts a valid payload', () => {
    expect(() => reminderSchema.parse(valid)).not.toThrow();
  });

  it('rejects a payload missing a required field', () => {
    const { titulo: _titulo, ...rest } = valid;
    const result = reminderSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid field types', () => {
    const result = reminderSchema.safeParse({ ...valid, ativo: 'true' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid date formats', () => {
    const result = reminderSchema.safeParse({ ...valid, data_lembrete: '01-05-2026' });
    expect(result.success).toBe(false);
  });
});
