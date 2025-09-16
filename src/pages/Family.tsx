import React, { Suspense, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FamilyProvider } from '../features/family/FamilyProvider';
import { useFamily } from '../features/family/FamilyContext';
import FamilyHeader from '../features/family/FamilyHeader';
import FamilySidebar from '../features/family/FamilySidebar';
import FamilyTabBar from '../features/family/FamilyTabBar';
import { LoadingSpinner } from '../components/ui/loading-states';
import { LoadingSpinner as LoadingSpinnerUI } from '../components/ui/loading-states';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useRouteChange } from '../hooks/useRouteChange';
import { useTransactions } from '../hooks/useTransactionsQuery';
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
  Users,
  Calendar
} from 'lucide-react';
import { useMediaQuery } from '../hooks/use-mobile';

// Lazy load das páginas
const FamilyDashboard = React.lazy(() => import('../features/family/FamilyDashboard'));
const FamilyGoals = React.lazy(() => import('../features/family/FamilyGoals'));
const FamilyBudgets = React.lazy(() => import('../features/family/FamilyBudgets'));
const FamilyAccounts = React.lazy(() => import('../features/family/FamilyAccounts'));
const FamilyTransactions = React.lazy(() => import('../features/family/FamilyTransactions'));
const FamilyMembers = React.lazy(() => import('../features/family/FamilyMembers'));
const FamilySettings = React.lazy(() => import('../features/family/FamilySettings'));
const RecurrentsPage = React.lazy(() => import('./recurrents'));
const ImporterPage = React.lazy(() => import('./importer'));

// Componente de loading
const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinnerUI size="lg" />
  </div>
);

