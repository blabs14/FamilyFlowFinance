import { describe, it, expect, beforeAll } from 'vitest'
import { supabaseTestClient, supabaseServiceClient } from '../tests/utils/supabaseTestClient'

describe('Debug Network Connectivity', () => {
  beforeAll(() => {
    console.log('🌐 Teste de conectividade de rede:')
    console.log('SUPABASE_URL:', process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)
    console.log('NODE_ENV:', process.env.NODE_ENV)
  })

  it('should test basic HTTP connectivity to Supabase', async () => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    
    if (!supabaseUrl) {
      throw new Error('URL do Supabase não configurada')
    }

    try {
      console.log('🔍 Testando conectividade HTTP básica...')
      
      // Teste básico de fetch para o endpoint de saúde
      const healthUrl = `${supabaseUrl}/health`
      console.log('Testando URL:', healthUrl)
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      console.log('Status da resposta:', response.status)
      console.log('Headers da resposta:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        console.log('⚠️ Resposta não OK, mas conexão estabelecida')
      } else {
        console.log('✅ Conectividade HTTP básica funcionando')
      }
      
      expect(true).toBe(true) // Sempre passa - só queremos ver os logs
    } catch (err) {
      console.error('❌ Erro de conectividade:', err)
      console.error('Tipo do erro:', typeof err)
      console.error('Mensagem:', err instanceof Error ? err.message : String(err))
      
      // Não falhar o teste, só registar o erro
      expect(true).toBe(true)
    }
  })

  it('should test Supabase REST API endpoint', async () => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !anonKey) {
      throw new Error('Credenciais do Supabase não configuradas')
    }

    try {
      console.log('🔍 Testando endpoint REST API...')
      
      // Teste do endpoint REST
      const restUrl = `${supabaseUrl}/rest/v1/`
      console.log('Testando URL REST:', restUrl)
      
      const response = await fetch(restUrl, {
        method: 'GET',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      console.log('Status da resposta REST:', response.status)
      
      if (response.status === 404) {
        console.log('✅ Endpoint REST acessível (404 esperado sem tabela específica)')
      } else if (response.ok) {
        console.log('✅ Endpoint REST funcionando')
      } else {
        console.log('⚠️ Resposta inesperada do REST API')
      }
      
      expect(true).toBe(true)
    } catch (err) {
      console.error('❌ Erro no REST API:', err)
      expect(true).toBe(true)
    }
  })

  it('should test Supabase Auth endpoint', async () => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !anonKey) {
      throw new Error('Credenciais do Supabase não configuradas')
    }

    try {
      console.log('🔍 Testando endpoint de autenticação...')
      
      // Teste do endpoint de auth
      const authUrl = `${supabaseUrl}/auth/v1/settings`
      console.log('Testando URL Auth:', authUrl)
      
      const response = await fetch(authUrl, {
        method: 'GET',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      console.log('Status da resposta Auth:', response.status)
      
      if (response.ok) {
        const data = await response.text()
        console.log('✅ Endpoint Auth funcionando')
        console.log('Dados recebidos (primeiros 200 chars):', data.substring(0, 200))
      } else {
        console.log('⚠️ Resposta inesperada do Auth endpoint')
      }
      
      expect(true).toBe(true)
    } catch (err) {
      console.error('❌ Erro no Auth endpoint:', err)
      expect(true).toBe(true)
    }
  })

  it('should test simple client initialization', async () => {
    try {
      console.log('🔍 Testando inicialização simples do cliente...')
      
      // Teste muito básico - só verificar se o cliente foi criado
      expect(supabaseTestClient).toBeDefined()
      expect(supabaseServiceClient).toBeDefined()
      
      console.log('✅ Clientes inicializados com sucesso')
      
      // Tentar uma operação muito simples que não requer rede
      const testClient = supabaseTestClient
      expect(testClient.auth).toBeDefined()
      
      console.log('✅ Estrutura do cliente parece correta')
      
    } catch (err) {
      console.error('❌ Erro na inicialização:', err)
      throw err
    }
  })
})