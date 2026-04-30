// src/pages/ContasPage.tsx
// Unit 5: página unificada de contas + cartões, scope-aware via useScope()
import React, { useState } from 'react';
import { useScope } from '../features/scope/useScope';
import { useAuth } from '../contexts/AuthContext';
import { useAccountsScoped, useCreditCards, useSoftDeleteAccount, useSoftDeleteCreditCard } from '../hooks/useAccountsQuery';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ConfirmationDialog } from '../components/ui/confirmation-dialog';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Wallet, Plus, CreditCard, Trash2 } from 'lucide-react';
import { formatMoney } from '../lib/money';
import CreditCardFormNew from '../components/CreditCardFormNew';
import AccountForm from '../components/AccountForm';
import { useToast } from '../hooks/use-toast';

const ContasPage: React.FC = () => {
  const scope = useScope();
  const { user } = useAuth();
  const { toast } = useToast();

  const userId = user?.id ?? '';
  const familyId = scope.type === 'family' ? (scope as { familyId?: string | null }).familyId ?? null : null;

  const { data: accountsResult, isLoading: accountsLoading } = useAccountsScoped({ userId, familyId });
  const { data: cardsResult, isLoading: cardsLoading } = useCreditCards({ userId, familyId });
  const softDeleteAccountMutation = useSoftDeleteAccount();
  const softDeleteCardMutation = useSoftDeleteCreditCard();

  const accounts = (accountsResult as { data?: unknown[] } | null)?.data ?? [];
  const cards = (cardsResult as { data?: unknown[] } | null)?.data ?? [];

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string; type: 'account' | 'card' } | null>(null);

  const isLoading = accountsLoading || cardsLoading;

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !user?.id) return;
    try {
      if (deleteTarget.type === 'account') {
        await softDeleteAccountMutation.mutateAsync({ accountId: deleteTarget.id, userId: user.id });
        toast({ title: 'Conta arquivada com sucesso' });
      } else {
        await softDeleteCardMutation.mutateAsync({ cardId: deleteTarget.id, userId: user.id });
        toast({ title: 'Cartão arquivado com sucesso' });
      }
    } catch {
      toast({ title: 'Erro ao arquivar', variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-24 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* ── Contas Bancárias ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Contas Bancárias
          </h2>
          <Button size="sm" onClick={() => setShowAccountForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova conta
          </Button>
        </div>

        {accounts.length === 0 ? (
          <Alert>
            <AlertDescription>
              Ainda não tens contas bancárias. Clica em &ldquo;Nova conta&rdquo; para adicionar.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(accounts as Array<Record<string, unknown>>).map((account) => (
              <Card key={account.account_id as string}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{account.nome as string}</CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeleteTarget({
                          id: account.account_id as string,
                          nome: account.nome as string,
                          type: 'account',
                        })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                  <Badge variant="secondary" className="w-fit text-xs capitalize">
                    {account.tipo as string}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {formatMoney(Math.round((account.saldo_atual as number) * 100))}
                  </p>
                  {(account.saldo_disponivel as number) < (account.saldo_atual as number) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Disponível: {formatMoney(Math.round((account.saldo_disponivel as number) * 100))}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Cartões de Crédito ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Cartões de Crédito
          </h2>
          <Button size="sm" onClick={() => setShowCardForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo cartão
          </Button>
        </div>

        {cards.length === 0 ? (
          <Alert>
            <AlertDescription>
              Ainda não tens cartões de crédito. Clica em &ldquo;Novo cartão&rdquo; para adicionar.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(cards as Array<Record<string, unknown>>).map((card) => {
              const limitCents = card.credit_limit_cents as number;
              const balanceCents = card.current_balance_cents as number;
              const utilizationPct = card.utilization_pct as number;
              const isHighUtilization = utilizationPct >= 80;

              return (
                <Card key={card.card_id as string}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{card.nome as string}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeleteTarget({
                          id: card.card_id as string,
                          nome: card.nome as string,
                          type: 'card',
                        })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Utilizado</p>
                      <p className="text-2xl font-bold">{formatMoney(balanceCents)}</p>
                    </div>
                    {/* Barra de utilização */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={isHighUtilization ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                          {utilizationPct.toFixed(0)}% utilizado
                        </span>
                        <span className="text-muted-foreground">
                          Limite: {formatMoney(limitCents)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isHighUtilization ? 'bg-destructive' : utilizationPct >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, utilizationPct)}%` }}
                        />
                      </div>
                    </div>
                    {(card.closing_day as number | null) && (
                      <p className="text-xs text-muted-foreground">
                        Fecho: dia {card.closing_day as number}
                        {(card.payment_day as number | null) ? ` · Pagamento: dia ${card.payment_day as number}` : ''}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Modais ── */}

      {/* Modal de nova conta bancária */}
      <Dialog open={showAccountForm} onOpenChange={setShowAccountForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova conta bancária</DialogTitle>
          </DialogHeader>
          <AccountForm
            initialData={{ id: '', nome: '', tipo: 'corrente', saldoAtual: 0 }}
            onSuccess={() => { setShowAccountForm(false); }}
            onCancel={() => setShowAccountForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Modal de novo cartão de crédito */}
      <Dialog open={showCardForm} onOpenChange={setShowCardForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cartão de crédito</DialogTitle>
          </DialogHeader>
          <CreditCardFormNew
            familyId={familyId}
            onSuccess={() => { setShowCardForm(false); }}
            onCancel={() => setShowCardForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Confirmação de arquivo */}
      {deleteTarget && (
        <ConfirmationDialog
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          title={`Arquivar ${deleteTarget.type === 'account' ? 'conta' : 'cartão'}?`}
          description={`"${deleteTarget.nome}" será arquivado(a). O histórico de transações é preservado. Podes restaurar mais tarde nas Definições.`}
          confirmLabel="Arquivar"
          onConfirm={handleDeleteConfirm}
          isLoading={softDeleteAccountMutation.isPending || softDeleteCardMutation.isPending}
        />
      )}
    </div>
  );
};

export default ContasPage;
