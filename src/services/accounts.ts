import { supabase } from '../lib/supabaseClient';
import { 
  Account, 
  AccountInsert, 
  AccountUpdate, 
  AccountUpdateExtended,
  AccountWithBalances,
  AccountBalance,
  AccountReserved
} from '../integrations/supabase/types';
import { AccountDomain, AccountWithBalancesDomain, mapAccountRowToDomain, mapAccountWithBalancesToDomain } from '../shared/types/accounts';
import { logger } from '../shared/lib/logger';

export const getAccounts = async (userId?: string): Promise<{ data: Account[] | null; error: unknown }> => {
  try {
    let query = supabase
      .from('accounts')
      .select('*')
      .order('nome');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    return { data: (data as Account[]) ?? null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getAccountsDomain = async (userId?: string): Promise<{ data: AccountDomain[]; error: unknown }> => {
  const { data, error } = await getAccounts(userId);
  return { data: (data || []).map(mapAccountRowToDomain), error };
};

export const getAccount = async (id: string): Promise<{ data: Account | null; error: unknown }> => {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();

    return { data: data || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const createAccount = async (accountData: AccountInsert, userId?: string): Promise<{ data: Account | null; error: unknown }> => {
  try {
    console.log('🔍 createAccount - Dados recebidos:', accountData);
    let resolvedUserId: string | undefined = (userId && userId.trim() !== '') ? userId : (accountData.user_id as string | undefined);
    console.log('🔍 createAccount - User ID:', resolvedUserId);
    if (!resolvedUserId) {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (!authError && authData?.user?.id) {
          resolvedUserId = authData.user.id;
        }
      } catch {
        // ignore
      }
    }
    if (!resolvedUserId) {
      return { data: null, error: { message: 'Utilizador não autenticado' } };
    }

    let adjustedData: AccountInsert = { ...accountData };
    if ((adjustedData.tipo === 'cartão de crédito') && ((adjustedData.amount_cents || 0) > 0)) {
      adjustedData = { ...adjustedData, amount_cents: 0 };
    }

    // Garantir que o family_id é propagado quando fornecido
    const rawFamilyId = (adjustedData as { family_id?: string | null }).family_id;
    const hasFamilyId = typeof rawFamilyId === 'string' && rawFamilyId.trim() !== '';
    const insertPayload: AccountInsert = {
      ...adjustedData,
      user_id: resolvedUserId,
      ...(hasFamilyId ? { family_id: rawFamilyId as string } : {}),
    } as AccountInsert;
    console.log('🔍 createAccount - Payload a inserir:', insertPayload);

    const { data, error } = await supabase
      .from('accounts')
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    const created = data as Account;

    // Pós-criação: aplicar lógicas específicas por tipo
    if (created) {
      if (created.tipo === 'cartão de crédito') {
        const { error: creditCardError } = await supabase.rpc('handle_credit_card_account', {
          p_account_id: created.id,
          p_user_id: resolvedUserId,
          p_operation: 'create'
        });
        if (creditCardError) {
          logger.warn('Aviso ao aplicar lógica de cartão de crédito:', creditCardError);
        }
      } else {
        // Para contas normais: se foi fornecido saldo inicial > 0, criar transação de ajuste até ao alvo
        const initialBalance = (Number((accountData as any).amount_cents) || 0) / 100;
        if (initialBalance !== 0) {
          const { error: setErr } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }).rpc('set_regular_account_balance', {
            p_user_id: resolvedUserId,
            p_account_id: created.id,
            p_new_balance: initialBalance
          });
          if (setErr) {
            logger.warn('Aviso ao definir saldo inicial:', setErr);
          }
        }
      }
    }

    // Recarregar a conta atualizada para refletir o saldo calculado
    const { data: refreshed, error: fetchErr } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', (created as Account).id)
      .single();

    return { data: (refreshed as Account) || created, error: fetchErr || null };
  } catch (error) {
    return { data: null, error };
  }
};

export const updateAccount = async (id: string, updates: AccountUpdateExtended, userId?: string): Promise<{ data: Account | null; error: unknown }> => {
  try {
    let resolvedUserId: string | undefined = userId;
    if (!resolvedUserId) {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (!authError && authData?.user?.id) {
          resolvedUserId = authData.user.id;
        }
      } catch {
        // ignore, ficará undefined se não obtivermos user
      }
    }
    if (!resolvedUserId) {
      return { data: null, error: { message: 'Utilizador não autenticado' } };
    }
    
    const onlyNameAndType = ('nome' in updates && 'tipo' in updates) &&
      Object.keys(updates).every((k) => k === 'nome' || k === 'tipo');

    if (onlyNameAndType) {
      let query = supabase
        .from('accounts')
        .update({ nome: updates.nome as AccountUpdate['nome'], tipo: updates.tipo as AccountUpdate['tipo'] })
        .eq('id', id);
      if (resolvedUserId) query = query.eq('user_id', resolvedUserId);
      const { data, error } = await query
        .select()
        .single();

      return { data: data as Account, error };
    }
    
    const otherUpdates: Partial<AccountUpdate> = {};
    let needsAdjustmentTransaction = false;
    let adjustmentAmount = 0;

    if (updates.saldoAtual !== undefined) {
      const { data: accountData } = await supabase
        .from('accounts')
        .select('tipo')
        .eq('id', id)
        .single();

      if ((accountData as { tipo?: string } | null)?.tipo === 'cartão de crédito') {
        // Para cartões de crédito, distinguir entre saldo alvo e ajuste
        let target: number;
        
        // Obter saldo atual primeiro
        const { data: currentBalanceData } = await supabase
          .from('account_balances')
          .select('saldo_atual')
          .eq('account_id', id)
          .single();
        
        const currentBalance = currentBalanceData?.saldo_atual || 0;
        
        // Verificar se é um ajuste (ajusteSaldo != 0) ou mudança de saldo alvo
        if (updates.ajusteSaldo !== undefined && updates.ajusteSaldo !== null && updates.ajusteSaldo !== 0) {
          // É um ajuste - aplicar ao saldo atual
          target = currentBalance + Number(updates.ajusteSaldo);
        } else if (updates.saldoAtual !== undefined && updates.saldoAtual !== null && updates.saldoAtual !== currentBalance) {
          // É uma mudança de saldo alvo (diferente do atual)
          target = updates.saldoAtual;
        } else {
          // Nenhum ajuste real - não fazer nada
          return { data: null, error: { message: 'Nenhum ajuste de saldo especificado' } };
        }
        
        const { error: rpcError } = await supabase.rpc('manage_credit_card_balance', {
          p_user_id: resolvedUserId,
          p_account_id: id,
          p_new_balance: target
        });

        if (rpcError) {
          return { data: null, error: rpcError };
        }

        const { data: updatedAccount, error: fetchError } = await supabase
          .from('accounts')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) {
          return { data: null, error: fetchError };
        }

        return { data: updatedAccount as Account, error: null };
      }
      // Para contas não-cartão: definir diretamente o saldo para o valor indicado (sem cálculos)
      const newBalance = updates.saldoAtual || 0;
      // Atualizar nome/tipo, se necessário
      if (typeof updates.nome === 'string' || typeof updates.tipo === 'string') {
        const baseUpdates: Partial<AccountUpdate> = {};
        if (typeof updates.nome === 'string') baseUpdates.nome = updates.nome as AccountUpdate['nome'];
        if (typeof updates.tipo === 'string') baseUpdates.tipo = updates.tipo as AccountUpdate['tipo'];
        let q = supabase.from('accounts').update(baseUpdates).eq('id', id);
        if (resolvedUserId) q = q.eq('user_id', resolvedUserId);
        const { error: baseErr } = await q.select('id').single();
        if (baseErr) return { data: null, error: baseErr };
      }
      // Definir saldo via função robusta
      const { error: setErr } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }).rpc('set_regular_account_balance', {
        p_user_id: resolvedUserId,
        p_account_id: id,
        p_new_balance: newBalance
      });
      if (setErr) {
        return { data: null, error: setErr };
      }
      const { data: updData2, error: fetchErr2 } = await supabase.from('accounts').select('*').eq('id', id).single();
      return { data: updData2 as Account, error: fetchErr2 };
    }

    if (updates.ajusteSaldo !== undefined && updates.ajusteSaldo !== 0) {
      needsAdjustmentTransaction = true;
      adjustmentAmount = updates.ajusteSaldo;
      // não propagar ajusteSaldo para o PATCH
    }

    // saldo column was dropped in Phase 3a — balance updates go via saldoAtual/ajusteSaldo above

    // Adicionar campos válidos (nome, tipo, family_id) caso tenham sido enviados
    if (typeof updates.nome === 'string') {
      otherUpdates.nome = updates.nome as AccountUpdate['nome'];
    }
    if (typeof updates.tipo === 'string') {
      otherUpdates.tipo = updates.tipo as AccountUpdate['tipo'];
    }
    if ((updates as Partial<AccountUpdate>).family_id !== undefined) {
      otherUpdates.family_id = (updates as Partial<AccountUpdate>).family_id as AccountUpdate['family_id'];
    }

    if (needsAdjustmentTransaction && adjustmentAmount !== 0) {
      let categoryId: string | null = null;
      
      const { data: ajusteCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('nome', 'Ajuste')
        .eq('user_id', (resolvedUserId as string) || '')
        .single();

      if (ajusteCategory) {
        categoryId = (ajusteCategory as { id: string }).id;
      } else {
        const { data: newCategory, error: createCategoryError } = await supabase
          .from('categories')
          .insert([
            {
              nome: 'Ajuste',
              user_id: (resolvedUserId as string) || '',
              cor: '#6B7280'
            }
          ])
          .select('id')
          .single();

        if (createCategoryError) {
          return { data: null, error: createCategoryError };
        }
        categoryId = (newCategory as { id?: string } | null)?.id || null;
      }

      if (categoryId) {
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert([
            {
              account_id: id,
              categoria_id: categoryId,
              user_id: (resolvedUserId as string) || '',
              valor: Math.abs(adjustmentAmount),
              tipo: adjustmentAmount > 0 ? 'receita' : 'despesa',
              data: new Date().toISOString().split('T')[0],
              descricao: `Ajuste de saldo: ${adjustmentAmount > 0 ? '+' : ''}${adjustmentAmount.toFixed(2)}€`
            }
          ]);

        if (transactionError) {
          return { data: null, error: transactionError };
        }

        // Atualizar o saldo agregado após a transação de ajuste
        try {
          await supabase.rpc('update_account_balance', { account_id_param: id });
        } catch (e) {
          // Ignorar erro de RPC em ambientes onde não exista
        }
      }
    }

    if (Object.keys(otherUpdates).length === 0) {
      const { data: acc, error: fetchErr } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', id)
        .single();
      return { data: acc as Account, error: fetchErr };
    }

    let updateQuery = supabase
      .from('accounts')
      .update(otherUpdates as AccountUpdate)
      .eq('id', id);
    if (resolvedUserId) updateQuery = updateQuery.eq('user_id', resolvedUserId);
    const { data, error } = await updateQuery
      .select()
      .single();

    return { data: data as Account, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const deleteAccount = async (id: string, userId?: string): Promise<{ data: boolean | null; error: unknown }> => {
  try {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) return { data: null, error: authError };
      resolvedUserId = userData?.user?.id;
    }
    if (!resolvedUserId) {
      return { data: null, error: { message: 'userId required' } };
    }
    const { data, error } = await supabase.rpc('delete_account_with_related_data', {
      p_account_id: id,
      p_user_id: resolvedUserId
    });

    if (error) {
      return { data: null, error };
    }

    if (data && typeof data === 'object' && 'success' in (data as Record<string, unknown>)) {
      const result = data as Record<string, unknown>;
      if (result.success) {
        return { data: true, error: null };
      } else {
        return { data: null, error: { message: (result as Record<string, unknown>).error || 'Erro ao eliminar conta' } };
      }
    }

    return { data: null, error: { message: 'Resposta inesperada do servidor' } };
  } catch (error) {
    return { data: null, error };
  }
};

