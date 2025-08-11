import React, { useState } from 'react';
import { useFamily } from './FamilyContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Wallet, Plus, Edit, Trash2, ArrowRightLeft, Target, CreditCard, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { AccountWithBalances } from '../../integrations/supabase/types';
import { ConfirmationDialog } from '../../components/ui/confirmation-dialog';
import { Alert, AlertDescription } from '../../components/ui/alert';
import AccountForm from '../../components/AccountForm';
import RegularAccountForm from '../../components/RegularAccountForm';
const LazyTransferModal = React.lazy(() => import('../../components/TransferModal').then(m => ({ default: m.TransferModal })));
import { LazyWrapper } from '../../components/ui/lazy-wrapper';
import { useToast } from '../../hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion';
import { getAuditLogsByRow } from '../../services/audit_logs';
type AuditEntry = { id: string; timestamp: string; operation: string; old_data?: any; new_data?: any; details?: any };

const FamilyAccounts: React.FC = () => {
    const {
    familyAccounts,
    familyCards,
    isLoading,
    canEdit,
    canDelete,
    createFamilyAccount,
    updateFamilyAccount,
    deleteFamilyAccount,
    refetchAll
  } = useFamily();
  
  const { toast } = useToast();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  const handleTransfer = () => {
    setShowTransferModal(true);
  };

  const handleTransferSuccess = () => {
    setShowTransferModal(false);
    refetchAll();
  };

  const handleEdit = (account: AccountWithBalances) => {
    console.log('[FamilyAccounts] handleEdit called with account:', account);
    
    // Para cartões de crédito, usar o saldo da conta diretamente
    // Para outras contas, usar o saldo calculado
    let saldoAtual = 0;
    if (account.tipo === 'cartão de crédito') {
      // Buscar o saldo diretamente da tabela accounts
      // Por enquanto, usar 0 como fallback
      saldoAtual = 0; // Será atualizado via useEffect
    } else {
      saldoAtual = account.saldo_atual || 0;
    }
    
    const editData = {
      id: account.account_id,
      nome: account.nome,
      tipo: account.tipo,
      saldoAtual,
    };
    
    console.log('[FamilyAccounts] editData created:', editData);
    setEditingAccount(editData);
    setShowCreateModal(true);
  };

  const handleSuccess = () => {
    console.log('[FamilyAccounts] handleSuccess called');
    setShowCreateModal(false);
    setEditingAccount(null);
    console.log('[FamilyAccounts] Forcing refetch...');
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
      await deleteFamilyAccount(accountToDelete.id);
      toast({
        title: 'Conta eliminada',
        description: `A conta familiar "${accountToDelete.nome}" foi eliminada com sucesso.`,
      });
      setShowDeleteConfirmation(false);
      setAccountToDelete(null);
    } catch (error: any) {
      toast({
        title: 'Erro ao eliminar conta',
        description: error.message || 'Ocorreu um erro ao eliminar a conta familiar.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading.family || isLoading.accounts) {
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
  const bankAccounts = familyAccounts.filter(account => account.tipo !== 'cartão de crédito');
  const creditCards = familyCards.filter(account => account.tipo === 'cartão de crédito');

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Contas Familiares</h2>
          <p className="text-muted-foreground">
            Gerencie as contas bancárias e cartões da família
          </p>
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
              Contas correntes e poupanças da família
            </p>
          </div>
          {canEdit('account') && (
            <div className="flex gap-2">
              <Button onClick={handleTransfer} variant="outline" size="sm" aria-label="Transferir">
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transferir
              </Button>
              <Button onClick={handleNew} variant="outline" size="sm" aria-label="Nova conta">
                <Plus className="h-4 w-4 mr-2" />
                Nova Conta
              </Button>
            </div>
          )}
        </div>

        {bankAccounts.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
            <Wallet className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma conta bancária encontrada</p>
            <span className="sr-only">Nenhuma conta bancária familiar encontrada</span>
            {canEdit('account') && (
              <Button onClick={handleNew} className="mt-2">
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Conta
              </Button>
            )}
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

                  {/* Saldo Disponível */}
                  {(account.saldo_disponivel !== (account.saldo_atual || 0)) && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Disponível</span>
                        <span className={`text-sm font-medium ${
                          account.saldo_disponivel < 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatCurrency(account.saldo_disponivel)}
                        </span>
                      </div>
                    </div>
                  )}

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
                    {canEdit('account') && (
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
                    )}
                    {canDelete('account') && (
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
                    )}
                  </div>

                  {/* Histórico de alterações (Audit Log) */}
                  <Accordion type="single" collapsible className="pt-2">
                    <AccordionItem value={`hist-${account.account_id}`}>
                      <AccordionTrigger>Histórico</AccordionTrigger>
                      <AccordionContent>
                        <AccountAuditList accountId={account.account_id} />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
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
              Cartões de crédito e débito da família
            </p>
          </div>
          {canEdit('account') && (
            <Button onClick={handleNew} variant="outline" size="sm" aria-label="Novo cartão">
              <Plus className="h-4 w-4 mr-2" />
              Novo Cartão
            </Button>
          )}
        </div>

        {creditCards.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
            <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum cartão de crédito encontrado</p>
            <span className="sr-only">Nenhum cartão de crédito familiar encontrado</span>
            {canEdit('account') && (
              <Button onClick={handleNew} className="mt-2">
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Cartão
              </Button>
            )}
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

                  {/* Saldo Disponível */}
                  {(account.saldo_disponivel !== (account.saldo_atual || 0)) && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Disponível</span>
                        <span className={`text-sm font-medium ${
                          account.saldo_disponivel < 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatCurrency(account.saldo_disponivel)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Status do Cartão */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge variant={account.saldo_atual < 0 ? 'destructive' : 'default'} className="text-xs">
                        {account.saldo_atual < 0 ? 'Em Dívida' : 'Em Dia'}
                      </Badge>
                    </div>
                  </div>

                  {/* Botões de ação - Editar e Eliminar */}
                  <div className="flex gap-2 pt-2">
                    {canEdit('account') && (
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
                    )}
                    {canDelete('account') && (
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
                    )}
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
            <DialogTitle>{editingAccount ? 'Editar Conta' : 'Criar Conta'}</DialogTitle>
            <DialogDescription>
              {editingAccount ? 'Editar dados da conta familiar' : 'Criar nova conta familiar'}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            console.log('[FamilyAccounts] Modal rendering - editingAccount:', editingAccount);
            console.log('[FamilyAccounts] editingAccount?.tipo:', editingAccount?.tipo);
            
            if (editingAccount) {
              console.log('[FamilyAccounts] Rendering RegularAccountForm');
              return (
                <RegularAccountForm
                  initialData={editingAccount}
                  onSuccess={handleSuccess}
                  onCancel={() => setShowCreateModal(false)}
                />
              );
            } else {
              console.log('[FamilyAccounts] Rendering AccountForm');
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

      {showTransferModal && <div className="sr-only">A carregar modal...</div>}
      <LazyWrapper fallback={<div>A carregar modal...</div>}>
        <LazyTransferModal
          isOpen={showTransferModal}
          onClose={handleTransferSuccess}
        />
      </LazyWrapper>

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
            : 'Tem a certeza que deseja eliminar esta conta familiar?'
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
};

const AccountAuditList: React.FC<{ accountId: string }> = ({ accountId }) => {
  const [logs, setLogs] = React.useState<AuditEntry[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [loaded, setLoaded] = React.useState<boolean>(false);

  React.useEffect(() => {
    let active = true;
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const { data, error } = await getAuditLogsByRow('accounts', accountId, 20);
        if (!active) return;
        if (error) {
          console.debug('[AccountAuditList] erro a obter logs:', error);
          setLogs([]);
        } else {
          setLogs(Array.isArray(data) ? (data as unknown as AuditEntry[]) : []);
        }
      } catch (e) {
        console.debug('[AccountAuditList] exceção a obter logs:', e);
        setLogs([]);
      } finally {
        if (active) {
          setLoading(false);
          setLoaded(true);
        }
      }
    };
    if (!loaded) fetchLogs();
    return () => { active = false; };
  }, [accountId, loaded]);

  if (loading) return <div className="text-sm text-muted-foreground">A carregar histórico...</div>;
  if (!logs.length) return <div className="text-sm text-muted-foreground">Sem histórico recente.</div>;

  return (
    <div className="space-y-2 text-sm">
      {logs.map((log) => (
        <div key={log.id} className="rounded border p-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{new Date(log.timestamp).toLocaleString('pt-PT')}</span>
            <Badge variant="outline">{log.operation}</Badge>
          </div>
          {log.old_data && log.new_data && (
            <div className="mt-1 text-xs text-muted-foreground">
              <span>Mudanças principais: </span>
              {/* Mostrar diffs simples de saldo se existirem */}
              {typeof log.old_data === 'object' && typeof log.new_data === 'object' && (
                <>
                  {('saldo' in log.old_data || 'saldo' in log.new_data) && (
                    <div>Saldo: {(log.old_data?.saldo ?? '-') } → {(log.new_data?.saldo ?? '-')}</div>
                  )}
                  {('nome' in log.old_data || 'nome' in log.new_data) && (
                    <div>Nome: {(log.old_data?.nome ?? '-') } → {(log.new_data?.nome ?? '-')}</div>
                  )}
                  {('tipo' in log.old_data || 'tipo' in log.new_data) && (
                    <div>Tipo: {(log.old_data?.tipo ?? '-') } → {(log.new_data?.tipo ?? '-')}</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FamilyAccounts; 