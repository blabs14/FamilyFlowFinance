import React, { Suspense, useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { PersonalProvider, usePersonal } from '../features/personal/PersonalProvider';
import { useTransactions } from '../hooks/useTransactionsQuery';
import { LoadingSpinner } from '../components/ui/loading-states';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useRouteChange } from '../hooks/useRouteChange';
import { useReminders } from '../hooks/useRemindersQuery';
import { useDailyReminderNotifications } from '../hooks/useDailyReminderNotifications';
import { 
  Home, 
  Wallet, 
  Target, 
  BarChart3, 
  TrendingUp, 
  Lightbulb, 
  Settings,
  Plus,
  CreditCard,
  PiggyBank,
  TrendingDown,
  Calendar,
  Clock
} from 'lucide-react';
import { useMediaQuery } from '../hooks/use-mobile';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/utils';
import { getReminderDate } from '../lib/dateUtils';


// Componentes lazy loading
const PersonalDashboard = React.lazy(() => import('../features/personal/PersonalDashboard'));
const PersonalAccounts = React.lazy(() => import('../features/personal/PersonalAccounts'));
const PersonalGoals = React.lazy(() => import('../features/personal/PersonalGoals'));
const PersonalBudgets = React.lazy(() => import('../features/personal/PersonalBudgets'));
const PersonalTransactions = React.lazy(() => import('../features/personal/PersonalTransactions'));
const PersonalInsights = React.lazy(() => import('../features/personal/PersonalInsights'));
const PersonalSettings = React.lazy(() => import('../features/personal/PersonalSettings'));
const PersonalReminders = React.lazy(() => import('../features/personal/PersonalReminders'));
const RecurrentsPage = React.lazy(() => import('./recurrents'));
const PayrollModule = React.lazy(() => import('../features/payroll/components/PayrollModule'));

// Componente de loading
const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="lg" />
  </div>
);

