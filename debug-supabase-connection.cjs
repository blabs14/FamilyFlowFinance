// Debug script para testar conectividade Supabase
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('=== Debug Supabase Connection ===')
console.log('URL:', SUPABASE_URL ? 'configured' : 'missing')
console.log('Anon Key:', SUPABASE_ANON_KEY ? 'configured' : 'missing')
console.log('Service Key:', SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'missing')

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Variáveis de ambiente não configuradas')
  process.exit(1)
}

const testClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const serviceClient = SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null

async function testConnection() {
  try {
    console.log('\n=== Testando cliente normal ===')
    const { data, error } = await testClient.from('accounts').select('count').limit(1)
    console.log('Resultado:', { data, error })
    
    if (serviceClient) {
      console.log('\n=== Testando service client ===')
      const { data: serviceData, error: serviceError } = await serviceClient.from('accounts').select('count').limit(1)
      console.log('Resultado:', { data: serviceData, error: serviceError })
    } else {
      console.log('\n⚠️ Service client não disponível')
    }
    
    console.log('\n=== Testando criação de utilizador ===')
    if (serviceClient) {
      const testEmail = 'debug-test@example.com'
      const { data: userData, error: userError } = await serviceClient.auth.admin.createUser({
        email: testEmail,
        password: 'testpassword123',
        email_confirm: true
      })
      console.log('Criação de utilizador:', { data: userData, error: userError })
    }
    
  } catch (error) {
    console.error('❌ Erro na conexão:', error)
  }
}

testConnection()