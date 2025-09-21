import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { useFamily } from './FamilyContext';
import { formatCurrency } from '../../lib/utils';
import { 
  Wallet, 
  CreditCard, 
  Target, 
  TrendingUp, 
  Users, 
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Calendar,
  Activity,
  BarChart3
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Suspense, useMemo } from 'react';
import { LazyReportChart, LazyFallback, LazyErrorBoundary } from './lazy/index';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';

const monthLabel = (date: Date) =>
  date.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '');

const FamilyDashboard: React.FC = () => {
  const { 
    family, 
    familyKPIs, 
    members, 
    pendingInvites, 
    familyAccounts, 
    familyGoals, 
    familyBudgets,
    familyTransactions,
    isLoading 
  } = useFamily();
  const navigate = useNavigate();

  // Construir séries reais a partir das transações (exclui transferências)
  const { expensesChartData, categoryChartData } = useMemo(() => {
     // Verificação de segurança para evitar erros quando os dados ainda não estão carregados
    if (!familyTransactions || !Array.isArray(familyTransactions)) {
      return { expensesChartData: [], categoryChartData: [] };
    }
    
    const txs = familyTransactions as Array<Record<string, unknown>>;
    const filtered = txs.filter((t) => (t?.['tipo'] as string) !== 'transferencia');

    // Últimos 6 meses incluindo o atual
    const now = new Date();
    const months: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, label: monthLabel(d), total: 0 });
    }

    filtered.forEach((t) => {
      const tipo = String(t?.['tipo'] ?? '');
      const valor = Number(t?.['valor'] ?? 0);
      const dataStr = String(t?.['data'] ?? '');
      if (!dataStr || Number.isNaN(valor)) return;
      const d = new Date(dataStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const m = months.find((m) => m.key === key);
      if (m && tipo === 'despesa') {
        m.total += valor;
      }
    });

    const expenses = months.map((m) => ({ month: m.label, value: m.total }));

    // Distribuição por categoria (top 5) para os últimos 90 dias
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(now.getDate() - 90);
    const perCategory: Record<string, number> = {};

    filtered.forEach((t) => {
      const tipo = String(t?.['tipo'] ?? '');
      const valor = Number(t?.['valor'] ?? 0);
      const dataStr = String(t?.['data'] ?? '');
      if (tipo !== 'despesa' || Number.isNaN(valor) || !dataStr) return;
      const d = new Date(dataStr);
      if (d < ninetyDaysAgo) return;
      const nome = String((t as Record<string, unknown>)['categoria_nome'] ?? (t as Record<string, unknown>)['categoria'] ?? 'Sem categoria');
      perCategory[nome] = (perCategory[nome] || 0) + valor;
    });

    const categories = Object.entries(perCategory)
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Mapear para o formato esperado pelo ReportChart
    const expensesChartData = expenses.map((e) => ({ categoria: e.month, total: e.value }));
    const categoryChartData = categories.map((c) => ({ categoria: c.category, total: c.value }));

    // Logs defensivos
    try {
      console.debug('[charts] expensesChartData sample:', expensesChartData.slice(0, 3));
      console.debug('[charts] categoryChartData sample:', categoryChartData.slice(0, 3));
    } catch {}

    return { expensesChartData, categoryChartData };
  }, [familyTransactions]);

  if (isLoading.family || isLoading.kpis) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">A carregar dados da família...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!family) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Nenhuma Família Encontrada
            </CardTitle>
            <CardDescription>
              Não foi encontrada nenhuma família associada à sua conta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Para começar a usar as Finanças Partilhadas, crie uma nova família ou aceite um convite existente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6 p-6">
      {/* Header da Família */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            {family.nome}
          </h2>
          <p className="text-sm text-muted-foreground">
            {family.description || 'Finanças partilhadas da família'}
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {members.length} membros
        </Badge>
      </div>

      {/* KPIs Principais */}
      <TooltipProvider>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card role="button" tabIndex={0} onClick={() => navigate('/family/accounts')} onKeyDown={(e) => e.key === 'Enter' && navigate('/family/accounts')} className="hover:shadow-md transition-shadow focus:outline-none focus:ring-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <CardTitle className="text-sm font-medium cursor-help">Saldo Total</CardTitle>
              </TooltipTrigger>
              <TooltipContent>
                Soma dos saldos de todas as contas da família (inclui contas de objetivos).
              </TooltipContent>
            </Tooltip>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(familyKPIs.totalBalance)}
            </div>
            <div className="flex items-center mt-1">
              <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate('/family/accounts')} aria-label="Ver todas as contas familiares">Ver contas</Button>
            </div>
          </CardContent>
        </Card>

        <Card role="button" tabIndex={0} onClick={() => navigate('/family/accounts')} onKeyDown={(e) => e.key === 'Enter' && navigate('/family/accounts')} className="hover:shadow-md transition-shadow focus:outline-none focus:ring-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <CardTitle className="text-sm font-medium cursor-help">Dívida Cartões</CardTitle>
              </TooltipTrigger>
              <TooltipContent>
                Saldo agregado das contas de tipo cartão de crédito.
              </TooltipContent>
            </Tooltip>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(familyKPIs.creditCardDebt)}
            </div>
            <div className="flex items-center mt-1">
              <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate('/family/accounts')} aria-label="Gerir cartões de crédito familiares">Gerir cartões</Button>
            </div>
          </CardContent>
        </Card>

        <Card role="button" tabIndex={0} onClick={() => navigate('/family/transactions')} onKeyDown={(e) => e.key === 'Enter' && navigate('/family/transactions')} className="hover:shadow-md transition-shadow focus:outline-none focus:ring-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <CardTitle className="text-sm font-medium cursor-help">Poupança Mensal</CardTitle>
              </TooltipTrigger>
              <TooltipContent>
                Receitas menos despesas no período atual. Delta compara com o mês anterior.
              </TooltipContent>
            </Tooltip>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(familyKPIs.monthlySavings)}
            </div>
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className={((familyKPIs.deltaVsPrev || 0) >= 0) ? 'text-green-600' : 'text-red-600'}>
                {((familyKPIs.deltaVsPrev || 0) >= 0 ? '+' : '')}{(familyKPIs.deltaVsPrev || 0).toFixed(2)}€ vs mês anterior
              </span>
              <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate('/family/transactions')} aria-label="Ver todas as transações familiares">Ver transações</Button>
            </div>
          </CardContent>
        </Card>

        <Card role="button" tabIndex={0} onClick={() => navigate('/family/goals')} onKeyDown={(e) => e.key === 'Enter' && navigate('/family/goals')} className="hover:shadow-md transition-shadow focus:outline-none focus:ring-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <CardTitle className="text-sm font-medium cursor-help">Progresso Objetivo</CardTitle>
              </TooltipTrigger>
              <TooltipContent>
                Maior progresso entre os objetivos ativos (em %).
              </TooltipContent>
            </Tooltip>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {familyKPIs.topGoalProgress.toFixed(1)}%
            </div>
            <div className="flex items-center mt-1">
              <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate('/family/goals')} aria-label="Ver objetivos financeiros familiares">Ver objetivos</Button>
            </div>
          </CardContent>
        </Card>
      </div>
      </TooltipProvider>

      {/* KPIs adicionais via RPC (percentagens globais) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card role="button" tabIndex={0} onClick={() => navigate('/family/goals')} onKeyDown={(e) => e.key === 'Enter' && navigate('/family/goals')} className="hover:shadow-md transition-shadow focus:outline-none focus:ring-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <CardTitle className="text-sm font-medium cursor-help">Progresso de Objetivos</CardTitle>
              </TooltipTrigger>
              <TooltipContent>
                Percentagem de progresso agregado dos objetivos ativos. Inclui saldo na conta de objetivos.
              </TooltipContent>
            </Tooltip>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{familyKPIs.goalsProgressPercentage.toFixed(1)}%</div>
            <div className="flex items-center mt-1">
              <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate('/family/goals')} aria-label="Ver detalhes dos objetivos">Detalhar</Button>
            </div>
          </CardContent>
        </Card>

        <Card role="button" tabIndex={0} onClick={() => navigate('/family/budgets')} onKeyDown={(e) => e.key === 'Enter' && navigate('/family/budgets')} className="hover:shadow-md transition-shadow focus:outline-none focus:ring-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <CardTitle className="text-sm font-medium cursor-help">Orçamento Gasto</CardTitle>
              </TooltipTrigger>
              <TooltipContent>
                Percentagem do total orçamentado já consumido. {familyKPIs.overspentBudgetsCount > 0 ? `Categorias acima do limite: ${familyKPIs.overspentBudgetsCount}.` : 'Sem categorias acima do limite.'}
              </TooltipContent>
            </Tooltip>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{familyKPIs.budgetSpentPercentage.toFixed(1)}%</div>
              {((familyKPIs.overspentBudgetsCount || 0) > 0) && (
                <Badge variant="destructive" className="text-xs">Ultrapassados: {familyKPIs.overspentBudgetsCount}</Badge>
              )}
            </div>
            <div className="flex items-center mt-1">
              <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate('/family/budgets')} aria-label="Ver orçamentos familiares">Ver orçamentos</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seção de Contas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Contas Familiares
          </CardTitle>
          <CardDescription>
            {familyAccounts.length} contas ativas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {familyAccounts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma conta familiar encontrada
            </p>
          ) : (
            <div className="space-y-3">
              {familyAccounts.slice(0, 3).map((account) => (
                <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      account.tipo === 'cartão de crédito' ? 'bg-red-500' : 'bg-green-500'
                    }`} />
                    <div>
                      <p className="font-medium">{account.nome}</p>
                      <p className="text-sm text-muted-foreground">{account.tipo}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency(account.saldo_atual || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Disponível: {formatCurrency(account.saldo_disponivel || 0)}
                    </p>
                  </div>
                </div>
              ))}
              {familyAccounts.length > 3 && (
                <p className="text-sm text-muted-foreground text-center">
                  +{familyAccounts.length - 3} mais contas
                </p>
              )}
              <div className="flex justify-end">
                <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate('/family/accounts')} aria-label="Gerir contas bancárias familiares">Gerir contas</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção de Objetivos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Objetivos Familiares
          </CardTitle>
          <CardDescription>
            {familyGoals.length} objetivos ativos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {familyGoals.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhum objetivo familiar encontrado
            </p>
          ) : (
            <div className="space-y-4">
              {familyGoals.slice(0, 2).map((goal) => {
                const progress = ((goal.valor_atual || 0) / (goal.valor_objetivo || 1)) * 100;
                return (
                  <div key={goal.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{goal.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(goal.valor_atual || 0)} / {formatCurrency(goal.valor_objetivo)}
                      </p>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {progress.toFixed(1)}% concluído
                    </p>
                  </div>
                );
              })}
              {familyGoals.length > 2 && (
                <p className="text-sm text-muted-foreground text-center">
                  +{familyGoals.length - 2} mais objetivos
                </p>
              )}
              <div className="flex justify-end">
                <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate('/family/goals')} aria-label="Gerir objetivos financeiros">Gerir objetivos</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção de Membros */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Membros Ativos
            </CardTitle>
            <CardDescription>
              {members.length} membros na família
            </CardDescription>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhum membro encontrado
              </p>
            ) : (
              <div className="space-y-3">
                {members.slice(0, 4).map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {member.profile?.nome?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{member.profile?.nome || 'Utilizador'}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
                    </div>
                    <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className="text-xs">
                      {member.role}
                    </Badge>
                  </div>
                ))}
                {members.length > 4 && (
                  <p className="text-sm text-muted-foreground text-center">
                    +{members.length - 4} mais membros
                  </p>
                )}
                <div className="flex justify-end">
                  <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate('/family/members')} aria-label="Gerir membros da família">Gerir membros</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Convites Pendentes
            </CardTitle>
            <CardDescription>
              {pendingInvites.filter(invite => invite.status === 'pending').length} convites aguardando
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingInvites.filter(invite => invite.status === 'pending').length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nenhum convite pendente
              </p>
            ) : (
              <div className="space-y-3">
                {pendingInvites
                  .filter(invite => invite.status === 'pending')
                  .slice(0, 3)
                  .map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium text-sm">{invite.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Convite enviado em {new Date(invite.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {invite.role}
                      </Badge>
                    </div>
                  ))}
                <div className="flex justify-end">
                  <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate('/family/members')} aria-label="Gerir convites pendentes">Gerir convites</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráficos e Visualizações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Evolução das Despesas (6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LazyErrorBoundary>
              <Suspense fallback={<LazyFallback message="A carregar gráfico..." />}>
                <LazyReportChart
                  data={expensesChartData}
                  type="line"
                  height={300}
                />
              </Suspense>
            </LazyErrorBoundary>
            {expensesChartData.every((e) => e.total === 0) && (
              <p className="text-xs text-muted-foreground mt-2">Sem despesas registadas neste período.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Distribuição por Categoria (90 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LazyErrorBoundary>
              <Suspense fallback={<LazyFallback message="A carregar gráfico..." />}>
                <LazyReportChart
                  data={categoryChartData}
                  type="pie"
                  height={300}
                />
              </Suspense>
            </LazyErrorBoundary>
            {categoryChartData.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">Sem despesas por categoria nos últimos 90 dias.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </TooltipProvider>
  );
};

export default FamilyDashboard;