// Componente de navegação mobile
const MobileNavigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { personalKPIs, isLoading } = usePersonal();
  const { data: reminders = [] } = useReminders();

  const remindersThisMonth = React.useMemo(() => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const start = new Date(year, month, 1, 0, 0, 0, 0);
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return (reminders || []).filter((r) => {
        const d = getReminderDate(r) ?? new Date('1970-01-01');
        return d >= start && d <= end && d >= now;
      }).length;
    } catch {
      return 0;
    }
  }, [reminders]);

  const tabs = [
    { value: '/personal', label: 'Resumo', icon: Home },
    { value: '/personal/accounts', label: 'Contas', icon: Wallet },
    { value: '/personal/transactions', label: 'Transações', icon: TrendingUp },
    { value: '/personal/goals', label: 'Objetivos', icon: Target },
    { value: '/personal/budgets', label: 'Orçamentos', icon: BarChart3 },
    { value: '/personal/payroll', label: 'Folha Pagamento', icon: Clock },
    { value: '/personal/insights', label: 'Insights', icon: Lightbulb },
    { value: '/personal/recorrentes', label: 'Recorrentes', icon: Calendar },
    { value: '/personal/importar', label: 'Importar', icon: Plus },
    { value: '/personal/reminders', label: 'Lembretes', icon: Calendar },
    { value: '/personal/settings', label: 'Definições', icon: Settings }
  ];

  const prefetchTab = (path: string) => {
    try {
      if (path === '/personal/insights') import('../features/personal/PersonalInsights');
      if (path === '/personal/transactions') import('../features/personal/PersonalTransactions');
      if (path === '/personal/budgets') import('../features/personal/PersonalBudgets');
    } catch {}
  };

  const currentTab = tabs.find(tab => location.pathname === tab.value)?.value || '/personal';

  return (
    <div className="lg:hidden">
      <Tabs value={currentTab} onValueChange={(value) => navigate(value)}>
        <TabsList className="grid w-full grid-cols-4 mb-4">
          {tabs.slice(0, 4).map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex flex-col items-center gap-1" onMouseEnter={() => prefetchTab(tab.value)} onFocus={() => prefetchTab(tab.value)}>
              <tab.icon className="h-4 w-4" />
              <span className="text-xs">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsList className="grid w-full grid-cols-4">
          {tabs.slice(4).map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex flex-col items-center gap-1" onMouseEnter={() => prefetchTab(tab.value)} onFocus={() => prefetchTab(tab.value)}>
              <tab.icon className="h-4 w-4" />
              <span className="text-xs flex items-center gap-1">
                {tab.label}
                {tab.value === '/personal/reminders' && remindersThisMonth > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 leading-none">
                    {remindersThisMonth}
                  </Badge>
                )}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
};

// Componente de navegação desktop
const DesktopNavigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: reminders = [] } = useReminders();

  const remindersThisMonth = React.useMemo(() => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const start = new Date(year, month, 1, 0, 0, 0, 0);
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
      return (reminders || []).filter((r) => {
        const d = getReminderDate(r) ?? new Date('1970-01-01');
        return d >= start && d <= end && d >= now;
      }).length;
    } catch {
      return 0;
    }
  }, [reminders]);

  const navItems = [
    { path: '/personal', label: 'Resumo', icon: Home, description: 'Visão geral pessoal' },
    { path: '/personal/accounts', label: 'Contas', icon: Wallet, description: 'Contas e cartões pessoais' },
    { path: '/personal/transactions', label: 'Transações', icon: TrendingUp, description: 'Histórico de transações' },
    { path: '/personal/goals', label: 'Objetivos', icon: Target, description: 'Metas financeiras pessoais' },
    { path: '/personal/budgets', label: 'Orçamentos', icon: BarChart3, description: 'Orçamentos mensais' },
    { path: '/personal/payroll', label: 'Folha Pagamento', icon: Clock, description: 'Gestão de horários e salários' },
    { path: '/personal/insights', label: 'Insights', icon: Lightbulb, description: 'Análises e dicas' },
    { path: '/personal/recorrentes', label: 'Recorrentes', icon: Calendar, description: 'Despesas recorrentes e subscrições' },
    { path: '/personal/importar', label: 'Importar', icon: Plus, description: 'CSV/Recibos' },
    { path: '/personal/reminders', label: 'Lembretes', icon: Calendar, description: 'Gerir lembretes pessoais' },
    { path: '/personal/settings', label: 'Definições', icon: Settings, description: 'Configurações pessoais' }
  ];

  const prefetchDesktop = (path: string) => {
    try {
      if (path === '/personal/insights') import('../features/personal/PersonalInsights');
      if (path === '/personal/transactions') import('../features/personal/PersonalTransactions');
      if (path === '/personal/budgets') import('../features/personal/PersonalBudgets');
    } catch {}
  };

  return (
    <div className="hidden lg:block w-64 bg-card border-r border-border min-h-screen p-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Área Pessoal</h2>
        <p className="text-sm text-muted-foreground">Gestão financeira individual</p>
      </div>
      
      <nav className="space-y-2">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            onMouseEnter={() => prefetchDesktop(item.path)}
            onFocus={() => prefetchDesktop(item.path)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 text-left ${
              location.pathname === item.path
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            <item.icon className="h-5 w-5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm flex items-center gap-2">
                {item.label}
                {item.path === '/personal/reminders' && remindersThisMonth > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 leading-none">
                    {remindersThisMonth}
                  </Badge>
                )}
              </div>
              <div className="text-xs truncate">{item.description}</div>
            </div>
          </button>
        ))}
      </nav>
    </div>
  );
};

// Componente de cabeçalho
const PersonalHeader: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { personalKPIs, isLoading } = usePersonal();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const { data: reminders = [] } = useReminders();

  const remindersToday = React.useMemo(() => {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return (reminders || []).filter((r) => {
        const d = getReminderDate(r) ?? new Date('1970-01-01');
        return d >= start && d <= end;
      }).length;
    } catch {
      return 0;
    }
  }, [reminders]);

  // (removido) Carregamento de audit logs foi movido para PersonalArea

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/personal') return 'Resumo';
    if (path === '/personal/accounts') return 'Contas';
    if (path === '/personal/goals') return 'Objetivos';
    if (path === '/personal/budgets') return 'Orçamentos';
    if (path === '/personal/transactions') return 'Transações';
    if (path === '/personal/insights') return 'Insights';
    if (path === '/personal/reminders') return 'Lembretes';
    if (path === '/personal/settings') return 'Definições';
    return 'Área Pessoal';
  };

  const getPrimaryAction = () => {
    const path = location.pathname;
    if (path === '/personal/goals') return { label: 'Novo Objetivo', action: () => navigate('/personal/goals/new') };
    if (path === '/personal/budgets') return { label: 'Novo Orçamento', action: () => navigate('/personal/budgets/new') };
    if (path === '/personal/transactions') return { label: 'Nova Transação', action: () => navigate('/personal/transactions/new') };
    if (path === '/personal/recorrentes') return { label: 'Nova Regra', action: () => navigate('/personal/recorrentes') };
    return null;
  };

  const primaryAction = getPrimaryAction();

  return (
    <div className="flex items-center justify-between p-6 border-b border-border bg-background">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/app')}
          className="flex items-center gap-2"
          title="Voltar à Home"
        >
          <Home className="h-4 w-4" />
        </Button>
        
        <div className="hidden sm:block w-px h-6 bg-border" />
        
        <div>
          <h1 className="text-2xl font-bold text-foreground">Visão Pessoal › {getPageTitle()}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão das suas finanças pessoais
          </p>
        </div>
      </div>
      
      {/* Lembretes que expiram hoje */}
      {remindersToday > 0 && (
        <Badge variant="secondary" title="Lembretes para hoje" className="whitespace-nowrap">
          Hoje: {remindersToday}
        </Badge>
      )}
    </div>
  );
};

