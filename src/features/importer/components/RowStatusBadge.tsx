import { Badge } from '@/components/ui/badge';

type RowStatus = 'ok' | 'warning' | 'error' | 'duplicate' | 'probable_duplicate' | 'matches_recurring';

const config: Record<RowStatus, { label: string; className: string }> = {
  ok:                 { label: 'ok',                      className: 'bg-green-500 text-white' },
  warning:            { label: 'aviso',                   className: 'border-yellow-400 text-yellow-700' },
  error:              { label: 'erro',                    className: 'bg-red-500 text-white' },
  duplicate:          { label: 'duplicado',               className: 'bg-gray-300 text-gray-700' },
  probable_duplicate: { label: 'provável duplicado',      className: 'border-yellow-500 text-yellow-700' },
  matches_recurring:  { label: 'corresponde recorrente',  className: 'bg-purple-100 text-purple-800' },
};

export function RowStatusBadge({ status, appliedRuleId }: { status: RowStatus; appliedRuleId?: string | null }) {
  const c = config[status] ?? config.ok;
  if (status === 'ok' && appliedRuleId) {
    return <Badge className="bg-blue-100 text-blue-800 border-blue-300">auto ⚡</Badge>;
  }
  return <Badge className={c.className}>{c.label}</Badge>;
}
