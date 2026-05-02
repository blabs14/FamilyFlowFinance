// src/services/__tests__/goals.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
  },
}));

import * as svc from '@/services/goals';

describe('goals service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGoalsWithBalance', () => {
    it('calls get_goals_with_balance rpc with null for personal scope', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });
      const { data, error } = await svc.getGoalsWithBalance();
      expect(mockRpc).toHaveBeenCalledWith('get_goals_with_balance', { p_family_id: null });
      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('passes family_id for family scope', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });
      await svc.getGoalsWithBalance('fam-123');
      expect(mockRpc).toHaveBeenCalledWith('get_goals_with_balance', { p_family_id: 'fam-123' });
    });
  });

  describe('allocateToGoal', () => {
    it('calls allocate_to_goal rpc with correct params', async () => {
      mockRpc.mockResolvedValueOnce({ data: { id: 'entry-1', amount_cents: 5000 }, error: null });
      const { data, error } = await svc.allocateToGoal({
        goalId: 'goal-1',
        accountId: 'acc-1',
        amountCents: 5000,
      });
      expect(mockRpc).toHaveBeenCalledWith('allocate_to_goal', expect.objectContaining({
        p_goal_id: 'goal-1',
        p_account_id: 'acc-1',
        p_amount: 50, // cents → euros for legacy RPC
      }));
      expect(error).toBeNull();
    });
  });

  describe('completeGoal', () => {
    it('calls complete_goal rpc with keep action', async () => {
      mockRpc.mockResolvedValueOnce({ data: { action: 'keep', balance_cents: 0 }, error: null });
      const { data, error } = await svc.completeGoal({ goalId: 'goal-1', action: 'keep' });
      expect(mockRpc).toHaveBeenCalledWith('complete_goal', expect.objectContaining({
        p_goal_id: 'goal-1',
        p_action: 'keep',
      }));
      expect(error).toBeNull();
    });

    it('passes target_account_id for transfer action', async () => {
      mockRpc.mockResolvedValueOnce({ data: { action: 'transfer', released_cents: 5000 }, error: null });
      await svc.completeGoal({ goalId: 'g-1', action: 'transfer', targetAccountId: 'acc-1' });
      expect(mockRpc).toHaveBeenCalledWith('complete_goal', expect.objectContaining({
        p_action: 'transfer',
        p_target_account_id: 'acc-1',
      }));
    });
  });

  describe('getGoalLedger', () => {
    it('calls get_goal_ledger rpc', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });
      const { data } = await svc.getGoalLedger('goal-1');
      expect(mockRpc).toHaveBeenCalledWith('get_goal_ledger', { p_goal_id: 'goal-1' });
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
