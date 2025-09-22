// Script de teste para verificar login do utilizador testetotal@exemplo.com
import { createClient } from '@supabase/supabase-js';

// Configurações do Supabase
const supabaseUrl = 'https://ebitcwrrcumsvqjgrapw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViaXRjd3JyY3Vtc3ZxamdyYXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NjcyMTYsImV4cCI6MjA2ODM0MzIxNn0.hLlTeSD2VzVCjvUSXLYQypXNYqthDx0q1N86aOftfEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
  console.log('🧪 Testando login do utilizador testetotal@exemplo.com...');
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'testetotal@exemplo.com',
      password: 'teste14'
    });
    
    console.log('📊 Resultado do login:');
    console.log('  - Data:', data);
    console.log('  - Error:', error);
    
    if (error) {
      console.error('❌ Erro no login:', error.message);
    } else {
      console.log('✅ Login bem-sucedido!');
      console.log('👤 Utilizador:', data.user?.email);
      console.log('🔑 Session:', !!data.session);
    }
    
  } catch (err) {
    console.error('💥 Erro inesperado:', err);
  }
}

testLogin();