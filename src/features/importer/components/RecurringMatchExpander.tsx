import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

export function RecurringMatchExpander({ instanceId }: { instanceId: string }) {
  const { data } = useQuery({
    queryKey: ['recurring_instance', instanceId],
    queryFn: async () => {
      const { data } = await supabase
        .from('recurring_instances')
        .select('*, recurring_rules(description, amount_cents)')
        .eq('id', instanceId)
        .single();
      return data;
    },
  });

  if (!data) return null;
  const desc = (data as any).recurring_rules?.description ?? '—';
  const amt  = ((data as any).recurring_rules?.amount_cents ?? 0) / 100;
  const fmtAmt = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(amt);

  return (
    <div className="px-4 py-2 bg-purple-50 text-xs text-purple-800 rounded">
      Corresponde a recorrente: <strong>{desc}</strong> ({fmtAmt}) — será confirmada ao importar.
    </div>
  );
}
