import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { payrollService } from '../services/payrollService';
import { useActiveContract } from './useActiveContract';
import { logger } from '@/shared/lib/logger';

interface OnboardingStatus {
  needsOnboarding: boolean;
  isLoading: boolean;
  error: string | null;
}

export function usePayrollOnboarding(): OnboardingStatus {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { activeContract, loading: contractLoading } = useActiveContract();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    function checkOnboardingStatus() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Aguardar o carregamento do contexto do contrato
      if (contractLoading) {
        setIsLoading(true);
        return;
      }

      try {
        setError(null);

        // Usar o contrato ativo do contexto (mais rápido e sincronizado)
        const hasActiveContract = activeContract !== null;
        setNeedsOnboarding(!hasActiveContract);

        // Redirecionar para onboarding se necessário e não estiver já lá
        // Evitar redirecionamentos em loop e permitir acesso à página de configuração
        const currentPath = location.pathname;
        const isInPayrollArea = currentPath.includes('/payroll');
        const isInOnboarding = currentPath.includes('/onboarding');
        const isInConfig = currentPath.includes('/config');
        
        // Em DEV/E2E/Preview não redirecionamos para permitir acesso às rotas de preview (calculator/history)
        const DISABLE_ONBOARDING_REDIRECT = import.meta.env.DEV || import.meta.env.VITE_E2E === '1' || import.meta.env.VITE_ENABLE_PAYROLL_PREVIEW === '1';
        
        // Não redirecionar se:
        // 1. Já está no onboarding
        // 2. Está na página de configuração (onde pode criar contratos)
        // 3. Não está na área de payroll
        // 4. Tem parâmetro 'new=1' no URL (indica criação de contrato em progresso)
        const urlParams = new URLSearchParams(location.search);
        const isCreatingContract = urlParams.get('new') === '1';
        
        if (!DISABLE_ONBOARDING_REDIRECT && !hasActiveContract && isInPayrollArea && !isInOnboarding && !isInConfig && !isCreatingContract) {
          navigate('/personal/payroll/onboarding', { replace: true });
        }
      } catch (err) {
        logger.error('Erro ao verificar status do onboarding:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setIsLoading(false);
      }
    }

    checkOnboardingStatus();
  }, [user, navigate, activeContract, contractLoading, location.pathname, location.search]);

  return {
    needsOnboarding,
    isLoading,
    error
  };
}

export default usePayrollOnboarding;