import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import dotenv from 'dotenv'

export default defineConfig(({ mode }) => {
  // Carregar explicitamente do .env.local
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
  
  // Usar process.env diretamente
  const env = process.env
  
  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      // NO setupFiles - queremos testes de integração reais sem mocks
      include: ['tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
      globals: true,
      // Executar testes sequencialmente para evitar rate limiting
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true
        }
      },
      // Timeouts maiores para testes de integração
      testTimeout: 30000,
      hookTimeout: 30000,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'tests/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/coverage/**'
        ]
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '../../src'),
        '@/components': path.resolve(__dirname, '../../src/components'),
        '@/lib': path.resolve(__dirname, '../../src/lib'),
        '@/hooks': path.resolve(__dirname, '../../src/hooks'),
        '@/types': path.resolve(__dirname, '../../src/types'),
        '@/services': path.resolve(__dirname, '../../src/services'),
        '@/contexts': path.resolve(__dirname, '../../src/contexts'),
        '@/integrations': path.resolve(__dirname, '../../src/integrations')
      }
    },
    define: {
      'process.env': env
    }
  }
})