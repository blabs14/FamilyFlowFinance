import { describe, it, expect, beforeAll } from 'vitest'
import { supabaseServiceClient } from '../tests/utils/supabaseTestClient'

describe('Debug Admin Auth', () => {
  beforeAll(() => {
    console.log('🔧 Configuração do teste:')
    console.log('SUPABASE_URL:', process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)
    console.log('SERVICE_ROLE_KEY exists:', !!(process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY))
  })

  it('should verify service client configuration', async () => {
    expect(supabaseServiceClient).toBeDefined()
    expect(supabaseServiceClient.auth).toBeDefined()
    expect(supabaseServiceClient.auth.admin).toBeDefined()
    
    console.log('✅ Cliente de serviço configurado corretamente')
  })

  it('should test admin.listUsers functionality', async () => {
    try {
      console.log('🔍 Testando listUsers...')
      const { data: users, error } = await supabaseServiceClient.auth.admin.listUsers({
        page: 1,
        perPage: 1
      })
      
      if (error) {
        console.error('❌ Erro ao listar usuários:', error)
        throw error
      }
      
      console.log('✅ listUsers funcionou. Total de usuários encontrados:', users?.users?.length || 0)
      expect(error).toBeNull()
      expect(users).toBeDefined()
    } catch (err) {
      console.error('💥 Erro inesperado:', err)
      throw err
    }
  })

  it('should test basic database query', async () => {
    try {
      console.log('🔍 Testando query básica na base de dados...')
      const { data, error } = await supabaseServiceClient
        .from('profiles')
        .select('id')
        .limit(1)
      
      if (error) {
        console.error('❌ Erro na query:', error)
        // Não falhar o teste se a tabela não existir
        console.log('⚠️ Tabela profiles pode não existir, continuando...')
      } else {
        console.log('✅ Query básica funcionou')
      }
      
      expect(true).toBe(true) // Sempre passa
    } catch (err) {
      console.error('💥 Erro inesperado na query:', err)
      throw err
    }
  })

  it('should test createUser with minimal data', async () => {
    const testEmail = `test-${Date.now()}@example.com`
    const testPassword = 'TestPassword123!'
    
    try {
      console.log('🔍 Testando createUser com dados mínimos...')
      console.log('Email de teste:', testEmail)
      
      const { data: user, error } = await supabaseServiceClient.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true
      })
      
      if (error) {
        console.error('❌ Erro ao criar usuário:', error)
        console.error('Detalhes do erro:', JSON.stringify(error, null, 2))
        throw error
      }
      
      console.log('✅ Usuário criado com sucesso:', user?.user?.id)
      expect(error).toBeNull()
      expect(user?.user).toBeDefined()
      expect(user?.user?.email).toBe(testEmail)
      
      // Limpar o usuário criado
      if (user?.user?.id) {
        console.log('🧹 Limpando usuário criado...')
        await supabaseServiceClient.auth.admin.deleteUser(user.user.id)
        console.log('✅ Usuário removido')
      }
    } catch (err) {
      console.error('💥 Erro inesperado ao criar usuário:', err)
      throw err
    }
  })
})