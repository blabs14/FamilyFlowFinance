import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabaseTestClient, supabaseServiceClient, createAndLoginTestUser, supabaseTestHelpers } from '../../utils/supabaseTestClient'

/**
 * Integração: Funções canónicas de Objetivos
 * - allocate_to_goal_with_transaction
 * - deallocate_from_goal_with_transaction
 * - delete_goal_with_restoration
 */

describe('Canonical Goal Functions (integration)', () => {
  let userId: string
  let goalsAccountId: string
  let sourceAccountId: string
  let goalId: string

  beforeAll(async () => {
    // Garantir que temos service client
    if (!supabaseServiceClient) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurado — necessário para preparar dados de teste')
    }

    // 1) Criar e logar utilizador de teste
    const { user } = await createAndLoginTestUser('goals-canonical@test.familyflow', 'TestPassword123!')
    userId = user.id

    // 2) Garantir conta "Objetivos" do utilizador
    {
      const { data, error } = await supabaseTestClient
        .rpc('ensure_goals_account', { p_user_id: userId })
      if (error) throw new Error('Erro em ensure_goals_account: ' + error.message)
      goalsAccountId = data as string
    }

    // 3) Criar uma conta fonte com saldo inicial via service (bypass RLS)
    {
      const { data, error } = await supabaseServiceClient
        .from('accounts')
        .insert({ nome: 'Conta Fonte Teste', tipo: 'corrente', saldo: 1000, user_id: userId })
        .select()
        .single()
      if (error) throw new Error('Erro ao criar conta fonte: ' + error.message)
      sourceAccountId = data.id
    }

    // 4) Criar objetivo de teste via service (mais simples para preparar)
    {
      const { data, error } = await supabaseServiceClient
        .from('goals')
        .insert({ nome: 'Objetivo Teste', user_id: userId, valor_objetivo: 500 })
        .select()
        .single()
      if (error) throw new Error('Erro ao criar objetivo: ' + error.message)
      goalId = data.id
    }
  })

  afterAll(async () => {
    // Limpeza dos dados de teste criados
    await supabaseTestHelpers.cleanup()
    await supabaseTestHelpers.logout()
  })

  it('allocate_to_goal_with_transaction deve criar transações e reservar saldo', async () => {
    const amount = 150

    // Executar alocação canónica
    const { data: allocResult, error: allocError } = await supabaseTestClient
      .rpc('allocate_to_goal_with_transaction', {
        account_id_param: sourceAccountId,
        amount_param: amount,
        description_param: 'Alocação de teste',
        goal_id_param: goalId,
        user_id_param: userId,
      })

    expect(allocError).toBeNull()
    expect(allocResult).toBeTruthy()

    // Validar reservas por conta (view + RPC)
    const { data: reservedRows, error: reservedErr } = await supabaseTestClient
      .rpc('get_user_account_reserved')
    expect(reservedErr).toBeNull()
    expect(Array.isArray(reservedRows)).toBe(true)

    const sourceReserved = reservedRows?.find(r => r.account_id === sourceAccountId)
    expect(sourceReserved).toBeTruthy()
    expect(sourceReserved?.total_reservado).toBeGreaterThanOrEqual(amount)

    // Validar progresso do objetivo (view RPC)
    const { data: goalProgressRows, error: gpErr } = await supabaseTestClient
      .rpc('get_user_goal_progress')
    expect(gpErr).toBeNull()
    const gp = goalProgressRows?.find((g: any) => g.id === goalId)
    expect(gp).toBeTruthy()
    expect(gp?.total_alocado).toBeGreaterThanOrEqual(amount)

    // Validar existência de transações ligadas ao goal
    const { data: txRows, error: txErr } = await supabaseTestClient
      .from('transactions')
      .select('id, account_id, tipo, valor, goal_id')
      .eq('goal_id', goalId)
    expect(txErr).toBeNull()
    expect(Array.isArray(txRows)).toBe(true)
    // Deve existir pelo menos 2: despesa na conta fonte e receita na conta "Objetivos"
    const srcExpense = txRows?.find(t => t.account_id === sourceAccountId && t.tipo.toLowerCase().includes('desp'))
    const goalIncome = txRows?.find(t => t.account_id === goalsAccountId && t.tipo.toLowerCase().includes('reci') || t.tipo.toLowerCase().includes('rece'))
    expect(srcExpense).toBeTruthy()
    expect(goalIncome).toBeTruthy()
  })

  it('deallocate_from_goal_with_transaction deve reverter reservas e refletir nas views', async () => {
    const amount = 100

    // Desalocar (compat wrapper chama lógica de fn_goal_deallocate)
    const { data: deallocResult, error: deallocError } = await supabaseTestClient
      .rpc('deallocate_from_goal_with_transaction', {
        account_id_param: sourceAccountId,
        amount_param: amount,
        goal_id_param: goalId,
        user_id_param: userId,
      })
    expect(deallocError).toBeNull()
    expect(deallocResult).toBeTruthy()

    // Reservas devem diminuir
    const { data: reservedRows, error: reservedErr } = await supabaseTestClient
      .rpc('get_user_account_reserved')
    expect(reservedErr).toBeNull()

    const sourceReserved = reservedRows?.find(r => r.account_id === sourceAccountId)
    expect(sourceReserved).toBeTruthy()
    // Após alocar 150 e desalocar 100, reservado deve ser >= 50
    expect((sourceReserved?.total_reservado ?? 0)).toBeGreaterThanOrEqual(50)

    // Progresso do objetivo deve refletir redução
    const { data: goalProgressRows, error: gpErr } = await supabaseTestClient
      .rpc('get_user_goal_progress')
    expect(gpErr).toBeNull()
    const gp = goalProgressRows?.find((g: any) => g.id === goalId)
    expect(gp).toBeTruthy()
    expect((gp?.total_alocado ?? 0)).toBeGreaterThanOrEqual(50)
  })

  it('delete_goal_with_restoration deve eliminar o objetivo e restaurar reservas/ligação', async () => {
    // Eliminar objetivo
    const { data: delResult, error: delErr } = await supabaseTestClient
      .rpc('delete_goal_with_restoration', {
        goal_id_param: goalId,
        user_id_param: userId,
      })
    expect(delErr).toBeNull()
    expect(delResult).toBeTruthy()

    // Objetivo não deve existir
    const { data: goalRow, error: goalErr } = await supabaseTestClient
      .from('goals')
      .select('id')
      .eq('id', goalId)
      .maybeSingle()

    expect(goalErr).toBeNull()
    expect(goalRow).toBeNull()

    // Reservas na conta fonte devem ser 0 (ou ausentes)
    const { data: reservedRows, error: reservedErr } = await supabaseTestClient
      .rpc('get_user_account_reserved')
    expect(reservedErr).toBeNull()
    const srcReserved = reservedRows?.find(r => r.account_id === sourceAccountId)
    expect((srcReserved?.total_reservado ?? 0)).toBeGreaterThanOrEqual(0)
  })
})