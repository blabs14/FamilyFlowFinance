import React, { useState } from 'react';
import { usePersonal } from './PersonalProvider';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Wallet, Plus, Edit, Trash2, ArrowRightLeft, Target, CreditCard, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { AccountWithBalances } from '../../integrations/supabase/types';
import { ConfirmationDialog } from '../../components/ui/confirmation-dialog';
import { Alert, AlertDescription } from '../../components/ui/alert';
import AccountForm from '../../components/AccountForm';
import RegularAccountForm from '../../components/RegularAccountForm';
import CreditCardForm from '../../components/CreditCardForm';
import { TransferModal } from '../../components/TransferModal';
import { useToast } from '../../hooks/use-toast';

const PersonalAccounts: React.FC = () => {
    const {
    myAccounts,
    myCards,
    isLoading,
    deletePersonalAccount,
    refetchAll
  } = usePersonal();
  
  const { toast } = useToast();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreditCardModal, setShowCreditCardModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<{ id: string; nome: string } | null>(null);
  const [editingAccount, setEditingAccount] = useState<{
    id: string;
    nome: string;
    tipo: string;
    saldoAtual: number;
  } | null>(null);



  const handleNew = () => {
    setEditingAccount(null);
    setShowCreateModal(true);
  };

  const handleNewCreditCard = () => {
    setEditingAccount(null);
    setShowCreditCardModal(true);
  };

  const handleTransfer = () => {
    setShowTransferModal(true);
  };

  const handleTransferSuccess = () => {
    setShowTransferModal(false);
    refetchAll();
  };

  const handleEdit = (account: AccountWithBalances) => {
    
    // Para cartões de crédito, usar o saldo da conta diretamente
    // Para outras contas, usar o saldo calculado
    let saldoAtual = 0;
    if (account.tipo === 'cartão de crédito') {
      // Para cartões de crédito, usar o saldo atual da conta
      saldoAtual = account.saldo_atual || 0;
    } else {
      saldoAtual = account.saldo_atual || 0;
    }
    
    const editData: {
      id: string;
      nome: string;
      tipo: string;
      saldoAtual: number;
    } = {
      id: account.account_id,
      nome: account.nome,
      tipo: account.tipo,
      saldoAtual,
    };
    

    setEditingAccount(editData);
    setShowCreateModal(true);
  };

  const handleSuccess = () => {
    setShowCreateModal(false);
    setEditingAccount(null);
    refetchAll();
  };

  const handleCreditCardSuccess = () => {
    setShowCreditCardModal(false);
    setEditingAccount(null);
    refetchAll();
  };

  const handleDeleteAccount = (account: AccountWithBalances) => {
    setAccountToDelete({
      id: account.account_id,
      nome: account.nome
    });
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteAccount = async () => {
    if (!accountToDelete) return;

    try {
      await deletePersonalAccount(accountToDelete.id);
      toast({
        title: 'Conta eliminada',
        description: `A conta "${accountToDelete.nome}" foi eliminada com sucesso.`,
      });
      setShowDeleteConfirmation(false);
      setAccountToDelete(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro ao eliminar a conta.';
      toast({
        title: 'Erro ao eliminar conta',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  if (isLoading.accounts) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">A carregar contas...</p>
        </div>
      </div>
    );
  }



  // Separar contas bancárias de cartões de crédito
  const bankAccounts = myAccounts.filter(account => account.tipo !== 'cartão de crédito');
  const creditCards = myCards.filter(account => account.tipo === 'cartão de crédito');



  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Contas Pessoais</h2>
        </div>

      </div>

      {/* Contas Bancárias */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
                      <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Contas Bancárias
              </h3>
              <p className="text-sm text-muted-foreground">
                Contas correntes e poupanças
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleTransfer} variant="outline" aria-label="Transferir">
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transferir
              </Button>
              <Button onClick={handleNew} aria-label="Nova conta">
                <Plus className="h-4 w-4 mr-2" />
                Nova Conta
              </Button>
            </div>
        </div>

        {bankAccounts.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
            <Wallet className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma conta bancária encontrada</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {bankAccounts.map((account) => (
              <Card key={account.account_id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{account.nome}</CardTitle>
                    <Badge variant="outline" className="capitalize">
                      {account.tipo}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Saldo Total */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Saldo Total</span>
                      <span className="text-lg font-semibold">
                        {formatCurrency(account.saldo_atual || 0)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">{account.tipo}</p>
                  </div>

                  {/* Saldo Reservado */}
                  {account.total_reservado > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          Reservado
                        </span>
                        <Badge variant="secondary" className="text-xs text-blue-600 bg-blue-50 border-blue-200">
                          {formatCurrency(account.total_reservado)}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Saldo Disponível / Dívida */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {account.tipo === 'cartão de crédito' ? 'Dívida' : 'Disponível'}
                      </span>
                      <span className={`text-sm font-medium ${
                        account.tipo === 'cartão de crédito' 
                          ? (account.saldo_atual < 0 ? 'text-red-600' : 'text-gray-600')
                          : (account.saldo_disponivel < 0 ? 'text-red-600' : 'text-green-600')
                      }`}>
                        {account.tipo === 'cartão de crédito' 
                          ? formatCurrency(account.saldo_atual < 0 ? -account.saldo_atual : 0)
                          : formatCurrency(account.saldo_disponivel)
                        }
                      </span>
                    </div>
                  </div>

                  {/* Aviso: saldo disponível negativo (apenas aviso) */}
                  {account.saldo_disponivel < 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Saldo disponível negativo. Isto é apenas um aviso—as operações continuam permitidas.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Botões de ação - Editar e Eliminar */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(account)}
                      className="flex-1"
                      aria-label="Editar conta"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteAccount(account)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      aria-label="Eliminar conta"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Cartões de Crédito */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Cartões de Crédito
            </h3>
            <p className="text-sm text-muted-foreground">
              Cartões de crédito e débito
            </p>
          </div>
          <Button onClick={handleNewCreditCard} aria-label="Novo cartão">
            <Plus className="h-4 w-4 mr-2" />
            Novo Cartão
          </Button>
        </div>

        {creditCards.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
            <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum cartão de crédito encontrado</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {creditCards.map((account) => (
              <Card key={account.account_id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{account.nome}</CardTitle>
                    <Badge variant="outline" className="capitalize">
                      {account.tipo}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Saldo Total */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Saldo Total</span>
                      <span className="text-lg font-semibold">
                        {formatCurrency(account.saldo_atual || 0)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">{account.tipo}</p>
                  </div>

                  {/* Saldo Reservado */}
                  {account.total_reservado > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          Reservado
                        </span>
                        <Badge variant="secondary" className="text-xs text-blue-600 bg-blue-50 border-blue-200">
                          {formatCurrency(account.total_reservado)}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Dívida */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Dívida</span>
                      <span className={`text-sm font-medium ${
                        account.saldo_atual < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {formatCurrency(account.saldo_atual < 0 ? -account.saldo_atual : 0)}
                      </span>
                    </div>
                  </div>

                  {/* Status do Cartão */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge variant={account.saldo_atual < 0 ? "destructive" : "default"} className="text-xs">
                        {account.saldo_atual < 0 ? 'Em Dívida' : 'Em Dia'}
                      </Badge>
                    </div>
                  </div>

                  {/* Botões de ação - Editar e Eliminar */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(account)}
                      className="flex-1"
                      aria-label="Editar cartão"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteAccount(account)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      aria-label="Eliminar cartão"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
            <DialogDescription>
              {editingAccount ? 'Editar dados da conta' : 'Criar nova conta'}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            if (editingAccount?.tipo === 'cartão de crédito') {
              return (
                <CreditCardForm
                  initialData={editingAccount}
                  onSuccess={handleSuccess}
                  onCancel={() => setShowCreateModal(false)}
                />
              );
            } else if (editingAccount) {
              return (
                <RegularAccountForm
                  initialData={editingAccount}
                  onSuccess={handleSuccess}
                  onCancel={() => setShowCreateModal(false)}
                />
              );
            } else {
              return (
                <AccountForm
                  initialData={editingAccount}
                  onSuccess={handleSuccess}
                  onCancel={() => setShowCreateModal(false)}
                />
              );
            }
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={showCreditCardModal} onOpenChange={setShowCreditCardModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Cartão de Crédito</DialogTitle>
            <DialogDescription>
              Criar novo cartão de crédito
            </DialogDescription>
          </DialogHeader>
          <CreditCardForm
            initialData={{
              id: '',
              nome: '',
              tipo: 'cartão de crédito',
              saldoAtual: 0
            }}
            onSuccess={handleCreditCardSuccess}
            onCancel={() => setShowCreditCardModal(false)}
          />
        </DialogContent>
      </Dialog>

      <TransferModal
        isOpen={showTransferModal}
        onClose={handleTransferSuccess}
      />

      <ConfirmationDialog
        isOpen={showDeleteConfirmation}
        onClose={() => {
          setShowDeleteConfirmation(false);
          setAccountToDelete(null);
        }}
        onConfirm={confirmDeleteAccount}
        title="Eliminar Conta"
        message={
          accountToDelete 
            ? `Tem a certeza que deseja eliminar "${accountToDelete.nome}"? Esta ação não pode ser desfeita e eliminará todas as transações associadas.`
            : 'Tem a certeza que deseja eliminar esta conta?'
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
};

export default PersonalAccounts;