// Componente de KPIs rápidos
const QuickKPIs: React.FC = () => {
  const { personalKPIs, isLoading, myGoals } = usePersonal();
  const location = useLocation();
  const { data: transactions = [] } = useTransactions();
  
  // Calcular objetivos ativos e concluídos
  const activeGoals = myGoals.filter(goal => goal.ativa).length;
  const completedGoals = myGoals.filter(goal => (Number((goal as any).progresso_percentual) || Number((goal as any).progress_percentage) || 0) >= 100).length;
  
  // Verificar se estamos na página de objetivos, orçamentos, contas ou transações
  const isGoalsPage = location.pathname === '/personal/goals';
  const isBudgetsPage = location.pathname === '/personal/budgets';
  const isAccountsPage = location.pathname === '/personal/accounts';
  const isTransactionsPage = location.pathname === '/personal/transactions';

  if (isLoading.kpis) {
    const cardCount = (isGoalsPage) ? 3 : (isBudgetsPage) ? 2 : (isAccountsPage || isTransactionsPage ? 4 : 4);
    return (
      <div className={`grid grid-cols-1 gap-4 p-6 ${(isGoalsPage) ? 'md:grid-cols-3' : (isBudgetsPage) ? 'md:grid-cols-2' : 'md:grid-cols-4'}`}>
        {Array.from({ length: cardCount }, (_, i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  // Se estamos na página de objetivos, mostrar 3 cards (incluindo Objetivos Ativos)
  if (isGoalsPage) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Disponível - Conta Objetivos</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(personalKPIs.goalsAccountBalance ?? 0)}
              </p>
            </div>
            <Target className="h-8 w-8 text-primary" />
          </div>
        </div>
        
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Progresso Objetivo</p>
              <p className="text-2xl font-bold text-foreground">
                {Math.round(personalKPIs.goalsProgressPercentage ?? 0)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(personalKPIs.goalsAccountBalance ?? 0)} / {formatCurrency(personalKPIs.totalGoalsValue ?? 0)}
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
        </div>
        
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Objetivos Ativos</p>
              <p className="text-2xl font-bold text-foreground">
                {activeGoals}
              </p>
              <p className="text-xs text-muted-foreground">
                {completedGoals} concluído{completedGoals !== 1 ? 's' : ''}
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
        </div>
      </div>
    );
  }

  // Se estamos na página de orçamentos, mostrar apenas os 2 cards específicos
  if (isBudgetsPage) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Gasto - Orçamentos</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(personalKPIs.totalBudgetSpent ?? 0)}
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
        </div>
        
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Percentagem Gasto - Orçamentos</p>
              <p className="text-2xl font-bold text-foreground">
                {Math.round(personalKPIs.budgetSpentPercentage ?? 0)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(personalKPIs.totalBudgetSpent ?? 0)} / {formatCurrency(personalKPIs.totalBudgetAmount ?? 0)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-primary" />
          </div>
        </div>
      </div>
    );
  }

  // Se estamos na página de transações, mostrar os 4 cards de métricas de transações
  if (isTransactionsPage) {
    // Usar dados das transações obtidas acima
    const totalIncome = transactions
      .filter(t => t.tipo === 'receita')
      .reduce((sum, t) => {
          const valor = typeof t.valor === 'number' ? t.valor : parseFloat(t.valor) || 0;
          return sum + valor;
        }, 0);

    const totalExpenses = transactions
        .filter(t => t.tipo === 'despesa')
        .reduce((sum, t) => {
          const valor = typeof t.valor === 'number' ? t.valor : parseFloat(t.valor) || 0;
          return sum + valor;
        }, 0);

    const netBalance = totalIncome - totalExpenses;
    const transactionCount = transactions.length;

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6">
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Receitas</p>
              <p className="text-2xl font-bold text-green-600">
                {totalIncome.toFixed(2)}€
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Despesas</p>
              <p className="text-2xl font-bold text-red-600">
                {totalExpenses.toFixed(2)}€
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Saldo Líquido</p>
              <p className="text-2xl font-bold text-blue-600">
                {netBalance.toFixed(2)}€
              </p>
            </div>
            <Wallet className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Transações</p>
              <p className="text-2xl font-bold text-foreground">
                {transactionCount}
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
        </div>
      </div>
    );
  }

  // Se estamos na página de contas, mostrar apenas 3 cards (sem Objetivos Ativos)
  if (isAccountsPage) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Saldo Total</p>
              <p className="text-2xl font-bold text-foreground">
                {personalKPIs.totalBalance.toFixed(2)}€
              </p>
            </div>
            <Wallet className="h-8 w-8 text-primary" />
          </div>
        </div>
        
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Dívida Cartões</p>
              <p className="text-2xl font-bold text-destructive">
                {personalKPIs.creditCardDebt.toFixed(2)}€
              </p>
            </div>
            <CreditCard className="h-8 w-8 text-destructive" />
          </div>
        </div>
        
        <div className="bg-card p-4 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Poupança Mensal</p>
              <p className="text-2xl font-bold text-green-600">
                {personalKPIs.monthlySavings.toFixed(2)}€
              </p>
            </div>
            <PiggyBank className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>
    );
  }

  // Para outras páginas, mostrar os 4 cards originais
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6">
      <div className="bg-card p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Saldo Total</p>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(personalKPIs.totalBalance ?? 0)}
            </p>
          </div>
          <Wallet className="h-8 w-8 text-primary" />
        </div>
      </div>
      
      <div className="bg-card p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Dívida Cartões</p>
            <p className="text-2xl font-bold text-destructive">
              {formatCurrency(personalKPIs.creditCardDebt ?? 0)}
            </p>
          </div>
          <CreditCard className="h-8 w-8 text-destructive" />
        </div>
      </div>
      
      <div className="bg-card p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Objetivos Ativos</p>
            <p className="text-2xl font-bold text-foreground">
              {activeGoals}
            </p>
            <p className="text-xs text-muted-foreground">
              {completedGoals} concluído{completedGoals !== 1 ? 's' : ''}
            </p>
          </div>
          <BarChart3 className="h-8 w-8 text-primary" />
        </div>
      </div>
      
      <div className="bg-card p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Poupança Mensal</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(personalKPIs.monthlySavings ?? 0)}
            </p>
          </div>
          <PiggyBank className="h-8 w-8 text-green-600" />
        </div>
      </div>
    </div>
  );
};

