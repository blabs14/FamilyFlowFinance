import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { RowStatusBadge } from './components/RowStatusBadge';
import { CategoryCell } from './components/CategoryCell';
import { RecurringMatchExpander } from './components/RecurringMatchExpander';
import { CreateRuleModal } from './components/CreateRuleModal';
import { Checkbox } from '@/components/ui/checkbox';
import { useUpdateStagingRow } from './hooks/useStagingRows';

type Row = {
  id: string;
  date: string;
  description: string;
  amount_cents: number;
  row_status: string;
  category_id?: string | null;
  applied_rule_id?: string | null;
  matched_recurring_instance_id?: string | null;
};

interface Props {
  fileId: string;
  rows: Row[];
  selectedIds: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
}

export default function StagingTable({ fileId, rows, selectedIds, onSelect, onSelectAll }: Props) {
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id, nome');
      return data ?? [];
    },
  });
  const updateRow = useUpdateStagingRow(fileId);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [ruleModalRow, setRuleModalRow] = useState<Row | null>(null);

  const isSelectable = (row: Row) => row.row_status !== 'duplicate' && row.row_status !== 'error';
  const fmtAmt = (cents: number) =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100);

  return (
    <>
      <div className="border rounded overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted text-left">
              <th className="p-2 w-8">
                <Checkbox
                  checked={rows.filter(isSelectable).length > 0 && rows.filter(isSelectable).every(r => selectedIds.has(r.id))}
                  onCheckedChange={(c) => onSelectAll(!!c)}
                />
              </th>
              <th className="p-2">Data</th>
              <th className="p-2">Descrição</th>
              <th className="p-2 text-right">Montante</th>
              <th className="p-2">Categoria</th>
              <th className="p-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <React.Fragment key={row.id}>
                <tr
                  className={`border-t hover:bg-muted/50 ${row.row_status === 'duplicate' ? 'opacity-50' : ''}`}
                  onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                >
                  <td className="p-2" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      disabled={!isSelectable(row)}
                      onCheckedChange={(c) => onSelect(row.id, !!c)}
                    />
                  </td>
                  <td className="p-2 whitespace-nowrap">{row.date}</td>
                  <td className="p-2 max-w-xs truncate">{row.description}</td>
                  <td className={`p-2 text-right tabular-nums ${row.amount_cents < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {fmtAmt(row.amount_cents)}
                  </td>
                  <td className="p-2" onClick={e => e.stopPropagation()}>
                    <CategoryCell
                      categoryId={row.category_id}
                      appliedRule={row.applied_rule_id ? { id: row.applied_rule_id, pattern: '' } : null}
                      categories={categories as any}
                      onChange={(catId) => updateRow.mutate({ id: row.id, patch: { category_id: catId } })}
                      onCreateRule={() => setRuleModalRow(row)}
                    />
                  </td>
                  <td className="p-2">
                    <RowStatusBadge status={row.row_status as any} appliedRuleId={row.applied_rule_id} />
                  </td>
                </tr>
                {expandedId === row.id && row.matched_recurring_instance_id && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <RecurringMatchExpander instanceId={row.matched_recurring_instance_id} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {ruleModalRow && (
        <CreateRuleModal
          open
          onClose={() => setRuleModalRow(null)}
          prefillPattern={ruleModalRow.description.split(' ')[0]}
          prefillCategoryId={ruleModalRow.category_id ?? undefined}
          categories={categories as any}
        />
      )}
    </>
  );
}
