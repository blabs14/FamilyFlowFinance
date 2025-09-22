const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configurações de ambiente...\n');

// Ler .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    console.log('📄 Conteúdo do .env.local:');
    console.log(envContent);
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Extrair variáveis específicas
    const lines = envContent.split('\n');
    const envVars = {};
    
    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
                envVars[key] = valueParts.join('=');
            }
        }
    });
    
    console.log('🔑 Variáveis extraídas:');
    Object.keys(envVars).forEach(key => {
        if (key.includes('SUPABASE')) {
            console.log(`${key}: ${envVars[key].substring(0, 20)}...`);
        }
    });
    
    console.log('\n📊 Comparação com valores hardcoded:');
    
    const hardcodedUrl = 'https://ebitcwrrcumsvqjgrapw.supabase.co';
    const hardcodedKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViaXRjd3JyY3Vtc3ZxamdyYXB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NjcyMTYsImV4cCI6MjA2ODM0MzIxNn0.hLlTeSD2VzVCjvUSXLYQypXNYqthDx0q1N86aOftfEY';
    
    console.log(`VITE_SUPABASE_URL no .env: ${envVars.VITE_SUPABASE_URL}`);
    console.log(`URL hardcoded:             ${hardcodedUrl}`);
    console.log(`URLs iguais: ${envVars.VITE_SUPABASE_URL === hardcodedUrl}`);
    
    console.log(`\nVITE_SUPABASE_ANON_KEY no .env: ${envVars.VITE_SUPABASE_ANON_KEY?.substring(0, 50)}...`);
    console.log(`Key hardcoded:                  ${hardcodedKey.substring(0, 50)}...`);
    console.log(`Keys iguais: ${envVars.VITE_SUPABASE_ANON_KEY === hardcodedKey}`);
    
} else {
    console.log('❌ Arquivo .env.local não encontrado!');
}