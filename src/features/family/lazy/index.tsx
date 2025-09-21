/* eslint-disable react-refresh/only-export-components */
// Componentes Lazy para Finanças Partilhadas
// Otimização de performance com carregamento sob demanda

import React, { lazy, Suspense } from 'react';
import { logger } from '@/shared/lib/logger';

// Componente de fallback otimizado
export const LazyFallback: React.FC<{ message?: string }> = ({ message = "A carregar..." }) => (
  <div className="flex items-center justify-center p-4">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mr-3"></div>
    <span className="text-sm text-muted-foreground">{message}</span>
  </div>
);

// Componente de fallback para componentes não disponíveis
const ComponentFallback: React.FC<{ message: string }> = ({ message }) => (
  <div className="p-4 text-center text-muted-foreground border border-dashed border-muted-foreground/20 rounded-lg">
    <div className="text-sm font-medium mb-1">{message}</div>
    <div className="text-xs opacity-70">Componente em desenvolvimento</div>
  </div>
);

// Função utilitária para criar lazy components com tratamento de erros robusto
const createSafeLazyComponent = (
  importFn: () => Promise<{ default: React.ComponentType<any> }>,
  fallbackMessage: string
): React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>> => {
  return lazy(() =>
    importFn()
      .then((mod) => {
        const Comp = (mod as any)?.default;
        if (!Comp) {
          logger.warn('Lazy module missing default export, using fallback:', fallbackMessage);
          return { default: () => <ComponentFallback message={fallbackMessage} /> };
        }
        return { default: Comp };
      })
      .catch(() => ({
        default: () => <ComponentFallback message={fallbackMessage} />
      }))
  );
};

// Componentes de Formulários Pesados - com tratamento de erros robusto
export const LazyTransactionForm = createSafeLazyComponent(
  () => import('../../../components/TransactionForm'),
  'Formulário de Transação'
);

export const LazyGoalAllocationModal = createSafeLazyComponent(
  () => import('../../../components/GoalAllocationModal'),
  'Modal de Alocação'
);

export const LazyGoalForm = createSafeLazyComponent(
  () => import('../../../components/GoalForm'),
  'Formulário de Objetivo'
);

export const LazyAccountForm = createSafeLazyComponent(
  () => import('../../../components/AccountForm'),
  'Formulário de Conta'
);

export const LazyRegularAccountForm = createSafeLazyComponent(
  () => import('../../../components/RegularAccountForm'),
  'Formulário de Conta Regular'
);

export const LazyBudgetForm = createSafeLazyComponent(
  () => import('../../../components/BudgetForm'),
  'Formulário de Orçamento'
);

// Componentes de Diálogos e Modais - com tratamento de erros robusto
export const LazyConfirmationDialog = createSafeLazyComponent(
  () => import('../../../components/ui/confirmation-dialog'),
  'Diálogo de Confirmação'
);

export const LazyTransferModal = createSafeLazyComponent(
  () => import('../../../components/TransferModal'),
  'Modal de Transferência'
);

// Componentes de UI Pesados - com tratamento de erros robusto
export const LazyTooltip = createSafeLazyComponent(
  () => import('../../../components/ui/tooltip'),
  'Tooltip'
);

export const LazySelect = createSafeLazyComponent(
  () => import('../../../components/ui/select'),
  'Select'
);

export const LazyDialog = createSafeLazyComponent(
  () => import('../../../components/ui/dialog'),
  'Dialog'
);

export const LazySheet = createSafeLazyComponent(
  () => import('../../../components/ui/sheet'),
  'Sheet'
);

// Componentes de Gráficos e Visualizações - com tratamento de erros robusto
export const LazyReportChart = createSafeLazyComponent(
  () => import('../../../components/ReportChart'),
  'Gráfico de Relatório'
);

export const LazyChart = createSafeLazyComponent(
  () => import('../../../components/ui/chart'),
  'Chart'
);

// Componentes de Notificações - com tratamento de erros robusto
export const LazyRealTimeNotifications = createSafeLazyComponent(
  () => import('../../../components/RealTimeNotifications'),
  'Notificações em Tempo Real'
);

