// src/services/creditCards.ts
// Unit 5: serviço de cartões de crédito
import { supabase } from '../lib/supabaseClient';
import { logger } from '../shared/lib/logger';

export type CreditCardInsertData = {
  user_id: string;
  family_id?: string | null;
  nome: string;
  credit_limit_cents: number;
  current_balance_cents?: number;
  closing_day?: number | null;
  payment_day?: number | null;
  apr?: number;
  annual_fee_cents?: number;
  currency?: string;
  order_index?: number | null;
};

export type CreditCardUpdateData = Partial<CreditCardInsertData>;

// ── Leitura ──────────────────────────────────────────────────────────────────

export const getCreditCardsScoped = async (
  options: { userId: string; familyId?: string | null }
): Promise<{ data: Record<string, unknown>[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_user_credit_cards', {
      p_user_id: options.userId,
      p_family_id: options.familyId ?? null,
    });
    if (error) return { data: null, error };
    return { data: (data || []) as Record<string, unknown>[], error: null };
  } catch (error) {
    logger.error('[creditCards] getCreditCardsScoped', error);
    return { data: null, error };
  }
};

// ── CRUD ─────────────────────────────────────────────────────────────────────

export const createCreditCard = async (
  cardData: CreditCardInsertData
): Promise<{ data: Record<string, unknown> | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('credit_cards')
      .insert([{
        user_id:               cardData.user_id,
        family_id:             cardData.family_id ?? null,
        nome:                  cardData.nome,
        credit_limit_cents:    cardData.credit_limit_cents,
        current_balance_cents: cardData.current_balance_cents ?? 0,
        closing_day:           cardData.closing_day ?? null,
        payment_day:           cardData.payment_day ?? null,
        apr:                   cardData.apr ?? 0,
        annual_fee_cents:      cardData.annual_fee_cents ?? 0,
        currency:              cardData.currency ?? 'EUR',
        order_index:           cardData.order_index ?? null,
      }])
      .select()
      .single();
    return { data: data as Record<string, unknown> | null, error };
  } catch (error) {
    logger.error('[creditCards] createCreditCard', error);
    return { data: null, error };
  }
};

export const updateCreditCard = async (
  cardId: string,
  updates: CreditCardUpdateData,
  userId?: string
): Promise<{ data: Record<string, unknown> | null; error: unknown }> => {
  try {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data: authData } = await supabase.auth.getUser();
      resolvedUserId = authData?.user?.id;
    }
    if (!resolvedUserId) return { data: null, error: { message: 'Utilizador não autenticado' } };

    const { data, error } = await supabase
      .from('credit_cards')
      .update(updates as Record<string, unknown>)
      .eq('id', cardId)
      .eq('user_id', resolvedUserId)
      .select()
      .single();
    return { data: data as Record<string, unknown> | null, error };
  } catch (error) {
    logger.error('[creditCards] updateCreditCard', error);
    return { data: null, error };
  }
};

export const softDeleteCreditCard = async (
  cardId: string,
  userId?: string
): Promise<{ data: boolean | null; error: unknown }> => {
  try {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data: authData } = await supabase.auth.getUser();
      resolvedUserId = authData?.user?.id;
    }
    if (!resolvedUserId) return { data: null, error: { message: 'Utilizador não autenticado' } };

    const { data, error } = await supabase.rpc('soft_delete_credit_card', {
      p_card_id: cardId,
      p_user_id: resolvedUserId,
    });
    if (error) return { data: null, error };
    return { data: (data as { success?: boolean } | null)?.success ? true : null, error: null };
  } catch (error) {
    logger.error('[creditCards] softDeleteCreditCard', error);
    return { data: null, error };
  }
};

// ── Pagamento ─────────────────────────────────────────────────────────────────

export type PayCreditCardParams = {
  userId: string;
  cardId: string;
  fromAccountId: string;
  amountCents: number;
  date?: string;
  description?: string;
};

export const payCreditCard = async (
  params: PayCreditCardParams
): Promise<{ data: { success: boolean; transaction_id: string; card_id: string; amount_cents: number } | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('pay_credit_card', {
      p_user_id:         params.userId,
      p_card_id:         params.cardId,
      p_from_account_id: params.fromAccountId,
      p_amount_cents:    params.amountCents,
      p_date:            params.date ?? new Date().toISOString().split('T')[0],
      p_description:     params.description ?? 'Pagamento de cartão de crédito',
      p_operation_id:    crypto.randomUUID(),
    });
    if (error) return { data: null, error };
    return { data: data as { success: boolean; transaction_id: string; card_id: string; amount_cents: number } | null, error: null };
  } catch (error) {
    logger.error('[creditCards] payCreditCard', error);
    return { data: null, error };
  }
};

// ── Reordenação ───────────────────────────────────────────────────────────────

export const reorderCreditCards = async (
  userId: string,
  items: Array<{ id: string; order_index: number }>
): Promise<{ error: unknown }> => {
  try {
    const { error } = await supabase.rpc('reorder_credit_cards', {
      p_user_id: userId,
      p_items: items,
    });
    return { error };
  } catch (error) {
    return { error };
  }
};
