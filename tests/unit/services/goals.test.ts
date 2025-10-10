import { vi, describe, it, expect, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabaseClient';
import {
  getGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
  getGoalProgress,
  allocateToGoal,
} from '@/services/goals';

// Mock do Supabase
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

const mockSupabase = vi.mocked(supabase);

// Helper para criar mock query
const createMockQuery = (resolvedValue: any) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(resolvedValue),
  // Para operações que não usam single
  then: vi.fn().mockResolvedValue(resolvedValue),
});

describe('Goals Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGoals', () => {
    it('should fetch goals successfully', async () => {
      const mockGoals = [
        {
          id: '1',
          nome: 'Viagem para Europa',
          valor_alvo: 5000.00,
          valor_atual: 1500.00,
          descricao: 'Economizar para viagem de férias',
          data_limite: '2024-12-31',
          user_id: 'user-123',
          progresso: 30,
        },
        {
          id: '2',
          nome: 'Carro Novo',
          valor_alvo: 25000.00,
          valor_atual: 8000.00,
          descricao: 'Trocar de carro',
          data_limite: '2025-06-30',
          user_id: 'user-123',
          progresso: 32,
        },
      ];

      const mockQuery = createMockQuery({ data: mockGoals, error: null });
      // Sobrescrever order para retornar o resultado final
      mockQuery.order = vi.fn().mockResolvedValue({ data: mockGoals, error: null });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await getGoals('user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('goals');
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result.data).toEqual(mockGoals);
      expect(result.error).toBeNull();
    });

    it('should handle fetch error', async () => {
      const mockQuery = createMockQuery({ data: null, error: { message: 'Database error' } });
      // Sobrescrever order para retornar o erro
      mockQuery.order = vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await getGoals('user-123');

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'Database error' });
    });
  });

  describe('getGoal', () => {
    it('should fetch single goal', async () => {
      const mockGoal = {
        id: '1',
        nome: 'Viagem para Europa',
        valor_alvo: 5000.00,
        valor_atual: 1500.00,
        descricao: 'Economizar para viagem de férias',
        data_limite: '2024-12-31',
        user_id: 'user-123',
        progresso: 30,
      };

      const mockQuery = createMockQuery({ data: mockGoal, error: null });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await getGoal('goal-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('goals');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'goal-1');
      expect(mockQuery.single).toHaveBeenCalled();
      expect(result.data).toEqual(mockGoal);
    });

    it('should handle goal not found', async () => {
      const mockQuery = createMockQuery({ data: null, error: { message: 'Goal not found' } });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await getGoal('non-existent');

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'Goal not found' });
    });
  });

  describe('createGoal', () => {
    it('should create goal successfully', async () => {
      const newGoal = {
        nome: 'Novo Objetivo',
        valor_alvo: 3000.00,
        descricao: 'Economizar para equipamento',
        data_limite: '2024-12-31',
        user_id: 'user-123',
      };

      const createdGoal = {
        id: 'new-goal-id',
        ...newGoal,
        valor_atual: 0,
        progresso: 0,
        created_at: '2024-01-20T10:00:00Z',
      };

      const mockQuery = createMockQuery({ data: createdGoal, error: null });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await createGoal(newGoal, 'user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('goals');
      expect(mockQuery.insert).toHaveBeenCalledWith([{
        ...newGoal,
        user_id: 'user-123',
      }]);
      expect(mockQuery.select).toHaveBeenCalled();
      expect(mockQuery.single).toHaveBeenCalled();
      expect(result.data).toEqual(createdGoal);
    });

    it('should handle create error', async () => {
      const newGoal = {
        nome: 'Novo Objetivo',
        valor_alvo: 3000.00,
        descricao: 'Economizar para equipamento',
        data_limite: '2024-12-31',
        user_id: 'user-123',
      };

      const mockQuery = createMockQuery({ data: null, error: { message: 'Insert failed' } });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await createGoal(newGoal, 'user-123');

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'Insert failed' });
    });
  });

  describe('updateGoal', () => {
    it('should update goal successfully', async () => {
      const updateData = {
        nome: 'Objetivo Atualizado',
        valor_alvo: 4000.00,
        descricao: 'Descrição atualizada',
        data_limite: '2025-01-31',
      };

      const updatedGoal = {
        id: 'goal-1',
        ...updateData,
        valor_atual: 1000.00,
        progresso: 25,
        user_id: 'user-123',
      };

      const mockQuery = createMockQuery({ data: updatedGoal, error: null });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await updateGoal('goal-1', updateData, 'user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('goals');
      expect(mockQuery.update).toHaveBeenCalledWith(updateData);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'goal-1');
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockQuery.select).toHaveBeenCalled();
      expect(mockQuery.single).toHaveBeenCalled();
      expect(result.data).toEqual(updatedGoal);
    });

    it('should handle update error', async () => {
      const updateData = {
        nome: 'Objetivo Atualizado',
        valor_alvo: 4000.00,
      };

      const mockQuery = createMockQuery({ data: null, error: { message: 'Update failed' } });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await updateGoal('goal-1', updateData, 'user-123');

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'Update failed' });
    });
  });

  describe('deleteGoal', () => {
    it('should delete a goal successfully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { success: true, message: 'Goal deleted successfully' },
        error: null,
      });

      const result = await deleteGoal('goal-1', 'user-123');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_goal_with_restoration', {
        goal_id_param: 'goal-1',
        user_id_param: 'user-123',
        idempotency_key: 'user-123:goal-1:delete'
      });
      expect(result.data).toEqual({ success: true, message: 'Goal deleted successfully' });
      expect(result.error).toBeNull();
    });

    it('should handle delete error', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });

      const result = await deleteGoal('goal-1', 'user-123');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_goal_with_restoration', {
        goal_id_param: 'goal-1',
        user_id_param: 'user-123',
        idempotency_key: 'user-123:goal-1:delete'
      });
      expect(result.error).toEqual({ message: 'Delete failed' });
    });
  });



  describe('getGoalProgress', () => {
    it('should fetch goal progress successfully', async () => {
      const mockProgress = [
        {
          goal_id: 'goal-1',
          current_amount: 500,
          target_amount: 1000,
          progress_percentage: 50,
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockProgress,
        error: null,
      });

      const result = await getGoalProgress('user-123');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_goal_progress', { user_id: 'user-123' });
      expect(result.data).toEqual(mockProgress);
      expect(result.error).toBeNull();
    });

    it('should handle progress fetch error', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Progress calculation failed' },
      });

      const result = await getGoalProgress('user-123');

      expect(result.error).toEqual({ message: 'Progress calculation failed' });
    });
  });

  describe('allocateToGoal', () => {
    it('should allocate to goal successfully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await allocateToGoal('goal-1', 'account-1', 500.00, 'user-123', 'Monthly allocation');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('allocate_to_goal_with_transaction', {
        goal_id_param: 'goal-1',
        account_id_param: 'account-1',
        amount_param: 500.00,
        user_id_param: 'user-123',
        description_param: 'Monthly allocation'
      });
      expect(result.data).toEqual({ success: true });
      expect(result.error).toBeNull();
    });

    it('should handle allocate to goal error', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Allocation failed' },
      });

      const result = await allocateToGoal('goal-1', 'account-1', 500.00, 'user-123');

      expect(result.error).toEqual({ message: 'Allocation failed' });
    });
  });
});