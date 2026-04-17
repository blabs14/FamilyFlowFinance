import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabaseTestClient, supabaseServiceClient, createAndLoginTestUser } from '../../utils/supabaseTestClient'

/**
 * Integração: Idempotência na eliminação de objetivos
 * Cenário: Alocar 500 ao objetivo (100% quando valor alvo = 500) e eliminar duas vezes com a mesma idempotency_key
 * - A primeira eliminação remove o objetivo e liberta reservas sem debitar contas origem
 * - A segunda eliminação (mesma idempotency_key) devolve o mesmo resultado e não cria efeitos nem transações adicionais
 */

describe.skip('Goal Deletion Idempotency (integration)', () => {
  let userId: string
  let goalsAccountId: string
  let srcId: string
  let goalId: string
  let idempotencyKey: string

  beforeAll(async () => {
    if (!supabaseServiceClient) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurado — necessário para preparar dados de teste')
    }

    // 1) Criar e fazer login com utilizador único
    const uniqueEmail = `goal-delete-idempotency-${Date.now()}@familyflow.test`
    const { user } = await createAndLoginTestUser(uniqueEmail, 'TestPassword123!')
    userId = user.id

    // 2) Garantir conta "Objetivos" do utilizador
    {
      const { data, error } = await supabaseTestClient
        .rpc('ensure_goals_account', { p_user_id: userId })
      if (error) throw new Error('Erro em ensure_goals_account: ' + error.message)
      goalsAccountId = data as string
    }

    // 3) Criar conta origem com saldo inicial 1000
    {
      const { data, error } = await supabaseServiceClient
        .from('accounts')
        .insert([{ nome: 'Conta Origem', tipo: 'corrente', saldo: 1000, user_id: userId }])
        .select()
        .single()
      if (error) throw new Error('Erro ao criar conta origem: ' + error.message)
      srcId = data.id
    }

    // 4) Criar objetivo de 500
    {
      const { data, error } = await supabaseServiceClient
        .from('goals')
        .insert({ nome: 'Objetivo 500 Idempotência', user_id: userId, valor_objetivo: 500 })
        .select()
        .single()
      if (error) throw new Error('Erro ao criar objetivo: ' + error.message)
      goalId = data.id
    }

    idempotencyKey = `${userId}:${goalId}:delete`
  })

  afterAll(async () => {
    // Limpeza básica
    try {
      await supabaseServiceClient.from('goals').delete().eq('user_id', userId)
      await supabaseServiceClient.from('accounts').delete().eq('user_id', userId)
      await supabaseServiceClient.from('idempotent_ops').delete().eq('user_id', userId)
    } catch (e) {
      // noop
    }
  })

  it('deve eliminar duas vezes com a mesma idempotency_key sem efeitos adicionais', async () => {
    // 5) Alocar 500 da Conta Origem para atingir 100%
    {
      const { data, error } = await supabaseTestClient
        .rpc('allocate_to_goal_with_transaction', {
          account_id_param: srcId,
          amount_param: 500,
          description_param: 'Alocação Única',
          goal_id_param: goalId,
          user_id_param: userId,
        })
      expect(error).toBeNull()
      expect(data).toBeTruthy()
    }

    // 6) Contar despesas antes da eliminação
    let expenseCountBefore = 0
    {
      const { data: tx, error: txErr } = await supabaseTestClient
        .from('transactions')
        .select('id, account_id, tipo')
        .eq('account_id', srcId)
      expect(txErr).toBeNull()
      expenseCountBefore = (tx || []).filter(t => (t.tipo || '').toLowerCase().includes('desp')).length
    }

    // 7) Primeira eliminação com idempotency_key
    {
      const { data, error } = await supabaseTestClient
        .rpc('delete_goal_with_restoration', {
          goal_id_param: goalId,
          user_id_param: userId,
          idempotency_key: idempotencyKey,
        })
      expect(error).toBeNull()
      expect(data).toBeTruthy()
    }

    // 8) Validar objetivo removido
    {
      const { data, error } = await supabaseTestClient
        .from('goals')
        .select('id')
        .eq('id', goalId)
        .maybeSingle()
      expect(error).toBeNull()
      expect(data).toBeNull()
    }

    // 9) Validar reservas libertadas (conta origem sem reservas)
    {
      const { data: reservedRows, error } = await supabaseTestClient.rpc('get_user_account_reserved')
      expect(error).toBeNull()
      const srcReserved = reservedRows?.find((r: any) => r.account_id === srcId)
      expect((srcReserved?.total_reservado ?? 0)).toBe(0)
    }

    // 10) Saldo da conta origem não sofre novo débito (deve manter 500)
    {
      const { data: acc, error: accErr } = await supabaseServiceClient
        .from('accounts')
        .select('id, saldo')
        .eq('id', srcId)
        .single()
      expect(accErr).toBeNull()
      expect(acc.saldo).toBe(500)
    }

    // 11) Registo de idempotência criado
    {
      const { data, error } = await supabaseTestClient
        .from('idempotent_ops')
        .select('operation_key, user_id, operation_type')
        .eq('operation_key', idempotencyKey)
        .eq('user_id', userId)
      expect(error).toBeNull()
      expect((data || []).length).toBeGreaterThanOrEqual(1)
    }

    // 12) Segunda eliminação com a mesma idempotency_key
    {
      const { data, error } = await supabaseTestClient
        .rpc('delete_goal_with_restoration', {
          goal_id_param: goalId,
          user_id_param: userId,
          idempotency_key: idempotencyKey,
        })
      expect(error).toBeNull()
      expect(data).toBeTruthy()
    }

    // 13) Não há novas despesas após segunda eliminação
    {
      const { data: tx, error: txErr } = await supabaseTestClient
        .from('transactions')
        .select('id, account_id, tipo')
        .eq('account_id', srcId)
      expect(txErr).toBeNull()
      const expenseCountAfter = (tx || []).filter(t => (t.tipo || '').toLowerCase().includes('desp')).length
      expect(expenseCountAfter).toBe(expenseCountBefore)
    }

    // 14) Registo de idempotência continua único por (operation_key, user_id, operation_type)
    {
      const { data, error } = await supabaseTestClient
        .from('idempotent_ops')
        .select('operation_key, user_id, operation_type')
        .eq('operation_key', idempotencyKey)
        .eq('user_id', userId)
        .eq('operation_type', 'goal_delete_correct')
      expect(error).toBeNull()
      expect((data || []).length).toBe(1)
    }
  })
})