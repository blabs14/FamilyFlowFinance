import { vi, describe, it, expect, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabaseClient';
import {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
} from '@/services/accounts';
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
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(resolvedValue),
  // Para operações que não usam single
  then: vi.fn().mockResolvedValue(resolvedValue),
});

describe('Accounts Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAccounts', () => {
    it('should fetch accounts successfully', async () => {
      const mockAccounts = [
        {
          id: '1',
          nome: 'Conta Corrente',
          tipo: 'corrente',
          saldo_atual: 1500.00,
          saldo_inicial: 1000.00,
          user_id: 'user-123',
        },
        {
          id: '2',
          nome: 'Conta Poupança',
          tipo: 'poupanca',
          saldo_atual: 5000.00,
          saldo_inicial: 5000.00,
          user_id: 'user-123',
        },
      ];

      const mockQuery = createMockQuery({
        data: mockAccounts,
        error: null,
      });
      
      // Override order para retornar o resultado final
      mockQuery.order = vi.fn().mockResolvedValue({
        data: mockAccounts,
        error: null,
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await getAccounts();

      expect(mockSupabase.from).toHaveBeenCalledWith('accounts');
      expect(mockQuery.select).toHaveBeenCalledWith('*');
      expect(mockQuery.order).toHaveBeenCalledWith('nome');
      expect(result.data).toEqual(mockAccounts);
      expect(result.error).toBeNull();
    });

    it('should handle fetch error', async () => {
      const mockQuery = createMockQuery({
        data: null,
        error: { message: 'Database error' },
      });
      
      // Override order para retornar o resultado final
      mockQuery.order = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await getAccounts();

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'Database error' });
    });
  });

  describe('getAccount', () => {
    it('should fetch single account', async () => {
      const mockAccount = {
        id: '1',
        nome: 'Conta Corrente',
        tipo: 'corrente',
        saldo_atual: 1500.00,
        saldo_inicial: 1000.00,
        user_id: 'user-123',
      };

      const mockQuery = createMockQuery({
        data: mockAccount,
        error: null,
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await getAccount('account-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('accounts');
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'account-1');
      expect(mockQuery.single).toHaveBeenCalled();
      expect(result.data).toEqual(mockAccount);
    });

    it('should handle account not found', async () => {
      const mockQuery = createMockQuery({
        data: null,
        error: { message: 'Account not found' },
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await getAccount('non-existent');

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'Account not found' });
    });
  });

  describe('createAccount', () => {
    it('should create account successfully', async () => {
      const newAccount = {
        nome: 'Nova Conta',
        tipo: 'corrente' as const,
        saldo_inicial: 1000.00,
      };

      const createdAccount = {
        id: 'new-account-id',
        ...newAccount,
        user_id: 'user-123',
        saldo_atual: 1000.00,
        created_at: '2024-01-20T10:00:00Z',
      };

      const mockQuery = createMockQuery({
        data: createdAccount,
        error: null,
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await createAccount(newAccount, 'user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('accounts');
      expect(mockQuery.insert).toHaveBeenCalledWith([{
        ...newAccount,
        user_id: 'user-123',
      }]);
      expect(mockQuery.select).toHaveBeenCalled();
      expect(mockQuery.single).toHaveBeenCalled();
      expect(result.data).toEqual(createdAccount);
    });

    it('should create account with zero initial balance', async () => {
      const newAccount = {
        nome: 'Conta Sem Saldo',
        tipo: 'corrente' as const,
        saldo_inicial: 0,
      };

      const createdAccount = {
        id: 'new-account-id',
        ...newAccount,
        user_id: 'user-123',
        saldo_atual: 0,
      };

      const mockQuery = createMockQuery({
        data: createdAccount,
        error: null,
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await createAccount(newAccount, 'user-123');

      expect(mockQuery.insert).toHaveBeenCalledWith([{
        ...newAccount,
        user_id: 'user-123',
      }]);
      expect(result.data).toEqual(createdAccount);
    });

    it('should handle create error', async () => {
      const newAccount = {
        nome: 'Nova Conta',
        tipo: 'corrente' as const,
        saldo_inicial: 1000.00,
      };

      const mockQuery = createMockQuery({
        data: null,
        error: { message: 'Insert failed' },
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await createAccount(newAccount, 'user-123');

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'Insert failed' });
    });
  });

  describe('updateAccount', () => {
    it('should update account successfully', async () => {
      const updateData = {
        nome: 'Conta Atualizada',
        tipo: 'poupanca' as const,
        // cenário base: sem saldoAtual nem ajusteSaldo, deve usar update direto
      } as const;

      const updatedAccount = {
        id: 'account-1',
        ...updateData,
        saldo_atual: 2500.00,
        user_id: 'user-123',
      };

      const mockQuery = createMockQuery({
        data: updatedAccount,
        error: null,
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await updateAccount('account-1', updateData, 'user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('accounts');
      expect(mockQuery.update).toHaveBeenCalledWith(updateData);
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'account-1');
      expect(mockQuery.select).toHaveBeenCalled();
      expect(mockQuery.single).toHaveBeenCalled();
      expect(result.data).toEqual(updatedAccount);
    });

    it('should handle update error', async () => {
      const updateData = {
        nome: 'Conta Atualizada',
        tipo: 'poupanca' as const,
      } as const;

      const mockQuery = createMockQuery({
        data: null,
        error: { message: 'Update failed' },
      });

      mockSupabase.from.mockReturnValue(mockQuery as any);

      const result = await updateAccount('account-1', updateData, 'user-123');

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'Update failed' });
    });
  });

  describe('deleteAccount', () => {
    it('should delete account successfully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await deleteAccount('account-1', 'user-123');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_account_with_related_data', {
        p_account_id: 'account-1',
        p_user_id: 'user-123'
      });
      expect(result.data).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should handle delete error', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });

      const result = await deleteAccount('account-1', 'user-123');

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'Delete failed' });
    });

    it('should handle RPC error response', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { success: false, error: 'Cannot delete account with existing transactions' },
        error: null,
      });

      const result = await deleteAccount('account-1', 'user-123');

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'Cannot delete account with existing transactions' });
    });

    it('should handle unexpected response format', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 'unexpected',
        error: null,
      });

      const result = await deleteAccount('account-1', 'user-123');

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'Resposta inesperada do servidor' });
    });
  });
});

