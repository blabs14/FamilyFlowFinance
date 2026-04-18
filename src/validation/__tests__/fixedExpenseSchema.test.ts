import { describe, expect, it } from 'vitest';
import { fixedExpenseSchema } from '../fixedExpenseSchema';

describe('fixedExpenseSchema', () => {
  const valid = {
    nome: 'Renda',
    valor: '750.50',
    dia_vencimento: '5',
    categoria_id: 'categoria-1',
    ativa: true,
  };

  it('accepts a valid payload', () => {
    const result = fixedExpenseSchema.parse(valid);
    expect(result.valor).toBe(750.5);
    expect(result.dia_vencimento).toBe(5);
  });

  it('rejects a payload missing a required field', () => {
    const { categoria_id: _categoriaId, ...rest } = valid;
    const result = fixedExpenseSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid field types', () => {
    const result = fixedExpenseSchema.safeParse({ ...valid, valor: 'abc' });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range due day', () => {
    const result = fixedExpenseSchema.safeParse({ ...valid, dia_vencimento: 32 });
    expect(result.success).toBe(false);
  });
});
