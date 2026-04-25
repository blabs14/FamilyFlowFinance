# Unit 3: Navigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three parallel navigation universes (`/app`, `/personal/*`, `/family/*`) with a single flat sidebar under `/app/*`, scope-aware via `useScope()`, eliminating all duplicate nav code.

**Architecture:** `MainLayout` retains its existing shell (header + sidebar + bottom tabbar); `NavigationSidebar` and `BottomTabBar` are rewritten in-place to carry the 8 unified items + scope toggle in the sidebar header; family-contextual items (Membros, Convites, Definições Família) appear conditionally when `scope.kind === 'family'`; `/personal/*` and `/family/*` become redirect routes; each previously-duplicated page (Accounts, Transactions, Goals, Budgets) becomes a single page file that calls `useScope()` and delegates to the right data layer.

**Tech Stack:** React Router v6 (`Navigate` for redirects), TailwindCSS, shadcn/ui (`Sheet`, `DropdownMenu`, `Button`), `useScope()` from `src/features/scope`, Vitest + React Testing Library.

---

## Situação Atual (descoberta no codebase)

- `src/components/layout/NavigationSidebar.tsx` — sidebar existente com 6 items misturados (Dashboard, Relatórios, Cashflow, Performance, Área Pessoal, Finanças Partilhadas). `ScopeToggle` já importado e visível no header via `MainLayout`.
- `src/components/layout/BottomTabBar.tsx` — tabbar com apenas 3 items (Início, Relatórios, Fluxos).
- `src/components/layout/MainLayout.tsx` — layout principal com header fixo, sidebar desktop e bottom tabbar mobile. Já importa `ScopeToggle`.
- `src/App.tsx` — tem rotas `/app/*` (Dashboard, Reports, Cashflow, Payroll, Performance, Profile) + `/personal/*` (PersonalPage) + `/family/*` (FamilyPage). `ScopeProvider` já envolve a app.
- `src/pages/Personal.tsx` — layout completo próprio (DesktopNavigation + MobileNavigation + PersonalHeader + QuickKPIs) com sub-rotas em `/personal/*`.
- `src/pages/Family.tsx` — layout completo próprio (DesktopNavigation + MobileNavigation + FamilyHeader) com sub-rotas em `/family/*`.
- `src/features/scope/` — `ScopeProvider`, `useScope`, `ScopeToggle`, `ScopeBadge` já implementados (Unit 1 Phase 1 completa).
- Páginas duplicadas a unificar: `PersonalAccounts`/`FamilyAccounts`, `PersonalTransactions`/`FamilyTransactions`, `PersonalGoals`/`FamilyGoals`, `PersonalBudgets`/`FamilyBudgets`, `PersonalDashboard`/`FamilyDashboard`.
- Código morto a eliminar: `src/features/family/FamilySidebar.tsx`, `src/features/family/FamilyTabBar.tsx`, `src/features/family/FamilyHeader.tsx`, `src/pages/Personal.tsx`, `src/pages/Family.tsx`.

---

## File Structure

### Criar
- `src/pages/app/AccountsPage.tsx` — página unificada de contas
- `src/pages/app/TransactionsPage.tsx` — página unificada de transações
- `src/pages/app/GoalsPage.tsx` — página unificada de objetivos
- `src/pages/app/BudgetsPage.tsx` — página unificada de orçamentos
- `src/pages/app/RecurrentsPage.tsx` — página unificada de recorrentes (wrapper da existente)
- `src/pages/app/MembersPage.tsx` — página de membros (scope família)
- `src/pages/app/FamilySettingsPage.tsx` — página definições família (scope família)
- `src/components/layout/__tests__/NavigationSidebar.test.tsx`
- `src/components/layout/__tests__/BottomTabBar.test.tsx`

### Modificar
- `src/components/layout/NavigationSidebar.tsx` — reescrever com 8 items + items contextuais família + ScopeToggle no header
- `src/components/layout/BottomTabBar.tsx` — reescrever com 5 items + "Mais" drawer
- `src/components/layout/MainLayout.tsx` — atualizar `getPageTitle()` para cobrir todas as novas rotas
- `src/App.tsx` — adicionar rotas `/app/*` para novos pages + redirects `/personal/*` e `/family/*`

### Eliminar (via `git rm`)
- `src/pages/Personal.tsx`
- `src/pages/Family.tsx`
- `src/features/family/FamilySidebar.tsx`
- `src/features/family/FamilyTabBar.tsx`
- `src/features/family/FamilyHeader.tsx`

---

## Task 1: Reescrever NavigationSidebar com 8 items + scope toggle + items contextuais

**Ficheiros:**
- Criar: `src/components/layout/__tests__/NavigationSidebar.test.tsx`
- Modificar: `src/components/layout/NavigationSidebar.tsx`

- [ ] **Step 1.1: Escrever o teste falhante**

```typescript
// src/components/layout/__tests__/NavigationSidebar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mocks mínimos
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'test@example.com' } }),
}));
vi.mock('../../../hooks/useProfilesQuery', () => ({
  useProfile: () => ({ data: { nome: 'Pedro' }, isLoading: false }),
}));
vi.mock('../../../features/scope', () => ({
  ScopeToggle: () => <div data-testid="scope-toggle" />,
  useScope: () => ({ scope: { kind: 'personal' }, setScope: vi.fn(), scopedFilter: null }),
  useMyFamilies: () => ({ data: [] }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

import { NavigationSidebar } from '../NavigationSidebar';

describe('NavigationSidebar', () => {
  it('renderiza os 8 items de nav principal', () => {
    render(<NavigationSidebar />, { wrapper });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Contas')).toBeInTheDocument();
    expect(screen.getByText('Transações')).toBeInTheDocument();
    expect(screen.getByText('Orçamentos')).toBeInTheDocument();
    expect(screen.getByText('Objetivos')).toBeInTheDocument();
    expect(screen.getByText('Recorrentes')).toBeInTheDocument();
    expect(screen.getByText('Payroll')).toBeInTheDocument();
    expect(screen.getByText('Relatórios')).toBeInTheDocument();
  });

  it('não mostra items de família quando scope é pessoal', () => {
    render(<NavigationSidebar />, { wrapper });
    expect(screen.queryByText('Membros')).not.toBeInTheDocument();
    expect(screen.queryByText('Convites')).not.toBeInTheDocument();
    expect(screen.queryByText('Definições Família')).not.toBeInTheDocument();
  });

  it('mostra items de família quando scope é família', async () => {
    vi.doMock('../../../features/scope', () => ({
      ScopeToggle: () => <div data-testid="scope-toggle" />,
      useScope: () => ({
        scope: { kind: 'family', familyId: 'fam-1' },
        setScope: vi.fn(),
        scopedFilter: { userId: 'u1', familyId: 'fam-1' },
      }),
      useMyFamilies: () => ({ data: [{ id: 'fam-1', nome: 'Silva' }] }),
    }));
    const { NavigationSidebar: NS } = await import('../NavigationSidebar');
    render(<NS />, { wrapper });
    expect(screen.getByText('Membros')).toBeInTheDocument();
    expect(screen.getByText('Convites')).toBeInTheDocument();
    expect(screen.getByText('Definições Família')).toBeInTheDocument();
  });

  it('inclui o ScopeToggle no header da sidebar', () => {
    render(<NavigationSidebar />, { wrapper });
    expect(screen.getByTestId('scope-toggle')).toBeInTheDocument();
  });
});
```

- [ ] **Step 1.2:** Run: `npx vitest run src/components/layout/__tests__/NavigationSidebar.test.tsx` Expected: FAIL (items como "Contas", "Transações" etc. não existem ainda)

- [ ] **Step 1.3: Implementar NavigationSidebar.tsx**

```typescript
// src/components/layout/NavigationSidebar.tsx
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  Home,
  Wallet,
  ArrowLeftRight,
  PieChart,
  Target,
  RefreshCw,
  Briefcase,
  BarChart3,
  Users,
  UserPlus,
  Settings,
  User,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../hooks/useProfilesQuery';
import { ScopeToggle, useScope } from '../../features/scope';

interface NavigationSidebarProps {
  onNavigate?: () => void;
}

const mainNavItems = [
  { title: 'Dashboard',    href: '/app',             icon: Home,           description: 'Visão geral' },
  { title: 'Contas',       href: '/app/contas',       icon: Wallet,         description: 'Contas e cartões' },
  { title: 'Transações',   href: '/app/transacoes',   icon: ArrowLeftRight, description: 'Histórico de movimentos' },
  { title: 'Orçamentos',   href: '/app/orcamentos',   icon: PieChart,       description: 'Orçamentos mensais' },
  { title: 'Objetivos',    href: '/app/objetivos',    icon: Target,         description: 'Metas financeiras' },
  { title: 'Recorrentes',  href: '/app/recorrentes',  icon: RefreshCw,      description: 'Despesas e subscrições recorrentes' },
  { title: 'Payroll',      href: '/app/payroll',      icon: Briefcase,      description: 'Folha de pagamento' },
  { title: 'Relatórios',   href: '/app/reports',      icon: BarChart3,      description: 'Relatórios e análises' },
];

const familyNavItems = [
  { title: 'Membros',            href: '/app/membros',             icon: Users,    description: 'Membros da família' },
  { title: 'Convites',           href: '/app/convites',            icon: UserPlus, description: 'Gerir convites' },
  { title: 'Definições Família', href: '/app/definicoes-familia',  icon: Settings, description: 'Configurações da família' },
];

export function NavigationSidebar({ onNavigate }: NavigationSidebarProps) {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { scope } = useScope();

  const isFamilyScope = scope.kind === 'family';

  const getInitials = (name: string) =>
    name.split(' ').map((w) => w.charAt(0)).join('').toUpperCase().slice(0, 2);

  const userName = profile?.nome || user?.user_metadata?.full_name || 'Utilizador';
  const userEmail = user?.email || '';
  const userInitials = getInitials(userName);

  const renderNavItem = (item: (typeof mainNavItems)[0]) => (
    <NavLink
      key={item.href}
      to={item.href}
      end={item.href === '/app'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group',
          isActive
            ? 'bg-primary text-primary-foreground shadow-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent',
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn(
              'h-5 w-5 transition-transform group-hover:scale-110',
              isActive ? 'text-primary-foreground' : '',
            )}
          />
          <div className="flex-1 min-w-0">
            <div className={cn('font-medium text-sm', isActive ? 'text-primary-foreground' : '')}>
              {item.title}
            </div>
            <div
              className={cn(
                'text-xs truncate',
                isActive ? 'text-primary-foreground/80' : 'text-muted-foreground',
              )}
            >
              {item.description}
            </div>
          </div>
        </>
      )}
    </NavLink>
  );

  return (
    <div className="flex flex-col w-full h-full bg-card">
      {/* Logo + Scope Toggle */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">F</span>
          </div>
          <div>
            <h2 className="font-semibold text-foreground">FamilyFlow</h2>
            <p className="text-xs text-muted-foreground">Finanças em família</p>
          </div>
        </div>
        <ScopeToggle />
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {mainNavItems.map(renderNavItem)}

        {/* Family-contextual items */}
        {isFamilyScope && (
          <>
            <div className="pt-3 pb-1">
              <p className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Família
              </p>
            </div>
            {familyNavItems.map(renderNavItem)}
          </>
        )}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-border">
        <NavLink
          to="/app/profile"
          onClick={onNavigate}
          className="flex items-center space-x-3 p-3 rounded-lg bg-accent hover:bg-accent/80 transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 bg-gradient-secondary rounded-full flex items-center justify-center">
            <span className="text-secondary-foreground font-medium text-sm">
              {profileLoading ? '...' : userInitials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-foreground">
              {profileLoading ? 'A carregar...' : userName}
            </div>
            <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
          </div>
          <User className="h-4 w-4 text-muted-foreground" />
        </NavLink>
      </div>
    </div>
  );
}
```

- [ ] **Step 1.4:** Run: `npx vitest run src/components/layout/__tests__/NavigationSidebar.test.tsx` Expected: PASS

- [ ] **Step 1.5: Commit**

```bash
git add src/components/layout/NavigationSidebar.tsx \
        src/components/layout/__tests__/NavigationSidebar.test.tsx
git commit -m "feat(nav): rewrite NavigationSidebar — 8 items + scope toggle + family contextual items"
```

---

## Task 2: Reescrever BottomTabBar com 5 items + "Mais" drawer

**Ficheiros:**
- Criar: `src/components/layout/__tests__/BottomTabBar.test.tsx`
- Modificar: `src/components/layout/BottomTabBar.tsx`

- [ ] **Step 2.1: Escrever o teste falhante**

```typescript
// src/components/layout/__tests__/BottomTabBar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../features/scope', () => ({
  useScope: () => ({ scope: { kind: 'personal' }, scopedFilter: null }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

import { BottomTabBar } from '../BottomTabBar';

describe('BottomTabBar', () => {
  it('renderiza 5 itens visíveis + botão Mais', () => {
    render(<BottomTabBar />, { wrapper });
    expect(screen.getByText('Início')).toBeInTheDocument();
    expect(screen.getByText('Contas')).toBeInTheDocument();
    expect(screen.getByText('Transações')).toBeInTheDocument();
    expect(screen.getByText('Objetivos')).toBeInTheDocument();
    expect(screen.getByText('Mais')).toBeInTheDocument();
  });

  it('abre o drawer "Mais" ao clicar', () => {
    render(<BottomTabBar />, { wrapper });
    fireEvent.click(screen.getByText('Mais'));
    expect(screen.getByText('Orçamentos')).toBeInTheDocument();
    expect(screen.getByText('Recorrentes')).toBeInTheDocument();
    expect(screen.getByText('Payroll')).toBeInTheDocument();
    expect(screen.getByText('Relatórios')).toBeInTheDocument();
  });

  it('mostra Membros no drawer quando scope é família', async () => {
    vi.doMock('../../../features/scope', () => ({
      useScope: () => ({
        scope: { kind: 'family', familyId: 'fam-1' },
        scopedFilter: { userId: 'u1', familyId: 'fam-1' },
      }),
    }));
    const { BottomTabBar: BTB } = await import('../BottomTabBar');
    render(<BTB />, { wrapper });
    fireEvent.click(screen.getByText('Mais'));
    expect(screen.getByText('Membros')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2.2:** Run: `npx vitest run src/components/layout/__tests__/BottomTabBar.test.tsx` Expected: FAIL

- [ ] **Step 2.3: Implementar BottomTabBar.tsx**

```typescript
// src/components/layout/BottomTabBar.tsx
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Wallet,
  ArrowLeftRight,
  Target,
  PieChart,
  RefreshCw,
  Briefcase,
  BarChart3,
  Users,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { useScope } from '../../features/scope';

