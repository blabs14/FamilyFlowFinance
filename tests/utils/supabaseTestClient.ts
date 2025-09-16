import { createClient } from '@supabase/supabase-js'
import { Database } from '@/integrations/supabase/database.types'

// URLs e chaves do Supabase para testes (a partir de variáveis de ambiente)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Variáveis de ambiente do Supabase não configuradas. Verifique .env')
}

// Log para debug
console.log('Supabase Test Config:', {
  url: SUPABASE_URL ? 'configured' : 'missing',
  anonKey: SUPABASE_ANON_KEY ? 'configured' : 'missing',
  serviceKey: SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'missing'
})



/**
 * Cliente Supabase para testes com permissões de utilizador normal (anon)
 * Sujeito a RLS e políticas de segurança
 */
export const supabaseTestClient = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

/**
 * Cliente Supabase para testes com permissões de service role
 * Bypassa RLS - usar apenas para setup/teardown de dados de teste
 * Nota: Só funciona se SUPABASE_SERVICE_ROLE_KEY estiver configurada
 */
export const supabaseServiceClient = SUPABASE_SERVICE_ROLE_KEY ? createClient<Database>(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
) : null

// Cache de utilizadores para evitar rate limiting
const userCache = new Map<string, { user: any, session: any }>()

// Pool expandido de utilizadores de teste pré-criados
const TEST_USERS = [
  { email: 'test-user-1@familyflow.test', password: 'TestPassword123!' },
  { email: 'test-user-2@familyflow.test', password: 'TestPassword123!' },
  { email: 'test-user-3@familyflow.test', password: 'TestPassword123!' },
  { email: 'test-user-4@familyflow.test', password: 'TestPassword123!' },
  { email: 'test-user-5@familyflow.test', password: 'TestPassword123!' },
  { email: 'test-user-6@familyflow.test', password: 'TestPassword123!' },
  { email: 'test-user-7@familyflow.test', password: 'TestPassword123!' },
  { email: 'test-user-8@familyflow.test', password: 'TestPassword123!' },
  { email: 'test-user-9@familyflow.test', password: 'TestPassword123!' },
  { email: 'test-user-10@familyflow.test', password: 'TestPassword123!' }
]

let userPoolIndex = 0
const userUsageCount = new Map<string, number>()

/**
 * Obtém o próximo utilizador do pool com menor uso
 */
const getNextTestUser = () => {
  // Encontrar o utilizador com menor uso
  let leastUsedUser = TEST_USERS[0]
  let minUsage = userUsageCount.get(leastUsedUser.email) || 0
  
  for (const user of TEST_USERS) {
    const usage = userUsageCount.get(user.email) || 0
    if (usage < minUsage) {
      leastUsedUser = user
      minUsage = usage
    }
  }
  
  // Incrementar contador de uso
  userUsageCount.set(leastUsedUser.email, minUsage + 1)
  
  return leastUsedUser
}

// Função para limpar cache de utilizadores e contadores de uso
export const clearUserCache = () => {
  userCache.clear()
  userUsageCount.clear()
  userPoolIndex = 0
  console.log('Cache de utilizadores e contadores limpos')
}

/**
 * Cria um utilizador de teste e faz login
 */
