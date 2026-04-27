import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import DashboardChart from '../components/DashboardChart';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Plus,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Bell,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardData } from '../hooks/useDashboardQuery';
import { useAccountsWithBalances } from '../hooks/useAccountsQuery';
import { useTransactions } from '../hooks/useTransactionsQuery';
import { useGoals } from '../hooks/useGoalsQuery';
import { formatCurrency } from '../lib/utils';
import { useReminders } from '../hooks/useRemindersQuery';
import { useBudgets } from '../hooks/useBudgetsQuery';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: dashboardData, isLoading, error } = useDashboardData();
  const { data: accounts = [] } = useAccountsWithBalances();
  const { data: transactions = [] } = useTransactions();
  const { data: goals = [] } = useGoals();
  const { data: reminders = [] } = useReminders();
  const { data: budgets = [] } = useBudgets();
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>A carregar dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-red-600">
          <p>Erro ao carregar dados do dashboard</p>
          <p className="text-sm text-muted-foreground">Tente recarregar a página</p>
        </div>
      </div>
    );
  }

  const getBalanceChange = () => {
    const monthlySavings = Number(dashboardData?.monthlySavings || 0);
    return {
      value: Math.abs(monthlySavings),
      isPositive: monthlySavings >= 0,
      percentage: (dashboardData?.monthlyIncome || 0) > 0 ? (monthlySavings / (dashboardData?.monthlyIncome || 1)) * 100 : 0
    };
  };

  const balanceChange = getBalanceChange();

  // Métricas adicionais
  const totalAccounts = accounts.length;
  const activeGoals = goals.filter(goal => goal.ativa).length;
  const recentTransactions = transactions.slice(0, 5);

  // Lembretes de hoje
  const remindersToday = (() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${d}`;
    return (reminders || []).filter(r => typeof r.date === 'string' && r.date.startsWith(key));
  })();

  // Orçamentos em excesso (quando disponível)
  const overspentBudgetsCount = Array.isArray(budgets)
    ? (budgets || []).filter(b => Number(b.valor_gasto || 0) > Number(b.valor_orcamento || 0)).length
    : 0;
  
  // Distribuição de contas
  const accountDistribution = accounts.map(account => ({
    name: account.nome,
    balance: account.saldo_atual || 0,
    percentage: ((account.saldo_atual || 0) / (dashboardData?.totalBalance || 1)) * 100
  }));

  // Análise de transações por tipo
  const transactionsByType = (() => {
    const receitas = transactions.filter(t => t.tipo === 'receita').reduce((sum, t) => sum + (t.amount_cents || 0) / 100, 0);
    const despesas = transactions.filter(t => t.tipo === 'despesa').reduce((sum, t) => sum + (t.amount_cents || 0) / 100, 0);
    return [
      { name: 'Receitas', value: receitas },
      { name: 'Despesas', value: despesas }
    ];
  })();

  const goToReports = () => navigate('/app/reports');
  const goToBudgets = () => navigate('/budgets');
  const goToTransactions = () => navigate('/personal/transactions');

  return (
    <div className="space-y-6">
      {/* Header do Dashboard */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Bem-vindo de volta, {user?.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={goToReports} aria-label="Abrir Relatórios">
            <Calendar className="h-4 w-4 mr-2" />
            {selectedPeriod === 'month' ? 'Este Mês' : 'Este Ano'}
          </Button>
        </div>
      </div>

      {/* Indicadores rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card role="button" tabIndex={0} onClick={goToReports} onKeyDown={(e) => e.key === 'Enter' && goToReports()} className="hover:shadow-md transition-shadow focus:outline-none focus:ring-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lembretes de Hoje</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{remindersToday.length}</div>
            <p className="text-xs text-muted-foreground">Lembretes com data de hoje</p>
          </CardContent>
        </Card>
        <Card role="button" tabIndex={0} onClick={goToBudgets} onKeyDown={(e) => e.key === 'Enter' && goToBudgets()} className="hover:shadow-md transition-shadow focus:outline-none focus:ring-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orçamentos em Excesso</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overspentBudgetsCount}</div>
            <p className="text-xs text-muted-foreground">Categorias acima do orçamento</p>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Saldo Total */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData?.totalBalance || 0)}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {balanceChange.isPositive ? (
                <ArrowUpRight className="h-3 w-3 text-green-600 mr-1" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-600 mr-1" />
              )}
              <span className={balanceChange.isPositive ? 'text-green-600' : 'text-red-600'}>
                Poupança Mensal: {balanceChange.isPositive ? '+' : '-'}{formatCurrency(balanceChange.value)}
              </span>
              <Button variant="link" className="ml-auto h-auto p-0 text-xs" onClick={goToReports} aria-label="Ver relatórios financeiros detalhados">Ver relatórios</Button>
            </div>
          </CardContent>
        </Card>

        {/* Receitas Mensais */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receitas Mensais</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(dashboardData?.monthlyIncome || 0)}
            </div>
            <div className="flex items-center mt-1">
              <Button variant="link" className="ml-auto h-auto p-0 text-xs" onClick={goToReports}>Ver relatórios</Button>
            </div>
          </CardContent>
        </Card>

        {/* Despesas Mensais */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas Mensais</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(dashboardData?.monthlyExpenses || 0)}
            </div>
            <div className="flex items-center mt-1">
              <Button variant="link" className="ml-auto h-auto p-0 text-xs" onClick={goToReports}>Ver relatórios</Button>
            </div>
          </CardContent>
        </Card>

        {/* Objetivos Ativos */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Objetivos Ativos</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{activeGoals}</div>
            <div className="flex items-center mt-1">
              <Button variant="link" className="ml-auto h-auto p-0 text-xs" onClick={() => navigate('/Goals')} aria-label="Ver todos os objetivos financeiros">Ver objetivos</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs adicionais provenientes do RPC (percentagens) */}
      {(dashboardData?.goalsProgressPercentage != null || dashboardData?.budgetSpentPercentage != null) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {dashboardData?.goalsProgressPercentage != null && (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Progresso de Objetivos</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.goalsProgressPercentage.toFixed(1)}%</div>
                <Button variant="link" className="h-auto p-0 text-xs mt-1" onClick={() => navigate('/Goals')} aria-label="Gerir objetivos financeiros">
                  Ver objetivos
                </Button>
              </CardContent>
            </Card>
          )}

          {dashboardData?.budgetSpentPercentage != null && (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Orçamento Gasto</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.budgetSpentPercentage.toFixed(1)}%</div>
                <Button variant="link" className="h-auto p-0 text-xs mt-1" onClick={goToBudgets} aria-label="Gerir orçamentos mensais">
                  Ver orçamentos
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Seção de Gráficos e Análises */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição de Contas - Gráfico */}
        <DashboardChart
          data={accountDistribution
            .filter(account => account.balance > 0)
            .sort((a, b) => b.balance - a.balance)
            .slice(0, 8)
            .map(account => ({
              name: account.name,
              value: account.balance,
              percentage: account.percentage
            }))}
          title="Distribuição por Conta"
          type="pie"
          height={350}
        />

        {/* Receitas vs Despesas - Gráfico */}
        <DashboardChart
          data={transactionsByType}
          title="Receitas vs Despesas"
          type="bar"
          height={350}
        />

        {/* Transações Recentes */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Transações Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentTransactions.length > 0 ? (
              <div className="space-y-3">
                {recentTransactions.map((transaction, index) => (
                  <div key={transaction.id || `transaction-${index}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
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
                      {transaction.tipo === 'receita' ? '+' : '-'}{formatCurrency((transaction.amount_cents || 0) / 100)}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button variant="link" className="h-auto p-0 text-xs" onClick={goToTransactions} aria-label="Ver todas as transações">Ver todas</Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma transação encontrada</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => navigate('/personal/transactions')}
                >
                  Criar Transação
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-2"
              onClick={() => navigate('/personal/transactions')}
            >
              <Plus className="h-6 w-6" />
              <span className="text-sm">Nova Transação</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-2"
              onClick={() => navigate('/personal/accounts')}
            >
              <Wallet className="h-6 w-6" />
              <span className="text-sm">Gerir Contas</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-2"
              onClick={() => navigate('/personal/goals')}
            >
              <Target className="h-6 w-6" />
              <span className="text-sm">Objetivos</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col items-center justify-center gap-2"
              onClick={() => navigate('/personal/insights')}
            >
              <BarChart3 className="h-6 w-6" />
              <span className="text-sm">Relatórios</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Estado do Sistema */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Total de Contas</p>
                <p className="text-2xl font-bold">{totalAccounts}</p>
              </div>
              <Badge variant="secondary">{totalAccounts > 0 ? 'Ativo' : 'Inativo'}</Badge>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Transações Este Mês</p>
                <p className="text-2xl font-bold">{transactions.filter(t => 
                  new Date(t.data).getMonth() === new Date().getMonth()
                ).length}</p>
              </div>
              <Badge variant="outline">Mensal</Badge>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Estado do Sistema</p>
                <p className="text-2xl font-bold text-green-600">Online</p>
              </div>
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}