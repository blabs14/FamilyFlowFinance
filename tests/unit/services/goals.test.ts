import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeGoal, resetFactoryCounter } from '../../utils/factories';
import {
  allocateFunds,
  allocateToGoal,
  createGoal,
  deleteGoal,
  getFamilyGoals,
  getGoal,
  getGoalProgress,
  getGoals,
  getGoalsDomain,
  getPersonalGoals,
  getUserGoalProgress,
  updateGoal,
} from '@/services/goals';

const fromMock = vi.fn();
const rpcMock = vi.fn();
const getUserMock = vi.fn();
const mapGoalRowToDomainMock = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    rpc: (...args: unknown[]) => rpcMock(...args),
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
    },
  },
}));

vi.mock('@/config/rpcConfig', () => ({
  retryWithBackoff: async <T>(fn: () => Promise<T>) => fn(),
  withTimeout: async <T>(promise: Promise<T>) => promise,
}));

vi.mock('@/shared/types/goals', () => ({
  mapGoalRowToDomain: (...args: unknown[]) => mapGoalRowToDomainMock(...args),
}));

function mockFrom({
  data = null,
  error = null,
  singleData = data,
  singleError = error,
}: {
  data?: unknown;
  error?: unknown;
  singleData?: unknown;
  singleError?: unknown;
} = {}) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue({ data: singleData, error: singleError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: singleData, error: singleError }),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(resolve, reject),
  };

  return chain;
}

