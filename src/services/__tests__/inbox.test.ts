// src/services/__tests__/inbox.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeInboxItem, resetFactoryCounter } from '../../../tests/utils/factories';

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
}: { data?: unknown; error?: unknown } = {}) {
  const chain: any = {
    select:  vi.fn(() => chain),
    update:  vi.fn(() => chain),
    eq:      vi.fn(() => chain),
    in:      vi.fn(() => chain),
    order:   vi.fn(() => chain),
    limit:   vi.fn(() => chain),
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve),
  };
  return chain;
}

import {
  getInboxItems,
  dismissInboxItem,
  doneInboxItem,
  getInboxItem,
} from '@/services/inbox';

describe('inbox service', () => {
  beforeEach(() => {
    resetFactoryCounter();
    vi.clearAllMocks();
  });

  describe('getInboxItems', () => {
    it('returns pending inbox items for a user', async () => {
      const items = [makeInboxItem(), makeInboxItem()];
      fromMock.mockReturnValueOnce(mockFrom({ data: items }));

      const result = await getInboxItems('user-1');

      expect(fromMock).toHaveBeenCalledWith('inbox_items');
      expect(result).toEqual({ data: items, error: null });
    });

    it('returns empty list for blank user id', async () => {
      const result = await getInboxItems('');
      expect(result).toEqual({ data: [], error: null });
      expect(fromMock).not.toHaveBeenCalled();
    });
  });

  describe('dismissInboxItem', () => {
    it('calls rpc skip_recurring_instance for recurring source', async () => {
      const item = makeInboxItem({ source_type: 'recurring_instance', source_id: 'inst-1' });
      rpcMock.mockResolvedValueOnce({ data: { ok: true }, error: null });

      const result = await dismissInboxItem(item as any);

      expect(rpcMock).toHaveBeenCalledWith('skip_recurring_instance', {
        p_instance_id: 'inst-1',
      });
      expect(result.error).toBeNull();
    });

    it('updates status directly for manual items', async () => {
      const item = makeInboxItem({ source_type: 'manual' });
      const chain = mockFrom({ data: item });
      fromMock.mockReturnValueOnce(chain);

      await dismissInboxItem(item as any);

      expect(fromMock).toHaveBeenCalledWith('inbox_items');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'dismissed' })
      );
    });
  });

  describe('doneInboxItem', () => {
    it('calls rpc confirm_recurring_instance for recurring source', async () => {
      const item = makeInboxItem({ source_type: 'recurring_instance', source_id: 'inst-2' });
      rpcMock.mockResolvedValueOnce({ data: { ok: true, amount_cents: 5000 }, error: null });

      const result = await doneInboxItem(item as any);

      expect(rpcMock).toHaveBeenCalledWith('confirm_recurring_instance', {
        p_instance_id: 'inst-2',
      });
      expect(result.error).toBeNull();
    });
  });
});
