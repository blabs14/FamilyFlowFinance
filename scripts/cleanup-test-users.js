// Script para limpar utilizadores de teste
const { cleanupTestUsers } = require('../tests/utils/supabaseTestClient.ts')

async function main() {
  console.log('Limpando utilizadores de teste...')
  await cleanupTestUsers()
  console.log('Limpeza concluída')
  process.exit(0)
}

main().catch(error => {
  console.error('Erro na limpeza:', error)
  process.exit(1)
})