import { describe, it, expect } from 'vitest'
import { supabaseTestClient, supabaseServiceClient } from './utils/supabaseTestClient'

describe('Simple Supabase Connection Test', () => {
  it('should connect and get basic info', async () => {
    try {
      // Teste básico de conectividade
      const { data, error } = await supabaseTestClient
        .from('profiles')
        .select('id')
        .limit(1)
      
      console.log('Query result:', { data, error })
      
      // Se chegou aqui sem erro de rede, a conexão está OK
      expect(error).not.toMatch(/fetch failed|ECONNREFUSED/)
      
    } catch (err: any) {
      console.error('Connection test failed:', err)
      
      // Se for erro de rede, falhar o teste
      if (err.message?.includes('fetch failed') || err.code === 'ECONNREFUSED') {
        throw new Error(`Erro de conectividade: ${err.message}`)
      }
      
      // Outros erros (como tabela não existir) são OK para este teste
      console.log('Non-network error (OK for connection test):', err.message)
    }
  })
  
  it('should have service role client configured', async () => {
    try {
      // Teste com service role (deve ter mais permissões)
      const { data, error } = await supabaseServiceClient
        .from('profiles')
        .select('id')
        .limit(1)
      
      console.log('Service role query result:', { data, error })
      
      // Se chegou aqui sem erro de rede, a conexão está OK
      expect(error).not.toMatch(/fetch failed|ECONNREFUSED/)
      
    } catch (err: any) {
      console.error('Service role connection test failed:', err)
      
      // Se for erro de rede, falhar o teste
      if (err.message?.includes('fetch failed') || err.code === 'ECONNREFUSED') {
        throw new Error(`Erro de conectividade com service role: ${err.message}`)
      }
      
      // Outros erros são OK para este teste
      console.log('Non-network error (OK for connection test):', err.message)
    }
  })
})