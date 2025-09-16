import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

describe('Supabase Connection Debug', () => {
  it('should connect to Supabase successfully', async () => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    
    console.log('URL:', supabaseUrl)
    console.log('Key exists:', !!supabaseKey)
    
    expect(supabaseUrl).toBeDefined()
    expect(supabaseKey).toBeDefined()
    
    const supabase = createClient(supabaseUrl!, supabaseKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // Teste simples de conectividade
    try {
      const { data, error } = await supabase.from('profiles').select('count').limit(1)
      console.log('Connection test result:', { data, error })
      
      // Se não houver erro de rede, a conexão está OK
      if (error && error.message.includes('fetch failed')) {
        throw new Error('Erro de conectividade: ' + error.message)
      }
    } catch (err: any) {
      console.error('Connection error:', err)
      if (err.message.includes('fetch failed') || err.code === 'ECONNREFUSED') {
        throw new Error('Erro de conectividade com Supabase: ' + err.message)
      }
    }
  })
})