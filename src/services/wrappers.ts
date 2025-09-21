import { supabase } from '../lib/supabaseClient';

// Exemplo: wrapper para agregação customizada (ex: saldo total)
export async function getTotalBalance() {
  const { data, error } = await supabase.rpc('get_user_accounts_with_balances', {
    p_user_id: (await supabase.auth.getUser()).data.user?.id,
  });

  if (error) {
    console.error('Error getting total balance:', error);
    return null;
  }

  // Calculate total balance from accounts
  const totalBalance = data?.reduce((sum: number, account: any) => sum + (account.saldo_atual || 0), 0) || 0;
  return totalBalance;
}

// Exemplo: wrapper para relatório customizado
export const getCustomReport = async (params: any) => {
  return supabase.rpc('custom_report', params);
};

// Adiciona mais funções conforme os wrappers definidos no Supabase