/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { logger } from '../shared/lib/logger';
import { useUserDataInvalidation } from '../hooks/useUserDataInvalidation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error: unknown } | void>;
  register: (email: string, password: string, nome?: string) => Promise<{ error: unknown } | void>;
  resetPassword: (email: string) => Promise<{ error: unknown } | void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Hook para invalidar dados do utilizador quando há mudanças de autenticação
  useUserDataInvalidation(user);

  useEffect(() => {
    let mounted = true;
    let initializationComplete = false;
    
    // Logs reduzidos para melhor performance
    logger.info('[Auth] AuthProvider inicializando');
    
    // Setup auth state listener
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) {
        return;
      }
      
      // Log apenas eventos importantes
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        logger.info(`[Auth] Estado alterado: ${event}`, {
          hasSession: !!session,
          userId: session?.user?.id
        });
      }
      
      // Update state atomically
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      initializationComplete = true;
    });
    
    // Função simplificada de inicialização
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
        }
        
        if (error) {
          logger.warn('[Auth] Erro ao obter sessão:', error);
        }
        
      } catch (error) {
        logger.error('[Auth] Erro na inicialização:', error);
      } finally {
        if (mounted) {
          setLoading(false);
          initializationComplete = true;
        }
      }
    };
    
    // Inicializar autenticação
    initializeAuth();
    
    // Fallback: garantir que loading seja false após 8 segundos
    // (decisão Unit 4: 3s era demasiado curto para rede móvel PT; 8s é razoável para dogfood)
    const fallbackTimer = setTimeout(() => {
      if (mounted && !initializationComplete) {
        logger.warn('[Auth] Timeout na inicialização auth (8s) — possível problema de rede ou Supabase', {
          timestamp: new Date().toISOString(),
        });
        setLoading(false);
        initializationComplete = true;
      }
    }, 8000);
    
    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      listener.subscription.unsubscribe();
    };
  }, []); // Empty dependency array to avoid re-initialization

  const login = useCallback(async (email: string, password: string) => {
    logger.info('[Auth] Tentativa de login iniciada', { email });
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        logger.warn('[Auth] Falha no login', { error: error.message, email });
      } else {
        logger.info('[Auth] Login bem-sucedido', { userId: data.user?.id, email });
      }
      
      setLoading(false);
      return { error };
    } catch (error) {
      logger.error('[Auth] Erro crítico no login:', error);
      setLoading(false);
      return { error };
    }
  }, []);

  const register = useCallback(async (email: string, password: string, nome?: string) => {
    setLoading(true);
    
    const signUpData: any = { email, password };
    if (nome) {
      signUpData.options = {
        data: {
          nome: nome
        }
      };
    }
    
    const { error } = await supabase.auth.signUp(signUpData);
    setLoading(false);
    return { error };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    return { error };
  }, []);

  const logout = useCallback(async () => {
    logger.info('[Auth] Logout iniciado');
    
    try {
      // Don't set loading during logout to avoid UI flicker
      // The onAuthStateChange will handle the state updates
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        logger.error('[Auth] Erro no logout:', error);
        throw error;
      }
      
      logger.info('[Auth] Logout bem-sucedido');
      
      // Force clear state if onAuthStateChange doesn't fire
      setTimeout(() => {
        if (user || session) {
          setUser(null);
          setSession(null);
        }
      }, 1000);
      
    } catch (error) {
      logger.error('[Auth] Erro crítico no logout:', error);
      // On error, still try to clear local state
      setUser(null);
      setSession(null);
      throw error;
    }
  }, [user, session]);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    login,
    register,
    resetPassword,
    logout,
  }), [user, session, loading, login, register, resetPassword, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook separado para resolver problemas de Fast Refresh
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { useAuth };