const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
  console.log('🔍 Testando login com credenciais...');
  console.log('URL:', supabaseUrl);
  console.log('Key length:', supabaseKey?.length);
  
  const email = 'testetotal@exemplo.com';
  const passwords = ['teste14', 'teste123', 'teste', 'password', '123456'];
  
  for (const password of passwords) {
    console.log(`\n🔐 Testando senha: "${password}"`);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        console.log(`❌ Erro: ${error.message}`);
      } else {
        console.log(`✅ SUCESSO! Senha correta: "${password}"`);
        console.log('User ID:', data.user?.id);
        console.log('Email:', data.user?.email);
        return;
      }
    } catch (err) {
      console.log(`❌ Exceção: ${err.message}`);
    }
  }
  
  console.log('\n❌ Nenhuma senha funcionou');
}

testLogin();