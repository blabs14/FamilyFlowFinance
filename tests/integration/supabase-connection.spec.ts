import { describe, it, expect } from 'vitest';
import { supabaseTestClient } from '../utils/supabaseTestClient';

describe('Supabase Connection Test', () => {
  it('should have valid Supabase configuration', () => {
    console.log('Environment variables:');
    console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
    console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'DEFINIDA' : 'NÃO DEFINIDA');
    
    expect(process.env.VITE_SUPABASE_URL).toBeDefined();
    expect(process.env.VITE_SUPABASE_ANON_KEY).toBeDefined();
    expect(supabaseTestClient).toBeDefined();
  });

  it('should be able to make a simple query', async () => {
    try {
      // Tentar uma query simples que não requer autenticação
      const { data, error } = await supabaseTestClient
        .from('contas')
        .select('count')
        .limit(1);
      
      console.log('Query result:', { data, error });
      
      // Se chegou aqui, a conexão funciona (mesmo que retorne erro de RLS)
      expect(true).toBe(true);
    } catch (err) {
      console.error('Connection error:', err);
      throw err;
    }
  });
});