export const createAndLoginTestUser = async (
  email?: string,
  password?: string,
  retries: number = 5
): Promise<any> => {
  // Se não especificado, usar utilizador do pool
  const testUser = email && password ? { email, password } : getNextTestUser()
  const { email: userEmail, password: userPassword } = testUser
  
  // Verificar cache primeiro
  const cacheKey = `${userEmail}:${userPassword}`
  if (userCache.has(cacheKey)) {
    console.log('Reutilizando utilizador do cache:', userEmail)
    const cached = userCache.get(cacheKey)
    
    // Verificar se a sessão ainda é válida
    try {
      const { data: { user }, error } = await supabaseTestClient.auth.getUser(cached.session.access_token)
      if (user && !error) {
        await supabaseTestClient.auth.setSession(cached.session)
        return cached
      } else {
        console.log(`Sessão expirada para ${userEmail}, removendo do cache`)
        userCache.delete(cacheKey)
      }
    } catch (error) {
      console.log(`Erro ao verificar sessão para ${userEmail}, removendo do cache`)
      userCache.delete(cacheKey)
    }
  }

  console.log(`Tentando autenticar utilizador: ${userEmail}`)

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Tentar fazer login primeiro (assumindo que o utilizador já existe)
      const loginResult = await supabaseTestClient.auth.signInWithPassword({
        email: userEmail,
        password: userPassword
      })

      if (loginResult.data.user && loginResult.data.session) {
        console.log(`Login bem-sucedido para: ${userEmail}`)
        const result = { user: loginResult.data.user, session: loginResult.data.session }
        userCache.set(cacheKey, result)
        return result
      }

      // Se o login falhou e é a primeira tentativa, tentar criar o utilizador
      if (attempt === 1) {
        console.log(`Login falhou para ${userEmail}, tentando criar...`)
        try {
          // Usar service client para criar utilizador com email confirmado
          if (supabaseServiceClient) {
            console.log(`Tentando criar utilizador ${userEmail} via admin API...`)
            
            // Primeiro, tentar eliminar o utilizador se já existir
            try {
              const { data: usersData } = await supabaseServiceClient.auth.admin.listUsers()
              const existingUser = usersData.users.find(u => u.email === userEmail)
              
              if (existingUser) {
                console.log(`Eliminando utilizador existente: ${existingUser.id}`)
                await supabaseServiceClient.auth.admin.deleteUser(existingUser.id)
                console.log(`Utilizador ${userEmail} eliminado`)
              }
            } catch (deleteError) {
              console.log(`Erro ao eliminar utilizador existente: ${deleteError.message}`)
            }
            
            // Agora criar o utilizador
            const { data: createData, error: createError } = await supabaseServiceClient.auth.admin.createUser({
              email: userEmail,
              password: userPassword,
              email_confirm: true
            })
            
            if (createError) {
              console.log(`Erro ao criar utilizador via admin: ${createError.message}`)
            } else {
              console.log(`Utilizador ${userEmail} criado via admin API com ID: ${createData.user.id}`)
            }
          } else {
            // Fallback para signUp normal
            const signUpResult = await supabaseTestClient.auth.signUp({
              email: userEmail,
              password: userPassword
            })

            if (signUpResult.error && !signUpResult.error.message.includes('already registered')) {
              throw new Error(`Erro ao criar utilizador: ${signUpResult.error.message}`)
            }

            console.log(`Utilizador ${userEmail} criado ou já existia`)
          }
        } catch (createError) {
          if (!createError.message.includes('rate limit')) {
            console.log(`Erro na criação (ignorado): ${createError.message}`)
          } else {
            throw createError
          }
        }
      }
      
      // Aguardar antes de tentar fazer login novamente
      const delay = Math.min(2000 * attempt, 10000) // Max 10 segundos
      await new Promise(resolve => setTimeout(resolve, delay))
      
      const retryLoginResult = await supabaseTestClient.auth.signInWithPassword({
        email: userEmail,
        password: userPassword
      })
      
      if (retryLoginResult.data.user && retryLoginResult.data.session) {
        const result = {
          user: retryLoginResult.data.user,
          session: retryLoginResult.data.session
        }
        
        userCache.set(cacheKey, result)
        console.log(`Utilizador ${userEmail} autenticado e em cache`)
        return result
      }
      
      throw new Error(`Login falhou: ${retryLoginResult.error?.message}`)
      
    } catch (error) {
      console.warn(`Tentativa ${attempt}: Erro:`, error.message)
      if (attempt === retries) {
        throw new Error(`Erro ao autenticar utilizador após ${retries} tentativas: ${error.message}`)
      }
      
      // Aguardar progressivamente mais tempo entre tentativas
      const backoffDelay = Math.min(3000 * attempt, 15000) // Max 15 segundos
      console.log(`Aguardando ${backoffDelay}ms antes da próxima tentativa...`)
      await new Promise(resolve => setTimeout(resolve, backoffDelay))
    }
  }

  throw new Error('Falha ao autenticar utilizador após todas as tentativas')
}

