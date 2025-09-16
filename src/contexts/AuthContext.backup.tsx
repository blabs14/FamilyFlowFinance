// Backup do AuthContext original
// Este arquivo é um backup do AuthContext antes das modificações de debug
// Para restaurar, renomeie este arquivo para AuthContext.tsx

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: AuthError }>;
  register: (email: string, password: string, fullName: string) => Promise<{ error?: AuthError }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: AuthError }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialSessionLoaded, setInitialSessionLoaded] = useState(false);

  // Função simplificada de inicialização
  const initializeAuth = async () => {
    console.log('[Auth] 🚀 Inicializando autenticação...');
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('[Auth] ❌ Erro ao obter sessão:', error);
      } else {
        console.log('[Auth] ✅ Sessão obtida:', !!session);
        setSession(session);
        setUser(session?.user ?? null);
      }
    } catch (error) {
      console.error('[Auth] 💥 Exceção ao inicializar:', error);
    } finally {
      setLoading(false);
      setInitialSessionLoaded(true);
      console.log('[Auth] 🏁 Inicialização concluída - loading: false');
    }
  };

  useEffect(() => {
    console.log('[Auth] 🔄 useEffect executado');
    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] 🔔 Auth state change:', event, !!session);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (initialSessionLoaded) {
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [initialSessionLoaded]);

  const login = async (email: string, password: string) => {
    console.log('[Auth] 🔐 Tentando login...');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[Auth] ❌ Erro no login:', error);
    } else {
      console.log('[Auth] ✅ Login bem-sucedido');
    }
    return { error };
  };

  const register = async (email: string, password: string, fullName: string) => {
    console.log('[Auth] 📝 Tentando registo...');
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });
    if (error) {
      console.error('[Auth] ❌ Erro no registo:', error);
    } else {
      console.log('[Auth] ✅ Registo bem-sucedido');
    }
    return { error };
  };

  const logout = async () => {
    console.log('[Auth] 🚪 Fazendo logout...');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[Auth] ❌ Erro no logout:', error);
    } else {
      console.log('[Auth] ✅ Logout bem-sucedido');
    }
  };

  const resetPassword = async (email: string) => {
    console.log('[Auth] 🔄 Enviando reset de password...');
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      console.error('[Auth] ❌ Erro no reset:', error);
    } else {
      console.log('[Auth] ✅ Reset enviado');
    }
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    login,
    register,
    logout,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}