// src/services/__tests__/accounts.unit05.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn(),
    rpc: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

import { softDeleteAccount, reorderAccounts, getAccountsScoped } from '../accounts';

describe('accounts service — Unit 5', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('softDeleteAccount', () => {
    it('chama RPC soft_delete_account com account_id e user_id', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({
        data: { success: true, account_id: 'acc-1' },
        error: null,
      });

      const result = await softDeleteAccount('acc-1', 'user-1');
      expect(supabase.rpc).toHaveBeenCalledWith('soft_delete_account', {
        p_account_id: 'acc-1',
        p_user_id: 'user-1',
      });
      expect(result.data).toBe(true);
      expect(result.error).toBeNull();
    });

    it('devolve error quando RPC falha', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: { message: 'Conta não encontrada' },
      });

      const result = await softDeleteAccount('acc-missing', 'user-1');
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
    });
  });

  describe('reorderAccounts', () => {
    it('chama RPC reorder_accounts com items JSON', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({ data: null, error: null });

      const items = [
        { id: 'acc-1', order_index: 0 },
        { id: 'acc-2', order_index: 1 },
      ];
      await reorderAccounts('user-1', items);

      expect(supabase.rpc).toHaveBeenCalledWith('reorder_accounts', {
        p_user_id: 'user-1',
        p_items: items,
      });
    });
  });

  describe('getAccountsScoped', () => {
    it('chama RPC get_user_accounts com user_id', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({
        data: [{ account_id: 'acc-1', nome: 'Conta', tipo: 'corrente', currency: 'EUR', saldo_atual: 1000 }],
        error: null,
      });

      const result = await getAccountsScoped({ userId: 'user-1' });
      expect(supabase.rpc).toHaveBeenCalledWith('get_user_accounts', {
        p_user_id: 'user-1',
        p_family_id: null,
      });
      expect(result.data).toHaveLength(1);
    });

    it('inclui family_id quando scope é family', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({ data: [], error: null });

      await getAccountsScoped({ userId: 'user-1', familyId: 'fam-1' });
      expect(supabase.rpc).toHaveBeenCalledWith('get_user_accounts', {
        p_user_id: 'user-1',
        p_family_id: 'fam-1',
      });
    });
  });
});
