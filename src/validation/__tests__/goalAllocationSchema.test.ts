import { describe, expect, it } from 'vitest';
import {
  createGoalAllocationSchema,
  goalAllocationSchema,
  updateGoalAllocationSchema,
} from '../goalAllocationSchema';

describe('goalAllocationSchema', () => {
  const valid = {
    goal_id: '11111111-1111-1111-1111-111111111111',
    account_id: '22222222-2222-2222-2222-222222222222',
    valor: 25.5,
    data_alocacao: '2026-04-18',
    descricao: 'Reforco mensal',
  };

  it('accepts a valid payload', () => {
    expect(() => goalAllocationSchema.parse(valid)).not.toThrow();
  });

  it('rejects a payload missing a required field', () => {
    const { goal_id: _goalId, ...rest } = valid;
    const result = goalAllocationSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid field types', () => {
    const result = goalAllocationSchema.safeParse({ ...valid, valor: '25.5' });
    expect(result.success).toBe(false);
  });

  it('allows create payload without allocation date', () => {
    const { data_alocacao: _data, ...createPayload } = valid;
    expect(() => createGoalAllocationSchema.parse(createPayload)).not.toThrow();
  });

  it('rejects zero or negative allocation values on update', () => {
    const result = updateGoalAllocationSchema.safeParse({ valor: 0 });
    expect(result.success).toBe(false);
  });
});
