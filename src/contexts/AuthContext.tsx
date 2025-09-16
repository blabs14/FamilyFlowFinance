/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
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
    
    console.log('[Auth] 🚀 FIXED: AuthProvider mounting...');
    
    // Função para garantir que loading seja sempre false após inicialização
    const ensureLoadingFalse = () => {
      if (mounted && !initializationComplete) {
        console.log('[Auth] 🔧 FIXED: Forçando loading = false');
        setLoading(false);
        initializationComplete = true;
      }
    };
    
    // Setup auth state listener
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) {
        console.warn('[Auth] ⚠️ onAuthStateChange called but component unmounted, ignoring', { event });
        return;
      }
      
      console.log(`[Auth] 🔄 FIXED: Auth state changed: ${event}`, {
        hasSession: !!session,
        userId: session?.user?.id || 'none'
      });
      
      logger.info(`[Auth] Estado alterado: ${event}`, {
        hasSession: !!session,
        userId: session?.user?.id
      });
      
      // Update state atomically
      setSession(session);
      setUser(session?.user ?? null);
      
      // Always stop loading after any auth state change
      console.log('[Auth] 🏁 FIXED: Auth state changed, stopping loading');
      setLoading(false);
      initializationComplete = true;
    });
    
    // Função simplificada de inicialização
    const initializeAuth = async () => {
      console.log('[Auth] 🚀 FIXED: Inicializando autenticação...');
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('[Auth] 📊 FIXED: Resultado getSession:', { hasSession: !!session, error: !!error });
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
        }
        
      } catch (error) {
        console.error('[Auth] 💥 FIXED: Erro:', error);
      } finally {
        // SEMPRE definir loading como false no final, mesmo com erro
        if (mounted) {
          console.log('[Auth] 🔧 FIXED: Definindo loading = false (finally)');
          setLoading(false);
          initializationComplete = true;
        }
      }
    };
    
    // Inicializar autenticação
    initializeAuth();
    
    // Fallback: garantir que loading seja false após 2 segundos
    const fallbackTimer = setTimeout(() => {
      if (mounted && !initializationComplete) {
        console.warn('[Auth] ⏰ FIXED: Fallback - forçando loading = false após timeout');
        setLoading(false);
        initializationComplete = true;
      }
    }, 2000);
    
    return () => {
      console.log('[Auth] 🧹 FIXED: Limpeza do contexto');
      mounted = false;
      clearTimeout(fallbackTimer);
      listener.subscription.unsubscribe();
    };
  }, []); // Empty dependency array to avoid re-initialization

  const login = async (email: string, password: string) => {
    console.log('🔐 [AuthContext] Iniciando login...');
    console.log('📧 [AuthContext] Email:', email);
    console.log('🔑 [AuthContext] Password fornecida:', !!password);
    console.log('🔑 [AuthContext] Password length:', password?.length);
    
    console.log('[Auth] 🔐 Login attempt started', {
      email,
      timestamp: new Date().toISOString(),
      currentUser: user?.id || 'none',
      currentSession: !!session
    });
    
    logger.info('[Auth] Tentativa de login iniciada', { email });
    setLoading(true);
    
    try {
      console.log('📞 [AuthContext] Chamando supabase.auth.signInWithPassword...');
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      console.log('📋 [AuthContext] Resposta do Supabase:');
      console.log('  - Data:', data);
      console.log('  - Error:', error);
      console.log('  - User:', data?.user);
      console.log('  - Session:', data?.session);
      
      if (error) {
        console.error('❌ [AuthContext] Erro no login:', error);
        console.error('[Auth] ❌ Login failed', {
          error: error.message,
          email,
          timestamp: new Date().toISOString()
        });
        logger.warn('[Auth] Falha no login', { error: error.message, email });
      } else {
        console.log('✅ [AuthContext] Login bem-sucedido!');
        console.log('👤 [AuthContext] Utilizador:', data.user?.email);
        console.log('[Auth] ✅ Login successful', {
          userId: data.user?.id,
          email,
          hasSession: !!data.session,
          expiresAt: data.session?.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : 'none',
          timestamp: new Date().toISOString()
        });
        logger.info('[Auth] Login bem-sucedido', { userId: data.user?.id, email });
      }
      
      setLoading(false);
      return { error };
    } catch (error) {
      console.error('💥 [AuthContext] Erro inesperado no login:', error);
      console.error('[Auth] 💥 Login exception:', error);
      logger.error('[Auth] Erro crítico no login:', error);
      setLoading(false);
      return { error };
    }
  };

  const register = async (email: string, password: string, nome?: string) => {
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
  };

  const resetPassword = async (email: string) => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    return { error };
  };

  const logout = async () => {
    console.log('[Auth] 🚪 Logout started', {
      currentUser: user?.id || 'none',
      currentSession: !!session,
      timestamp: new Date().toISOString(),
      tokensInStorage: Object.keys(localStorage).filter(k => k.startsWith('sb-')).length
    });
    
    logger.info('[Auth] Logout iniciado');
    
    try {
      // Don't set loading during logout to avoid UI flicker
      // The onAuthStateChange will handle the state updates
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('[Auth] ❌ Logout failed', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
        logger.error('[Auth] Erro no logout:', error);
        throw error;
      }
      
      console.log('[Auth] ✅ Logout successful', {
        timestamp: new Date().toISOString(),
        tokensAfterLogout: Object.keys(localStorage).filter(k => k.startsWith('sb-')).length
      });
      logger.info('[Auth] Logout bem-sucedido');
      
      // Force clear state if onAuthStateChange doesn't fire
      setTimeout(() => {
        if (user || session) {
          console.log('[Auth] 🧹 Force clearing auth state after logout timeout');
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
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, login, register, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
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