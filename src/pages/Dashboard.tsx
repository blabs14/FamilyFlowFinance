import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Target,
  Loader2,
  Plus,
  Calendar,
  BarChart3,
  Bell,
  Activity,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useScope } from '@/features/scope';
import { ContributionsWidget } from '@/components/dashboard/ContributionsWidget';
import { DashboardInsights } from '@/components/dashboard/DashboardInsights';
import { useDashboardData } from '../hooks/useDashboardQuery';
import { useTransactions } from '../hooks/useTransactionsQuery';
import { formatCurrency } from '../lib/utils';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: dashboardData, isLoading, error } = useDashboardData();
  const { data: transactions = [] } = useTransactions();
  const { scope } = useScope();

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

  const recentTransactions = transactions.slice(0, 5);

  const goToReports = () => navigate('/app/reports');
  const goToBudgets = () => navigate('/app/budgets');
  const goToTransactions = () => navigate('/app/transactions');

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
            Este Mês
          </Button>
        </div>
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
            <div className="text-2xl font-bold">
              {formatCurrency((dashboardData?.totalBalanceCents ?? 0) / 100)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <span>
                Poupança Mensal: {formatCurrency((dashboardData?.netCents ?? 0) / 100)}
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
              {formatCurrency((dashboardData?.incomeCents ?? 0) / 100)}
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
              {formatCurrency((dashboardData?.expenseCents ?? 0) / 100)}
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
            <div className="text-2xl font-bold text-blue-600">
              {dashboardData?.goalsProgressPercentage?.toFixed(1) ?? 0}%
            </div>
            <div className="flex items-center mt-1">
              <Button variant="link" className="ml-auto h-auto p-0 text-xs" onClick={() => navigate('/app/goals')} aria-label="Ver todos os objetivos financeiros">Ver objetivos</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inbox Badge */}
      {(dashboardData?.inboxPendingCount ?? 0) > 0 && (
        <Card
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate('/app/inbox')}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Bell className="h-5 w-5 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm font-medium">Inbox</p>
              <p className="text-xs text-muted-foreground">
                {dashboardData?.inboxPendingCount} {dashboardData?.inboxPendingCount === 1 ? 'item' : 'itens'} pendentes
              </p>
            </div>
            <Badge className="ml-auto">{dashboardData?.inboxPendingCount}</Badge>
          </CardContent>
        </Card>
      )}

      {/* KPIs adicionais provenientes do RPC (percentagens) */}
      {dashboardData?.budgetSpentPercentage != null && dashboardData.budgetSpentPercentage > 0 && (
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orçamento Gasto</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.budgetSpentPercentage.toFixed(1)}%</div>
            <Button variant="link" className="h-auto p-0 text-xs mt-1" onClick={() => navigate('/app/budgets')}>
              Ver orçamentos
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Seção de Análises e Transações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DashboardInsights */}
        <DashboardInsights />

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
                  onClick={() => navigate('/app/transactions')}
                >
                  Criar Transação
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contribuições por membro — visível apenas no âmbito familiar */}
      {scope.kind === 'family' && <ContributionsWidget />}

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
              onClick={() => navigate('/app/transactions')}
            >
              <Plus className="h-6 w-6" />
              <span className="text-sm">Nova Transação</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center gap-2"
              onClick={() => navigate('/app/accounts')}
            >
              <Wallet className="h-6 w-6" />
              <span className="text-sm">Gerir Contas</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center gap-2"
              onClick={() => navigate('/app/goals')}
            >
              <Target className="h-6 w-6" />
              <span className="text-sm">Objetivos</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col items-center justify-center gap-2"
              onClick={() => navigate('/app/reports')}
            >
              <BarChart3 className="h-6 w-6" />
              <span className="text-sm">Relatórios</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
