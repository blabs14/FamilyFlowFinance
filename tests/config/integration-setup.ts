import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { config } from 'dotenv';

// Carregar variáveis de ambiente do .env.local
config({ path: '.env.local' });

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Configuração específica para testes de integração
// NÃO fazer mock do Supabase - usar cliente real

// Verificar se as variáveis de ambiente necessárias estão definidas
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Variável de ambiente ${envVar} não está definida. Verifique o ficheiro .env.local`);
  }
}

console.log('✅ Configuração de testes de integração carregada');
console.log('📍 Supabase URL:', process.env.SUPABASE_URL);
console.log('🔑 Chaves configuradas:', {
  anon: !!process.env.SUPABASE_ANON_KEY,
  service: !!process.env.SUPABASE_SERVICE_ROLE_KEY
});