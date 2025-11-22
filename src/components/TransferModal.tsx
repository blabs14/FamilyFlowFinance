import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOptionalFamily } from '../features/family/FamilyContext';
import { useCreateTransaction } from '../hooks/useTransactionsQuery';
import { useAllAccountsWithBalances } from '../hooks/useAccountsQuery';
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
import { logger } from '@/shared/lib/logger';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TransferModal = ({ isOpen, onClose }: TransferModalProps) => {
  const { user } = useAuth();
  const family = useOptionalFamily();
  const queryClient = useQueryClient();
  const { mutateAsync: createTransaction, isPending: isCreating } = useCreateTransaction();
  const { data: accounts = [] } = useAllAccountsWithBalances();
  const { data: categories = [] } = useCategoriesDomain();
  const { toast } = useToast();
  const canEditTransaction = family?.canEdit?.('transaction') ?? true;

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState('');

  // Usar todas as contas disponíveis (pessoais e familiares) para permitir transferências cross-scope
  const allAvailableAccounts = accounts as any[];

  // CORREÇÃO: Mostrar TODAS as contas nos dropdowns (não filtrar por saldo)
  const availableFromAccounts = allAvailableAccounts;
  logger.debug('TransferModal availableFromAccounts', {
    total: availableFromAccounts.length,
    accounts: availableFromAccounts.map(a => ({ account_id: a.account_id, nome: a.nome, saldo_disponivel: a.saldo_disponivel }))
  });

  // Usar as propriedades corretas das contas com saldos
  const fromAccount = allAvailableAccounts.find(acc => acc.account_id === fromAccountId);
  const toAccount = allAvailableAccounts.find(acc => acc.account_id === toAccountId);
  logger.debug('TransferModal selected accounts', {
    fromAccountId,
    toAccountId,
    fromSaldoDisponivel: fromAccount?.saldo_disponivel,
    toSaldoAtual: toAccount?.saldo_atual
  });

  // Detectar transferência cross-scope para mostrar aviso informativo
  const isCrossScopeTransfer = fromAccount && toAccount &&
    (fromAccount as any).scope !== (toAccount as any).scope;

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

    // Verificar permissões RBAC (usar contexto de família se disponível)
    if (!canEditTransaction) {
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
    logger.debug('TransferModal submit check', {
      numericAmount,
      fromSaldoDisponivel: fromAccount?.saldo_disponivel,
      insufficient: !!fromAccount && numericAmount > (fromAccount?.saldo_disponivel ?? 0)
    });
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferência</DialogTitle>
          <DialogDescription>Realize uma transferência entre contas.</DialogDescription>
        </DialogHeader>

        {isCrossScopeTransfer && (
          <div className="text-xs text-muted-foreground mb-2">
            Nota: transferência entre escopos (pessoal ↔ família)
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm">Conta de Origem</label>
              <Select value={fromAccountId} onValueChange={setFromAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta de origem" />
                </SelectTrigger>
                <SelectContent>
                  {availableFromAccounts.map(acc => (
                    <SelectItem key={acc.account_id} value={acc.account_id}>
                      {acc.nome} — Disponível: {formatCurrency(acc.saldo_disponivel)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm">Conta de Destino</label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta de destino" />
                </SelectTrigger>
                <SelectContent>
                  {allAvailableAccounts.map(acc => (
                    <SelectItem key={acc.account_id} value={acc.account_id}>
                      {acc.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm">Montante</label>
              <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className="text-sm">Descrição</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          {validationError && (
            <div className="text-sm text-red-600">{validationError}</div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <FormSubmitButton loading={isCreating} type="submit">Transferir</FormSubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TransferModal;

export { TransferModal };