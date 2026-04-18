import { describe, expect, it } from 'vitest';
import { notificationSchema } from '../notificationSchema';

describe('notificationSchema', () => {
  const valid = {
    titulo: 'Meta atualizada',
    mensagem: 'A meta recebeu um reforco.',
    tipo: 'info' as const,
    evento: 'meta' as const,
  };

  it('accepts a valid payload', () => {
    expect(() => notificationSchema.parse(valid)).not.toThrow();
  });

  it('rejects a payload missing a required field', () => {
    const { titulo: _titulo, ...rest } = valid;
    const result = notificationSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid field types', () => {
    const result = notificationSchema.safeParse({ ...valid, tipo: 'debug' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid event values', () => {
    const result = notificationSchema.safeParse({ ...valid, evento: 'pagamento' });
    expect(result.success).toBe(false);
  });
});
