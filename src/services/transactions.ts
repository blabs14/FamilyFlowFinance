import { supabase } from '@/lib/supabaseClient';
import { Transaction, TransactionInsert, TransactionUpdate } from '@/types/transaction';
import { Database } from '@/integrations/supabase/types';
import { logger } from '../shared/lib/logger';

export const getTransactions = async (): Promise<{ data: Transaction[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getTransaction = async (id: string): Promise<{ data: Transaction | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const createTransaction = async (transactionData: TransactionInsert, userId: string): Promise<{ data: Transaction | null; error: unknown }> => {
  try {
    // Verificar se é uma conta de cartão de crédito
    const { data: account } = await supabase
      .from('accounts')
      .select('tipo')
      .eq('id', transactionData.account_id)
      .single();
    
    if (account?.tipo === 'cartão de crédito') {
      // Enviar valor sempre positivo; o tipo controla o sentido
      const valorNorm = Math.abs(Number(transactionData.valor || 0));
      const rpcPayload: {
        p_user_id: string;
        p_account_id: string;
        p_valor: number;
        p_data: string;
        p_categoria_id: string | null;
        p_tipo: string;
        p_descricao?: string | null;
        p_goal_id?: string;
      } = {
        p_user_id: userId,
        p_account_id: transactionData.account_id,
        p_valor: valorNorm,
        p_data: transactionData.data,
        p_categoria_id: transactionData.categoria_id || null,
        p_tipo: transactionData.tipo,
        p_descricao: transactionData.descricao || null,
      };
      if (transactionData.goal_id) rpcPayload.p_goal_id = transactionData.goal_id;
      
      const { data, error } = await supabase.rpc('cc_tx_v1', rpcPayload);
    
      if (error) {
        // Fallback genérico: inserir diretamente e atualizar saldo
        const { data: inserted, error: insErr } = await supabase
          .from('transactions')
          .insert([{ 
            account_id: transactionData.account_id,
            user_id: userId,
            categoria_id: transactionData.categoria_id || null,
            valor: valorNorm,
            tipo: transactionData.tipo,
            data: transactionData.data,
            descricao: transactionData.descricao || null
          }])
          .select()
          .single();
        if (!insErr && inserted) {
          try { await supabase.rpc('update_account_balance', { account_id_param: transactionData.account_id }); } catch {}
          return { data: inserted as Transaction, error: null };
        }
        return { data: null, error: insErr || error };
      }
    
      const createdId = data as string | null;
      if (!createdId) return { data: null, error: new Error('Transação não criada') };

      const { data: createdTransaction, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', createdId)
        .single();
    
      return { data: createdTransaction || null, error: fetchError };
    } else {
      const { data, error } = await supabase
        .from('transactions')
        .insert([{ ...transactionData, user_id: userId }])
        .select()
        .single();

      if (!error && data) {
        try {
          await supabase.rpc('update_account_balance', {
            account_id_param: data.account_id
          });
        } catch (balanceError) {
          logger.warn('Erro ao atualizar saldo da conta:', balanceError);
        }
      }

      return { data, error };
    }
  } catch (error) {
    return { data: null, error };
  }
};

export const updateTransaction = async (id: string, updates: TransactionUpdate, userId: string): Promise<{ data: Transaction | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      try {
        await supabase.rpc('update_account_balance', {
          account_id_param: data.account_id
        });
      } catch (balanceError) {
        logger.warn('Erro ao atualizar saldo da conta:', balanceError);
      }
    }

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteTransaction = async (id: string, userId: string): Promise<{ data: boolean | null; error: unknown }> => {
  try {
    const { data: transaction } = await supabase
      .from('transactions')
      .select('account_id')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (!error && transaction) {
      try {
        await supabase.rpc('update_account_balance', {
          account_id_param: (transaction as Pick<Transaction, 'account_id'>).account_id
        });
      } catch (balanceError) {
        logger.warn('Erro ao atualizar saldo da conta:', balanceError);
      }
    }

    return { data: !error, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getPersonalTransactions = async (): Promise<{ data: Transaction[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_personal_transactions');
    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getFamilyTransactions = async (): Promise<{ data: Transaction[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_family_transactions');
    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

// Versões em domínio (opcionais)
export const getTransactionsDomain = async (): Promise<{ data: TransactionDomain[] | null; error: unknown }> => {
  const { data, error } = await getTransactions();
  return { data: (data || []).map(mapTransactionRowToDomain), error };
};

export const getTransactionDomain = async (id: string): Promise<{ data: TransactionDomain | null; error: unknown }> => {
  const { data, error } = await getTransaction(id);
  return { data: data ? mapTransactionRowToDomain(data) : null, error };
};

export const createTransactionDomain = async (transactionData: TransactionInsert, userId: string): Promise<{ data: TransactionDomain | null; error: unknown }> => {
  const { data, error } = await createTransaction(transactionData, userId);
  return { data: data ? mapTransactionRowToDomain(data) : null, error };
};

export const updateTransactionDomain = async (id: string, updates: TransactionUpdate, userId: string): Promise<{ data: TransactionDomain | null; error: unknown }> => {
  const { data, error } = await updateTransaction(id, updates, userId);
  return { data: data ? mapTransactionRowToDomain(data) : null, error };
};

export const getCreditCardSummary = async (cardAccountId: string): Promise<{ data: { saldo: number; total_gastos: number; total_pagamentos: number; status: string; ciclo_inicio: string } | null; error: unknown }> => {
  try {
    // Alguns tipos gerados podem exigir p_user_id; a função atual só usa p_account_id
    const { data, error } = await supabase.rpc('get_credit_card_summary', {
      p_account_id: cardAccountId
    });
    if (error) return { data: null, error };
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== 'object') return { data: null, error: null };
    
    const rowObj = row as Record<string, unknown>;
    const shaped = {
      saldo: Number(rowObj.saldo ?? 0),
      total_gastos: Number(rowObj.total_gastos ?? 0),
      total_pagamentos: Number(rowObj.total_pagamentos ?? 0),
      status: String(rowObj.status ?? ''),
      ciclo_inicio: String(rowObj.ciclo_inicio ?? '')
    };
    return { data: shaped, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const payCreditCardFromAccount = async (
  userId: string,
  cardAccountId: string,
  bankAccountId: string,
  amount: number,
  dateISO: string,
  descricao?: string
): Promise<{ data: { amountPaid: number } | null; error: unknown }> => {
  try {
    // Obter saldo atual do cartão para calcular teto de pagamento (até 0)
    const { data: cardAcc, error: cardErr } = await supabase
      .from('account_balances')
      .select('saldo_atual')
      .eq('account_id', cardAccountId)
      .single();
    if (cardErr) return { data: null, error: cardErr };

    const currentBalance = Number(cardAcc?.saldo_atual || 0);
    const currentDebt = Math.max(0, -currentBalance); // dívida é o valor positivo em falta
    const requested = Math.abs(amount);
    const amountToPay = Math.min(requested, currentDebt);

    // Nada a pagar (cartão já liquidado)
    if (amountToPay <= 0) {
      return { data: { amountPaid: 0 }, error: null };
    }

    const { data, error } = await supabase.rpc('pay_credit_card_from_account', {
      p_user_id: userId,
      p_card_account_id: cardAccountId,
      p_bank_account_id: bankAccountId,
      p_amount: amountToPay,
      p_date: dateISO,
      p_descricao: descricao ?? null
    });

    if (!error) {
      try {
        await Promise.all([
          supabase.rpc('update_account_balance', { account_id_param: bankAccountId }),
          supabase.rpc('update_account_balance', { account_id_param: cardAccountId })
        ]);
      } catch (balanceError) {
        logger.warn('Erro ao recalcular saldos após pagamento de cartão:', balanceError);
      }
    }

    return { data: { amountPaid: amountToPay }, error };
  } catch (error) {
    return { data: null, error };
  }
};