// 5 items visíveis no tabbar
const primaryTabItems = [
  { title: 'Início',      href: '/app',           icon: Home,           end: true },
  { title: 'Contas',      href: '/app/contas',     icon: Wallet,         end: false },
  { title: 'Transações',  href: '/app/transacoes', icon: ArrowLeftRight, end: false },
  { title: 'Objetivos',   href: '/app/objetivos',  icon: Target,         end: false },
];

// Items no drawer "Mais"
const moreItems = [
  { title: 'Orçamentos',  href: '/app/orcamentos',  icon: PieChart   },
  { title: 'Recorrentes', href: '/app/recorrentes', icon: RefreshCw  },
  { title: 'Payroll',     href: '/app/payroll',     icon: Briefcase  },
  { title: 'Relatórios',  href: '/app/reports',     icon: BarChart3  },
];

const familyMoreItems = [
  { title: 'Membros',            href: '/app/membros',            icon: Users },
  { title: 'Convites',           href: '/app/convites',           icon: Users },
  { title: 'Definições Família', href: '/app/definicoes-familia', icon: Users },
];

export function BottomTabBar() {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const location = useLocation();
  const { scope } = useScope();
  const isFamilyScope = scope.kind === 'family';

  const allMoreItems = isFamilyScope
    ? [...moreItems, ...familyMoreItems]
    : moreItems;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-lg">
      <div className="flex justify-around items-center py-2 px-1">
        {primaryTabItems.map((item) => {
          const isActive = item.end
            ? location.pathname === item.href
            : location.pathname.startsWith(item.href);

          return (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.end}
              className={cn(
                'flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-200 min-w-0 flex-1 max-w-[80px]',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <div
                className={cn(
                  'p-1.5 rounded-lg transition-all duration-200',
                  isActive ? 'bg-primary-light' : '',
                )}
              >
                <item.icon
                  className={cn(
                    'h-5 w-5 transition-all duration-200',
                    isActive ? 'text-primary scale-110' : 'text-muted-foreground',
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-xs font-medium mt-1 truncate transition-all duration-200',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {item.title}
              </span>
            </NavLink>
          );
        })}

        {/* Botão Mais */}
        <Sheet open={isMoreOpen} onOpenChange={setIsMoreOpen}>
          <SheetTrigger asChild>
            <button
              className="flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-200 min-w-0 flex-1 max-w-[80px] text-muted-foreground"
              aria-label="Mais opções"
            >
              <div className="p-1.5 rounded-lg">
                <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-xs font-medium mt-1">Mais</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-8">
            <SheetHeader className="mb-4">
              <SheetTitle>Mais opções</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-4 gap-4">
              {allMoreItems.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={() => setIsMoreOpen(false)}
                    className={cn(
                      'flex flex-col items-center justify-center p-3 rounded-lg gap-2 text-center',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-accent text-accent-foreground hover:bg-accent/80',
                    )}
                  >
                    <item.icon className="h-6 w-6" />
                    <span className="text-xs font-medium leading-tight">{item.title}</span>
                  </NavLink>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
```

- [ ] **Step 2.4:** Run: `npx vitest run src/components/layout/__tests__/BottomTabBar.test.tsx` Expected: PASS

- [ ] **Step 2.5: Commit**

```bash
git add src/components/layout/BottomTabBar.tsx \
        src/components/layout/__tests__/BottomTabBar.test.tsx
git commit -m "feat(nav): rewrite BottomTabBar — 5 items + Mais drawer with family-contextual items"
```

---

## Task 3: Criar páginas unificadas em src/pages/app/

**Ficheiros:**
- Criar: `src/pages/app/AccountsPage.tsx`, `src/pages/app/TransactionsPage.tsx`, `src/pages/app/GoalsPage.tsx`, `src/pages/app/BudgetsPage.tsx`, `src/pages/app/RecurrentsPage.tsx`, `src/pages/app/MembersPage.tsx`, `src/pages/app/FamilySettingsPage.tsx`

Cada página chama `useScope()` e renderiza o componente correto (Personal ou Family). Esta abordagem preserva o código existente das features (PersonalAccounts, FamilyAccounts, etc.) sem as reescrever — o isolamento completo das providers acontece em Task 4.

- [ ] **Step 3.1: Criar AccountsPage.tsx**

```typescript
// src/pages/app/AccountsPage.tsx
import React, { Suspense } from 'react';
import { useScope } from '../../features/scope';
import { LoadingSpinner } from '../../components/ui/loading-states';
import { PersonalProvider } from '../../features/personal/PersonalProvider';
import { FamilyProvider } from '../../features/family/FamilyProvider';

const PersonalAccounts = React.lazy(() => import('../../features/personal/PersonalAccounts'));
const FamilyAccounts = React.lazy(() => import('../../features/family/FamilyAccounts'));

const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="lg" />
  </div>
);

export default function AccountsPage() {
  const { scope } = useScope();

  if (scope.kind === 'family') {
    return (
      <FamilyProvider>
        <Suspense fallback={<PageLoading />}>
          <FamilyAccounts />
        </Suspense>
      </FamilyProvider>
    );
  }

  return (
    <PersonalProvider>
      <Suspense fallback={<PageLoading />}>
        <PersonalAccounts />
      </Suspense>
    </PersonalProvider>
  );
}
```

- [ ] **Step 3.2: Criar TransactionsPage.tsx**

```typescript
// src/pages/app/TransactionsPage.tsx
import React, { Suspense } from 'react';
import { useScope } from '../../features/scope';
import { LoadingSpinner } from '../../components/ui/loading-states';
import { PersonalProvider } from '../../features/personal/PersonalProvider';
import { FamilyProvider } from '../../features/family/FamilyProvider';

const PersonalTransactions = React.lazy(() => import('../../features/personal/PersonalTransactions'));
const FamilyTransactions = React.lazy(() => import('../../features/family/FamilyTransactions'));

const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="lg" />
  </div>
);

export default function TransactionsPage() {
  const { scope } = useScope();

  if (scope.kind === 'family') {
    return (
      <FamilyProvider>
        <Suspense fallback={<PageLoading />}>
          <FamilyTransactions />
        </Suspense>
      </FamilyProvider>
    );
  }

  return (
    <PersonalProvider>
      <Suspense fallback={<PageLoading />}>
        <PersonalTransactions />
      </Suspense>
    </PersonalProvider>
  );
}
```

- [ ] **Step 3.3: Criar GoalsPage.tsx**

```typescript
// src/pages/app/GoalsPage.tsx
import React, { Suspense } from 'react';
import { useScope } from '../../features/scope';
import { LoadingSpinner } from '../../components/ui/loading-states';
import { PersonalProvider } from '../../features/personal/PersonalProvider';
import { FamilyProvider } from '../../features/family/FamilyProvider';

const PersonalGoals = React.lazy(() => import('../../features/personal/PersonalGoals'));
const FamilyGoals = React.lazy(() => import('../../features/family/FamilyGoals'));

const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="lg" />
  </div>
);

export default function GoalsPage() {
  const { scope } = useScope();

  if (scope.kind === 'family') {
    return (
      <FamilyProvider>
        <Suspense fallback={<PageLoading />}>
          <FamilyGoals />
        </Suspense>
      </FamilyProvider>
    );
  }

  return (
    <PersonalProvider>
      <Suspense fallback={<PageLoading />}>
        <PersonalGoals />
      </Suspense>
    </PersonalProvider>
  );
}
```

- [ ] **Step 3.4: Criar BudgetsPage.tsx**

```typescript
// src/pages/app/BudgetsPage.tsx
import React, { Suspense } from 'react';
import { useScope } from '../../features/scope';
import { LoadingSpinner } from '../../components/ui/loading-states';
import { PersonalProvider } from '../../features/personal/PersonalProvider';
import { FamilyProvider } from '../../features/family/FamilyProvider';

const PersonalBudgets = React.lazy(() => import('../../features/personal/PersonalBudgets'));
const FamilyBudgets = React.lazy(() => import('../../features/family/FamilyBudgets'));

const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="lg" />
  </div>
);

export default function BudgetsPage() {
  const { scope } = useScope();

  if (scope.kind === 'family') {
    return (
      <FamilyProvider>
        <Suspense fallback={<PageLoading />}>
          <FamilyBudgets />
        </Suspense>
      </FamilyProvider>
    );
  }

  return (
    <PersonalProvider>
      <Suspense fallback={<PageLoading />}>
        <PersonalBudgets />
      </Suspense>
    </PersonalProvider>
  );
}
```

- [ ] **Step 3.5: Criar RecurrentsPage.tsx**

```typescript
// src/pages/app/RecurrentsPage.tsx
// Wrapper simples — a página de recorrentes já é scope-agnóstica (usa useAuth internamente)
import React, { Suspense } from 'react';
import { LoadingSpinner } from '../../components/ui/loading-states';

const RecurrentsContent = React.lazy(() => import('../recurrents'));

const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="lg" />
  </div>
);

