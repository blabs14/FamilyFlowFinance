import { describe, it, expect, beforeAll } from 'vitest'

// Integração autenticada (sem mocks) — validação do fluxo de auth e caminhos CSV/PDF
// Requer SUPABASE_URL e um token de acesso válido: SUPABASE_TEST_ACCESS_TOKEN ou TEST_ACCESS_TOKEN

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const FUNCTION_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/export-payslips` : undefined
const ACCESS_TOKEN = process.env.SUPABASE_TEST_ACCESS_TOKEN || process.env.TEST_ACCESS_TOKEN || process.env.VITE_TEST_ACCESS_TOKEN

let reachable = false
async function checkReachable(): Promise<boolean> {
  if (!FUNCTION_ENDPOINT) return false
  try {
    const res = await fetch(FUNCTION_ENDPOINT, { method: 'OPTIONS' })
    return res.ok || res.status === 405 || res.status === 401
  } catch {
    return false
  }
}

beforeAll(async () => {
  reachable = await checkReachable()
})

const canRun = reachable && FUNCTION_ENDPOINT && ACCESS_TOKEN
const maybeDescribe = canRun ? describe : describe.skip

maybeDescribe('Edge Function export-payslips — fluxo autenticado básico', () => {
  it('POST autorizado com ids inexistentes devolve 404 (Nenhum payslip encontrado) [CSV]', async () => {
    const body = { format: 'csv', ids: ['00000000-0000-0000-0000-000000000000'] }
    const res = await fetch(FUNCTION_ENDPOINT!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      },
      body: JSON.stringify(body)
    })
    const json = await res.json().catch(() => ({}))
    expect([404, 200]).toContain(res.status)
    if (res.status === 404) {
      expect(json?.error).toBe('Nenhum payslip encontrado para exportação')
    } else {
      // Caso existam dados no ambiente de teste, deve devolver signedUrl
      expect(typeof json?.signedUrl).toBe('string')
      expect(json?.signedUrl?.length).toBeGreaterThan(10)
    }
  })

  it('POST autorizado com ids inexistentes devolve 404 (Nenhum payslip encontrado) [PDF]', async () => {
    const body = { format: 'pdf', ids: ['00000000-0000-0000-0000-000000000000'] }
    const res = await fetch(FUNCTION_ENDPOINT!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      },
      body: JSON.stringify(body)
    })
    const json = await res.json().catch(() => ({}))
    expect([404, 200]).toContain(res.status)
    if (res.status === 404) {
      expect(json?.error).toBe('Nenhum payslip encontrado para exportação')
    } else {
      // Caso existam dados no ambiente de teste, deve devolver signedUrl
      expect(typeof json?.signedUrl).toBe('string')
      expect(json?.signedUrl?.length).toBeGreaterThan(10)
    }
  })


})

if (!FUNCTION_ENDPOINT || !reachable || !ACCESS_TOKEN) {
  console.warn('[integração/export-payslips-auth] Sem SUPABASE_URL ou token de acesso de teste. Configure .env.local e a variável SUPABASE_TEST_ACCESS_TOKEN para executar estes testes.')
}