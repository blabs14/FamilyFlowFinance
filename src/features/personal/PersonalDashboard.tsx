import React from 'react';
import { usePersonal } from './PersonalProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { Badge } from '../../components/ui/badge';
import { 
  Wallet, 
  CreditCard, 
  Target, 
  TrendingUp, 
  TrendingDown,
  PiggyBank,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Bell
} from 'lucide-react';
import { useReminders } from '../../hooks/useRemindersQuery';
import { formatCurrency } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';

const PersonalDashboard: React.FC = () => {
  const { 
    myAccounts, 
    myCards, 
    myGoals, 
    myBudgets, 
    myTransactions, 
    personalKPIs, 
    isLoading 
  } = usePersonal();
  const { data: reminders = [] } = useReminders();

  // Loading progressivo - mostrar conteúdo conforme os dados vão carregando
  const isLoadingAny = isLoading.accounts || isLoading.goals || isLoading.budgets || isLoading.transactions || isLoading.kpis;

  // Calcular estatísticas - otimizado com useMemo
  const totalAccounts = myAccounts.length;
  const totalCards = myCards.length;
  
  // Lembretes de hoje
  const remindersToday = React.useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${d}`;
    return reminders.filter((r: any) => typeof r.date === 'string' && r.date.startsWith(key));
  }, [reminders]);

  // Orçamentos em excesso
  const overspentBudgetsCount = React.useMemo(() => {
    return myBudgets.filter((b: any) => Number(b.valor_gasto || 0) > Number(b.valor_orcamento || 0)).length;
  }, [myBudgets]);
  
  // Usar useMemo para cálculos pesados
  const { activeGoals, completedGoals, monthlyIncome, monthlyExpenses, cardsInDebt, totalDebt } = React.useMemo(() => {
    const activeGoals = myGoals.filter(goal => goal.ativa).length;
    const completedGoals = myGoals.filter(goal => {
      const objetivo = Number(goal.valor_objetivo ?? 0);
      const atual = Number((goal as any).valor_atual ?? (goal as any).total_alocado ?? 0);
      return objetivo > 0 && atual >= objetivo;
    }).length;
    
    // Transações do mês atual
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyTransactions = myTransactions.filter(t => t.data.startsWith(currentMonth));
    const monthlyIncome = monthlyTransactions
      .filter(t => t.tipo === 'receita')
      .reduce((sum, t) => sum + ((t.amount_cents || 0) / 100), 0);
    const monthlyExpenses = monthlyTransactions
      .filter(t => t.tipo === 'despesa')
      .reduce((sum, t) => sum + ((t.amount_cents || 0) / 100), 0);

    // Cartões em dívida
    const cardsInDebt = myCards.filter(card => ((card.amount_cents || 0) / 100) < 0);
    const totalDebt = cardsInDebt.reduce((sum, card) => sum + Math.abs((card.amount_cents || 0) / 100), 0);
    
    return { activeGoals, completedGoals, monthlyIncome, monthlyExpenses, cardsInDebt, totalDebt };
  }, [myGoals, myTransactions, myCards]);

  return (
    <div className="p-6 space-y-6">

      {/* Indicadores rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CardTitle className="text-sm font-medium cursor-help">Lembretes de Hoje</CardTitle>
                </TooltipTrigger>
                <TooltipContent>Lembretes com data igual a hoje.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{remindersToday.length}</div>
            <p className="text-xs text-muted-foreground">Lembretes com data de hoje</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CardTitle className="text-sm font-medium cursor-help">Orçamentos em Excesso</CardTitle>
                </TooltipTrigger>
                <TooltipContent>Número de categorias cujo gasto ultrapassa o orçamento definido.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overspentBudgetsCount}</div>
            <p className="text-xs text-muted-foreground">Categorias acima do orçamento</p>
          </CardContent>
        </Card>
      </div>

      {/* KPIs pessoais via RPC */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CardTitle className="text-sm font-medium cursor-help">Saldo Total</CardTitle>
                </TooltipTrigger>
                <TooltipContent>Somatório de saldos de todas as contas pessoais.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(personalKPIs.totalBalance || 0)}</div>
            <p className="text-xs text-muted-foreground">Somatório de contas pessoais</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CardTitle className="text-sm font-medium cursor-help">Poupança Mensal</CardTitle>
                </TooltipTrigger>
                <TooltipContent>Receitas menos despesas no mês corrente. Delta compara com o mês anterior.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(personalKPIs.monthlySavings || 0)}</div>
            <p className="text-xs text-muted-foreground">Receitas - Despesas (mês atual)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CardTitle className="text-sm font-medium cursor-help">Progresso de Objetivos</CardTitle>
                </TooltipTrigger>
                <TooltipContent>Percentagem agregada de progresso dos objetivos pessoais.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(personalKPIs.goalsProgressPercentage || 0).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Contribuição global</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CardTitle className="text-sm font-medium cursor-help">Orçamento Gasto</CardTitle>
                </TooltipTrigger>
                <TooltipContent>Percentagem do total orçamentado já consumido.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(personalKPIs.budgetSpentPercentage || 0).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Percentagem do orçamento gasto</p>
          </CardContent>
        </Card>
      </div>

      {/* Seção de Contas e Cartões */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Contas Pessoais
            </CardTitle>
            <CardDescription>
              Saldos das suas contas bancárias
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading.accounts ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={`account-loading-${i}`} className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="h-4 bg-muted animate-pulse rounded w-24" />
                      <div className="h-3 bg-muted animate-pulse rounded w-16" />
                    </div>
                    <div className="h-4 bg-muted animate-pulse rounded w-20" />
                  </div>
                ))}
              </div>
            ) : myAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma conta pessoal encontrada
              </p>
            ) : (
              myAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{account.nome}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {account.tipo}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${((account.amount_cents || 0) / 100) >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {((account.amount_cents || 0) / 100).toFixed(2)}€
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Cartões de Crédito */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Cartões de Crédito
            </CardTitle>
            <CardDescription>
              Estado dos seus cartões de crédito
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading.accounts ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={`card-loading-${i}`} className="flex items-center justify-between">
                    <div className="space-y-2">
                      <div className="h-4 bg-muted animate-pulse rounded w-24" />
                      <div className="h-3 bg-muted animate-pulse rounded w-16" />
                    </div>
                    <div className="h-4 bg-muted animate-pulse rounded w-20" />
                  </div>
                ))}
              </div>
            ) : myCards.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum cartão de crédito encontrado
              </p>
            ) : (
              <div className="space-y-4">
                {myCards.map((card) => {
                  const balance = (card.amount_cents || 0) / 100;
                  const isInDebt = balance < 0;
                  
                  return (
                    <div key={card.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{card.nome}</p>
                        <div className="flex items-center gap-2">
                          {isInDebt ? (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Em Dívida
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Em Dia
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${isInDebt ? 'text-destructive' : 'text-green-600'}`}>
                          {balance.toFixed(2)}€
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seção de Objetivos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Objetivos Pessoais
          </CardTitle>
          <CardDescription>
            Progresso dos seus objetivos financeiros
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading.goals ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={`goal-loading-${i}`} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="h-4 bg-muted animate-pulse rounded w-32" />
                      <div className="h-3 bg-muted animate-pulse rounded w-24" />
                    </div>
                    <div className="h-5 bg-muted animate-pulse rounded w-12" />
                  </div>
                  <div className="h-2 bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : myGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum objetivo pessoal encontrado
            </p>
          ) : (
            myGoals.slice(0, 3).map((goal) => {
              const progress = goal.valor_objetivo > 0 
                ? ((goal.valor_atual || 0) / goal.valor_objetivo) * 100 
                : 0;
              
              return (
                <div key={goal.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{goal.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {(goal.valor_atual || 0).toFixed(2)}€ / {goal.valor_objetivo.toFixed(2)}€
                      </p>
                    </div>
                    <Badge variant={progress >= 100 ? "default" : "secondary"}>
                      {progress.toFixed(0)}%
                    </Badge>
                  </div>
                  <Progress value={Math.min(progress, 100)} className="h-2" />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Transações Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Transações Recentes
          </CardTitle>
          <CardDescription>
            Últimas transações pessoais
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading.transactions ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={`transaction-loading-${i}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-muted animate-pulse rounded-full" />
                    <div className="space-y-1">
                      <div className="h-4 bg-muted animate-pulse rounded w-32" />
                      <div className="h-3 bg-muted animate-pulse rounded w-20" />
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="h-4 bg-muted animate-pulse rounded w-20" />
                    <div className="h-3 bg-muted animate-pulse rounded w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : myTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma transação encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myTransactions.slice(0, 5).map((transaction, index) => (
                <div key={transaction.id || `transaction-${transaction.data}-${index}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      transaction.tipo === 'receita' ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <div>
                      <div className="text-sm font-medium">{transaction.descricao}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(transaction.data).toLocaleDateString('pt-PT')}
                      </div>
                    </div>
                  </div>
                  <div className={`text-sm font-semibold ${
                    transaction.tipo === 'receita' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.tipo === 'receita' ? '+' : '-'}{((transaction.amount_cents || 0) / 100).toFixed(2)}€
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonalDashboard;