import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGoalAllocations } from '../hooks/useGoalAllocations';
import { useAccountsWithBalances } from '../hooks/useAccountsQuery';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { FormSubmitButton } from './ui/loading-button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui/select';

interface GoalDeallocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalId: string;
  goalName: string;
  canEdit?: boolean;
}

const GoalDeallocationModal = ({ isOpen, onClose, goalId, goalName, canEdit = true }: GoalDeallocationModalProps) => {
  const { user } = useAuth();
  const { allocations, deallocate, isDeleting, isAllocating } = useGoalAllocations(goalId);
  const { data: accounts = [] } = useAccountsWithBalances();

  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [validationError, setValidationError] = useState('');

  const isSubmitting = isDeleting || isAllocating; // indicativo

  const allocatedByAccount = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of allocations || []) {
      const current = map.get(a.account_id) || 0;
      map.set(a.account_id, current + (Number(a.valor) || 0));
    }
    return map;
  }, [allocations]);

  const allocatedAccounts = useMemo(() => {
    const filtered = accounts.filter(acc => (allocatedByAccount.get(acc.account_id) || 0) > 0);
    
    console.log('🔍 [DEBUG] GoalDeallocationModal - Dados de contas:', {
      accountsLength: accounts.length,
      accounts: accounts.map(acc => ({
        id: acc.account_id,
        nome: acc.nome,
        family_id: acc.family_id
      })),
      allocatedByAccount: Object.fromEntries(allocatedByAccount),
      allocatedAccountsLength: filtered.length,
      allocatedAccounts: filtered.map(acc => ({
        id: acc.account_id,
        nome: acc.nome,
        allocated: allocatedByAccount.get(acc.account_id) || 0
      }))
    });
    
    return filtered;
  }, [accounts, allocatedByAccount]);

  const selectedAllocated = allocatedByAccount.get(selectedAccountId) || 0;

  useEffect(() => {
    if (isOpen) {
      setSelectedAccountId('');
      setAmount('');
      setValidationError('');
    }
  }, [isOpen]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const numericValue = value.replace(/[^\d.,]/g, '').replace(',', '.');
    setAmount(numericValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canEdit || !selectedAccountId) {
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return;
    }

    if (numericAmount > selectedAllocated) {
      return;
    }

    try {
      await deallocate({ goalId, accountId: selectedAccountId, amount: numericAmount });
      onClose();
    } catch (error) {
      console.error('Erro ao desalocar do objetivo:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open)=>{ if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Desalocar de {goalName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Conta de Origem (alocada)</label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger data-cy="deallocate-account-select">
                <SelectValue placeholder="Selecionar conta" />
              </SelectTrigger>
              <SelectContent>
                {allocatedAccounts.map(acc => (
                  <SelectItem key={acc.account_id} value={acc.account_id}>
                    {acc.nome} — Alocado: €{(allocatedByAccount.get(acc.account_id) || 0).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Valor a Desalocar (€)</label>
            <Input
              type="text"
              placeholder="0,00"
              data-cy="deallocate-amount-input"
              value={amount}
              onChange={handleAmountChange}
              required
              className="w-full"
            />
            {selectedAccountId && (
              <p className="text-xs text-gray-500">Máximo: €{selectedAllocated.toFixed(2)}</p>
            )}
          </div>

          {validationError && (
            <div className="text-red-600 text-sm">{validationError}</div>
          )}

          <div className="flex gap-2">
            <FormSubmitButton
              isSubmitting={isSubmitting}
              submitText="Desalocar"
              submittingText="A desalocar..."
              data-cy="deallocate-submit-btn"
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GoalDeallocationModal;
export { GoalDeallocationModal };
