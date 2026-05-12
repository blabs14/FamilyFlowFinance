// src/components/TransactionSplitModal.tsx
import { useState } from 'react';
import { updateTransactionSplits, SplitInput } from '../services/splits';
import { useCategoriesDomain } from '../hooks/useCategoriesQuery';
import { useToast } from '../hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { centsToEuro, euroToCents } from '../lib/money';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from './ui/select';

interface SplitRow extends SplitInput {
  _key: string; // react key
}

interface TransactionSplitModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transactionId: string;
  totalCents: number;
}

export const TransactionSplitModal = ({
  open, onOpenChange, transactionId, totalCents,
}: TransactionSplitModalProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: categories } = useCategoriesDomain();
  const [rows, setRows] = useState<SplitRow[]>([
    { _key: crypto.randomUUID(), categoria_id: '', amount_cents: totalCents },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const sumCents = rows.reduce((acc, r) => acc + (r.amount_cents || 0), 0);
  const isBalanced = sumCents === totalCents;

  const addRow = () =>
    setRows(prev => [
      ...prev,
      { _key: crypto.randomUUID(), categoria_id: '', amount_cents: 0 },
    ]);

  const removeRow = (key: string) =>
    setRows(prev => prev.filter(r => r._key !== key));

  const updateRow = (key: string, patch: Partial<SplitRow>) =>
    setRows(prev => prev.map(r => r._key === key ? { ...r, ...patch } : r));

  const handleSave = async () => {
    if (!isBalanced) return;
    setIsSaving(true);
    try {
      const splits: SplitInput[] = rows.map(({ _key: _k, ...rest }) => rest);
      const { error } = await updateTransactionSplits(transactionId, splits);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({ title: 'Splits guardados com sucesso' });
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao guardar splits';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dividir por categorias</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {rows.map(row => (
            <div key={row._key} className="flex gap-2 items-center">
              <Select
                value={row.categoria_id}
                onValueChange={v => updateRow(row._key, { categoria_id: v })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Categoria..." />
                </SelectTrigger>
                <SelectContent>
                  {(categories ?? []).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                className="w-28"
                value={centsToEuro(row.amount_cents)}
                onChange={e =>
                  updateRow(row._key, { amount_cents: euroToCents(parseFloat(e.target.value) || 0) })
                }
              />
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(row._key)}
                >
                  &times;
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between text-sm mt-2">
          <button type="button" onClick={addRow} className="text-blue-600 hover:underline">
            + Adicionar linha
          </button>
          <span className={isBalanced ? 'text-green-600' : 'text-red-600'}>
            {isBalanced
              ? 'Soma correcta'
              : `Soma: ${centsToEuro(sumCents).toFixed(2)}€ (faltam ${centsToEuro(totalCents - sumCents).toFixed(2)}€)`}
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!isBalanced || isSaving}>
            {isSaving ? 'A guardar...' : 'Guardar splits'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionSplitModal;