export const getAccountBalances = async (): Promise<{ data: import('../integrations/supabase/types').AccountBalanceRPC[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_user_account_balances');
    return { data: (data as import('../integrations/supabase/types').AccountBalanceRPC[]) || null, error };
  } catch (error) {
    return { data: null, error };
  }
};

export const getAccountReservedScoped = async (
  options?: { includeFamily?: boolean; originOnly?: boolean }
): Promise<{ data: { account_id: string; total_reservado: number }[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_user_account_reserved_scoped', {
      p_include_family: options?.includeFamily ?? true,
      p_origin_only: options?.originOnly ?? true
    });

    if (error) {
      return { data: null, error };
    }

    // Normalizar o payload devolvido pela RPC (array de { account_id, total_reservado })
    const rows = (Array.isArray(data) ? data : []) as { account_id: string; total_reservado: number }[];
    return { data: rows, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const getFamilyAccountsWithBalances = async (userId?: string): Promise<{ data: AccountWithBalances[] | null; error: unknown }> => {
  try {
    if (!userId) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase.rpc('get_family_accounts_with_balances', {
      p_user_id: userId
    });

    if (error) {
      return { data: null, error };
    }

    // Filtrar a conta "Objetivos" das contas disponíveis para alocação
    const filteredData = (data || []).filter(account => {
      const accountName = account.nome?.toLowerCase() || '';
      const accountType = account.tipo?.toLowerCase() || '';
      return !accountName.includes('objetivo') && !accountType.includes('objetivo');
    });

    return { data: filteredData, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const getAccountsWithBalances = async (userId?: string): Promise<{ data: AccountWithBalances[] | null; error: unknown }> => {
  try {
    if (!userId) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase.rpc('get_user_accounts_with_balances', {
      p_user_id: userId
    });

    if (error) {
      return { data: null, error };
    }

    return { data: (data || []) as AccountWithBalances[], error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const getAccountsWithBalancesDomain = async (userId?: string): Promise<{ data: AccountWithBalancesDomain[]; error: unknown }> => {
  const { data, error } = await getAccountsWithBalances(userId);
  return { data: (data || []).map(mapAccountWithBalancesToDomain), error };
};

export const getAccountReservePercentage = async (accountId: string): Promise<{ data: number | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_account_reserve_percentage', {
      p_account_id: accountId
    });

    if (error) {
      return { data: null, error };
    }

    // RPC devolve valor em basis points, converter para percentagem (0-100)
    const percentageBp = Number(data) || 0;
    const percentage = percentageBp / 100; // de basis points para percentagem

    return { data: percentage, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const setAccountReservePercentage = async (accountId: string, percentBp: number): Promise<{ data: boolean | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('set_account_reserve_percentage', {
      p_account_id: accountId,
      p_percent_bp: percentBp
    });

    if (error) {
      return { data: null, error };
    }

    return { data: true, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

/** @deprecated Use supabase.rpc('get_kpis', { scope_family_id: null }) — Unit 10 */
export const getPersonalKPIs = async () => {
  const { data, error } = await supabase.rpc('get_personal_kpis');
  
  if (error) {
    logger.error('Error fetching personal KPIs:', error);
    throw error;
  }
  
  const defaultKPIs = {
    total_balance: 0,
    credit_card_debt: 0,
    top_goal_progress: 0,
    monthly_savings: 0,
    goals_account_balance: 0,
    total_goals_value: 0,
    goals_progress_percentage: 0,
    total_budget_spent: 0,
    total_budget_amount: 0,
    budget_spent_percentage: 0
  };

  return {
    data: (Array.isArray(data) && data.length > 0 ? data[0] : defaultKPIs),
    error: null
  };
};

// ── Unit 5: scope-aware accounts ────────────────────────────────────────────

export const getAccountsScoped = async (
  options: { userId: string; familyId?: string | null }
): Promise<{ data: AccountWithBalances[] | null; error: unknown }> => {
  try {
    const { data, error } = await supabase.rpc('get_user_accounts', {
      p_user_id: options.userId,
      p_family_id: options.familyId ?? null,
    });
    if (error) return { data: null, error };
    return { data: (data || []) as AccountWithBalances[], error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const softDeleteAccount = async (
  accountId: string,
  userId?: string
): Promise<{ data: boolean | null; error: unknown }> => {
  try {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data: authData } = await supabase.auth.getUser();
      resolvedUserId = authData?.user?.id;
    }
    if (!resolvedUserId) return { data: null, error: { message: 'Utilizador não autenticado' } };

    const { data, error } = await supabase.rpc('soft_delete_account', {
      p_account_id: accountId,
      p_user_id: resolvedUserId,
    });
    if (error) return { data: null, error };
    return { data: (data as { success?: boolean } | null)?.success ? true : null, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

export const reorderAccounts = async (
  userId: string,
  items: Array<{ id: string; order_index: number }>
): Promise<{ error: unknown }> => {
  try {
    const { error } = await supabase.rpc('reorder_accounts', {
      p_user_id: userId,
      p_items: items,
    });
    return { error };
  } catch (error) {
    return { error };
  }
};
