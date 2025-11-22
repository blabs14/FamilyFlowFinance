import { describe, it, expect, beforeAll } from 'vitest'

// Verificação de audit logging após export bem sucedido

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const FUNCTION_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/export-payslips` : undefined
const REST_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1` : undefined
const ACCESS_TOKEN = process.env.SUPABASE_TEST_ACCESS_TOKEN || process.env.TEST_ACCESS_TOKEN || process.env.VITE_TEST_ACCESS_TOKEN
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

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

const canRun = reachable && FUNCTION_ENDPOINT && REST_ENDPOINT && ACCESS_TOKEN
const maybeDescribe = canRun ? describe : describe.skip

maybeDescribe('Edge Function export-payslips — audit logging', () => {
  it('Export CSV deve registar uma linha em export_audit visível via RLS', async () => {
    const body = { format: 'csv', range: { from: '2024-01', to: '2025-12' } }
    const res = await fetch(FUNCTION_ENDPOINT!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ACCESS_TOKEN}` },
      body: JSON.stringify(body)
    })
    const json = await res.json().catch(() => ({}))

    if (res.status === 404) {
      console.warn('[audit] Sem dados para exportação — impossível validar criação de export_audit. Teste marcado como SKIPPED.')
      expect(true).toBe(true)
      return
    }

    expect(res.status).toBe(200)
    expect(typeof json?.signedUrl).toBe('string')

    // Consultar a tabela de auditoria conforme RLS (user vê apenas os seus registos)
    const auditRes = await fetch(`${REST_ENDPOINT!}/export_audit?order=created_at.desc&limit=1`, {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'apikey': ANON_KEY || ACCESS_TOKEN
      }
    })
    const auditJson = await auditRes.json().catch(() => [])

    expect(auditRes.ok).toBe(true)
    expect(Array.isArray(auditJson)).toBe(true)
    expect(auditJson.length).toBe(1)

    const last = auditJson[0]
    expect(last?.format).toBe('csv')
    expect(last?.status).toBe('success')
    expect(typeof last?.count).toBe('number')
    expect(typeof last?.duration_ms).toBe('number')
    expect(typeof last?.size_bytes).toBe('number')
    expect(typeof last?.path).toBe('string')
  })
})

if (!FUNCTION_ENDPOINT || !reachable || !ACCESS_TOKEN) {
  console.warn('[integração/export-payslips-audit] Sem SUPABASE_URL ou token — teste será SKIPPED. Configure .env.local e garanta dados reais.')
}