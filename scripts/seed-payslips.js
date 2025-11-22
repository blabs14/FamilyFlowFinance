// Seed de dados mínimos para testes de exportação de payslips
// Uso: node scripts/seed-payslips.js
// Requer envs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_TEST_ACCESS_TOKEN
// Opcional: SUPABASE_ANON_KEY, SUPABASE_TEST_TENANT_ID

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const userToken = process.env.SUPABASE_TEST_ACCESS_TOKEN
const anonKey = process.env.SUPABASE_ANON_KEY || serviceKey
const tenantId = process.env.SUPABASE_TEST_TENANT_ID || null

if (!url || !serviceKey || !userToken) {
  console.error('[seed] Faltam SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_TEST_ACCESS_TOKEN no ambiente')
  process.exit(1)
}

async function getUser() {
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${userToken}`, apikey: anonKey }
  })
  if (!res.ok) throw new Error(`[seed] Falha a obter utilizador: ${res.status}`)
  return res.json()
}

async function insertPeriod(month, year) {
  const body = { month, year }
  if (tenantId) body.tenant_id = tenantId
  const res = await fetch(`${url}/rest/v1/payroll_periods`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': anonKey,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`[seed] Falha a criar período: ${res.status}`)
  const arr = await res.json()
  const row = Array.isArray(arr) ? arr[0] : arr
  return row?.id
}

async function insertPayslip(userId, periodId) {
  const body = {
    user_id: userId,
    period_id: periodId,
    gross_cents: 250000,
    net_cents: 180000,
    irs_deduction_cents: 40000,
    ss_deduction_cents: 30000,
    meal_allowance_cents: 8000,
    other_allowances_cents: 5000,
    other_deductions_cents: 3000
  }
  if (tenantId) body.tenant_id = tenantId
  const res = await fetch(`${url}/rest/v1/payroll_payslips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': anonKey,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`[seed] Falha a criar payslip: ${res.status}`)
  const arr = await res.json()
  const row = Array.isArray(arr) ? arr[0] : arr
  return row?.id
}

(async () => {
  try {
    const user = await getUser()
    const userId = user?.id
    if (!userId) throw new Error('[seed] User ID não encontrado no token de teste')

    const now = new Date()
    const periodId = await insertPeriod(now.getMonth() + 1, now.getFullYear())
    const payslipId = await insertPayslip(userId, periodId)

    console.log('[seed] Concluído:', { userId, periodId, payslipId })
  } catch (e) {
    console.error('[seed] Erro:', e)
    process.exit(1)
  }
})()