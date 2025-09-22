const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Simular import.meta.env
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

// Simular exatamente o que acontece no supabaseClient.ts
const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Simulando configuração do React...');
console.log(`URL: ${supabaseUrl}`);
console.log(`Key length: ${supabaseAnonKey?.length}`);

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Variáveis de ambiente em falta');
    process.exit(1);
}

// Criar cliente exatamente como no React
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
    },
});

async function testLogin() {
    const email = 'testetotal@exemplo.com';
    const password = 'teste14';
    
    console.log('\n🔐 Testando login com configuração React...');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Password length: ${password.length}`);
    console.log(`Email type: ${typeof email}`);
    console.log(`Password type: ${typeof password}`);
    
    try {
        console.log('\n📞 Chamando supabase.auth.signInWithPassword...');
        
        const result = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        console.log('\n📋 Resultado completo:');
        console.log('Data:', JSON.stringify(result.data, null, 2));
        console.log('Error:', JSON.stringify(result.error, null, 2));
        
        if (result.error) {
            console.log(`\n❌ ERRO: ${result.error.message}`);
            console.log(`Tipo do erro: ${typeof result.error}`);
            console.log(`Código do erro: ${result.error.status || 'N/A'}`);
            
            // Verificar propriedades específicas do erro
            console.log('\n🔍 Propriedades do erro:');
            Object.keys(result.error).forEach(key => {
                console.log(`  ${key}: ${result.error[key]}`);
            });
        } else {
            console.log(`\n✅ SUCESSO!`);
            console.log(`User ID: ${result.data.user?.id}`);
            console.log(`Email: ${result.data.user?.email}`);
            console.log(`Session: ${!!result.data.session}`);
        }
        
    } catch (err) {
        console.log(`\n💥 EXCEÇÃO: ${err.message}`);
        console.log(`Stack: ${err.stack}`);
    }
}

testLogin();