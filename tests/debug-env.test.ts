import { describe, it, expect } from 'vitest'

describe('Environment Variables Debug', () => {
  it('should load environment variables from .env.local', () => {
    console.log('=== DEBUG VARIÁVEIS DE AMBIENTE ===')
    console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL)
    console.log('VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? 'DEFINIDA' : 'NÃO DEFINIDA')
    console.log('VITE_SUPABASE_SERVICE_ROLE_KEY:', process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? 'DEFINIDA' : 'NÃO DEFINIDA')
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL)
    console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'DEFINIDA' : 'NÃO DEFINIDA')
    console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'DEFINIDA' : 'NÃO DEFINIDA')
    console.log('NODE_ENV:', process.env.NODE_ENV)
    console.log('=================================')
    
    // Verificar se pelo menos uma das variáveis está definida
    const hasSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const hasAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    
    expect(hasSupabaseUrl).toBeDefined()
    expect(hasAnonKey).toBeDefined()
  })
})