export default function RecurrentsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <RecurrentsContent />
    </Suspense>
  );
}
```

- [ ] **Step 3.6: Criar MembersPage.tsx**

```typescript
// src/pages/app/MembersPage.tsx
// Apenas disponível em scope família — proteger com redirect se scope pessoal
import React, { Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useScope } from '../../features/scope';
import { LoadingSpinner } from '../../components/ui/loading-states';
import { FamilyProvider } from '../../features/family/FamilyProvider';

const FamilyMembers = React.lazy(() => import('../../features/family/FamilyMembers'));

const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="lg" />
  </div>
);

export default function MembersPage() {
  const { scope } = useScope();

  if (scope.kind !== 'family') {
    return <Navigate to="/app" replace />;
  }

  return (
    <FamilyProvider>
      <Suspense fallback={<PageLoading />}>
        <FamilyMembers />
      </Suspense>
    </FamilyProvider>
  );
}
```

- [ ] **Step 3.7: Criar FamilySettingsPage.tsx**

```typescript
// src/pages/app/FamilySettingsPage.tsx
// Apenas disponível em scope família
import React, { Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useScope } from '../../features/scope';
import { LoadingSpinner } from '../../components/ui/loading-states';
import { FamilyProvider } from '../../features/family/FamilyProvider';

const FamilySettings = React.lazy(() => import('../../features/family/FamilySettings'));

const PageLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <LoadingSpinner size="lg" />
  </div>
);

export default function FamilySettingsPage() {
  const { scope } = useScope();

  if (scope.kind !== 'family') {
    return <Navigate to="/app" replace />;
  }

  return (
    <FamilyProvider>
      <Suspense fallback={<PageLoading />}>
        <FamilySettings />
      </Suspense>
    </FamilyProvider>
  );
}
```

- [ ] **Step 3.8: Verificar compilação TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3.9: Commit**

```bash
git add src/pages/app/
git commit -m "feat(pages): add unified scope-aware page wrappers in /app/*"
```

---

## Task 4: Atualizar App.tsx — registar rotas /app/* + redirects /personal/* e /family/*

**Ficheiros:**
- Modificar: `src/App.tsx`

- [ ] **Step 4.1: Ler App.tsx antes de editar**

Confirmar linhas exatas de importação e rotas para `/personal/*` e `/family/*`.

- [ ] **Step 4.2: Atualizar App.tsx**

Substituir o bloco de rotas protegidas e os blocos `/personal/*` e `/family/*` pelo seguinte. Manter todas as importações existentes que continuam a ser usadas.

```typescript
// Adicionar imports lazy das novas páginas
const AccountsPage = lazy(() => import('./pages/app/AccountsPage'));
const TransactionsPage = lazy(() => import('./pages/app/TransactionsPage'));
const GoalsPage = lazy(() => import('./pages/app/GoalsPage'));
const BudgetsPage = lazy(() => import('./pages/app/BudgetsPage'));
const RecurrentsAppPage = lazy(() => import('./pages/app/RecurrentsPage'));
const MembersPage = lazy(() => import('./pages/app/MembersPage'));
const FamilySettingsPage = lazy(() => import('./pages/app/FamilySettingsPage'));
```

Substituir o bloco de rotas `/app` e `/personal`, `/family`:

```tsx
{/* Páginas protegidas sob /app */}
<Route path="/app" element={<RequireAuth><MainLayout /></RequireAuth>}>
  <Route index element={
    <Suspense fallback={<PageLoading />}>
      <Dashboard />
    </Suspense>
  } />
  <Route path="contas/*" element={
    <Suspense fallback={<PageLoading />}>
      <AccountsPage />
    </Suspense>
  } />
  <Route path="transacoes/*" element={
    <Suspense fallback={<PageLoading />}>
      <TransactionsPage />
    </Suspense>
  } />
  <Route path="objetivos/*" element={
    <Suspense fallback={<PageLoading />}>
      <GoalsPage />
    </Suspense>
  } />
  <Route path="orcamentos/*" element={
    <Suspense fallback={<PageLoading />}>
      <BudgetsPage />
    </Suspense>
  } />
  <Route path="recorrentes" element={
    <Suspense fallback={<PageLoading />}>
      <RecurrentsAppPage />
    </Suspense>
  } />
  <Route path="payroll/*" element={
    <Suspense fallback={<PageLoading />}>
      <PayrollPage />
    </Suspense>
  } />
  <Route path="reports" element={
    <Suspense fallback={<PageLoading />}>
      <ReportsPage />
    </Suspense>
  } />
  <Route path="cashflow" element={
    <Suspense fallback={<PageLoading />}>
      <CashflowPage />
    </Suspense>
  } />
  <Route path="membros/*" element={
    <Suspense fallback={<PageLoading />}>
      <MembersPage />
    </Suspense>
  } />
  <Route path="convites" element={
    <Suspense fallback={<PageLoading />}>
      <MembersPage />
    </Suspense>
  } />
  <Route path="definicoes-familia" element={
    <Suspense fallback={<PageLoading />}>
      <FamilySettingsPage />
    </Suspense>
  } />
  <Route path="performance" element={
    <Suspense fallback={<PageLoading />}>
      <PerformanceDashboard />
    </Suspense>
  } />
  <Route path="profile" element={
    <Suspense fallback={<PageLoading />}>
      <ProfilePage />
    </Suspense>
  } />
</Route>

