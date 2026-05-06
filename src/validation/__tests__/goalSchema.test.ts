// src/validation/__tests__/goalSchema.test.ts
import { describe, it, expect } from 'vitest';
import { goalSchema, goalAllocationSchema } from '../goalSchema';

describe('goalSchema', () => {
  it('rejects empty nome', () => {
    const result = goalSchema.safeParse({ nome: '', target_cents: 5000 });
    expect(result.success).toBe(false);
  });

  it('rejects zero target_cents', () => {
    const result = goalSchema.safeParse({ nome: 'Férias', target_cents: 0 });
    expect(result.success).toBe(false);
  });

  it('accepts valid savings goal', () => {
    const result = goalSchema.safeParse({ nome: 'Férias', target_cents: 50000 });
    expect(result.success).toBe(true);
  });

  it('defaults tipo to savings', () => {
    const result = goalSchema.safeParse({ nome: 'Férias', target_cents: 50000 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tipo).toBe('savings');
  });

  it('accepts amortization tipo', () => {
    const result = goalSchema.safeParse({ nome: 'Empréstimo', target_cents: 100000, tipo: 'amortization' });
    expect(result.success).toBe(true);
  });

  it('rejects unknown tipo', () => {
    const result = goalSchema.safeParse({ nome: 'X', target_cents: 1000, tipo: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('goalAllocationSchema', () => {
  it('rejects zero amount_cents', () => {
    const result = goalAllocationSchema.safeParse({ goal_id: 'g-1', account_id: 'a-1', amount_cents: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative amount_cents', () => {
    const result = goalAllocationSchema.safeParse({ goal_id: 'g-1', account_id: 'a-1', amount_cents: -100 });
    expect(result.success).toBe(false);
  });

  it('accepts valid allocation', () => {
    const result = goalAllocationSchema.safeParse({ goal_id: 'g-1', account_id: 'a-1', amount_cents: 5000 });
    expect(result.success).toBe(true);
  });
});
