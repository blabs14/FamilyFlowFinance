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

// 4 items visíveis no tabbar
const primaryTabItems = [
  { title: 'Início',     href: '/app',           icon: Home,           end: true  },
  { title: 'Contas',     href: '/app/contas',     icon: Wallet,         end: false },
  { title: 'Transações', href: '/app/transacoes', icon: ArrowLeftRight, end: false },
  { title: 'Objetivos',  href: '/app/objetivos',  icon: Target,         end: false },
];

// Items no drawer "Mais"
const moreItems = [
  { title: 'Orçamentos',  href: '/app/orcamentos',  icon: PieChart  },
  { title: 'Recorrentes', href: '/app/recorrentes', icon: RefreshCw },
  { title: 'Payroll',     href: '/app/payroll',     icon: Briefcase },
  { title: 'Relatórios',  href: '/app/reports',     icon: BarChart3 },
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

  const allMoreItems = isFamilyScope ? [...moreItems, ...familyMoreItems] : moreItems;

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
