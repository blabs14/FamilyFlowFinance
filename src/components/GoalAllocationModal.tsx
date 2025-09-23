import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGoalAllocations } from '../hooks/useGoalAllocations';
import { useAccountsWithBalances } from '../hooks/useAccountsQuery';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { FormSubmitButton } from './ui/loading-button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from './ui/select';
import { logger } from '@/shared/lib/logger';

interface GoalAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  goalId: string;
  goalName: string;
  currentProgress: number;
  targetAmount: number;
  canEdit?: boolean;
}

const GoalAllocationModal = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  goalId, 
  goalName, 
  currentProgress, 
  targetAmount,
  canEdit = true
}: GoalAllocationModalProps) => {
  const { user } = useAuth();
  const { allocateToGoal, isAllocating, isSuccess } = useGoalAllocations();
  const { data: accounts = [] } = useAccountsWithBalances();
  
  // Debug: GoalAllocationModal props and accounts data
  console.log('🔍 [DEBUG] GoalAllocationModal - Dados de contas:', {
    accountsLength: accounts.length,
    accounts: accounts.map(acc => ({
      id: acc.account_id,
      nome: acc.nome,
      saldo_disponivel: acc.saldo_disponivel,
      family_id: acc.family_id
    })),
    filteredAccounts: accounts.filter(account => account.saldo_disponivel > 0).map(acc => ({
      id: acc.account_id,
      nome: acc.nome,
      saldo_disponivel: acc.saldo_disponivel
    }))
  });
  
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState('');

  const selectedAccount = accounts.find(acc => acc.account_id === selectedAccountId);
  const remainingAmount = targetAmount - currentProgress;

  // Formata erros provenientes do Supabase/servidor para uma mensagem amigável
  const formatAllocationError = (err: any): string => {
    if (!err) return 'Erro ao processar alocação. Tente novamente.';
    const code = err?.code || err?.status || err?.name;
    const msg = err?.message || err?.error?.message || 'Erro ao processar alocação.';
    const details = err?.details || err?.error_description || err?.hint;
    let finalMsg = msg;
    if (code) finalMsg += ` (código: ${code})`;
    if (details) finalMsg += ` — ${details}`;
    return finalMsg;
  };

  useEffect(() => {
    if (isOpen) {
      console.log('🔍 [DEBUG] GoalAllocationModal - Modal aberto com props:', {
        goalId,
        goalIdType: typeof goalId,
        goalIdIsNull: goalId === null,
        goalIdIsUndefined: goalId === undefined,
        goalName,
        currentProgress,
        targetAmount,
        canEdit
      });
      setSelectedAccountId('');
      setAmount('');
      setDescription('');
      setValidationError('');
    }
  }, [isOpen, goalId, goalName, currentProgress, targetAmount, canEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔍 [DEBUG] GoalAllocationModal - handleSubmit chamado:', {
      goalId,
      selectedAccountId,
      amount,
      description,
      canEdit,
      user: user?.id
    });
    
    setValidationError('');
    
    // Validar goalId
    if (!goalId) {
      console.error('[DEBUG] GoalAllocationModal - goalId é null ou undefined');
      setValidationError('Erro: ID do objetivo não encontrado');
      return;
    }
    
    if (!canEdit) {
      console.log('[DEBUG] GoalAllocationModal - Sem permissões para editar');
      setValidationError('Não tem permissões para alocar fundos a objetivos');
      return;
    }

    if (!selectedAccountId) {
      console.log('[DEBUG] GoalAllocationModal - Conta não selecionada');
      setValidationError('Selecione uma conta');
      return;
    }

    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (!numericAmount || numericAmount <= 0) {
      console.log('[DEBUG] GoalAllocationModal - Valor inválido:', numericAmount);
      setValidationError('Insira um valor válido');
      return;
    }

    if (selectedAccount && numericAmount > selectedAccount.saldo_disponivel) {
      console.log('[DEBUG] GoalAllocationModal - Saldo insuficiente:', {
        amount: numericAmount,
        available: selectedAccount.saldo_disponivel
      });
      setValidationError('Saldo insuficiente na conta selecionada');
      return;
    }

    console.log('[DEBUG] GoalAllocationModal - Dados para alocação:', {
      goalId,
      goalIdType: typeof goalId,
      goalIdLength: goalId?.length,
      accountId: selectedAccountId,
      accountIdType: typeof selectedAccountId,
      accountIdLength: selectedAccountId?.length,
      amount: numericAmount,
      amountType: typeof numericAmount,
      description: description || "Alocacao para " + goalName
    });

    console.log('[DEBUG] GoalAllocationModal - Chamando allocateToGoal...');
    try {
      await allocateToGoal({
        goalId,
        accountId: selectedAccountId,
        amount: numericAmount,
        description: description || "Alocacao para " + goalName
      });
      console.log('[DEBUG] GoalAllocationModal - Alocação bem-sucedida');
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('[DEBUG] GoalAllocationModal - Erro na alocação:', error);
      logger.error('[GoalAllocationModal] Error allocating to goal:', error);
      setValidationError(formatAllocationError(error));
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Permitir apenas números e vírgula/ponto
    const numericValue = value.replace(/[^\d.,]/g, '').replace(',', '.');
    setAmount(numericValue);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alocar para {goalName}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="account" className="text-sm font-medium">
                Conta de Origem
              </label>
              <Select value={selectedAccountId} onValueChange={(value) => {
                console.log('🔍 [DEBUG] GoalAllocationModal - Conta selecionada:', {
                  selectedAccountId: value,
                  accountIdType: typeof value,
                  accountIdIsNull: value === null,
                  accountIdIsUndefined: value === undefined
                });
                setSelectedAccountId(value);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter(account => account.saldo_disponivel > 0)
                    .map(account => (
                      <SelectItem key={account.account_id} value={account.account_id}>
                        {account.nome} - €{account.saldo_disponivel.toFixed(2)} disponível
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="amount" className="text-sm font-medium">
                Valor a Alocar (€)
              </label>
              <Input
                id="amount"
                type="text"
                placeholder="0,00"
                value={amount}
                onChange={handleAmountChange}
                required
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Restam €{remainingAmount.toFixed(2)} para atingir o objetivo
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Descrição (Opcional)
              </label>
              <Input
                id="description"
                type="text"
                placeholder="Descrição da alocação"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full"
              />
            </div>

            {validationError && (
              <div className="text-red-600 text-sm">{validationError}</div>
            )}

            <div className="flex gap-2">
              <FormSubmitButton 
                isSubmitting={isAllocating}
                submitText="Alocar"
                submittingText="A alocar..."
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </form>
      </DialogContent>
    </Dialog>
  );
};

export default GoalAllocationModal;

export { GoalAllocationModal };