describe('goals service', () => {
  beforeEach(() => {
    resetFactoryCounter();
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: 'auth-user-1' } } });
    mapGoalRowToDomainMock.mockImplementation((goal: any) => ({
      id: goal.id,
      nome: goal.nome,
      mapped: true,
    }));
  });

  describe('getGoals', () => {
    it('returns an empty list for an invalid user id', async () => {
      const result = await getGoals('');

      expect(result).toEqual({ data: [], error: null });
      expect(fromMock).not.toHaveBeenCalled();
    });

    it('returns goals for a valid user', async () => {
      const goals = [makeGoal(), makeGoal()];
      const chain = mockFrom({ data: goals });
      fromMock.mockReturnValueOnce(chain);

      const result = await getGoals('user-1');

      expect(fromMock).toHaveBeenCalledWith('goals');
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(chain.is).toHaveBeenCalledWith('family_id', null);
      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual({ data: goals, error: null });
    });
  });

  describe('getGoalsDomain', () => {
    it('returns an empty domain list for an invalid user id', async () => {
      const result = await getGoalsDomain('  ');

      expect(result).toEqual({ data: [], error: null });
      expect(mapGoalRowToDomainMock).not.toHaveBeenCalled();
    });

    it('maps raw goals into domain goals', async () => {
      const goal = makeGoal();
      fromMock.mockReturnValueOnce(mockFrom({ data: [goal] }));

      const result = await getGoalsDomain('user-1');

      expect(mapGoalRowToDomainMock).toHaveBeenCalled();
      expect(mapGoalRowToDomainMock.mock.calls[0]?.[0]).toEqual(goal);
      expect(result).toEqual({
        data: [{ id: goal.id, nome: goal.nome, mapped: true }],
        error: null,
      });
    });
  });

  describe('getGoal', () => {
    it('returns a single goal for the user', async () => {
      const goal = makeGoal();
      const chain = mockFrom({ singleData: goal });
      fromMock.mockReturnValueOnce(chain);

      const result = await getGoal(goal.id, 'user-1');

      expect(fromMock).toHaveBeenCalledWith('goals');
      expect(chain.eq).toHaveBeenNthCalledWith(1, 'id', goal.id);
      expect(chain.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-1');
      expect(result).toEqual({ data: goal, error: null });
    });

    it('returns the Supabase error when single fetch fails', async () => {
      const error = { message: 'not found' };
      fromMock.mockReturnValueOnce(mockFrom({ singleData: null, singleError: error }));

      const result = await getGoal('goal-1', 'user-1');

      expect(result).toEqual({ data: null, error });
    });
  });

  describe('createGoal', () => {
    it('creates a goal with an explicit user id', async () => {
      const goal = makeGoal({ user_id: 'user-1' });
      const chain = mockFrom({ singleData: goal });
      fromMock.mockReturnValueOnce(chain);

      const result = await createGoal({ nome: goal.nome, valor_objetivo: 1000 } as any, 'user-1');

      expect(fromMock).toHaveBeenCalledWith('goals');
      expect(chain.insert).toHaveBeenCalledWith([
        expect.objectContaining({ nome: goal.nome, valor_objetivo: 1000, user_id: 'user-1' }),
      ]);
      expect(result).toEqual({ data: goal, error: null });
    });

    it('falls back to the authenticated user when user id is missing', async () => {
      const goal = makeGoal({ user_id: 'auth-user-1' });
      const chain = mockFrom({ singleData: goal });
      fromMock.mockReturnValueOnce(chain);

      await createGoal({ nome: goal.nome, valor_objetivo: 1000 } as any);

      expect(getUserMock).toHaveBeenCalled();
      expect(chain.insert).toHaveBeenCalledWith([
        expect.objectContaining({ user_id: 'auth-user-1' }),
      ]);
    });
  });

  describe('updateGoal', () => {
    it('updates a goal in edit mode', async () => {
      const updatedGoal = makeGoal({ nome: 'Novo nome' });
      const chain = mockFrom({ singleData: updatedGoal });
      fromMock.mockReturnValueOnce(chain);

      const result = await updateGoal('goal-1', { nome: 'Novo nome' } as any, 'user-1');

      expect(chain.update).toHaveBeenCalledWith({ nome: 'Novo nome' });
      expect(chain.eq).toHaveBeenNthCalledWith(1, 'id', 'goal-1');
      expect(chain.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-1');
      expect(result).toEqual({ data: updatedGoal, error: null });
    });

    it('returns the Supabase error when the update fails', async () => {
      const error = { message: 'update failed' };
      fromMock.mockReturnValueOnce(mockFrom({ singleData: null, singleError: error }));

      const result = await updateGoal('goal-1', { nome: 'Falhou' } as any);

      expect(result).toEqual({ data: null, error });
    });
  });

  describe('deleteGoal', () => {
    it('calls the delete RPC with the deterministic idempotency key', async () => {
      rpcMock.mockResolvedValueOnce({ data: { success: true, message: 'apagado' }, error: null });

      const result = await deleteGoal('goal-1', 'user-1');

      expect(rpcMock).toHaveBeenCalledWith('delete_goal_with_restoration', {
        goal_id_param: 'goal-1',
        user_id_param: 'user-1',
        idempotency_key: 'user-1:goal-1:delete',
      });
      expect(result).toEqual({ data: { success: true, message: 'apagado' }, error: null });
    });

    it('returns the rpc error when deletion fails', async () => {
      const error = { code: 'PGRST', message: 'delete failed' };
      rpcMock.mockResolvedValueOnce({ data: null, error });

      const result = await deleteGoal('goal-1', 'user-1');

      expect(result).toEqual({ data: null, error });
    });
  });

  describe('allocateToGoal', () => {
    it('calls the allocation RPC with the right payload', async () => {
      rpcMock.mockResolvedValueOnce({ data: { amount_allocated: 100 }, error: null });

      const result = await allocateToGoal('goal-1', 'account-1', 100, 'user-1', 'Reforco');

      expect(rpcMock).toHaveBeenCalledWith('allocate_to_goal_with_transaction', {
        goal_id_param: 'goal-1',
        account_id_param: 'account-1',
        amount_param: 100,
        user_id_param: 'user-1',
        description_param: 'Reforco',
      });
      expect(result).toEqual({ data: { amount_allocated: 100 }, error: null });
    });

    it('returns an error when the amount is invalid', async () => {
      const result = await allocateToGoal('goal-1', 'account-1', 0, 'user-1');

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toMatch(/Montante deve ser positivo/);
    });
  });

  describe('allocateFunds', () => {
    it('returns the compatibility placeholder response', async () => {
      await expect(allocateFunds('goal-1', 100)).resolves.toEqual({ data: null, error: null });
    });

    it('does not call supabase directly', async () => {
      await allocateFunds('goal-1', 100);

      expect(fromMock).not.toHaveBeenCalled();
      expect(rpcMock).not.toHaveBeenCalled();
    });
  });

  describe('getGoalProgress', () => {
    it('returns goal progress from the RPC', async () => {
      const progress = [{ goal_id: 'goal-1', progress_percentage: 50 }];
      rpcMock.mockResolvedValueOnce({ data: progress, error: null });

      const result = await getGoalProgress('user-1');

      expect(rpcMock).toHaveBeenCalledWith('get_user_goal_progress', { user_id: 'user-1' });
      expect(result).toEqual({ data: progress, error: null });
    });

    it('returns an error when user id is missing', async () => {
      const result = await getGoalProgress('');

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toMatch(/User ID is required/);
    });
  });

  describe('getUserGoalProgress', () => {
    it('uses the authenticated user id and returns the rpc rows', async () => {
      const progress = [{ goal_id: 'goal-1', progress_percentage: 50 }];
      rpcMock.mockResolvedValueOnce({ data: progress, error: null });

      const result = await getUserGoalProgress();

      expect(getUserMock).toHaveBeenCalled();
      expect(rpcMock).toHaveBeenCalledWith('get_user_goal_progress', { user_id: 'auth-user-1' });
      expect(result).toEqual(progress);
    });

    it('returns an empty list when the rpc fails', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: { message: 'rpc failed' } });

      const result = await getUserGoalProgress();

      expect(result).toEqual([]);
    });
  });

  describe('getPersonalGoals', () => {
    it('returns personal goals from the rpc', async () => {
      const goals = [makeGoal()];
      rpcMock.mockResolvedValueOnce({ data: goals, error: null });

      const result = await getPersonalGoals('user-1');

      expect(rpcMock).toHaveBeenCalledWith('get_personal_goals', { p_user_id: 'user-1' });
      expect(result).toEqual({ data: goals, error: null });
    });

    it('returns null data when the rpc throws', async () => {
      const error = new Error('network');
      rpcMock.mockRejectedValueOnce(error);

      const result = await getPersonalGoals('user-1');

      expect(result).toEqual({ data: null, error });
    });
  });

  describe('getFamilyGoals', () => {
    it('returns family goals from the rpc', async () => {
      const goals = [makeGoal({ family_id: 'family-1' })];
      rpcMock.mockResolvedValueOnce({ data: goals, error: null });

      const result = await getFamilyGoals('user-1');

      expect(rpcMock).toHaveBeenCalledWith('get_family_goals', { p_user_id: 'user-1' });
      expect(result).toEqual({ data: goals, error: null });
    });

    it('returns null data when the rpc throws', async () => {
      const error = new Error('network');
      rpcMock.mockRejectedValueOnce(error);

      const result = await getFamilyGoals('user-1');

      expect(result).toEqual({ data: null, error });
    });
  });
});
