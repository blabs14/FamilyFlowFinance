// src/components/family/SplitAmongMembersModal.tsx
import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSplitTransaction } from '@/hooks/useFamilySplitsQuery';
import { useToast } from '@/hooks/use-toast';
import { formatMoney } from '@/lib/money';

interface Member {
  user_id: string;
  profiles?: { nome?: string } | null;
}

interface Props {
  open: boolean;
  transactionId: string;
  amountCents: number;
  members: Member[];
  onClose: () => void;
}

const SplitAmongMembersModal: React.FC<Props> = ({
  open, transactionId, amountCents, members, onClose,
}) => {
  const { toast } = useToast();
  const splitTx = useSplitTransaction();

  // Default: equal split (first member absorbs rounding)
  const equalShare = Math.floor(amountCents / (members.length || 1));
  const [shares, setShares] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      members.map((m, i) => [
        m.user_id,
        (
          (i === 0
            ? amountCents - equalShare * (members.length - 1)
            : equalShare) / 100
        ).toFixed(2),
      ])
    )
  );

  const totalCents = Object.values(shares).reduce(
    (acc, v) => acc + Math.round(parseFloat(v || '0') * 100),
    0
  );
  const isValid = totalCents === amountCents;

  const handleSubmit = async () => {
    if (!isValid) {
      toast({ title: 'A soma das partes deve ser igual ao total', variant: 'destructive' });
      return;
    }
    try {
      await splitTx.mutateAsync({
        transactionId,
        shares: members.map((m) => ({
          user_id: m.user_id,
          share_cents: Math.round(parseFloat(shares[m.user_id] || '0') * 100),
        })),
      });
      toast({ title: 'Transação dividida com sucesso' });
      onClose();
    } catch (e: any) {
      toast({ title: 'Erro ao dividir transação', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Repartir entre membros</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Total: <strong>{formatMoney(amountCents)}</strong>
        </p>
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3">
              <Label className="flex-1 truncate min-w-0">
                {m.profiles?.nome ?? m.user_id}
              </Label>
              <Input
                type="number" min="0" step="0.01" className="w-32"
                value={shares[m.user_id] ?? '0'}
                onChange={(e) =>
                  setShares((s) => ({ ...s, [m.user_id]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
        {!isValid && (
          <p className="text-xs text-destructive mt-2">
            Soma: {formatMoney(totalCents)} ≠ Total: {formatMoney(amountCents)}
          </p>
        )}
        <div className="flex gap-2 pt-4">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!isValid || splitTx.isPending}
            onClick={handleSubmit}
          >
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SplitAmongMembersModal;
