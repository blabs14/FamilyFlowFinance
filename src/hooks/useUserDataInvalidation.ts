import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User } from '@supabase/supabase-js';
import { logger } from '../shared/lib/logger';

/**
 * Hook que invalida todas as queries relacionadas com dados do utilizador
 * quando este faz re-login, garantindo que os dados são refrescados.
 */
export const useUserDataInvalidation = (user: User | null) => {
  const queryClient = useQueryClient();
  
  React.useEffect(() => {
    if (user?.id) {
      // Invalidar todas as queries relacionadas com dados do utilizador
      const invalidatePromises = [
        // Objetivos
        queryClient.invalidateQueries({ queryKey: ['goals'] }),
        queryClient.invalidateQueries({ queryKey: ['goals-domain'] }),
        queryClient.invalidateQueries({ queryKey: ['goalProgress'] }),
        
        // Contas
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts-domain'] }),
        queryClient.invalidateQueries({ queryKey: ['accountsWithBalances'] }),
        queryClient.invalidateQueries({ queryKey: ['accountsWithBalances-domain'] }),
        queryClient.invalidateQueries({ queryKey: ['creditCardSummary'] }),
        
        // Transações
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['recent-transactions'] }),
        
        // Categorias
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
        queryClient.invalidateQueries({ queryKey: ['categories-domain'] }),
        
        // Família
        queryClient.invalidateQueries({ queryKey: ['families'] }),
        queryClient.invalidateQueries({ queryKey: ['family-members'] }),
        queryClient.invalidateQueries({ queryKey: ['family-invites'] }),
        
        // Perfil
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
        
        // Dashboard
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        
        // Despesas fixas
        queryClient.invalidateQueries({ queryKey: ['fixed-expenses'] }),
      ];
      
      Promise.all(invalidatePromises).then(() => {
        logger.info('[useUserDataInvalidation] Todas as queries de dados do utilizador foram invalidadas após re-login');
      }).catch((error) => {
        logger.error('[useUserDataInvalidation] Erro ao invalidar queries:', error);
      });
    }
  }, [user?.id, queryClient]);
};