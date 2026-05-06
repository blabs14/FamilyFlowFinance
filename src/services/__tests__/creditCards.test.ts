// src/services/__tests__/creditCards.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    rpc: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

import {
  getCreditCardsScoped,
  createCreditCard,
  updateCreditCard,
  softDeleteCreditCard,
  payCreditCard,
} from '../creditCards';

describe('creditCards service', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getCreditCardsScoped', () => {
    it('chama RPC get_user_credit_cards com user_id', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({
        data: [{ card_id: 'card-1', nome: 'Cartão Visa', currency: 'EUR' }],
        error: null,
      });

      const result = await getCreditCardsScoped({ userId: 'user-1' });
      expect(supabase.rpc).toHaveBeenCalledWith('get_user_credit_cards', {
        p_user_id: 'user-1',
        p_family_id: null,
      });
      expect(result.data).toHaveLength(1);
      expect(result.error).toBeNull();
    });

    it('inclui family_id quando scope é family', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({ data: [], error: null });

      await getCreditCardsScoped({ userId: 'user-1', familyId: 'fam-1' });
      expect(supabase.rpc).toHaveBeenCalledWith('get_user_credit_cards', {
        p_user_id: 'user-1',
        p_family_id: 'fam-1',
      });
    });
  });

  describe('createCreditCard', () => {
    it('insere na tabela credit_cards e devolve a linha criada', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      const mockCard = { id: 'card-new', nome: 'Cartão MB', user_id: 'user-1' };
      (supabase.from as any).mockReturnThis();
      (supabase.insert as any).mockReturnThis();
      (supabase.select as any).mockReturnThis();
      (supabase.single as any).mockResolvedValueOnce({ data: mockCard, error: null });

      const result = await createCreditCard({
        user_id: 'user-1',
        nome: 'Cartão MB',
        credit_limit_cents: 500000,
        currency: 'EUR',
      });

      expect(supabase.from).toHaveBeenCalledWith('credit_cards');
      expect(result.data).toEqual(mockCard);
    });
  });

  describe('softDeleteCreditCard', () => {
    it('chama RPC soft_delete_credit_card', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({
        data: { success: true, card_id: 'card-1' },
        error: null,
      });

      const result = await softDeleteCreditCard('card-1', 'user-1');
      expect(supabase.rpc).toHaveBeenCalledWith('soft_delete_credit_card', {
        p_card_id: 'card-1',
        p_user_id: 'user-1',
      });
      expect(result.data).toBe(true);
    });
  });

  describe('payCreditCard', () => {
    it('chama RPC pay_credit_card com todos os parâmetros', async () => {
      const { supabase } = await import('../../lib/supabaseClient');
      (supabase.rpc as any).mockResolvedValueOnce({
        data: { success: true, transaction_id: 'tx-1', card_id: 'card-1', amount_cents: 10000 },
        error: null,
      });

      const result = await payCreditCard({
        userId: 'user-1',
        cardId: 'card-1',
        fromAccountId: 'acc-1',
        amountCents: 10000,
        date: '2026-04-21',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('pay_credit_card', expect.objectContaining({
        p_user_id: 'user-1',
        p_card_id: 'card-1',
        p_from_account_id: 'acc-1',
        p_amount_cents: 10000,
      }));
      expect(result.data?.success).toBe(true);
    });
  });
});
