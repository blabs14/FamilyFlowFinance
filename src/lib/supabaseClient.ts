import { createClient } from '@supabase/supabase-js';
import type { Database } from '../integrations/supabase/database.types';
import { logger } from '../shared/lib/logger';

// PROBLEMA IDENTIFICADO: Este código estava a remover tokens em desenvolvimento
// Comentado para permitir persistência de sessão
// try {
//   if (import.meta.env.DEV && typeof window !== 'undefined') {
//     const toDelete: string[] = [];
//     for (let i = 0; i < localStorage.length; i++) {
//       const k = localStorage.key(i) ?? '';
//       if (/^(sb-|supabase\.)/i.test(k)) toDelete.push(k);
//     }
//     toDelete.forEach(k => localStorage.removeItem(k));
//   }
// } catch {}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  logger.error('[Supabase] Variáveis de ambiente em falta. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  throw new Error('Variáveis de ambiente do Supabase em falta');
}

if (import.meta.env.DEV) {
  logger.info('🔧 Supabase inicializado (dev). URL presente:', !!supabaseUrl, 'AnonKey length:', supabaseAnonKey?.length);
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});