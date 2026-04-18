import { describe, expect, it } from 'vitest';
import { profileSchema } from '../profileSchema';

describe('profileSchema', () => {
  const valid = {
    nome: 'Ana Silva',
    email: 'ana@example.com',
    telefone: '912345678',
    avatar_url: 'https://example.com/avatar.png',
  };

  it('accepts a valid payload', () => {
    expect(() => profileSchema.parse(valid)).not.toThrow();
  });

  it('rejects a payload missing a required field', () => {
    const { nome: _nome, ...rest } = valid;
    const result = profileSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid field types', () => {
    const result = profileSchema.safeParse({ ...valid, avatar_url: 'not-a-url' });
    expect(result.success).toBe(false);
  });
});
