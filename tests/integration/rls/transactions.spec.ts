import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supabaseTestClient, supabaseServiceClient, supabaseTestHelpers, setupTestEnvironment } from '../../utils/supabaseTestClient'

describe('RLS - Transactions', () => {
  let testEnv: any

  beforeEach(async () => {
    // Configurar ambiente de teste completo
    testEnv = await setupTestEnvironment()
    console.log('Ambiente de teste configurado:', {
      adminUserId: testEnv.adminUser.user.id,
      memberUserId: testEnv.memberUser.user.id,
      familyId: testEnv.family.id,
      adminAccountId: testEnv.adminAccount.id,
      memberAccountId: testEnv.memberAccount.id,
      categoryId: testEnv.category.id
    })
  })

  afterEach(async () => {
    await supabaseTestHelpers.cleanup()
  })

  describe('SELECT permissions', () => {
    it('should allow family members to read family transactions', async () => {
      // Criar transação como admin
      const { data: transaction } = await supabaseServiceClient
        .from('transactions')
        .insert({
          account_id: testEnv.adminAccount.id,
          categoria_id: testEnv.category.id,
          data: new Date().toISOString().split('T')[0],
          tipo: 'despesa',
          valor: 100,
          descricao: 'Teste RLS',
          user_id: testEnv.adminUser.user.id,
          family_id: testEnv.family.id
        })
        .select()
        .single()

      // Fazer login como member
      await supabaseTestClient.auth.signInWithPassword({
        email: testEnv.memberUser.user.email,
        password: 'TestPassword123!'
      })

      const { data: transactions, error } = await supabaseTestClient
        .from('transactions')
        .select('*')
        .eq('family_id', testEnv.family.id)

      expect(error).toBeNull()
      expect(transactions).toHaveLength(1)
      expect(transactions?.[0].id).toBe(transaction?.id)
    })

    it('should allow viewers to read family transactions', async () => {
      // Criar transação como admin
      await supabaseServiceClient
        .from('transactions')
        .insert({
          account_id: testEnv.adminAccount.id,
          categoria_id: testEnv.category.id,
          data: new Date().toISOString().split('T')[0],
          tipo: 'receita',
          valor: 200,
          descricao: 'Teste Viewer',
          user_id: testEnv.adminUser.user.id,
          family_id: testEnv.family.id
        })

      // Fazer login como member (que tem role viewer no nosso setup)
      await supabaseTestClient.auth.signInWithPassword({
        email: testEnv.memberUser.user.email,
        password: 'TestPassword123!'
      })

      const { data: transactions, error } = await supabaseTestClient
        .from('transactions')
        .select('*')
        .eq('family_id', testEnv.family.id)

      expect(error).toBeNull()
      expect(transactions).toHaveLength(1)
    })

    it('should not allow access to transactions from other families', async () => {
      // Fazer login como admin
      await supabaseTestClient.auth.signInWithPassword({
        email: testEnv.adminUser.user.email,
        password: 'TestPassword123!'
      })
      
      // Criar outra família
      const otherUserEmail = `other-${Date.now()}@familyflow.test`
      const otherUser = await supabaseTestHelpers.createAndLoginTestUser(otherUserEmail, 'TestPassword123!')
      const otherFamily = await supabaseTestHelpers.createTestFamily(otherUser.user.id, 'Outra Família')
      const otherAccount = await supabaseTestHelpers.createTestAccount(otherUser.user.id, otherFamily.id)
      const otherCategory = await supabaseTestHelpers.createTestCategory(otherUser.user.id, otherFamily.id)

      // Fazer login como o outro utilizador para criar a transação
      await supabaseTestClient.auth.signInWithPassword({
        email: otherUser.user.email,
        password: 'TestPassword123!'
      })
      
      // Criar transação na outra família
      await supabaseTestClient
        .from('transactions')
        .insert({
          account_id: otherAccount.id,
          categoria_id: otherCategory.id,
          data: new Date().toISOString().split('T')[0],
          tipo: 'despesa',
          valor: 50,
          user_id: otherUser.user.id,
          family_id: otherFamily.id
        })
        
      // Voltar a fazer login como admin
      await supabaseTestClient.auth.signInWithPassword({
        email: testEnv.adminUser.user.email,
        password: 'TestPassword123!'
      })

      // Tentar ler transações da outra família com o utilizador atual
      const { data: transactions } = await supabaseTestClient
        .from('transactions')
        .select('*')
        .eq('family_id', otherFamily.id)

      expect(transactions).toHaveLength(0)
    })
  })

  describe('INSERT permissions', () => {
    it('should allow family admins to create transactions', async () => {
      // Fazer login como admin
      await supabaseTestClient.auth.signInWithPassword({
          email: testEnv.adminUser.user.email,
          password: 'TestPassword123!'
        })

      const { data: transaction, error } = await supabaseTestClient
        .from('transactions')
        .insert({
          account_id: testEnv.adminAccount.id,
          categoria_id: testEnv.category.id,
          data: new Date().toISOString().split('T')[0],
          tipo: 'despesa',
          valor: 75,
          descricao: 'Criado pelo admin',
          user_id: testEnv.adminUser.user.id,
          family_id: testEnv.family.id
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(transaction).toBeDefined()
      expect(transaction?.valor).toBe(75)
    })

    it('should allow family members to create transactions', async () => {
      // Fazer login como member
      await supabaseTestClient.auth.signInWithPassword({
          email: testEnv.memberUser.user.email,
          password: 'TestPassword123!'
        })

      const { data: transaction, error } = await supabaseTestClient
        .from('transactions')
        .insert({
          account_id: testEnv.memberAccount.id,
          categoria_id: testEnv.category.id,
          data: new Date().toISOString().split('T')[0],
          tipo: 'receita',
          valor: 150,
          descricao: 'Criado pelo member',
          user_id: testEnv.memberUser.user.id,
          family_id: testEnv.family.id
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(transaction).toBeDefined()
      expect(transaction?.valor).toBe(150)
    })

    it('should block viewers from creating transactions', async () => {
      // Fazer login como viewer
      await supabaseTestClient.auth.signInWithPassword({
        email: testEnv.viewerUser.user.email,
        password: 'TestPassword123!'
      })

      const { data: transaction, error } = await supabaseTestClient
        .from('transactions')
        .insert({
          account_id: testEnv.viewerAccount.id,
          categoria_id: testEnv.category.id,
          data: new Date().toISOString().split('T')[0],
          tipo: 'despesa',
          valor: 25,
          descricao: 'Tentativa do viewer',
          user_id: testEnv.viewerUser.user.id,
          family_id: testEnv.family.id
        })
        .select()
        .single()

      expect(error).toBeDefined()
      expect(error?.code).toBe('42501') // Insufficient privilege
      expect(transaction).toBeNull()
    })
  })

  describe('UPDATE permissions', () => {
    it('should allow transaction owner to update their transactions', async () => {
      // Fazer login como admin
      await supabaseTestClient.auth.signInWithPassword({
        email: testEnv.adminUser.user.email,
        password: 'TestPassword123!'
      })
      
      // Criar transação
      const { data: transaction } = await supabaseServiceClient
        .from('transactions')
        .insert({
          account_id: testEnv.adminAccount.id,
          categoria_id: testEnv.category.id,
          data: new Date().toISOString().split('T')[0],
          tipo: 'despesa',
          valor: 100,
          user_id: testEnv.adminUser.user.id,
          family_id: testEnv.family.id
        })
        .select()
        .single()

      const { data: updated, error } = await supabaseTestClient
        .from('transactions')
        .update({ valor: 200, descricao: 'Atualizado' })
        .eq('id', transaction?.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(updated?.valor).toBe(200)
      expect(updated?.descricao).toBe('Atualizado')
    })

    it('should block viewers from updating transactions', async () => {
      // Fazer login como admin para criar transação
      await supabaseTestClient.auth.signInWithPassword({
        email: testEnv.adminUser.user.email,
        password: 'TestPassword123!'
      })
      
      // Criar transação como admin
      const { data: transaction, error: insertError } = await supabaseTestClient
        .from('transactions')
        .insert({
          account_id: testEnv.adminAccount.id,
          categoria_id: testEnv.category.id,
          data: new Date().toISOString().split('T')[0],
          tipo: 'despesa',
          valor: 100,
          user_id: testEnv.adminUser.user.id,
          family_id: testEnv.family.id
        })
        .select()
        .single()
        
      if (insertError) {
        throw insertError
      }

      // Mudar para viewer e tentar atualizar
      await supabaseTestClient.auth.signInWithPassword({
          email: testEnv.viewerUser.user.email,
          password: 'TestPassword123!'
        })

      const { data, error, count } = await supabaseTestClient
        .from('transactions')
        .update({ valor: 300 })
        .eq('id', transaction?.id)
        .select()

      // Com políticas PERMISSIVE, a operação não retorna erro mas também não atualiza nada
      expect(data).toEqual([])
      expect(count).toBeNull() // Supabase retorna null quando nenhuma linha é afetada
    })
  })

  describe('DELETE permissions', () => {
    it('should allow transaction owner to delete their transactions', async () => {
      // Fazer login como admin
      await supabaseTestClient.auth.signInWithPassword({
        email: testEnv.memberUser.user.email,
        password: 'TestPassword123!'
      })
      
      // Criar transação
      const { data: transaction } = await supabaseServiceClient
        .from('transactions')
        .insert({
          account_id: testEnv.adminAccount.id,
          categoria_id: testEnv.category.id,
          data: new Date().toISOString().split('T')[0],
          tipo: 'despesa',
          valor: 100,
          user_id: testEnv.adminUser.user.id,
          family_id: testEnv.family.id
        })
        .select()
        .single()

      const { error } = await supabaseTestClient
        .from('transactions')
        .delete()
        .eq('id', transaction?.id)

      expect(error).toBeNull()

      // Verificar que foi eliminado
      const { data: check } = await supabaseTestClient
        .from('transactions')
        .select('*')
        .eq('id', transaction?.id)

      expect(check).toHaveLength(0)
    })

    it('should block viewers from deleting transactions', async () => {
      // Fazer login como admin para criar transação
      await supabaseTestClient.auth.signInWithPassword({
        email: testEnv.adminUser.user.email,
        password: 'TestPassword123!'
      })
      
      // Criar transação como admin
      const { data: transaction, error: insertError } = await supabaseTestClient
        .from('transactions')
        .insert({
          account_id: testEnv.adminAccount.id,
          categoria_id: testEnv.category.id,
          data: new Date().toISOString().split('T')[0],
          tipo: 'despesa',
          valor: 100,
          user_id: testEnv.adminUser.user.id,
          family_id: testEnv.family.id
        })
        .select()
        .single()
        
      if (insertError) {
        throw insertError
      }

      // Mudar para viewer e tentar eliminar
      await supabaseTestClient.auth.signInWithPassword({
        email: testEnv.viewerUser.user.email,
        password: 'TestPassword123!'
      })

      const { data, error, count } = await supabaseTestClient
        .from('transactions')
        .delete()
        .eq('id', transaction?.id)
        .select()

      // Com políticas PERMISSIVE, a operação não retorna erro mas também não elimina nada
      expect(data).toEqual([])
      expect(count).toBeNull() // Supabase retorna null quando nenhuma linha é afetada
    })
  })
})