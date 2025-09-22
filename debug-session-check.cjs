const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
            envVars[key] = valueParts.join('=');
        }
    }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
    },
});

async function checkSession() {
    console.log('🔍 Verificando estado da sessão...\n');
    
    try {
        // Verificar sessão atual
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        console.log('📋 Estado da sessão:');
        console.log('Session data:', JSON.stringify(sessionData, null, 2));
        console.log('Session error:', sessionError);
        
        // Verificar usuário atual
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        console.log('\n👤 Estado do usuário:');
        console.log('User data:', JSON.stringify(userData, null, 2));
        console.log('User error:', userError);
        
        // Se há uma sessão ativa, fazer logout
        if (sessionData.session) {
            console.log('\n🚪 Sessão ativa encontrada. Fazendo logout...');
            const { error: logoutError } = await supabase.auth.signOut();
            
            if (logoutError) {
                console.log('❌ Erro no logout:', logoutError);
            } else {
                console.log('✅ Logout realizado com sucesso');
            }
            
            // Verificar novamente após logout
            const { data: newSessionData } = await supabase.auth.getSession();
            console.log('📋 Estado da sessão após logout:', !!newSessionData.session);
        }
        
        // Agora tentar login
        console.log('\n🔐 Tentando login após limpeza...');
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: 'testetotal@exemplo.com',
            password: 'teste14'
        });
        
        if (loginError) {
            console.log('❌ Erro no login:', loginError);
        } else {
            console.log('✅ Login bem-sucedido:', !!loginData.user);
        }
        
    } catch (err) {
        console.log('💥 Erro:', err.message);
    }
}

checkSession();