import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// URLs e chaves do Supabase para testes
const SUPABASE_URL = 'https://ebitcwrrcumsvqjgrapw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViaXRjd3JyY3Vtc3ZxamdyYXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NjcyMTYsImV4cCI6MjA2ODM0MzIxNn0.hLlTeSD2VzVCjvUSXLYQypXNYqthDx0q1N86aOftfEY'

describe('Supabase Connection Test', () => {
  it('should connect to Supabase successfully', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    // Teste básico de conectividade
    const { data, error } = await supabase
      .from('families')
      .select('count')
      .limit(1)
    
    console.log('Connection test result:', { data, error })
    
    // Se não há erro de rede, a conexão está a funcionar
    if (error) {
      expect(error.message).not.toContain('fetch failed')
    }
  })
  
  it('should be able to check auth status', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    const { data: { session }, error } = await supabase.auth.getSession()
    
    console.log('Auth status:', { session: !!session, error })
    
    // Não deve haver erro de rede
    if (error) {
      expect(error.message).not.toContain('fetch failed')
    }
  })
})