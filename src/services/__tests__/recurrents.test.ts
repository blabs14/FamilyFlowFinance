// src/services/__tests__/recurrents.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRecurringRule, resetFactoryCounter } from '../../../tests/utils/factories';

const fromMock = vi.hoisted(() => vi.fn());
const rpcMock  = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc:  (...args: unknown[]) => rpcMock(...args),
  },
}));

function mockFrom({
  data = null,
  error = null,
  singleData = data,
  singleError = error,
}: { data?: unknown; error?: unknown; singleData?: unknown; singleError?: unknown } = {}) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq:     vi.fn(() => chain),
    is:     vi.fn(() => chain),
    order:  vi.fn(() => chain),
    single: vi.fn().mockResolvedValue({ data: singleData, error: singleError }),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve),
  };
  return chain;
}

import {
  listRecurringRules,
  createRecurringRule,
  pauseRecurringRule,
  confirmRecurringInstance,
  skipRecurringInstance,
} from '@/services/recurrents';

describe('recurrents service', () => {
  beforeEach(() => {
    resetFactoryCounter();
    vi.clearAllMocks();
  });

  describe('listRecurringRules', () => {
    it('queries recurring_rules filtered by scope=personal', async () => {
      const rules = [makeRecurringRule()];
      fromMock.mockReturnValueOnce(mockFrom({ data: rules }));

      const result = await listRecurringRules('personal');

      expect(fromMock).toHaveBeenCalledWith('recurring_rules');
      expect(result).toEqual({ data: rules, error: null });
    });
  });

  describe('createRecurringRule', () => {
    it('inserts and returns the new rule', async () => {
      const rule = makeRecurringRule({
        user_id: '00000000-0000-0000-0000-000000000001',
        amount_cents: 5000,
      });
      const chain = mockFrom({ singleData: rule });
      fromMock.mockReturnValueOnce(chain);

      const result = await createRecurringRule(rule as any);

      expect(chain.insert).toHaveBeenCalledWith([expect.objectContaining({ amount_cents: 5000 })]);
      expect(result).toEqual({ data: rule, error: null });
    });
  });

  describe('pauseRecurringRule', () => {
    it('calls the rr_pause_rule RPC', async () => {
      rpcMock.mockResolvedValueOnce({ data: true, error: null });

      await pauseRecurringRule('rule-1');

      expect(rpcMock).toHaveBeenCalledWith('rr_pause_rule', { rule_id: 'rule-1' });
    });
  });

  describe('confirmRecurringInstance', () => {
    it('calls confirm_recurring_instance rpc', async () => {
      rpcMock.mockResolvedValueOnce({
        data: { ok: true, amount_cents: 5000 },
        error: null,
      });

      const result = await confirmRecurringInstance('inst-1');

      expect(rpcMock).toHaveBeenCalledWith('confirm_recurring_instance', {
        p_instance_id: 'inst-1',
      });
      expect(result.data).toEqual({ ok: true, amount_cents: 5000 });
      expect(result.error).toBeNull();
    });

    it('returns error when rpc fails', async () => {
      const error = { message: 'not authorized' };
      rpcMock.mockResolvedValueOnce({ data: null, error });

      const result = await confirmRecurringInstance('inst-1');

      expect(result).toEqual({ data: null, error });
    });
  });

  describe('skipRecurringInstance', () => {
    it('calls skip_recurring_instance rpc', async () => {
      rpcMock.mockResolvedValueOnce({ data: { ok: true }, error: null });

      const result = await skipRecurringInstance('inst-2');

      expect(rpcMock).toHaveBeenCalledWith('skip_recurring_instance', {
        p_instance_id: 'inst-2',
      });
      expect(result.error).toBeNull();
    });
  });
});
