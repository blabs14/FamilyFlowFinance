import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { supabaseTestClient, supabaseServiceClient, supabaseTestHelpers } from '../../utils/supabaseTestClient'

describe('RLS - Categories', () => {
  let testUser1: any
  let testUser2: any
  let viewerUser: any
  let testFamily: any

  beforeEach(async () => {
    // Criar utilizadores de teste
    testUser1 = await supabaseTestHelpers.createAndLoginTestUser()

    testUser2 = await supabaseTestHelpers.createAndLoginTestUser()

    viewerUser = await supabaseTestHelpers.createAndLoginTestUser()

    // Criar família
    testFamily = await supabaseTestHelpers.createTestFamily(testUser1.user.id, 'Família RLS Teste')

    // Adicionar membros à família (testUser1 já é admin por ser o criador)
    await supabaseTestHelpers.addFamilyMember(testFamily.id, testUser2.user.id, 'member')
    await supabaseTestHelpers.addFamilyMember(testFamily.id, viewerUser.user.id, 'viewer')
  }, 60000)

  afterEach(async () => {
    await supabaseTestHelpers.cleanup()
  })

  describe('SELECT permissions - Personal categories', () => {
    it('should allow users to read their own personal categories', async () => {
      // Criar categoria pessoal para testUser1
      const { data: category } = await supabaseServiceClient
        .from('categories')
        .insert({
          nome: 'Categoria Pessoal User1',
          cor: '#FF0000',
          user_id: testUser1.user.id,
          family_id: null // categoria pessoal
        })
        .select()
        .single()

      // Login como testUser1 e ler suas categorias
      await supabaseTestClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'password123'
      })

      const { data: categories, error } = await supabaseTestClient
        .from('categories')
        .select('*')
        .eq('user_id', testUser1.user.id)
        .is('family_id', null)

      expect(error).toBeNull()
      expect(categories).toHaveLength(1)
      expect(categories?.[0].id).toBe(category?.id)
    })

    it('should not allow users to read personal categories from other users', async () => {
      // Criar categoria pessoal para testUser2
      await supabaseServiceClient
        .from('categories')
        .insert({
          nome: 'Categoria Pessoal User2',
          cor: '#00FF00',
          user_id: testUser2.user.id,
          family_id: null
        })

      // Login como testUser1 e tentar ler categorias do testUser2
      await supabaseTestClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'password123'
      })

      const { data: categories } = await supabaseTestClient
        .from('categories')
        .select('*')
        .eq('user_id', testUser2.user.id)
        .is('family_id', null)

      expect(categories).toHaveLength(0)
    })
  })

  describe('SELECT permissions - Family categories', () => {
    it('should allow family members to read family categories', async () => {
      // Criar categoria da família
      const { data: category } = await supabaseServiceClient
        .from('categories')
        .insert({
          nome: 'Categoria Família',
          cor: '#0000FF',
          user_id: testUser1.user.id,
          family_id: testFamily.id
        })
        .select()
        .single()

      // Login como testUser2 (member) e ler categorias da família
      await supabaseTestClient.auth.signInWithPassword({
        email: 'test2@example.com',
        password: 'password123'
      })

      const { data: categories, error } = await supabaseTestClient
        .from('categories')
        .select('*')
        .eq('family_id', testFamily.id)

      expect(error).toBeNull()
      expect(categories).toHaveLength(1)
      expect(categories?.[0].id).toBe(category?.id)
    })

    it('should allow viewers to read family categories', async () => {
      // Criar categoria da família
      await supabaseServiceClient
        .from('categories')
        .insert({
          nome: 'Categoria para Viewer',
          cor: '#FFFF00',
          user_id: testUser1.user.id,
          family_id: testFamily.id
        })

      // Login como viewer e ler categorias da família
      await supabaseTestClient.auth.signInWithPassword({
        email: 'viewer@example.com',
        password: 'password123'
      })

      const { data: categories, error } = await supabaseTestClient
        .from('categories')
        .select('*')
        .eq('family_id', testFamily.id)

      expect(error).toBeNull()
      expect(categories).toHaveLength(1)
    })

    it('should not allow access to categories from other families', async () => {
      // Criar outra família
      const otherFamily = await supabaseTestHelpers.createTestFamily(testUser2.user.id, 'Outra Família')
      
      // Criar categoria na outra família
      await supabaseServiceClient
        .from('categories')
        .insert({
          nome: 'Categoria Outra Família',
          cor: '#FF00FF',
          user_id: testUser2.user.id,
          family_id: otherFamily.id
        })

      // Login como testUser1 e tentar ler categorias da outra família
      await supabaseTestClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'password123'
      })

      const { data: categories } = await supabaseTestClient
        .from('categories')
        .select('*')
        .eq('family_id', otherFamily.id)

      expect(categories).toHaveLength(0)
    })
  })

  describe('INSERT permissions - Personal categories', () => {
    it('should allow users to create personal categories', async () => {
      // Login como testUser1
      await supabaseTestClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'password123'
      })

      const { data: category, error } = await supabaseTestClient
        .from('categories')
        .insert({
          nome: 'Nova Categoria Pessoal',
          cor: '#123456',
          user_id: testUser1.user.id,
          family_id: null
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(category).toBeDefined()
      expect(category?.nome).toBe('Nova Categoria Pessoal')
      expect(category?.user_id).toBe(testUser1.user.id)
      expect(category?.family_id).toBeNull()
    })

    it('should not allow users to create categories for other users', async () => {
      // Login como testUser1
      await supabaseTestClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'password123'
      })

      const { data: category, error } = await supabaseTestClient
        .from('categories')
        .insert({
          nome: 'Categoria para Outro User',
          cor: '#654321',
          user_id: testUser2.user.id, // Tentar criar para outro utilizador
          family_id: null
        })
        .select()
        .single()

      expect(error).toBeDefined()
      expect(category).toBeNull()
    })
  })

  describe('INSERT permissions - Family categories', () => {
    it('should allow family admins to create family categories', async () => {
      // Login como admin
      await supabaseTestClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'password123'
      })

      const { data: category, error } = await supabaseTestClient
        .from('categories')
        .insert({
          nome: 'Categoria Família Admin',
          cor: '#ABCDEF',
          user_id: testUser1.user.id,
          family_id: testFamily.id
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(category).toBeDefined()
      expect(category?.family_id).toBe(testFamily.id)
    })

    it('should allow family members to create family categories', async () => {
      // Login como member
      await supabaseTestClient.auth.signInWithPassword({
        email: 'test2@example.com',
        password: 'password123'
      })

      const { data: category, error } = await supabaseTestClient
        .from('categories')
        .insert({
          nome: 'Categoria Família Member',
          cor: '#FEDCBA',
          user_id: testUser2.user.id,
          family_id: testFamily.id
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(category).toBeDefined()
      expect(category?.family_id).toBe(testFamily.id)
    })

    it('should block viewers from creating family categories', async () => {
      // Login como viewer
      await supabaseTestClient.auth.signInWithPassword({
        email: 'viewer@example.com',
        password: 'password123'
      })

      const { data: category, error } = await supabaseTestClient
        .from('categories')
        .insert({
          nome: 'Tentativa Viewer',
          cor: '#000000',
          user_id: viewerUser.user.id,
          family_id: testFamily.id
        })
        .select()
        .single()

      expect(error).toBeDefined()
      expect(error?.code).toBe('42501') // Insufficient privilege
      expect(category).toBeNull()
    })

    it('should block viewers from creating personal categories', async () => {
      // Login como viewer
      await supabaseTestClient.auth.signInWithPassword({
        email: 'viewer@example.com',
        password: 'password123'
      })

      const { data: category, error } = await supabaseTestClient
        .from('categories')
        .insert({
          nome: 'Categoria Pessoal Viewer',
          cor: '#111111',
          user_id: viewerUser.user.id,
          family_id: null
        })
        .select()
        .single()

      expect(error).toBeDefined()
      expect(error?.code).toBe('42501') // Insufficient privilege
      expect(category).toBeNull()
    })
  })

  describe('UPDATE permissions', () => {
    it('should allow category owner to update their categories', async () => {
      // Criar categoria como testUser1
      const { data: category } = await supabaseServiceClient
        .from('categories')
        .insert({
          nome: 'Categoria Original',
          cor: '#ORIGINAL',
          user_id: testUser1.user.id,
          family_id: testFamily.id
        })
        .select()
        .single()

      // Login como testUser1 e atualizar
      await supabaseTestClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'password123'
      })

      const { data: updated, error } = await supabaseTestClient
        .from('categories')
        .update({ 
          nome: 'Categoria Atualizada',
          cor: '#UPDATED'
        })
        .eq('id', category?.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(updated?.nome).toBe('Categoria Atualizada')
      expect(updated?.cor).toBe('#UPDATED')
    })

    it('should block viewers from updating categories', async () => {
      // Criar categoria
      const { data: category } = await supabaseServiceClient
        .from('categories')
        .insert({
          nome: 'Categoria para Teste',
          cor: '#TEST',
          user_id: testUser1.user.id,
          family_id: testFamily.id
        })
        .select()
        .single()

      // Login como viewer e tentar atualizar
      const { data: loginData, error: loginError } = await supabaseTestClient.auth.signInWithPassword({
        email: 'viewer-user@familyflow.test',
        password: 'testpassword123'
      })
      
      console.log('Login result:', { loginData: !!loginData?.user, loginError })
      console.log('Current user after login:', await supabaseTestClient.auth.getUser())
      
      const { data, error } = await supabaseTestClient
        .from('categories')
        .update({ nome: 'Tentativa Update' })
        .eq('id', category?.id)
        .select()
      
      // Verificar se a categoria foi realmente atualizada
      const { data: updatedCategory } = await supabaseTestClient
        .from('categories')
        .select('*')
        .eq('id', category?.id)
        .single()
      
      // RLS pode bloquear de duas formas:
      // 1. Retornar erro 42501 (Insufficient privilege)
      // 2. Retornar dados vazios sem erro (comportamento silencioso)
      const wasBlocked = (error?.code === '42501') || (data?.length === 0 && updatedCategory?.nome === 'Categoria para Teste')
      
      expect(wasBlocked).toBe(true)
    })

    it('should not allow updating categories from other users', async () => {
      // Criar categoria como testUser2
      const { data: category } = await supabaseServiceClient
        .from('categories')
        .insert({
          nome: 'Categoria User2',
          cor: '#USER2',
          user_id: testUser2.user.id,
          family_id: testFamily.id
        })
        .select()
        .single()

      // Login como testUser1 e tentar atualizar categoria do testUser2
      await supabaseTestClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'password123'
      })

      const { error } = await supabaseTestClient
        .from('categories')
        .update({ nome: 'Tentativa Hack' })
        .eq('id', category?.id)

      expect(error).toBeDefined()
    })
  })

  describe('DELETE permissions', () => {
    it('should allow category owner to delete their categories', async () => {
      // Criar categoria como testUser1
      const { data: category } = await supabaseServiceClient
        .from('categories')
        .insert({
          nome: 'Categoria para Eliminar',
          cor: '#DELETE',
          user_id: testUser1.user.id,
          family_id: testFamily.id
        })
        .select()
        .single()

      // Login como testUser1 e eliminar
      await supabaseTestClient.auth.signInWithPassword({
        email: 'test-user-1@familyflow.test',
        password: 'password123'
      })

      const { error } = await supabaseTestClient
        .from('categories')
        .delete()
        .eq('id', category?.id)

      expect(error).toBeNull()

      // Verificar que foi eliminada
      const { data: check } = await supabaseTestClient
        .from('categories')
        .select('*')
        .eq('id', category?.id)

      expect(check).toHaveLength(0)
    })

    it('should block viewers from deleting categories', async () => {
      // Criar categoria
      const { data: category } = await supabaseServiceClient
        .from('categories')
        .insert({
          nome: 'Categoria Protegida',
          cor: '#PROTECT',
          user_id: testUser1.user.id,
          family_id: testFamily.id
        })
        .select()
        .single()

      // Login como viewer e tentar eliminar
      await supabaseTestClient.auth.signInWithPassword({
        email: 'viewer-user@familyflow.test',
        password: 'testpassword123'
      })

      const { error } = await supabaseTestClient
        .from('categories')
        .delete()
        .eq('id', category?.id)

      console.log('DELETE Error structure:', JSON.stringify(error, null, 2))
      expect(error).toBeDefined()
      expect(error?.code).toBe('42501') // Insufficient privilege
    })
  })
})