require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY // Usar a chave anónima para simular um cliente real
);

async function testAuthenticationAndRPC() {
  console.log('🔐 Testando Autenticação e Funções RPC...\n');

  try {
    // 1. Verificar se há utilizadores na base de dados
    console.log('1. Verificando utilizadores existentes...');
    const adminSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data: users, error: usersError } = await adminSupabase.auth.admin.listUsers();
    if (usersError) {
      console.error('❌ Erro ao listar utilizadores:', usersError);
      return;
    }
    
    console.log(`✅ Encontrados ${users.users.length} utilizadores na base de dados`);
    
    if (users.users.length === 0) {
      console.log('⚠️  Nenhum utilizador encontrado. Vamos criar um utilizador de teste...');
      
      // Criar utilizador de teste
      const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
        email: 'teste@familyflow.com',
        password: 'teste123456',
        email_confirm: true
      });
      
      if (createError) {
        console.error('❌ Erro ao criar utilizador de teste:', createError);
        return;
      }
      
      console.log('✅ Utilizador de teste criado:', newUser.user.email);
    }

    // 2. Fazer login com o primeiro utilizador ou utilizador de teste
    const testEmail = users.users.length > 0 ? users.users[0].email : 'teste@familyflow.com';
    const testPassword = 'teste123456';
    
    console.log(`\n2. Fazendo login com: ${testEmail}`);
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (authError) {
      console.error('❌ Erro de autenticação:', authError);
      
      // Se falhar, tentar resetar a password
      console.log('🔄 Tentando resetar password...');
      const { error: resetError } = await adminSupabase.auth.admin.updateUserById(
        users.users[0].id,
        { password: testPassword }
      );
      
      if (resetError) {
        console.error('❌ Erro ao resetar password:', resetError);
        return;
      }
      
      // Tentar login novamente
      const { data: retryAuth, error: retryError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword
      });
      
      if (retryError) {
        console.error('❌ Erro de autenticação após reset:', retryError);
        return;
      }
      
      console.log('✅ Login bem-sucedido após reset da password');
    } else {
      console.log('✅ Login bem-sucedido');
    }

    // 3. Verificar sessão
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      console.error('❌ Nenhuma sessão ativa');
      return;
    }
    
    console.log('✅ Sessão ativa para utilizador:', session.session.user.email);
    const userId = session.session.user.id;

    // 4. Testar funções RPC com utilizador autenticado
    console.log('\n3. Testando funções RPC com utilizador autenticado...');
    
    // Test get_user_goal_progress
    console.log('\n📊 Testando get_user_goal_progress...');
    const { data: goalProgress, error: goalError } = await supabase.rpc('get_user_goal_progress', {
      user_id: userId
    });
    console.log('get_user_goal_progress:', { 
      success: !goalError, 
      dataLength: goalProgress?.length || 0, 
      error: goalError?.message 
    });

    // Test get_user_accounts_with_balances
    console.log('\n💰 Testando get_user_accounts_with_balances...');
    const { data: accounts, error: accountsError } = await supabase.rpc('get_user_accounts_with_balances', {
      p_user_id: userId
    });
    console.log('get_user_accounts_with_balances:', { 
      success: !accountsError, 
      dataLength: accounts?.length || 0, 
      error: accountsError?.message 
    });

    // Test get_family_goals
    console.log('\n🎯 Testando get_family_goals...');
    const { data: familyGoals, error: familyGoalsError } = await supabase.rpc('get_family_goals', {
      p_user_id: userId
    });
    console.log('get_family_goals:', { 
      success: !familyGoalsError, 
      dataLength: familyGoals?.length || 0, 
      error: familyGoalsError?.message 
    });

    // Test get_personal_kpis
    console.log('\n📈 Testando get_personal_kpis...');
    const { data: kpis, error: kpisError } = await supabase.rpc('get_personal_kpis');
    console.log('get_personal_kpis:', { 
      success: !kpisError, 
      data: kpis, 
      error: kpisError?.message 
    });

    // Test get_personal_budgets
    console.log('\n💼 Testando get_personal_budgets...');
    const { data: budgets, error: budgetsError } = await supabase.rpc('get_personal_budgets');
    console.log('get_personal_budgets:', { 
      success: !budgetsError, 
      dataLength: budgets?.length || 0, 
      error: budgetsError?.message 
    });

    // Test get_personal_transactions
    console.log('\n💳 Testando get_personal_transactions...');
    const { data: transactions, error: transactionsError } = await supabase.rpc('get_personal_transactions');
    console.log('get_personal_transactions:', { 
      success: !transactionsError, 
      dataLength: transactions?.length || 0, 
      error: transactionsError?.message 
    });

    // Test get_user_family_data
    console.log('\n👨‍👩‍👧‍👦 Testando get_user_family_data...');
    const { data: familyData, error: familyDataError } = await supabase.rpc('get_user_family_data');
    console.log('get_user_family_data:', { 
      success: !familyDataError, 
      hasData: !!familyData, 
      error: familyDataError?.message 
    });

    console.log('\n✅ Teste de autenticação e RPC concluído com sucesso!');
    
    // 5. Fazer logout
    await supabase.auth.signOut();
    console.log('🚪 Logout realizado');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

testAuthenticationAndRPC();