{/* Redirects legacy — /personal/* e /family/* → /app */}
<Route path="/personal" element={<Navigate to="/app" replace />} />
<Route path="/personal/accounts" element={<Navigate to="/app/contas" replace />} />
<Route path="/personal/transactions" element={<Navigate to="/app/transacoes" replace />} />
<Route path="/personal/goals" element={<Navigate to="/app/objetivos" replace />} />
<Route path="/personal/budgets" element={<Navigate to="/app/orcamentos" replace />} />
<Route path="/personal/recorrentes" element={<Navigate to="/app/recorrentes" replace />} />
<Route path="/personal/payroll" element={<Navigate to="/app/payroll" replace />} />
<Route path="/personal/insights" element={<Navigate to="/app/reports" replace />} />
<Route path="/personal/reminders" element={<Navigate to="/app" replace />} />
<Route path="/personal/settings" element={<Navigate to="/app/profile" replace />} />
<Route path="/personal/*" element={<Navigate to="/app" replace />} />

<Route path="/family" element={<Navigate to="/app" replace />} />
<Route path="/family/dashboard" element={<Navigate to="/app" replace />} />
<Route path="/family/accounts" element={<Navigate to="/app/contas" replace />} />
<Route path="/family/transactions" element={<Navigate to="/app/transacoes" replace />} />
<Route path="/family/goals" element={<Navigate to="/app/objetivos" replace />} />
<Route path="/family/budgets" element={<Navigate to="/app/orcamentos" replace />} />
<Route path="/family/recorrentes" element={<Navigate to="/app/recorrentes" replace />} />
<Route path="/family/members" element={<Navigate to="/app/membros" replace />} />
<Route path="/family/settings" element={<Navigate to="/app/definicoes-familia" replace />} />
<Route path="/family/*" element={<Navigate to="/app" replace />} />
```

- [ ] **Step 4.3: Verificar compilação TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros. Se houver erros por imports não usados de `PersonalPage`/`FamilyPage`, remover essas linhas de importação.

- [ ] **Step 4.4: Correr testes**

```bash
npm test
```

Esperado: todos passam. Navegação básica funciona.

- [ ] **Step 4.5: Commit**

```bash
git add src/App.tsx
git commit -m "feat(router): add /app/* routes + redirect /personal/* and /family/* to /app"
```

---

## Task 5: Atualizar MainLayout — getPageTitle para novas rotas

**Ficheiros:**
- Modificar: `src/components/layout/MainLayout.tsx`

- [ ] **Step 5.1: Atualizar getPageTitle()**

Substituir a função `getPageTitle()` existente:

```typescript
const getPageTitle = () => {
  const path = location.pathname;
  if (path === '/app' || path === '/app/') return 'Dashboard';
  if (path.startsWith('/app/contas')) return 'Contas';
  if (path.startsWith('/app/transacoes')) return 'Transações';
  if (path.startsWith('/app/objetivos')) return 'Objetivos';
  if (path.startsWith('/app/orcamentos')) return 'Orçamentos';
  if (path.startsWith('/app/recorrentes')) return 'Recorrentes';
  if (path.startsWith('/app/payroll')) return 'Payroll';
  if (path.startsWith('/app/reports')) return 'Relatórios';
  if (path.startsWith('/app/cashflow')) return 'Cashflow';
  if (path.startsWith('/app/membros')) return 'Membros';
  if (path.startsWith('/app/convites')) return 'Convites';
  if (path.startsWith('/app/definicoes-familia')) return 'Definições Família';
  if (path.startsWith('/app/profile')) return 'Perfil';
  if (path.startsWith('/app/performance')) return 'Performance';
  return 'Dashboard';
};
```

- [ ] **Step 5.2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Step 5.3: Correr testes**

```bash
npm test
```

- [ ] **Step 5.4: Commit**

```bash
git add src/components/layout/MainLayout.tsx
git commit -m "feat(layout): update MainLayout getPageTitle for all /app/* routes"
```

---

## Task 6: Eliminar código morto — Personal.tsx, Family.tsx, FamilySidebar, FamilyTabBar, FamilyHeader

**Ficheiros:**
- Eliminar: `src/pages/Personal.tsx`, `src/pages/Family.tsx`, `src/features/family/FamilySidebar.tsx`, `src/features/family/FamilyTabBar.tsx`, `src/features/family/FamilyHeader.tsx`

- [ ] **Step 6.1: Verificar que nenhum ficheiro activo importa estes**

```bash
grep -r "pages/Personal\|pages/Family\|FamilySidebar\|FamilyTabBar\|FamilyHeader" \
     src/ --include="*.ts" --include="*.tsx" -l
```

Esperado: apenas os próprios ficheiros a eliminar (e possivelmente `src/pages/Family.tsx` que importa FamilySidebar/FamilyTabBar/FamilyHeader — estes são eliminados juntos).

- [ ] **Step 6.2: Verificar que App.tsx não importa PersonalPage/FamilyPage**

Confirmar que as linhas abaixo foram removidas na Task 4:

```typescript
const PersonalPage = lazy(() => import('./pages/Personal'));
const FamilyPage = lazy(() => import('./pages/Family'));
```

Se ainda existirem, removê-las agora.

- [ ] **Step 6.3: Eliminar ficheiros**

```bash
git rm src/pages/Personal.tsx \
       src/pages/Family.tsx \
       src/features/family/FamilySidebar.tsx \
       src/features/family/FamilyTabBar.tsx \
       src/features/family/FamilyHeader.tsx
