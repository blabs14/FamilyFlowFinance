import { vi, describe, it, expect, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '../transactions';

// Mock do Supabase
vi.mock('@/lib/supabase', () => ({
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
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(resolvedValue),
  // Para operações que não usam single
  then: vi.fn().mockResolvedValue(resolvedValue),
});

describe('Transactions Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTransactions', () => {
    it('should return transactions successfully', async () => {
      const mockTransactions = [
        { id: '1', descricao: 'Test 1', valor: 100 },
        { id: '2', descricao: 'Test 2', valor: 200 },
      ];

      const mockQuery = createMockQuery({
        data: mockTransactions,
        error: null,
      });
      
      // Override order para retornar o resultado final
      mockQuery.order = vi.fn().mockResolvedValue({
        data: mockTransactions,
        error: null,
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await getTransactions();

      expect(mockSupabase.from).toHaveBeenCalledWith('transactions');
      expect(mockQuery.select).toHaveBeenCalledWith('*');
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result.data).toEqual(mockTransactions);
    });



    it('should handle database error', async () => {
      const mockQuery = createMockQuery({
        data: null,
        error: { message: 'Database error' },
      });
      
      // Override order para retornar o erro
      mockQuery.order = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await getTransactions();

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'Database error' });
    });
  });

  describe('getTransaction', () => {
    it('should fetch single transaction', async () => {
      const mockTransaction = {
        id: '1',
        descricao: 'Compra supermercado',
        valor: -150.50,
        data: '2024-01-15',
        tipo: 'despesa',
        categoria: 'Alimentação',
      };

      const mockQuery = createMockQuery({
        data: mockTransaction,
        error: null,
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await getTransaction('transaction-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('transactions');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'transaction-1');
      expect(mockQuery.single).toHaveBeenCalled();
      expect(result.data).toEqual(mockTransaction);
    });

    it('should handle transaction not found', async () => {
      const mockQuery = createMockQuery({
        data: null,
        error: { message: 'Transaction not found' },
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await getTransaction('non-existent');

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'Transaction not found' });
    });
  });

  describe('createTransaction', () => {
    it('should create transaction successfully', async () => {
      const newTransaction = {
        descricao: 'Nova transação',
        valor: -100.00,
        data: '2024-01-20',
        tipo: 'despesa' as const,
        categoria: 'Transporte',
        conta_id: 'account-1',
        user_id: 'user-123',
      };

      const createdTransaction = {
        id: 'new-transaction-id',
        ...newTransaction,
      };

      const mockQuery = createMockQuery({
        data: { id: 'new-transaction-id', ...newTransaction, user_id: 'user-123' },
        error: null,
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const result = await createTransaction(newTransaction, 'user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('transactions');
      expect(mockQuery.insert).toHaveBeenCalledWith([{ ...newTransaction, user_id: 'user-123' }]);
      expect(mockQuery.select).toHaveBeenCalled();
      expect(mockQuery.single).toHaveBeenCalled();
      expect(result.data).toEqual({ id: 'new-transaction-id', ...newTransaction, user_id: 'user-123' });
    });

    it('should handle create error', async () => {
      const newTransaction = {
        descricao: 'Nova transação',
        valor: -100.00,
        data: '2024-01-20',
        tipo: 'despesa' as const,
        categoria: 'Transporte',
        conta_id: 'account-1',
        user_id: 'user-123',
      };

      const mockQuery = createMockQuery({
        data: null,
        error: { message: 'Insert failed' },
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await createTransaction(newTransaction, 'user-123');

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'Insert failed' });
    });
  });

  describe('updateTransaction', () => {
    it('should update transaction successfully', async () => {
      const updateData = {
        descricao: 'Transação atualizada',
        valor: -200.00,
        categoria: 'Alimentação',
      };

      const updatedTransaction = {
        id: 'transaction-1',
        ...updateData,
        data: '2024-01-15',
        tipo: 'despesa',
        conta_id: 'account-1',
        user_id: 'user-123',
      };

      const mockQuery = createMockQuery({
        data: updatedTransaction,
        error: null,
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const result = await updateTransaction('transaction-1', updateData, 'user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('transactions');
      expect(mockQuery.update).toHaveBeenCalledWith(updateData);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'transaction-1');
      expect(mockQuery.select).toHaveBeenCalled();
      expect(mockQuery.single).toHaveBeenCalled();
      expect(result.data).toEqual(updatedTransaction);
    });

    it('should handle update error', async () => {
      const updateData = {
        descricao: 'Transação atualizada',
        valor: -200.00,
      };

      const mockQuery = createMockQuery({
        data: null,
        error: { message: 'Update failed' },
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await updateTransaction('transaction-1', updateData, 'user-123');

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'Update failed' });
    });
  });

  describe('deleteTransaction', () => {
    it('should delete a transaction successfully', async () => {
      // Mock para a primeira chamada (select)
      const selectMockQuery = createMockQuery({
        data: { account_id: 'account-1' },
        error: null,
      });

      // Mock para a segunda chamada (delete)
      const deleteMockQuery = createMockQuery({
        data: null,
        error: null,
      });
      
      // Override delete para retornar o resultado final
      deleteMockQuery.eq = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      mockSupabase.from
        .mockReturnValueOnce(selectMockQuery as any)
        .mockReturnValueOnce(deleteMockQuery as any);
      
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const result = await deleteTransaction('transaction-1', 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('transactions');
      expect(selectMockQuery.select).toHaveBeenCalledWith('account_id');
      expect(selectMockQuery.eq).toHaveBeenCalledWith('id', 'transaction-1');
      expect(deleteMockQuery.delete).toHaveBeenCalled();
      expect(deleteMockQuery.eq).toHaveBeenCalledWith('id', 'transaction-1');
      expect(result.data).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should handle delete error', async () => {
      const mockSelectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { account_id: 'account-1' },
          error: null,
        }),
      };

      const mockDeleteQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Delete failed' },
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockSelectQuery as any)
        .mockReturnValueOnce(mockDeleteQuery as any);

      const result = await deleteTransaction('transaction-1', 'user-1');

      expect(result.error).toEqual({ message: 'Delete failed' });
    });
  });
});