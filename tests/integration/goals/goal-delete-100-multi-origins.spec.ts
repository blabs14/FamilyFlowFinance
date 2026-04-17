import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabaseTestClient, supabaseServiceClient, createAndLoginTestUser } from '../../utils/supabaseTestClient'

/**
 * Integração: Eliminação de objetivo a 100% com múltiplas contas origem
 * Cenário: Duas contas origem (500 + 500) alocam para o mesmo objetivo (1000)
 * - Verifica que a eliminação NÃO debita novamente as contas origem
 * - Apenas liberta reservas na conta "Objetivos" e remove alocações
 */

describe.skip('Goal Deletion at 100% with Multiple Origin Accounts (integration)', () => {
  let userId: string
  let goalsAccountId: string
  let srcAId: string
  let srcBId: string
  let goalId: string

  beforeAll(async () => {
    if (!supabaseServiceClient) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurado — necessário para preparar dados de teste')
    }

    // 1) Criar e fazer login com utilizador único para evitar colisões
    const uniqueEmail = `goal-delete-100-multi-origins-${Date.now()}@familyflow.test`
    const { user } = await createAndLoginTestUser(uniqueEmail, 'TestPassword123!')
    userId = user.id

    // 2) Garantir conta "Objetivos" do utilizador
    {
      const { data, error } = await supabaseTestClient
        .rpc('ensure_goals_account', { p_user_id: userId })
      if (error) throw new Error('Erro em ensure_goals_account: ' + error.message)
      goalsAccountId = data as string
    }

    // 3) Criar duas contas origem com saldo inicial 1000 cada (via service)
    {
      const { data, error } = await supabaseServiceClient
        .from('accounts')
        .insert([
          { nome: 'Conta Origem A', tipo: 'corrente', saldo: 1000, user_id: userId },
          { nome: 'Conta Origem B', tipo: 'corrente', saldo: 1000, user_id: userId }
        ])
        .select()
      if (error) throw new Error('Erro ao criar contas origem: ' + error.message)
      const a = data.find((r: any) => r.nome === 'Conta Origem A')
      const b = data.find((r: any) => r.nome === 'Conta Origem B')
      srcAId = a.id
      srcBId = b.id
    }

    // 4) Criar objetivo de 1000
    {
      const { data, error } = await supabaseServiceClient
        .from('goals')
        .insert({ nome: 'Objetivo 1000 Multi-Origem', user_id: userId, valor_objetivo: 1000 })
        .select()
        .single()
      if (error) throw new Error('Erro ao criar objetivo: ' + error.message)
      goalId = data.id
    }
  })

  afterAll(async () => {
    // Limpeza básica
    try {
      await supabaseServiceClient.from('goals').delete().eq('user_id', userId)
      await supabaseServiceClient.from('accounts').delete().eq('user_id', userId)
    } catch (e) {
      // noop
    }
  })

  it('deve alocar 500+500 e atingir 100%, depois eliminar sem debitar origens', async () => {
    // 5) Alocar 500 da Conta A
    {
      const { data, error } = await supabaseTestClient
        .rpc('allocate_to_goal_with_transaction', {
          account_id_param: srcAId,
          amount_param: 500,
          description_param: 'Alocação A',
          goal_id_param: goalId,
          user_id_param: userId,
        })
      expect(error).toBeNull()
      expect(data).toBeTruthy()
    }

    // 6) Alocar 500 da Conta B
    {
      const { data, error } = await supabaseTestClient
        .rpc('allocate_to_goal_with_transaction', {
          account_id_param: srcBId,
          amount_param: 500,
          description_param: 'Alocação B',
          goal_id_param: goalId,
          user_id_param: userId,
        })
      expect(error).toBeNull()
      expect(data).toBeTruthy()
    }

    // 7) Validar progresso do objetivo = 1000
    {
      const { data: goalProgressRows, error } = await supabaseTestClient.rpc('get_user_goal_progress', { user_id_param: userId })
      expect(error).toBeNull()
      const gp = goalProgressRows?.find((g: any) => g.id === goalId)
      expect(gp).toBeTruthy()
      // pode devolver real e historico; validar que pelo menos um >= 1000
      const totalReal = Number(gp?.total_alocado_real ?? 0)
      const totalHistorico = Number(gp?.total_alocado_historico ?? 0)
      expect(Math.max(totalReal, totalHistorico)).toBeGreaterThanOrEqual(1000)
    }

    // 8) Registar contagens de despesas nas contas origem ANTES da eliminação
    let srcAExpenseCountBefore = 0
    let srcBExpenseCountBefore = 0
    {
      const { data: txA, error: txErrA } = await supabaseTestClient
        .from('transactions')
        .select('id, account_id, tipo')
        .eq('account_id', srcAId)
      expect(txErrA).toBeNull()
      srcAExpenseCountBefore = (txA || []).filter(t => (t.tipo || '').toLowerCase().includes('desp')).length

      const { data: txB, error: txErrB } = await supabaseTestClient
        .from('transactions')
        .select('id, account_id, tipo')
        .eq('account_id', srcBId)
      expect(txErrB).toBeNull()
      srcBExpenseCountBefore = (txB || []).filter(t => (t.tipo || '').toLowerCase().includes('desp')).length
    }

    // 9) Não atualizar manualmente o status — confiar no progresso real (500+500 alocado) para marcar como completo
    // A view/func calculam progresso e a eliminação usa esse valor internamente

    // 10) Eliminar via wrapper (deve usar fn_goal_delete_with_correct_logic)
    {
      const { data, error } = await supabaseTestClient
        .rpc('delete_goal_with_restoration', {
          goal_id_param: goalId,
          user_id_param: userId,
        })
      expect(error).toBeNull()
      expect(data).toBeTruthy()
    }

    // 11) Objetivo removido
    {
      const { data, error } = await supabaseTestClient
        .from('goals')
        .select('id')
        .eq('id', goalId)
        .maybeSingle()
      expect(error).toBeNull()
      expect(data).toBeNull()
    }

    // 12) Reservas libertadas (nenhuma reserva nas contas origem)
    {
      const { data: reservedRows, error } = await supabaseTestClient.rpc('get_user_account_reserved')
      expect(error).toBeNull()
      const aReserved = reservedRows?.find((r: any) => r.account_id === srcAId)
      const bReserved = reservedRows?.find((r: any) => r.account_id === srcBId)
      expect((aReserved?.total_reservado ?? 0)).toBe(0)
      expect((bReserved?.total_reservado ?? 0)).toBe(0)
    }

    // 13) Saldos das contas origem NÃO sofrem novo débito
    {
      // contas origem devem manter o saldo após alocação (1000 - 500 = 500 cada)
      const { data: accA, error: accErrA } = await supabaseServiceClient
        .from('accounts')
        .select('id, saldo')
        .eq('id', srcAId)
        .single()
      expect(accErrA).toBeNull()
      expect(accA.saldo).toBe(500)

      const { data: accB, error: accErrB } = await supabaseServiceClient
        .from('accounts')
        .select('id, saldo')
        .eq('id', srcBId)
        .single()
      expect(accErrB).toBeNull()
      expect(accB.saldo).toBe(500)
    }

    // 14) Não há novas despesas nas contas origem após eliminação
    {
      const { data: txA, error: txErrA } = await supabaseTestClient
        .from('transactions')
        .select('id, account_id, tipo')
        .eq('account_id', srcAId)
      expect(txErrA).toBeNull()
      const srcAExpenseCountAfter = (txA || []).filter(t => (t.tipo || '').toLowerCase().includes('desp')).length
      expect(srcAExpenseCountAfter).toBe(srcAExpenseCountBefore)

      const { data: txB, error: txErrB } = await supabaseTestClient
        .from('transactions')
        .select('id, account_id, tipo')
        .eq('account_id', srcBId)
      expect(txErrB).toBeNull()
      const srcBExpenseCountAfter = (txB || []).filter(t => (t.tipo || '').toLowerCase().includes('desp')).length
      expect(srcBExpenseCountAfter).toBe(srcBExpenseCountBefore)
    }
  })
})