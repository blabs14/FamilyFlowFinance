// src/services/splits.ts
// Unit 6 Task 9: repartição de uma transação por múltiplas categorias
import { supabase } from '@/lib/supabaseClient';

export interface SplitInput {
  categoria_id: string;
  amount_cents: number;
  description?: string | null;
  order_index?: number;
}

export interface TransactionSplit extends SplitInput {
  id: string;
  transaction_id: string;
  created_at: string;
}

/**
 * Substitui atomicamente todos os splits de uma transação.
 * Apaga os splits existentes e insere os novos.
 * O trigger deferrable valida que SUM(splits) <= transactions.amount_cents.
 */
export const updateTransactionSplits = async (
  transactionId: string,
  splits: SplitInput[]
): Promise<{ data: TransactionSplit[] | null; error: unknown }> => {
  try {
    // 1. Apagar splits existentes
    const { error: deleteError } = await supabase
      .from('transaction_splits')
      .delete()
      .eq('transaction_id', transactionId);

    if (deleteError) return { data: null, error: deleteError };

    // 2. Se sem splits, terminar (transação volta a ter categoria única)
    if (!splits.length) return { data: [], error: null };

    // 3. Inserir novos splits com order_index sequencial
    const rows = splits.map((s, i) => ({
      transaction_id: transactionId,
      categoria_id: s.categoria_id,
      amount_cents: s.amount_cents,
      description: s.description ?? null,
      order_index: s.order_index ?? i,
    }));

    const { data, error } = await supabase
      .from('transaction_splits')
      .insert(rows)
      .select();

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getTransactionSplits = async (
  transactionId: string
): Promise<{ data: TransactionSplit[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('transaction_splits')
      .select('*, categories(nome, cor)')
      .eq('transaction_id', transactionId)
      .order('order_index', { ascending: true });

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};
