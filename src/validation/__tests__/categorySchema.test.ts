import { describe, expect, it } from 'vitest';
import { categorySchema } from '../categorySchema';

describe('categorySchema', () => {
  const valid = {
    nome: 'Casa',
    cor: '#AABBCC',
    descricao: 'Despesas da casa',
  };

  it('accepts a valid payload', () => {
    expect(() => categorySchema.parse(valid)).not.toThrow();
  });

  it('rejects a payload missing a required field', () => {
    const { nome: _nome, ...rest } = valid;
    const result = categorySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid field types', () => {
    const result = categorySchema.safeParse({ ...valid, cor: 'azul' });
    expect(result.success).toBe(false);
  });
});
