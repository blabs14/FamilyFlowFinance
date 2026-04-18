import { describe, expect, it } from 'vitest';
import { goalSchema } from '../goalSchema';

describe('goalSchema', () => {
  const valid = {
    nome: 'Fundo de emergencia',
    valor_objetivo: '1000',
    valor_atual: '250',
    prazo: '2026-12-31',
    status: 'active',
    ativa: true,
    account_id: 'account-1',
  };

  it('accepts a valid payload', () => {
    const result = goalSchema.parse(valid);
    expect(result.valor_objetivo).toBe(1000);
    expect(result.valor_atual).toBe(250);
  });

  it('rejects a payload missing a required field', () => {
    const { nome: _nome, ...rest } = valid;
    const result = goalSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid field types', () => {
    const result = goalSchema.safeParse({ ...valid, valor_objetivo: 'abc' });
    expect(result.success).toBe(false);
  });

  it('rejects negative current amounts', () => {
    const result = goalSchema.safeParse({ ...valid, valor_atual: -1 });
    expect(result.success).toBe(false);
  });
});
