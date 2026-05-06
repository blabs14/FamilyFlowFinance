import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { SyncedContractSelector } from './SyncedContractSelector';
import {
  Calculator,
  Clock,
  Car,
  Settings,
  FileText,
  BarChart3,
  Table,
  Gift,
  Calendar,
  Receipt
} from 'lucide-react';

interface PayrollNavigationProps {
  className?: string;
}

export function PayrollNavigation({ className }: PayrollNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      path: '/personal/payroll',
      label: 'Resumo',
      icon: BarChart3,
      description: 'Visão geral do mês'
    },
    {
      path: '/personal/payroll/timesheet',
      label: 'Timesheet',
      icon: Clock,
      description: 'Registo de horas semanal'
    },
    {
      path: '/personal/payroll/km',
      label: 'Quilometragem',
      icon: Car,
      description: 'Deslocações e reembolsos'
    },
    {
      path: '/personal/payroll/bonus',
      label: 'Bónus',
      icon: Gift,
      description: 'Prémios de produtividade e bónus',
      isNew: true
    },
    {
      path: '/personal/payroll/performance-bonus',
      label: 'Bónus Performance',
      icon: BarChart3,
      description: 'Configurar bónus automáticos',
      isNew: true
    },
    {
      path: '/personal/payroll/performance-results',
      label: 'Resultados Performance',
      icon: Table,
      description: 'Histórico de bónus calculados',
      isNew: true
    },
    {
      path: '/personal/payroll/subsidies',
      label: 'Visualizar Subsídios',
      icon: Gift,
      description: 'Subsídios de alimentação, férias e natal',
      isNew: true
    },
    {
      path: '/personal/payroll/vacations',
      label: 'Férias',
      icon: Calendar,
      description: 'Calendário de períodos de férias'
    },
    {
      path: '/personal/payroll/periods',
      label: 'Períodos',
      icon: Calendar,
      description: 'Gestão de períodos mensais',
      isNew: true
    },
    {
      path: '/personal/payroll/contracts',
      label: 'Contratos',
      icon: FileText,
      description: 'Visualizar e gerir contratos'
    },
    {
      path: '/app/payroll/recibos',
      label: 'Recibos',
      icon: Receipt,
      description: 'Recibos de vencimento',
      isNew: true
    },
    {
      path: '/personal/payroll/config',
      label: 'Configurações',
      icon: Settings,
      description: 'Contratos e políticas'
    }
  ];

  return (
    <div className={`bg-card border-b border-border ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Folha de Pagamento</h2>
            <p className="text-sm text-muted-foreground">Gestão de horários e salários</p>
          </div>
          <div className="flex items-center gap-2">
            <SyncedContractSelector variant="compact" />
          </div>
        </div>
        
        <nav className="flex flex-wrap gap-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            return (
              <Button
                key={item.path}
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                onClick={() => navigate(item.path)}
                className="flex items-center gap-2 h-auto py-2 px-3"
              >
                <item.icon className="h-4 w-4" />
                <span className="text-sm">{item.label}</span>
                {item.isNew && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 leading-none">
                    Novo
                  </Badge>
                )}
              </Button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default PayrollNavigation;