// Componente de navegação mobile
const MobileNavigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { familyKPIs, isLoading } = useFamily();

  const prefetchFamily = (path: string) => {
    try {
      if (path === '/family/dashboard') import('../features/family/FamilyDashboard');
      if (path === '/family/accounts') import('../features/family/FamilyAccounts');
      if (path === '/family/transactions') import('../features/family/FamilyTransactions');
      if (path === '/family/goals') import('../features/family/FamilyGoals');
      if (path === '/family/budgets') import('../features/family/FamilyBudgets');
      if (path === '/family/members') import('../features/family/FamilyMembers');
      if (path === '/family/settings') import('../features/family/FamilySettings');
    } catch {}
  };

  const tabs = [
    { value: '/family/dashboard', label: 'Resumo', icon: Home },
    { value: '/family/accounts', label: 'Contas', icon: Wallet },
    { value: '/family/transactions', label: 'Transações', icon: TrendingUp },
    { value: '/family/goals', label: 'Objetivos', icon: Target },
    { value: '/family/budgets', label: 'Orçamentos', icon: BarChart3 },
    { value: '/family/recorrentes', label: 'Recorrentes', icon: Calendar },
    { value: '/family/importar', label: 'Importar', icon: Plus },
    { value: '/family/members', label: 'Membros', icon: Users },
    { value: '/family/settings', label: 'Definições', icon: Settings }
  ];

  const currentTab = tabs.find(tab => location.pathname === tab.value)?.value || '/family/dashboard';

  return (
    <div className="lg:hidden">
      <Tabs value={currentTab} onValueChange={(value) => navigate(value)}>
        <TabsList className="grid w-full grid-cols-4 mb-4">
          {tabs.slice(0, 4).map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex flex-col items-center gap-1" onMouseEnter={() => prefetchFamily(tab.value)} onFocus={() => prefetchFamily(tab.value)}>
              <tab.icon className="h-4 w-4" />
              <span className="text-xs">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsList className="grid w-full grid-cols-3">
          {tabs.slice(4).map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex flex-col items-center gap-1" onMouseEnter={() => prefetchFamily(tab.value)} onFocus={() => prefetchFamily(tab.value)}>
              <tab.icon className="h-4 w-4" />
              <span className="text-xs">{tab.label}</span>
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

  const prefetchFamily = (path: string) => {
    try {
      if (path === '/family/dashboard') import('../features/family/FamilyDashboard');
      if (path === '/family/accounts') import('../features/family/FamilyAccounts');
      if (path === '/family/transactions') import('../features/family/FamilyTransactions');
      if (path === '/family/goals') import('../features/family/FamilyGoals');
      if (path === '/family/budgets') import('../features/family/FamilyBudgets');
      if (path === '/family/members') import('../features/family/FamilyMembers');
      if (path === '/family/settings') import('../features/family/FamilySettings');
    } catch {}
  };

  const navItems = [
    { path: '/family/dashboard', label: 'Resumo', icon: Home, description: 'Visão geral familiar' },
    { path: '/family/accounts', label: 'Contas', icon: Wallet, description: 'Contas e cartões familiares' },
    { path: '/family/transactions', label: 'Transações', icon: TrendingUp, description: 'Histórico de transações' },
    { path: '/family/goals', label: 'Objetivos', icon: Target, description: 'Metas financeiras familiares' },
    { path: '/family/budgets', label: 'Orçamentos', icon: BarChart3, description: 'Orçamentos mensais' },
    { path: '/family/recorrentes', label: 'Recorrentes', icon: Calendar, description: 'Despesas recorrentes e subscrições' },
    { path: '/family/importar', label: 'Importar', icon: Plus, description: 'CSV/Recibos' },
    { path: '/family/members', label: 'Membros', icon: Users, description: 'Gestão de membros' },
    { path: '/family/settings', label: 'Definições', icon: Settings, description: 'Configurações familiares' }
  ];

  return (
    <div className="hidden lg:block w-64 bg-card border-r border-border min-h-screen p-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Finanças Partilhadas</h2>
        <p className="text-sm text-muted-foreground">Gestão financeira familiar</p>
      </div>
      
      <nav className="space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              onMouseEnter={() => prefetchFamily(item.path)}
              onFocus={() => prefetchFamily(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <div>
                <div className="font-medium">{item.label}</div>
                <div className="text-xs opacity-80">{item.description}</div>
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
};



// Componente de KPIs rápidos
const QuickKPIs: React.FC = () => {
  const { familyKPIs, isLoading, familyGoals } = useFamily();
  const location = useLocation();
  const { data: transactions = [] } = useTransactions();
  
  // Calcular objetivos ativos e concluídos
  const activeGoals = familyGoals.filter(goal => goal.ativa).length;
  const completedGoals = familyGoals.filter(goal => goal.status === 'completed').length;
  
  // Verificar se estamos na página de objetivos, orçamentos, contas ou transações
  const isGoalsPage = location.pathname === '/family/goals';
  const isBudgetsPage = location.pathname === '/family/budgets';
  const isAccountsPage = location.pathname === '/family/accounts';
  const isTransactionsPage = location.pathname === '/family/transactions';

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
                {familyKPIs.goalsAccountBalance?.toFixed(2) || '0.00'}€
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
                {familyKPIs.goalsProgressPercentage?.toFixed(0) || '0'}%
              </p>
              <p className="text-xs text-muted-foreground">
                {familyKPIs.goalsAccountBalance?.toFixed(2) || '0.00'}€ / {familyKPIs.totalGoalsValue?.toFixed(2) || '0.00'}€
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
                {familyKPIs.totalBudgetSpent?.toFixed(2) || '0.00'}€
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
                {familyKPIs.budgetSpentPercentage?.toFixed(0) || '0'}%
              </p>
              <p className="text-xs text-muted-foreground">
                {familyKPIs.totalBudgetSpent?.toFixed(2) || '0.00'}€ / {familyKPIs.totalBudgetAmount?.toFixed(2) || '0.00'}€
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
    // Usar dados das transações do contexto
    // Removido hook condicional; usamos 'transactions' já obtidas acima
    const totalIncome = transactions
      .filter(t => t.tipo === 'receita')
      .reduce((sum, t) => sum + t.valor, 0);

    const totalExpenses = transactions
      .filter(t => t.tipo === 'despesa')
      .reduce((sum, t) => sum + t.valor, 0);

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
                {familyKPIs.totalBalance?.toFixed(2) || '0.00'}€
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
                {familyKPIs.creditCardDebt?.toFixed(2) || '0.00'}€
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
                {familyKPIs.monthlySavings?.toFixed(2) || '0.00'}€
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
              {familyKPIs.totalBalance?.toFixed(2) || '0.00'}€
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
              {familyKPIs.creditCardDebt?.toFixed(2) || '0.00'}€
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
              {familyKPIs.monthlySavings?.toFixed(2) || '0.00'}€
            </p>
          </div>
          <PiggyBank className="h-8 w-8 text-green-600" />
        </div>
      </div>
    </div>
  );
};

// Componente principal da Área Familiar
const FamilyArea: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const location = useLocation();
  
  // Hook para atualizar dados automaticamente quando a rota muda
  useRouteChange();

  return (
    <div className="flex h-screen bg-background">
      {/* Navegação desktop */}
      <DesktopNavigation />
      
      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <FamilyHeader 
          onPrimaryAction={useLocation().pathname === '/family/recorrentes' ? () => {} : undefined}
          primaryActionLabel={useLocation().pathname === '/family/recorrentes' ? 'Nova Regra' : undefined}
        />
        
        {/* KPIs rápidos (apenas em desktop) - removido apenas da página de definições */}
        {!isMobile && location.pathname !== '/family/settings' && <QuickKPIs />}
        
        {/* Navegação mobile */}
        <MobileNavigation />
        
        {/* Conteúdo das páginas */}
        <div className="flex-1 overflow-auto">
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<Navigate to="/family/dashboard" replace />} />
              <Route path="/dashboard" element={<FamilyDashboard />} />
              <Route path="/accounts/*" element={<FamilyAccounts />} />
              <Route path="/goals/*" element={<FamilyGoals />} />
              <Route path="/budgets/*" element={<FamilyBudgets />} />
              <Route path="/transactions/*" element={<FamilyTransactions />} />
              <Route path="/recorrentes" element={<RecurrentsPage />} />
              <Route path="/importar" element={<ImporterPage />} />
              <Route path="/members/*" element={<FamilyMembers />} />
              <Route path="/settings" element={<FamilySettings />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </div>
  );
};

const FamilyPage: React.FC = () => {
  return (
    <FamilyProvider>
      <FamilyArea />
    </FamilyProvider>
  );
};

export default FamilyPage;