```

- [ ] **Step 6.4: Verificar compilação TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros. Se FamilyPage importava tipos de FamilyHeader (ex: `FamilyHeaderProps`), esses tipos já não são necessários.

- [ ] **Step 6.5: Correr todos os testes**

```bash
npm test
```

Esperado: todos os testes passam.

- [ ] **Step 6.6: Commit**

```bash
git add -A
git commit -m "feat(cleanup): remove dead nav code — Personal.tsx, Family.tsx, FamilySidebar, FamilyTabBar, FamilyHeader"
```

---

## Task 7: Smoke test de navegação manual + verificação final

Esta task não tem código — é verificação manual e a finalização do branch.

- [ ] **Step 7.1: Iniciar servidor de desenvolvimento**

```bash
npm run dev
```

- [ ] **Step 7.2: Verificar cenários**

Verificar manualmente (ou via playwright se disponível):

| Cenário | Resultado esperado |
|---|---|
| Aceder `/personal/accounts` | Redirect para `/app/contas` |
| Aceder `/personal/goals` | Redirect para `/app/objetivos` |
| Aceder `/family/members` | Redirect para `/app/membros` |
| Aceder `/family/dashboard` | Redirect para `/app` |
| Sidebar desktop mostra 8 items | Sim |
| Com scope Pessoal: Membros não visível | Sim |
| Com scope Família: Membros visível | Sim |
| BottomTabBar mobile mostra 5 + Mais | Sim |
| Drawer Mais contém Orçamentos, Recorrentes, Payroll, Relatórios | Sim |
| Scope toggle presente no header da sidebar | Sim |
| ScopeBadge (se visível no header) muda ao trocar scope | Sim |

- [ ] **Step 7.3: Verificar ausência de referências legacy**

```bash
grep -r "\/personal\/" src/ --include="*.ts" --include="*.tsx" -l
grep -r "\/family\/" src/ --include="*.ts" --include="*.tsx" -l
```

Esperado: zero resultados (ou apenas comentários e os próprios redirects em App.tsx).

- [ ] **Step 7.4: Compilação limpa final**

```bash
npx tsc --noEmit && npm test
```

Esperado: 0 erros TypeScript, todos os testes PASS.

- [ ] **Step 7.5: Commit de verificação (se houver ajustes)**

```bash
git add -A
git commit -m "fix(nav): post-smoke-test adjustments to unified navigation"
```

---

## Verificação Final

```bash
# Compilação limpa
npx tsc --noEmit

# Todos os testes passam
npm test

# Nenhuma rota /personal ou /family no código activo (excepto redirects em App.tsx)
grep -r "href.*\/personal\|to.*\/personal\|href.*\/family\|to.*\/family" \
     src/ --include="*.tsx" --include="*.ts" \
     | grep -v "App.tsx" \
     | grep -v ".test."

# Confirmar que os 8 items estão no NavigationSidebar
grep -c "href.*\/app\/" src/components/layout/NavigationSidebar.tsx
# Esperado: ≥ 8
```

---

## Notas de Implementação

**Providers aninhados:** `PersonalProvider` e `FamilyProvider` são contexts de dados pesados que não devem estar sempre montados. As páginas em `src/pages/app/` montam apenas o provider necessário para o scope activo. Quando o utilizador muda de scope, o componente desmonta e remonta com o provider correto — React Query faz o cache work.

**Convites:** A rota `/app/convites` foi mapeada para `MembersPage` por pragmatismo — `FamilyMembers` já inclui a gestão de convites pendentes. Se no futuro for necessária uma página dedicada, basta criar `ConvitesPage.tsx` sem alterar a navegação.

**`FamilyContext` e `PersonalProvider` nos pages/app/:** As feature pages (`PersonalAccounts`, `FamilyAccounts`, etc.) dependem dos seus respectivos providers via `usePersonal()` / `useFamily()`. Os wrappers em `src/pages/app/` montam esses providers localmente, por isso não é necessário mover a lógica dos providers para um nível superior. Isso será feito em Unit 5+ quando as features forem reescritas com `useScope()` nativo.

**Importar** (`/personal/importar`, `/family/importar`) não tem rota directa em `/app/*` — foi diferida para Unit 14. O redirect de `/personal/importar` aponta para `/app` como fallback razoável.

**Terminologia de rotas:** Optou-se por rotas em português sem acentos (`/app/transacoes`, `/app/objetivos`, `/app/orcamentos`) para consistência com o mercado PT e compatibilidade URL. Evita encoding de caracteres especiais.
