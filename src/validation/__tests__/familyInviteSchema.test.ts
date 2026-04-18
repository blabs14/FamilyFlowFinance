import { describe, expect, it } from 'vitest';
import { familyInviteSchema } from '../familyInviteSchema';

describe('familyInviteSchema', () => {
  const valid = {
    email: 'membro@example.com',
    role: 'member' as const,
  };

  it('accepts a valid payload', () => {
    expect(() => familyInviteSchema.parse(valid)).not.toThrow();
  });

  it('rejects a payload missing a required field', () => {
    const { email: _email, ...rest } = valid;
    const result = familyInviteSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid field types', () => {
    const result = familyInviteSchema.safeParse({ ...valid, role: 'guest' });
    expect(result.success).toBe(false);
  });
});
