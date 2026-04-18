import { describe, expect, it } from 'vitest';
import { accountSchema } from '../accountSchema';

describe('accountSchema', () => {
  const valid = {
    nome: 'Conta Principal',
    tipo: 'corrente' as const,
    saldoAtual: 1500,
    ajusteSaldo: 0,
  };

  it('accepts a valid payload', () => {
    expect(() => accountSchema.parse(valid)).not.toThrow();
  });

  it('rejects a payload missing a required field', () => {
    const { nome: _nome, ...rest } = valid;
    const result = accountSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid field types', () => {
    const result = accountSchema.safeParse({ ...valid, tipo: 'crypto' });
    expect(result.success).toBe(false);
  });
});
