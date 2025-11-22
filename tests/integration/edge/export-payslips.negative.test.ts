import { describe, it, expect, beforeAll } from 'vitest'

// Integração (sem mocks) da Edge Function export-payslips — cenários negativos
// Requer SUPABASE_URL definido em .env.local (ver .env.example) ou VITE_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const FUNCTION_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/export-payslips` : undefined

// Helper para verificar rapidamente se o endpoint está acessível; em caso de falha, os testes são ignorados
let reachable = false

async function checkReachable(): Promise<boolean> {
  if (!FUNCTION_ENDPOINT) return false
  try {
    const res = await fetch(FUNCTION_ENDPOINT, { method: 'OPTIONS', headers: { Origin: 'http://localhost:8081' } })
    return res.ok || res.status === 405 || res.status === 401
  } catch {
    return false
  }
}

beforeAll(async () => {
  reachable = await checkReachable()
})

const maybeDescribe = reachable && FUNCTION_ENDPOINT ? describe : describe.skip

maybeDescribe('Edge Function export-payslips — cenários negativos', () => {
  it('OPTIONS responde com 200 e cabeçalhos CORS', async () => {
    const res = await fetch(FUNCTION_ENDPOINT!, { method: 'OPTIONS', headers: { Origin: 'http://localhost:8081' } })
    const text = await res.text()
    expect(res.status).toBe(200)
    expect(text).toBe('ok')
    // Verificações básicas de CORS
    expect(res.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('authorization')
    expect(res.headers.get('Vary')).toBe('Origin')
  })

  it('GET devolve 405 (Método não permitido)', async () => {
    const res = await fetch(FUNCTION_ENDPOINT!, { method: 'GET', headers: { Origin: 'http://localhost:8081' } })
    const json = await res.json().catch(() => ({}))
    expect(res.status).toBe(405)
    expect(json?.error).toBe('Método não permitido')
  })

  it('POST sem Authorization devolve 401 (Não autenticado)', async () => {
    const body = { ids: ['dummy-id'] }
    const res = await fetch(FUNCTION_ENDPOINT!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8081' },
      body: JSON.stringify(body)
    })
    const json = await res.json().catch(() => ({}))
    expect(res.status).toBe(401)
    expect(json?.error).toBe('Não autenticado')
  })

  it('POST com payload inválido (format fora do enum) devolve 400 (Parâmetros inválidos)', async () => {
    const body = { format: 'xlsx' } // inválido (enum é csv|pdf)
    const res = await fetch(FUNCTION_ENDPOINT!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8081' },
      body: JSON.stringify(body)
    })
    const json = await res.json().catch(() => ({}))
    expect(res.status).toBe(400)
    expect(json?.error).toBe('Parâmetros inválidos')
    // Deve conter detalhes/issues do Zod
    expect(Array.isArray(json?.detail)).toBe(true)
  })

  it('POST com body sem ids/range devolve 400 (Parâmetros inválidos: forneça ids ou range)', async () => {
    const body = {}
    const res = await fetch(FUNCTION_ENDPOINT!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8081' },
      body: JSON.stringify(body)
    })
    const json = await res.json().catch(() => ({}))
    expect(res.status).toBe(400)
    expect(json?.error).toBe('Parâmetros inválidos: forneça ids ou range')
  })
})

// Mensagem clara quando o endpoint não está configurado ou inacessível
if (!FUNCTION_ENDPOINT || !reachable) {
  console.warn('[integração/export-payslips] Endpoint não configurado ou não alcançável. Configure SUPABASE_URL em .env.local e garanta que o Supabase Functions está ativo.')
}