// Componente principal da Área Pessoal
const PersonalArea: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const location = useLocation();
  
  // Hook para atualizar dados automaticamente quando a rota muda
  useRouteChange();
  // Ativar notificações de lembretes do dia
  useDailyReminderNotifications();

  return (
    <div className="flex h-screen bg-background">
      {/* Navegação desktop */}
      <DesktopNavigation />
      
      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <PersonalHeader />
        
        {/* KPIs rápidos (apenas em desktop) - removido apenas da página de definições */}
        {!isMobile && location.pathname !== '/personal/settings' && <QuickKPIs />}
        
        {/* Navegação mobile */}
        <MobileNavigation />
        
        {/* Conteúdo das páginas */}
        <div className="flex-1 overflow-auto">
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route index element={<PersonalDashboard />} />
              <Route path="accounts/*" element={<PersonalAccounts />} />
              <Route path="goals" element={<PersonalGoals />} />
              <Route path="budgets/*" element={<PersonalBudgets />} />
              <Route path="transactions/*" element={<PersonalTransactions />} />
              <Route path="payroll/*" element={<PayrollModule />} />
              <Route path="recorrentes" element={<RecurrentsPage />} />
              <Route path="importar" element={
                <Suspense fallback={<PageLoading />}>
                  {React.createElement(React.lazy(()=> import('./importer')))}
                </Suspense>
              } />
              <Route path="reminders" element={<PersonalReminders />} />
              <Route path="insights" element={<PersonalInsights />} />
              <Route path="settings" element={<PersonalSettings />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </div>
  );
};

// Componente wrapper com provider
const PersonalPage: React.FC = () => {
  return (
    <PersonalProvider>
      <PersonalArea />
    </PersonalProvider>
  );
};

export default PersonalPage;