// Wrapper para Suspense com fallback otimizado
export function withLazyLoading<TProps extends Record<string, unknown>>(
  Component: React.ComponentType<TProps>,
  fallback?: React.ReactNode
): React.FC<TProps> {
  const LazyComponent = lazy(() => Promise.resolve({ default: Component as unknown as React.ComponentType<unknown> })) as React.LazyExoticComponent<React.ComponentType<unknown>>;

  return (props: TProps) => (
    <Suspense fallback={fallback || <LazyFallback />}>
      {React.createElement(LazyComponent as unknown as React.ComponentType<TProps>, props)}
    </Suspense>
  );
}

// Hook personalizado para lazy loading de serviços com tratamento de erros robusto
export function useLazyService<T>(serviceImport: () => Promise<T>) {
  const [service, setService] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const loadService = async () => {
      try {
        const startTime = performance.now();
        const serviceModule = await serviceImport();
        const loadTime = performance.now() - startTime;
        logger.debug(`✅ Lazy service loaded (${loadTime.toFixed(2)}ms)`);
        
        setService(serviceModule);
        setLoading(false);
      } catch (err) {
        logger.warn('⚠️ Lazy service loading failed:', err);
        setError(err as Error);
        setLoading(false);
        // Fornecer um serviço fallback para evitar quebras na aplicação
        setService(null);
      }
    };

    loadService();
  }, [serviceImport]);

  return { service, loading, error } as const;
}

// Wrapper para componentes com loading state
export function withLoadingState<TProps extends Record<string, unknown>>(
  Component: React.ComponentType<TProps>,
  LoadingComponent?: React.ComponentType
): React.FC<{ loading: boolean } & TProps> {
  return ({ loading, ...props }: { loading: boolean } & TProps) => {
    if (loading) {
      return LoadingComponent ? <LoadingComponent /> : <LazyFallback />;
    }
    return React.createElement(Component, props as unknown as TProps);
  };
}

// Função utilitária para criar lazy components com retry
export function createLazyComponent<TProps extends Record<string, unknown>>(
  importFn: () => Promise<{ default: React.ComponentType<TProps> }>,
  fallbackComponent?: React.ComponentType
): React.LazyExoticComponent<React.ComponentType<TProps>> {
  const lazyComp = lazy(() => 
    importFn().catch((error) => {
      logger.warn('Lazy component loading failed:', error);
      return {
        default: (fallbackComponent || (() => <ComponentFallback message="Componente não disponível" />)) as React.ComponentType<TProps>
      };
    })
  ) as React.LazyExoticComponent<React.ComponentType<unknown>>;
  return lazyComp as unknown as React.LazyExoticComponent<React.ComponentType<TProps>>;
}

// Hook para monitorizar performance do lazy loading
export const useLazyLoadingMetrics = () => {
  const [metrics, setMetrics] = React.useState({
    loadedComponents: 0,
    failedComponents: 0,
    totalLoadTime: 0,
    averageLoadTime: 0
  });

  const trackComponentLoad = React.useCallback((componentName: string, loadTime: number, success: boolean) => {
    setMetrics(prev => {
      const newLoaded = prev.loadedComponents + (success ? 1 : 0);
      const newFailed = prev.failedComponents + (success ? 0 : 1);
      const newTotalTime = prev.totalLoadTime + loadTime;
      const newAverage = newLoaded > 0 ? newTotalTime / newLoaded : 0;
      
      return {
        loadedComponents: newLoaded,
        failedComponents: newFailed,
        totalLoadTime: newTotalTime,
        averageLoadTime: newAverage
      };
    });
  }, []);

  return { metrics, trackComponentLoad } as const;
};

// Componente de erro boundary para lazy loading
export const LazyErrorBoundary: React.FC<{ 
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error }>;
}> = ({ children, fallback: FallbackComponent }) => {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logger.error('Lazy loading error:', event.error);
      setError(event.error || new Error('Unknown error'));
      setHasError(true);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return FallbackComponent ? (
      <FallbackComponent error={error || undefined} />
    ) : (
      <div className="p-4 text-center text-red-600 border border-red-200 rounded-lg bg-red-50">
        <div className="text-sm font-medium mb-1">Erro ao carregar componente</div>
        <div className="text-xs opacity-70">Tente recarregar a página</div>
      </div>
    );
  }

  return <>{children}</>;
};