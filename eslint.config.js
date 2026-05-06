import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.min.js',
      '.git/**',
      '.github/**',
      '.vscode/**',
      '.worktrees/**',
      '.claude/**',
      'supabase/**',
      'cypress/**',
      'src/integrations/supabase/database.types.ts'
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tseslint.parser,
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      // Evitar crash e falsos positivos em JSX: permitir curto-circuito e ternário
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: false }],
      'no-case-declarations': 'off',
      'no-console': 'warn', // Reativado após limpeza dos console statements
    },
  },
  // Override: proibir console na pasta payroll (temporariamente desativado)
  // {
  //   files: ['src/features/payroll/**/*.{ts,tsx}'],
  //   rules: {
  //     'no-console': 'error',
  //   },
  // },
  // Permitir console no módulo de logger e em testes/scripts manuais ou obsoletos
  {
    files: [
      'src/shared/lib/logger.ts',
      'tests/**/*.{js,ts,tsx,cjs}',
      'tests/manual/**/*.{js,ts,tsx,cjs}',
      'tests/obsolete/**/*.{js,ts,tsx,cjs}',
      'scripts/**/*.{js,ts,tsx,cjs}',
    ],
    rules: {
      'no-console': 'off', // Permitido em arquivos de teste
    },
  },
)
