import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { config } from 'dotenv'
import { supabaseTestClient, supabaseServiceClient, supabaseTestHelpers } from '../../utils/supabaseTestClient'

// Carregar variáveis de ambiente explicitamente
config({ path: '.env.local' })

describe('RLS - Transactions (Simplified)', () => {
  let testUser: any
  let familyId: string
  let accountId: string
  let categoryId: string

  beforeAll(async () => {
    // Usar utilizador pré-definido para evitar rate limiting
    testUser = await supabaseTestHelpers.createAndLoginTestUser(
      'test-simple@familyflow.test',
      'password123'
    )

    if (!testUser.user) {
      throw new Error('Erro ao criar utilizador de teste')
    }

    // Criar família de teste (usando service client para contornar RLS)
    const { data: familyData, error: familyError } = await supabaseServiceClient
      .from('families')
      .insert({
        nome: 'Família Teste',
        created_by: testUser.user.id
      })
      .select()
      .single()

    if (familyError) {
      throw new Error(`Erro ao criar família: ${familyError.message}`)
    }

    familyId = familyData.id

    // Adicionar utilizador como membro da família
    const { error: memberError } = await supabaseServiceClient
      .from('family_members')
      .insert({
        family_id: familyId,
        user_id: testUser.user.id,
        role: 'admin'
      })

    if (memberError) {
      throw new Error(`Erro ao adicionar membro à família: ${memberError.message}`)
    }

    // Criar conta de teste
    const { data: accountData, error: accountError } = await supabaseTestClient
      .from('accounts')
      .insert({
        nome: 'Conta Teste',
        tipo: 'corrente',
        saldo: 1000,
        family_id: familyId,
        user_id: testUser.user.id
      })
      .select()
      .single()

    if (accountError) {
      throw new Error(`Erro ao criar conta: ${accountError.message}`)
    }

    accountId = accountData.id

    // Criar categoria de teste
    const { data: categoryData, error: categoryError } = await supabaseTestClient
      .from('categories')
      .insert({
        nome: 'Categoria Teste',
        cor: '#FF0000',
        user_id: testUser.user.id,
        family_id: familyId
      })
      .select()
      .single()

    if (categoryError) {
      throw new Error(`Erro ao criar categoria: ${categoryError.message}`)
    }

    categoryId = categoryData.id
  })

  afterAll(async () => {
    // Limpar dados de teste
    if (familyId) {
      await supabaseServiceClient.from('transactions').delete().eq('family_id', familyId)
      await supabaseServiceClient.from('accounts').delete().eq('family_id', familyId)
      await supabaseServiceClient.from('families').delete().eq('id', familyId)
    }
    if (categoryId) {
      await supabaseServiceClient.from('categories').delete().eq('id', categoryId)
    }
    await supabaseTestClient.auth.signOut()
  })

  describe('SELECT permissions', () => {
    it('should allow user to read their own transactions', async () => {
      // Criar transação
      const { data: transaction, error: insertError } = await supabaseTestClient
        .from('transactions')
        .insert({
          descricao: 'Teste SELECT',
          valor: 100,
          tipo: 'despesa',
          account_id: accountId,
          categoria_id: categoryId,
          family_id: familyId,
          user_id: testUser.user.id,
          data: new Date().toISOString().split('T')[0]
        })
        .select()
        .single()

      expect(insertError).toBeNull()
      expect(transaction).toBeDefined()

      // Tentar ler a transação
      const { data: readTransaction, error: selectError } = await supabaseTestClient
        .from('transactions')
        .select('*')
        .eq('id', transaction.id)
        .single()

      expect(selectError).toBeNull()
      expect(readTransaction).toBeDefined()
      expect(readTransaction.descricao).toBe('Teste SELECT')
    })
  })

  describe('INSERT permissions', () => {
    it('should allow user to create transactions', async () => {
      const { data: transaction, error } = await supabaseTestClient
        .from('transactions')
        .insert({
          descricao: 'Teste INSERT',
          valor: 200,
          tipo: 'receita',
          account_id: accountId,
          categoria_id: categoryId,
          family_id: familyId,
          user_id: testUser.user.id,
          data: new Date().toISOString().split('T')[0]
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(transaction).toBeDefined()
      expect(transaction.descricao).toBe('Teste INSERT')
    })
  })

  describe('UPDATE permissions', () => {
    it('should allow user to update their own transactions', async () => {
      // Criar transação
      const { data: transaction, error: insertError } = await supabaseTestClient
        .from('transactions')
        .insert({
          descricao: 'Teste UPDATE Original',
          valor: 300,
          tipo: 'despesa',
          account_id: accountId,
          categoria_id: categoryId,
          family_id: familyId,
          user_id: testUser.user.id,
          data: new Date().toISOString().split('T')[0]
        })
        .select()
        .single()

      expect(insertError).toBeNull()

      // Atualizar a transação
      const { data: updatedTransaction, error: updateError } = await supabaseTestClient
        .from('transactions')
        .update({ descricao: 'Teste UPDATE Modificado' })
        .eq('id', transaction.id)
        .select()
        .single()

      expect(updateError).toBeNull()
      expect(updatedTransaction.descricao).toBe('Teste UPDATE Modificado')
    })
  })

  describe('DELETE permissions', () => {
    it('should allow user to delete their own transactions', async () => {
      // Criar transação
      const { data: transaction, error: insertError } = await supabaseTestClient
        .from('transactions')
        .insert({
          descricao: 'Teste DELETE',
          valor: 400,
          tipo: 'despesa',
          account_id: accountId,
          categoria_id: categoryId,
          family_id: familyId,
          user_id: testUser.user.id,
          data: new Date().toISOString().split('T')[0]
        })
        .select()
        .single()

      expect(insertError).toBeNull()

      // Eliminar a transação
      const { error: deleteError } = await supabaseTestClient
        .from('transactions')
        .delete()
        .eq('id', transaction.id)

      expect(deleteError).toBeNull()

      // Verificar que foi eliminada
      const { data: deletedTransaction, error: selectError } = await supabaseTestClient
        .from('transactions')
        .select('*')
        .eq('id', transaction.id)
        .single()

      expect(deletedTransaction).toBeNull()
    })
  })
})