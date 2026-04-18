import { describe, expect, it } from 'vitest';
import { attachmentSchema } from '../attachmentSchema';

describe('attachmentSchema', () => {
  const valid = {
    nome: 'Fatura Janeiro',
    url: 'https://example.com/files/janeiro.pdf',
    tipo: 'pdf',
    tamanho: 1024,
  };

  it('accepts a valid payload', () => {
    expect(() => attachmentSchema.parse(valid)).not.toThrow();
  });

  it('rejects a payload missing a required field', () => {
    const { url: _url, ...rest } = valid;
    const result = attachmentSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid field types', () => {
    const result = attachmentSchema.safeParse({ ...valid, tamanho: '1024' });
    expect(result.success).toBe(false);
  });
});