/**
   * Utilitários para testes de integração
   */
  export const testUtils = {
    /**
     * Cria um utilizador de teste e faz login
     */
    createAndLoginTestUser,

    /**
     * Cria uma família de teste
     */
    async createTestFamily(userId: string, familyName: string = 'Família Teste') {
    const { data, error } = await supabaseServiceClient
      .from('families')
      .insert({
        nome: familyName,
        created_by: userId
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Erro ao criar família de teste: ${error.message}`)
    }

    // Adicionar o criador como admin da família
    const { error: memberError } = await supabaseServiceClient
      .from('family_members')
      .insert({
        family_id: data.id,
        user_id: userId,
        role: 'admin'
      })

    if (memberError) {
      throw new Error(`Erro ao adicionar criador como membro da família: ${memberError.message}`)
    }

    return data
  },

  /**
   * Adiciona um membro à família
   */
  async addFamilyMember(familyId: string, userId: string, role: 'admin' | 'member' | 'viewer' = 'member') {
    // Usar service client se disponível, senão usar client normal
    const client = supabaseServiceClient || supabaseTestClient
    
    const { data, error } = await client
      .from('family_members')
      .insert({
        family_id: familyId,
        user_id: userId,
        role
      })
      .select()
      .single()

    if (error) {
      console.error('Erro ao adicionar membro à família:', error)
      throw new Error(`Erro ao adicionar membro à família: ${error.message}`)
    }

    console.log(`Membro adicionado à família: ${userId} como ${role} na família ${familyId}`)
    return data
  },

  /**
   * Cria uma conta de teste
   */
  async createTestAccount(userId: string, familyId?: string, accountName: string = 'Conta Teste') {
    const { data, error } = await supabaseServiceClient
      .from('accounts')
      .insert({
        nome: accountName,
        tipo: 'corrente',
        saldo: 1000,
        user_id: userId,
        family_id: familyId || null
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Erro ao criar conta de teste: ${error.message}`)
    }

    return data
  },

  /**
   * Cria uma categoria de teste
   */
  async createTestCategory(userId: string, familyId?: string, categoryName: string = 'Categoria Teste') {
    const { data, error } = await supabaseServiceClient
      .from('categories')
      .insert({
        nome: categoryName,
        cor: '#3B82F6',
        user_id: userId,
        family_id: familyId || null
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Erro ao criar categoria de teste: ${error.message}`)
    }

    return data
  },

  /**
   * Limpa dados de teste (usar após cada teste)
   */
  async cleanup() {
    // Limpar em ordem devido a foreign keys
    await supabaseServiceClient.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseServiceClient.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseServiceClient.from('accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseServiceClient.from('family_members').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseServiceClient.from('families').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    // Não eliminar utilizadores de teste para evitar problemas de autenticação
    // Os utilizadores serão reutilizados entre testes
  },

  /**
   * Faz logout do cliente de teste
   */
  async logout() {
    await supabaseTestClient.auth.signOut()
  }
}

/**
 * Limpa todos os dados de teste criados
 */
export async function cleanupTestData() {
  try {
    if (!supabaseServiceClient) {
      console.warn('Service client não disponível para limpeza')
      return
    }

    // Limpar em ordem devido a foreign keys
    await supabaseServiceClient
      .from('transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    await supabaseServiceClient
      .from('categories')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    await supabaseServiceClient
      .from('accounts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    await supabaseServiceClient
      .from('family_members')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    await supabaseServiceClient
      .from('families')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')

    console.log('Dados de teste limpos com sucesso')
  } catch (error) {
    console.warn('Erro ao limpar dados de teste:', error)
  }
}

/**
 * Limpa utilizadores de teste
 */
export async function cleanupTestUsers() {
  try {
    if (!supabaseServiceClient) {
      console.warn('Service client não disponível para limpeza de utilizadores')
      return
    }

    // Listar utilizadores de teste
    const { data: users, error } = await supabaseServiceClient.auth.admin.listUsers()
    
    if (error) {
      console.warn('Erro ao listar utilizadores:', error.message)
      return
    }

    // Eliminar utilizadores de teste
    for (const user of users.users) {
      if (user.email?.includes('test') || user.email?.includes('example')) {
        await supabaseServiceClient.auth.admin.deleteUser(user.id)
        console.log(`Utilizador de teste eliminado: ${user.email}`)
      }
    }

    console.log('Utilizadores de teste limpos com sucesso')
  } catch (error) {
    console.warn('Erro ao limpar utilizadores de teste:', error)
  }
}

/**
 * Configura um ambiente de teste completo com família e membros
 */
export async function setupTestEnvironment() {
  try {
    console.log('Configurando ambiente de teste...')
    
    // Limpar dados existentes primeiro
    // await cleanupTestData() // Comentado para não apagar dados durante os testes
    
    // Criar utilizador admin
    const adminUser = await createAndLoginTestUser('admin@familyflow.test', 'TestPassword123!')
    console.log('Utilizador admin criado:', adminUser.user.id)
    
    // Criar família
    const family = await testUtils.createTestFamily(adminUser.user.id, 'Família Teste')
    console.log('Família criada:', family.id)
    
    // Criar utilizador membro
    const memberUser = await createAndLoginTestUser('member@familyflow.test', 'TestPassword123!')
    console.log('Utilizador membro criado:', memberUser.user.id)
    
    // Criar utilizador viewer
    const viewerUser = await createAndLoginTestUser('viewer@familyflow.test', 'TestPassword123!')
    console.log('Utilizador viewer criado:', viewerUser.user.id)
    
    // Adicionar membro à família
    await testUtils.addFamilyMember(family.id, memberUser.user.id, 'member')
    console.log('Membro adicionado à família')
    
    // Adicionar viewer à família
    await testUtils.addFamilyMember(family.id, viewerUser.user.id, 'viewer')
    console.log('Viewer adicionado à família')
    
    // Criar contas para todos os utilizadores
    const adminAccount = await testUtils.createTestAccount(adminUser.user.id, family.id, 'Conta Admin')
    const memberAccount = await testUtils.createTestAccount(memberUser.user.id, family.id, 'Conta Membro')
    const viewerAccount = await testUtils.createTestAccount(viewerUser.user.id, family.id, 'Conta Viewer')
    console.log('Contas criadas:', adminAccount.id, memberAccount.id, viewerAccount.id)
    
    // Criar categoria
    const category = await testUtils.createTestCategory(adminUser.user.id, family.id, 'Categoria Teste')
    console.log('Categoria criada:', category.id)
    
    return {
      adminUser,
      memberUser,
      viewerUser,
      family,
      adminAccount,
      memberAccount,
      viewerAccount,
      category
    }
  } catch (error) {
    console.error('Erro ao configurar ambiente de teste:', error)
    throw error
  }
}

export { testUtils as supabaseTestHelpers }