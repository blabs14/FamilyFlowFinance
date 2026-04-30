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
  { title: 'Dashboard',    href: '/app',            icon: Home,           description: 'Visão geral', end: true },
  { title: 'Contas',       href: '/app/contas',      icon: Wallet,         description: 'Contas e cartões', end: false },
  { title: 'Transações',   href: '/app/transacoes',  icon: ArrowLeftRight, description: 'Histórico de movimentos', end: false },
  { title: 'Orçamentos',   href: '/app/orcamentos',  icon: PieChart,       description: 'Orçamentos mensais', end: false },
  { title: 'Objetivos',    href: '/app/objetivos',   icon: Target,         description: 'Metas financeiras', end: false },
  { title: 'Recorrentes',  href: '/app/recorrentes', icon: RefreshCw,      description: 'Despesas e subscrições recorrentes', end: false },
  { title: 'Payroll',      href: '/app/payroll',     icon: Briefcase,      description: 'Folha de pagamento', end: false },
  { title: 'Relatórios',   href: '/app/reports',     icon: BarChart3,      description: 'Relatórios e análises', end: false },
];

const familyNavItems = [
  { title: 'Membros',            href: '/app/membros',            icon: Users,    description: 'Membros da família', end: false },
  { title: 'Convites',           href: '/app/convites',           icon: UserPlus, description: 'Gerir convites', end: false },
  { title: 'Definições Família', href: '/app/definicoes-familia', icon: Settings, description: 'Configurações da família', end: false },
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
      end={item.end}
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
