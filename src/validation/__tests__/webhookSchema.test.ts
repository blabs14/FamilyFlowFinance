import { describe, expect, it } from 'vitest';
import { webhookSchema } from '../webhookSchema';

describe('webhookSchema', () => {
  const valid = {
    nome: 'Webhook principal',
    endpoint: 'https://example.com/webhooks/family-flow',
    evento: 'transacao' as const,
    ativo: true,
  };

  it('accepts a valid payload', () => {
    expect(() => webhookSchema.parse(valid)).not.toThrow();
  });

  it('rejects a payload missing a required field', () => {
    const { endpoint: _endpoint, ...rest } = valid;
    const result = webhookSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid field types', () => {
    const result = webhookSchema.safeParse({ ...valid, endpoint: 'notaurl' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid event values', () => {
    const result = webhookSchema.safeParse({ ...valid, evento: 'saldo' });
    expect(result.success).toBe(false);
  });
});
