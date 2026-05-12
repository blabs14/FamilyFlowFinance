// src/services/transfers.ts
// Unit 6 Task 8: serviço de transferências entre contas/cartões
import { supabase } from '@/lib/supabaseClient';

export interface TransferInsert {
  user_id: string;
  family_id?: string | null;
  from_account_id?: string | null;
  from_credit_card_id?: string | null;
  to_account_id?: string | null;
  to_credit_card_id?: string | null;
  amount_cents: number;
  currency?: string;
  date: string;       // YYYY-MM-DD
  description?: string | null;
  operation_id?: string;
}

export interface Transfer extends TransferInsert {
  id: string;
  event_time: string;
  reversal_of?: string | null;
  created_at: string;
  updated_at: string;
}

export const createTransfer = async (
  payload: TransferInsert
): Promise<{ data: Transfer | null; error: unknown }> => {
  try {
    const op_id = payload.operation_id
      ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}`);

    const { data, error } = await supabase
      .from('transfers')
      .insert([{ ...payload, operation_id: op_id }])
      .select()
      .single();

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const listTransfers = async (
  userId: string,
  familyId?: string | null
): Promise<{ data: Transfer[] | null; error: unknown }> => {
  try {
    let query = supabase
      .from('transfers')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (familyId) {
      query = supabase
        .from('transfers')
        .select('*')
        .eq('family_id', familyId)
        .order('date', { ascending: false });
    }

    const { data, error } = await query;
    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getTransfer = async (
  id: string
): Promise<{ data: Transfer | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('transfers')
      .select('*')
      .eq('id', id)
      .single();
    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteTransfer = async (
  id: string
): Promise<{ error: unknown }> => {
  try {
    // O trigger trigger_transfer_materialize com DELETE apaga as 2 transactions em cascade
    const { error } = await supabase
      .from('transfers')
      .delete()
      .eq('id', id);
    return { error };
  } catch (error) {
    return { error };
  }
};
