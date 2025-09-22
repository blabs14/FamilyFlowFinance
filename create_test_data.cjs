require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestData() {
  console.log('🔧 Criando dados de teste...');
  
  try {
    // 1. Verificar se já existem dados
    console.log('\n1. Verificando dados existentes...');
    
    const { data: existingGoals } = await supabase
      .from('goals')
      .select('count')
      .single();
    
    if (existingGoals && existingGoals.count > 0) {
      console.log('✅ Já existem dados na base de dados');
      return;
    }
    
    // 2. Obter utilizador atual (assumindo que está autenticado)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('❌ Erro: Utilizador não autenticado');
      console.log('Para testar, precisa de estar autenticado na aplicação');
      return;
    }
    
    console.log(`✅ Utilizador encontrado: ${user.id}`);
    
    // 3. Criar categoria padrão
    console.log('\n2. Criando categoria padrão...');
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .insert({
        nome: 'Geral',
        cor: '#3B82F6',
        user_id: user.id
      })
      .select()
      .single();
    
    if (categoryError) {
      console.log('❌ Erro ao criar categoria:', categoryError.message);
      return;
    }
    
    console.log('✅ Categoria criada:', category.nome);
    
    // 4. Criar conta de teste
    console.log('\n3. Criando conta de teste...');
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .insert({
        nome: 'Conta Principal',
        tipo: 'corrente',
        saldo: 1000.00,
        user_id: user.id
      })
      .select()
      .single();
    
    if (accountError) {
      console.log('❌ Erro ao criar conta:', accountError.message);
      return;
    }
    
    console.log('✅ Conta criada:', account.nome, 'com saldo:', account.saldo);
    
    // 5. Criar objetivo de teste
    console.log('\n4. Criando objetivo de teste...');
    const { data: goal, error: goalError } = await supabase
      .from('goals')
      .insert({
        nome: 'Férias de Verão',
        valor_objetivo: 2000.00,
        valor_atual: 0.00,
        valor_meta: 2000.00,
        prazo: '2024-12-31',
        user_id: user.id,
        ativa: true
      })
      .select()
      .single();
    
    if (goalError) {
      console.log('❌ Erro ao criar objetivo:', goalError.message);
      return;
    }
    
    console.log('✅ Objetivo criado:', goal.nome, 'meta:', goal.valor_objetivo);
    
    // 6. Testar a função de alocação
    console.log('\n5. Testando alocação...');
    const { data: result, error: allocError } = await supabase
      .rpc('allocate_to_goal_with_transaction', {
        goal_id_param: goal.id,
        account_id_param: account.id,
        amount_param: 100.00,
        description_param: 'Teste de alocação',
        user_id_param: user.id
      });
    
    if (allocError) {
      console.log('❌ Erro na alocação:', allocError.message);
      return;
    }
    
    console.log('✅ Alocação realizada com sucesso!');
    console.log('Resultado:', JSON.stringify(result, null, 2));
    
    // 7. Verificar resultados
    console.log('\n6. Verificando resultados...');
    
    // Verificar alocações
    const { data: allocations } = await supabase
      .from('goal_allocations')
      .select('*')
      .eq('goal_id', goal.id);
    
    console.log('Alocações encontradas:', allocations?.length || 0);
    
    // Verificar transações
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('goal_id', goal.id);
    
    console.log('Transações encontradas:', transactions?.length || 0);
    
    // Verificar saldo da conta
    const { data: updatedAccount } = await supabase
      .from('accounts')
      .select('saldo')
      .eq('id', account.id)
      .single();
    
    console.log('Saldo da conta após alocação:', updatedAccount?.saldo);
    
    console.log('\n🎉 Dados de teste criados com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

createTestData();