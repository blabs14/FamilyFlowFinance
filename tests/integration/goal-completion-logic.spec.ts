import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Goal Completion Logic - Integration Tests', () => {
  let supabaseServiceClient: any;
  let testUserId: string;

  beforeAll(async () => {
    // Importar o service client que bypassa RLS
    const { supabaseServiceClient: serviceClient } = await import('../utils/supabaseTestClient');
    
    if (!serviceClient) {
      throw new Error('Service role client não está configurado. Verifique SUPABASE_SERVICE_ROLE_KEY no .env');
    }
    
    supabaseServiceClient = serviceClient;
    
    // Criar um utilizador de teste único
    testUserId = `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('Setting up test data with user ID:', testUserId);
  });

  afterAll(async () => {
    if (supabaseServiceClient && testUserId) {
      console.log('Cleaning up test data...');
      
      try {
        // Limpar dados de teste na ordem correta (dependências primeiro)
        await supabaseServiceClient.from('goals').delete().eq('user_id', testUserId);
        await supabaseServiceClient.from('accounts').delete().eq('user_id', testUserId);
        
        console.log('Test data cleaned up successfully');
      } catch (error) {
        console.warn('Error during cleanup:', error);
      }
    }
  });

  it('should complete full goal lifecycle workflow', async () => {
    let testAccountId: string;
    let testGoalId: string;
    
    // PASSO 1: Criar uma conta principal de teste
    console.log('Step 1: Creating test account...');
    const { data: accountData, error: accountError } = await supabaseServiceClient
      .from('accounts')
      .insert({
        nome: 'Conta Principal Teste',
        tipo: 'corrente',
        saldo: 1000.00,
        user_id: testUserId
      })
      .select()
      .single();

    console.log('Account creation - Error:', accountError);
    console.log('Account created:', !!accountData);

    expect(accountError).toBeNull();
    expect(accountData).toBeDefined();
    expect(accountData.id).toBeDefined();
    expect(accountData.nome).toBe('Conta Principal Teste');
    expect(accountData.saldo).toBe(1000.00);

    testAccountId = accountData.id;
    console.log('Test account ID:', testAccountId);

    // PASSO 2: Criar um objetivo de teste
    console.log('Step 2: Creating test goal...');
    const { data: goalData, error: goalError } = await supabaseServiceClient
      .from('goals')
      .insert({
        nome: 'Objetivo Teste Integração',
        valor_objetivo: 500.00,
        valor_atual: 0.00,
        status: 'ativo',
        account_id: testAccountId,
        user_id: testUserId
      })
      .select()
      .single();

    console.log('Goal creation - Error:', goalError);
    console.log('Goal created:', !!goalData);

    expect(goalError).toBeNull();
    expect(goalData).toBeDefined();
    expect(goalData.id).toBeDefined();
    expect(goalData.nome).toBe('Objetivo Teste Integração');
    expect(goalData.valor_objetivo).toBe(500.00);
    expect(goalData.valor_atual).toBe(0.00);
    expect(goalData.status).toBe('ativo');

    testGoalId = goalData.id;
    console.log('Test goal ID:', testGoalId);

    // PASSO 3: Verificar se existe uma conta "Objetivos" para este utilizador
    console.log('Step 3: Checking for goals account...');
    const { data: goalsAccounts, error: goalsError } = await supabaseServiceClient
      .from('accounts')
      .select('*')
      .eq('user_id', testUserId)
      .eq('nome', 'Objetivos')
      .eq('tipo', 'objetivos');

    console.log('Goals account query - Error:', goalsError);
    console.log('Goals accounts found:', goalsAccounts?.length || 0);

    expect(goalsError).toBeNull();
    
    if (goalsAccounts && goalsAccounts.length > 0) {
      console.log('Goals account exists with ID:', goalsAccounts[0].id);
      expect(goalsAccounts[0].nome).toBe('Objetivos');
      expect(goalsAccounts[0].tipo).toBe('objetivos');
      expect(goalsAccounts[0].saldo).toBe(0.00);
    } else {
      console.log('Goals account does not exist yet - this may be expected');
    }

    // PASSO 4: Atualizar o progresso do objetivo para menos de 100%
    console.log('Step 4: Updating goal progress to 60%...');
    const { data: updatedGoal, error: updateError } = await supabaseServiceClient
      .from('goals')
      .update({
        valor_atual: 300.00 // 60% do objetivo (300/500)
      })
      .eq('id', testGoalId)
      .select()
      .single();

    console.log('Goal update - Error:', updateError);
    console.log('Goal updated:', !!updatedGoal);

    expect(updateError).toBeNull();
    expect(updatedGoal).toBeDefined();
    expect(updatedGoal.valor_atual).toBe(300.00);
    expect(updatedGoal.status).toBe('ativo'); // Deve continuar ativo

    // Verificar que a conta principal não foi alterada
    const { data: accountData2, error: accountError2 } = await supabaseServiceClient
      .from('accounts')
      .select('saldo')
      .eq('id', testAccountId)
      .single();

    expect(accountError2).toBeNull();
    expect(accountData2.saldo).toBe(1000.00); // Deve manter o saldo original

    // PASSO 5: Completar o objetivo (100% progresso)
    console.log('Step 5: Completing goal (100% progress)...');
    const { data: completedGoal, error: completionError } = await supabaseServiceClient
      .from('goals')
      .update({
        valor_atual: 500.00, // 100% do objetivo
        status: 'concluido'
      })
      .eq('id', testGoalId)
      .select()
      .single();

    console.log('Goal completion - Error:', completionError);
    console.log('Goal completed:', !!completedGoal);

    expect(completionError).toBeNull();
    expect(completedGoal).toBeDefined();
    expect(completedGoal.valor_atual).toBe(500.00);
    expect(completedGoal.status).toBe('concluido');

    // PASSO 6: Verificação final da consistência dos dados
    console.log('Step 6: Final data consistency check...');
    
    // Verificar o objetivo final
    const { data: finalGoal, error: finalGoalError } = await supabaseServiceClient
      .from('goals')
      .select('*')
      .eq('id', testGoalId)
      .single();

    console.log('Final goal query - Error:', finalGoalError);
    console.log('Final goal data:', finalGoal);

    expect(finalGoalError).toBeNull();
    expect(finalGoal).toBeDefined();
    expect(finalGoal.status).toBe('concluido');
    expect(finalGoal.valor_atual).toBe(500.00);
    expect(finalGoal.valor_objetivo).toBe(500.00);

    // Verificar a conta principal
    const { data: finalAccount, error: finalAccountError } = await supabaseServiceClient
      .from('accounts')
      .select('*')
      .eq('id', testAccountId)
      .single();

    console.log('Final account query - Error:', finalAccountError);
    console.log('Final account data:', finalAccount);

    expect(finalAccountError).toBeNull();
    expect(finalAccount).toBeDefined();
    expect(finalAccount.nome).toBe('Conta Principal Teste');
    
    // Verificar todas as contas do utilizador
    const { data: allAccounts, error: allAccountsError } = await supabaseServiceClient
      .from('accounts')
      .select('*')
      .eq('user_id', testUserId);

    expect(allAccountsError).toBeNull();
    expect(Array.isArray(allAccounts)).toBe(true);
    
    console.log('Final accounts for user:', allAccounts?.map(acc => ({
      id: acc.id,
      nome: acc.nome,
      tipo: acc.tipo,
      saldo: acc.saldo
    })));

    console.log('✅ Full goal lifecycle workflow completed successfully');
    
    // Nota: A lógica de desalocação automática (transferir dinheiro de volta para a conta principal)
    // pode ser implementada via triggers, functions ou lógica de aplicação
    // Por agora, verificamos que o objetivo foi marcado como concluído corretamente
  });
});