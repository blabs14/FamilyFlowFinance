import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { NavigationSidebar } from './NavigationSidebar';
import { BottomTabBar } from './BottomTabBar';
import { useAuth } from '../../contexts/AuthContext';
import LogoutButton from '../auth/LogoutButton';
import { RealTimeNotifications } from '../RealTimeNotifications';
import { useRouteChange } from '../../hooks/useRouteChange';
import { ErrorBoundary } from '../ErrorBoundary';

export function MainLayout() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  // Hook para atualizar dados automaticamente quando a rota muda
  useRouteChange();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/app':
        return 'Dashboard';


      case '/app/reports':
        return 'Relatórios';
      default:
        return 'Dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-background w-full">
      {/* Header fixo no topo */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-card border-b border-border shadow-sm">
        <div className="flex items-center justify-between px-4 h-full">
          {/* Botão de menu - visível apenas em mobile */}
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <NavigationSidebar onNavigate={() => setIsDrawerOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* Título da página */}
          <h1 className="text-lg font-semibold text-foreground md:ml-0">
            {getPageTitle()}
          </h1>

          {/* Botão de logout e notificações */}
          <div className="flex items-center gap-2">
            {user && (
              <>
                <RealTimeNotifications />
                <LogoutButton />
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-screen w-full pt-16">
        {/* Sidebar - visível apenas em desktop */}
        <aside className="hidden md:flex md:w-64 lg:w-72 fixed left-0 top-16 bottom-0 border-r border-border bg-card">
          <NavigationSidebar />
        </aside>

        {/* Conteúdo principal */}
        <main className="flex-1 md:ml-64 lg:ml-72 pb-20 md:pb-6">
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Bottom Tab Bar - visível apenas em mobile */}
      <div className="md:hidden">
        <BottomTabBar />
      </div>
    </div>
  );
}