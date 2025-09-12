import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFamily } from '../features/family/FamilyContext';
import { useCreateTransaction } from '../hooks/useTransactionsQuery';
import { useAccountsWithBalances } from '../hooks/useAccountsQuery';
import { useCategoriesDomain } from '../hooks/useCategoriesQuery';
import { ensureTransferCategory } from '../services/categories';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { FormSubmitButton } from './ui/loading-button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from './ui/select';
import { useToast } from '../hooks/use-toast';
import { formatCurrency } from '../lib/utils';
import { supabase } from '../lib/supabaseClient';
import { payCreditCardFromAccount } from '../services/transactions';
import { useQueryClient } from '@tanstack/react-query';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TransferModal = ({ isOpen, onClose }: TransferModalProps) => {
  const { user } = useAuth();
  const { canEdit } = useFamily();
  const queryClient = useQueryClient();
  const { mutateAsync: createTransaction, isPending: isCreating } = useCreateTransaction();
  const { data: accounts = [] } = useAccountsWithBalances();
  const { data: categories = [] } = useCategoriesDomain();
  const { toast } = useToast();
  
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState('');

  // Usar as propriedades corretas das contas com saldos
  const fromAccount = accounts.find(acc => acc.account_id === fromAccountId);
  const toAccount = accounts.find(acc => acc.account_id === toAccountId);

  // Buscar categoria de transferência ou usar a primeira categoria disponível
  const transferCategory = categories.find(cat => 
    cat.nome.toLowerCase().includes('transferência') || 
    cat.nome.toLowerCase().includes('transfer')
  ) || categories[0];

  useEffect(() => {
    if (isOpen) {
      setFromAccountId('');
      setToAccountId('');
      setAmount('');
      setDescription('');
      setValidationError('');
    }
  }, [isOpen]);

  const isCreditCard = (acc?: typeof accounts[number]) => (acc?.tipo || '').toLowerCase() === 'cartão de crédito';
  const isBankLike = (acc?: typeof accounts[number]) => !isCreditCard(acc);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    // Verificar permissões RBAC
    if (!canEdit('transaction')) {
      setValidationError('Não tem permissões para realizar transferências');
      toast({
        title: 'Acesso negado',
        description: 'Não tem permissões para realizar transferências',
        variant: 'destructive'
      });
      return;
    }

    if (!fromAccountId || !toAccountId) {
      setValidationError('Selecione as contas de origem e destino');
      return;
    }

    if (fromAccountId === toAccountId) {
      setValidationError('As contas de origem e destino devem ser diferentes');
      return;
    }

    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (!numericAmount || numericAmount <= 0) {
      setValidationError('Insira um valor válido');
      return;
    }

    // Verificar saldo disponível usando a propriedade correta
    if (fromAccount && numericAmount > fromAccount.saldo_disponivel) {
      setValidationError('Saldo insuficiente na conta de origem');
      return;
    }

    try {
      // Pagamento de cartão (origem banco -> destino cartão)
      if (isBankLike(fromAccount) && isCreditCard(toAccount)) {
        const { data, error } = await payCreditCardFromAccount(
          user?.id || '',
          toAccountId,
          fromAccountId,
          numericAmount,
          new Date().toISOString().split('T')[0],
          description || `Pagamento de cartão ${toAccount?.nome} a partir de ${fromAccount?.nome}`
        );

        if (error) {
          setValidationError((error as { message?: string }).message || 'Erro ao pagar cartão');
          toast({ title: 'Erro no pagamento', description: (error as { message?: string }).message || 'Erro ao pagar cartão', variant: 'destructive' });
          return;
        }

        const efetivo = data?.amountPaid ?? 0;
        if (efetivo <= 0) {
          toast({ title: 'Sem pagamento necessário', description: 'O cartão já estava liquidado.' });
        } else if (efetivo < numericAmount) {
          toast({ title: 'Pagamento ajustado', description: `Pago ${formatCurrency(efetivo)} (ajustado ao necessário).` });
        } else {
          toast({ title: 'Pagamento realizado', description: `Pagamento de ${formatCurrency(numericAmount)} do cartão ${toAccount?.nome} usando ${fromAccount?.nome}.` });
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['transactions'] }),
          queryClient.invalidateQueries({ queryKey: ['accountsWithBalances', user?.id] }),
          queryClient.invalidateQueries({ queryKey: ['creditCardSummary', toAccountId, user?.id] })
        ]);
        onClose();
        return;
      }

      // Transferência normal
      const { data: transferCat, error: catError } = await ensureTransferCategory(user?.id || '');
      if (catError) {
        setValidationError('Erro ao configurar categoria de transferência');
        return;
      }

      const { data: result, error } = await supabase.rpc('create_transfer_transaction', {
        p_from_account_id: fromAccountId,
        p_to_account_id: toAccountId,
        p_amount: numericAmount,
        p_user_id: user?.id || '',
        p_categoria_id: transferCat?.id || categories[0]?.id,
        p_description: description || `Transferência de ${fromAccount?.nome} para ${toAccount?.nome}`,
        p_data: new Date().toISOString().split('T')[0]
      });

      if (error) {
        setValidationError(error.message || 'Erro ao realizar transferência');
        toast({ title: 'Erro na transferência', description: error.message || 'Erro ao realizar transferência', variant: 'destructive' });
        return;
      }

      if (result && typeof result === 'object' && 'error' in result) {
        const errorMessage = (result as { error?: string }).error || 'Erro na transferência';
        setValidationError(errorMessage);
        toast({ title: 'Erro na transferência', description: errorMessage, variant: 'destructive' });
        return;
      }

      toast({
        title: 'Transferência realizada',
        description: `Transferência de ${formatCurrency(numericAmount)} de ${fromAccount?.nome} para ${toAccount?.nome} realizada com sucesso.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['accountsWithBalances', user?.id] })
      ]);
      onClose();
    } catch (error) {
      const msg = (error as { message?: string }).message || 'Erro ao processar operação';
      setValidationError(msg);
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Permitir apenas números e vírgula/ponto
    const numericValue = value.replace(/[^\d.,]/g, '').replace(',', '.');
    setAmount(numericValue);
  };

  // Filtrar contas com saldo disponível
  const availableAccounts = accounts.filter(account => account.saldo_disponivel > 0);
  const hasEditPermission = canEdit('transaction');

  return (
    <Dialog open={isOpen} onOpenChange={(open)=>{ if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir entre Contas</DialogTitle>
          <DialogDescription>
            {hasEditPermission 
              ? "Transfere dinheiro de uma conta para outra. A transferência não afeta as estatísticas de receitas e despesas."
              : "Não tem permissões para realizar transferências. Contacte um administrador da família."
            }
          </DialogDescription>
        </DialogHeader>
        
        {!hasEditPermission ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-4">Acesso restrito</p>
            <Button onClick={onClose} variant="outline">
              Fechar
            </Button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="fromAccount" className="text-sm font-medium">
                Conta de Origem
              </label>
              <Select value={fromAccountId} onValueChange={setFromAccountId} disabled={!hasEditPermission}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar conta de origem" />
                </SelectTrigger>
                <SelectContent>
                  {availableAccounts.map(account => (
                    <SelectItem key={account.account_id} value={account.account_id}>
                      {account.nome} - €{(account.saldo_disponivel || 0).toFixed(2)} disponível
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="toAccount" className="text-sm font-medium">
                Conta de Destino
              </label>
              <Select value={toAccountId} onValueChange={setToAccountId} disabled={!hasEditPermission}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar conta de destino" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(account => (
                    <SelectItem key={account.account_id} value={account.account_id}>
                      {account.nome} - €{(account.saldo_atual || 0).toFixed(2)} saldo atual
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label htmlFor="amount" className="text-sm font-medium">
                Valor a Transferir (€)
              </label>
              <Input
                id="amount"
                type="text"
                placeholder="0,00"
                value={amount}
                onChange={handleAmountChange}
                required
                disabled={!hasEditPermission}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Descrição (Opcional)
              </label>
              <Input
                id="description"
                type="text"
                placeholder="Descrição da transferência"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!hasEditPermission}
                className="w-full"
              />
            </div>

            {validationError && (
              <div className="text-red-600 text-sm">{validationError}</div>
            )}

            <div className="flex gap-2">
              <FormSubmitButton 
                isSubmitting={isCreating}
                submitText="Transferir"
                submittingText="A transferir..."
                disabled={!hasEditPermission}
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
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TransferModal;

export { TransferModal };