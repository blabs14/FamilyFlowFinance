import { describe, it, expect } from 'vitest';
import { config } from 'dotenv';
import path from 'path';

// Tentar carregar .env.local explicitamente
const envPath = path.resolve(process.cwd(), '.env.local');
console.log('Tentando carregar .env.local de:', envPath);

const result = config({ path: envPath });
console.log('Resultado do carregamento:', result);

describe('Debug Environment Loading', () => {
  it('should load environment variables from .env.local', () => {
    console.log('process.env.SUPABASE_URL:', process.env.SUPABASE_URL);
    console.log('process.env.VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
    console.log('process.env.SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'DEFINIDA' : 'UNDEFINED');
    console.log('process.env.VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'DEFINIDA' : 'UNDEFINED');
    console.log('process.env.SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'DEFINIDA' : 'UNDEFINED');
    
    // Verificar se pelo menos uma das variáveis está definida
    const hasSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const hasAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    console.log('hasSupabaseUrl:', hasSupabaseUrl);
    console.log('hasAnonKey:', hasAnonKey);
    
    expect(hasSupabaseUrl).toBeDefined();
    expect(hasAnonKey).toBeDefined();
  });
  
  it('should check current working directory', () => {
    console.log('Current working directory:', process.cwd());
    console.log('__dirname:', __dirname);
    console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
  });
});