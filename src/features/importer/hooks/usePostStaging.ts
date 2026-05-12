import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

interface PostParams {
  selectedRows: Array<{
    id: string;
    date: string;
    amount_cents: number;
    description: string;
    category_id?: string | null;
    matched_recurring_instance_id?: string | null;
    account_id: string;
  }>;
}

export function usePostStaging() {
  return useMutation({
    mutationFn: async ({ selectedRows }: PostParams) => {
      const created: string[] = [];

      for (const row of selectedRows) {
        if (row.matched_recurring_instance_id) {
          const { data, error } = await supabase.rpc('confirm_recurring_instance', {
            p_instance_id: row.matched_recurring_instance_id,
          });
          if (error) throw error;
          if (data?.transaction_id) created.push(data.transaction_id);
        } else {
          const { data, error } = await supabase
            .from('transactions')
            .insert({
              data: row.date,
              amount_cents: row.amount_cents,
              descricao: row.description,
              categoria_id: row.category_id ?? null,
              account_id: row.account_id,
              tipo: 'expense',
            } as any)
            .select('id')
            .single();
          if (error) throw error;
          created.push(data.id);
        }
      }
      return created;
    },
  });
}