// Novos testes de regressão: separação Personal vs Family + mapeamento familyId
describe('Accounts Service - Family vs Personal (Regressão)', () => {
  it('getAccountsWithBalances deve excluir contas com family_id (área pessoal)', async () => {
    const personal = {
      account_id: 'a1', user_id: 'u1', family_id: null,
      nome: 'Conta Pessoal', tipo: 'conta', saldo_atual: 100, total_reservado: 0, saldo_disponivel: 100,
    };
    const family = {
      account_id: 'a2', user_id: 'u1', family_id: 'fam-1',
      nome: 'Conta Família', tipo: 'conta', saldo_atual: 50, total_reservado: 0, saldo_disponivel: 50,
    };

    (supabase.rpc as any).mockResolvedValueOnce({ data: [personal, family], error: null });

    const { getAccountsWithBalances } = await import('@/services/accounts');
    const result = await getAccountsWithBalances('u1');

    expect(supabase.rpc).toHaveBeenCalledWith('get_user_accounts_with_balances', { p_user_id: 'u1' });
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]).toMatchObject({ account_id: 'a1', family_id: null });
  });

  it('getFamilyAccountsWithBalances deve devolver apenas contas com family_id', async () => {
    const family = {
      account_id: 'a2', user_id: 'u1', family_id: 'fam-1',
      nome: 'Conta Família', tipo: 'conta', saldo_atual: 50, total_reservado: 0, saldo_disponivel: 50,
    };

    (supabase.rpc as any).mockResolvedValueOnce({ data: [family], error: null });

    const { getFamilyAccountsWithBalances } = await import('@/services/accounts');
    const result = await getFamilyAccountsWithBalances('u1');

    expect(supabase.rpc).toHaveBeenCalledWith('get_family_accounts_with_balances', { p_user_id: 'u1' });
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]).toMatchObject({ account_id: 'a2', family_id: 'fam-1' });
  });
});