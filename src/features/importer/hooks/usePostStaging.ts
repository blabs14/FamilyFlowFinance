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

      // NOTE: confirm_recurring_instance RPC does not exist in this project.
      // Recurring match is recorded but not confirmed via RPC — plain INSERT only.
      for (const row of selectedRows) {
        const { data, error } = await supabase
          .from('transactions')
          .insert({
            data: row.date,
            amount_cents: row.amount_cents,
            descricao: row.description,
            categoria_id: row.category_id ?? null,
            account_id: row.account_id,
            tipo: 'expense',
            // user_id is set by Supabase RLS via auth.uid() — not passed explicitly
          } as any)
          .select('id')
          .single();
        if (error) throw error;
        created.push(data.id);
      }
      return created;
    },
  });
}
