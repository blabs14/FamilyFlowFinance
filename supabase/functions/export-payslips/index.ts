import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Edge Function: export-payslips
// Gera CSV ou PDF de recibos de vencimento do utilizador autenticado,
// faz upload para o bucket privado "exports" e devolve signed URL.

// Notas de segurança:
// - RLS nas tabelas de payroll garante acesso apenas aos próprios dados.
// - Rate limit simples baseado em export_audit (máx 10/hora/utilizador).
// - Upload a Storage com service role; leitura via signed URL.

declare const Deno: any;

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  } as Record<string,string>;
}

function toEuros(cents: number | null | undefined): number {
  const c = typeof cents === 'number' ? cents : 0;
  return Math.round(c) / 100;
}

function safeText(s: unknown): string { return String(s ?? '').slice(0, 2000); }

function formatCsvRow(row: Record<string, unknown>, delimiter = ','): string {
  const vals = Object.values(row).map(v => {
    const t = safeText(v);
    if (t.includes(delimiter) || /\"|\n|\r/.test(t)) {
      return '"' + t.replace(/\"/g, '""') + '"';
    }
    return t;
  });
  return vals.join(delimiter);
}

async function getProjectUrl(): Promise<string | undefined> {
  const projectRef = Deno.env.get('SUPABASE_PROJECT_REF');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || (projectRef ? `https://${projectRef}.supabase.co` : undefined);
  return supabaseUrl;
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const txt = await res.text();
  try {
    const parsed = txt.length ? JSON.parse(txt) : null;
    return { ok: res.ok, status: res.status, data: parsed, text: txt };
  } catch {
    return { ok: res.ok, status: res.status, data: null, text: txt };
  }
}

function nowIso(): string { return new Date().toISOString(); }

function clampCount<T>(arr: T[], max: number): T[] { return arr.slice(0, Math.max(0, max)); }

// PDF básico via pdf-lib (npm). Mantém dependência pequena e compatível com Deno.
async function generateSimplePDF(title: string, rows: Array<Record<string, unknown>>): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await import('npm:pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const marginLeft = 40;
  let y = 800;

  page.drawText(title, { x: marginLeft, y, size: 16, font: fontBold });
  y -= 24;
  const genAt = `Gerado em: ${new Date().toLocaleString('pt-PT')}`;
  page.drawText(genAt, { x: marginLeft, y, size: 10, font });
  y -= 20;

  // Cabeçalho
  const header = ['Período','Bruto','Líquido','IRS','SS'];
  const colX = [marginLeft, 220, 320, 420, 480];
  page.drawText(header[0], { x: colX[0], y, size: 11, font: fontBold });
  page.drawText(header[1], { x: colX[1], y, size: 11, font: fontBold });
  page.drawText(header[2], { x: colX[2], y, size: 11, font: fontBold });
  page.drawText(header[3], { x: colX[3], y, size: 11, font: fontBold });
  page.drawText(header[4], { x: colX[4], y, size: 11, font: fontBold });
  y -= 14;

  // Linhas
  for (const r of rows) {
    if (y < 60) {
      // nova página
      const p2 = pdfDoc.addPage([595.28, 841.89]);
      y = 800; // reset
      p2.drawText(title, { x: marginLeft, y, size: 16, font: fontBold });
      y -= 24;
      p2.drawText(genAt, { x: marginLeft, y, size: 10, font });
      y -= 20;
      // cabeçalho
      p2.drawText(header[0], { x: colX[0], y, size: 11, font: fontBold });
      p2.drawText(header[1], { x: colX[1], y, size: 11, font: fontBold });
      p2.drawText(header[2], { x: colX[2], y, size: 11, font: fontBold });
      p2.drawText(header[3], { x: colX[3], y, size: 11, font: fontBold });
      p2.drawText(header[4], { x: colX[4], y, size: 11, font: fontBold });
      y -= 14;
      // desenhar linha na nova página
      p2.drawText(String(r['period']), { x: colX[0], y, size: 11, font });
      p2.drawText(String(r['gross_eur']), { x: colX[1], y, size: 11, font });
      p2.drawText(String(r['net_eur']), { x: colX[2], y, size: 11, font });
      p2.drawText(String(r['irs_eur']), { x: colX[3], y, size: 11, font });
      p2.drawText(String(r['ss_eur']), { x: colX[4], y, size: 11, font });
      y -= 12;
      continue;
    }
    page.drawText(String(r['period']), { x: colX[0], y, size: 11, font });
    page.drawText(String(r['gross_eur']), { x: colX[1], y, size: 11, font });
    page.drawText(String(r['net_eur']), { x: colX[2], y, size: 11, font });
    page.drawText(String(r['irs_eur']), { x: colX[3], y, size: 11, font });
    page.drawText(String(r['ss_eur']), { x: colX[4], y, size: 11, font });
    y -= 12;
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

function monthYearStr(rng?: { from?: string; to?: string }, rowsCount?: number) {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '').replace('T','').slice(0,15) + 'Z';
  const from = rng?.from || '';
  const to = rng?.to || '';
  const base = (from && to) ? `${from}_${to}` : (from || to || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  return `${base}_${rowsCount ?? 0}_${ts}`;
}

import { z } from 'npm:zod';

// Esquema de validação do input
const exportInputSchema = z.object({
  format: z.enum(['csv','pdf']).optional(),
  ids: z.array(z.string()).max(500).optional(),
  range: z.object({ from: z.string().min(1), to: z.string().min(1) }).partial().optional(),
});

// Removido: função inputSchema incorreta. Utilizamos exportInputSchema (zod) e corsHeaders para CORS.

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { ...corsHeaders(req) } });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } });
  }

  const startedAt = Date.now();
  const requestId = (globalThis.crypto?.randomUUID?.() ?? `req_${startedAt}`);
  console.info(JSON.stringify({ event: 'export_start', requestId, startedAt }));

  try {
    const supabaseUrl = await getProjectUrl();
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization') || '';
    if (!supabaseUrl || !anonKey) {
      console.error(JSON.stringify({ event: 'config_missing', requestId }));
      return new Response(JSON.stringify({ error: 'Configuração Supabase em falta', requestId }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } });
    }

    const bodyJson = await req.json().catch(()=>({}));
    const parsed = exportInputSchema.safeParse(bodyJson);
    if (!parsed.success) {
      console.warn(JSON.stringify({ event: 'input_invalid', requestId, issues: parsed.error.issues }));
      return new Response(JSON.stringify({ error: 'Parâmetros inválidos', detail: parsed.error.issues, requestId }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } });
    }
    const body = parsed.data;
    const format = (body?.format === 'pdf') ? 'pdf' : 'csv';
    const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === 'string').slice(0, 500) : [];
    const range = body?.range && typeof body.range === 'object' ? { from: body.range.from, to: body.range.to } : undefined;

    if (!ids.length && !range) {
      console.warn(JSON.stringify({ event: 'input_missing_ids_or_range', requestId }));
      return new Response(JSON.stringify({ error: 'Parâmetros inválidos: forneça ids ou range', requestId }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } });
    }

    // Obter utilizador
    const userRes = await fetchJson(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'apikey': anonKey, 'Authorization': authHeader }
    });
    if (!userRes.ok || !userRes.data?.id) {
      console.warn(JSON.stringify({ event: 'auth_failed', requestId, status: userRes.status }));
      return new Response(JSON.stringify({ error: 'Não autenticado', detail: userRes.text || userRes.data, requestId }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } });
    }
    const userId = String(userRes.data.id);
    console.info(JSON.stringify({ event: 'auth_ok', requestId, userId }));

    // Rate limit: 10/hora
    const sinceIso = new Date(Date.now() - 60*60*1000).toISOString();
    const rlRes = await fetchJson(`${supabaseUrl}/rest/v1/export_audit?user_id=eq.${userId}&created_at=gte.${sinceIso}&select=id`, {
      headers: { 'apikey': anonKey, 'Authorization': authHeader }
    });
    if (!rlRes.ok) {
      console.warn(JSON.stringify({ event: 'rate_limit_check_failed', requestId, status: rlRes.status }));
    } else {
      const cnt = Array.isArray(rlRes.data) ? rlRes.data.length : 0;
      console.info(JSON.stringify({ event: 'rate_limit_checked', requestId, count: cnt }));
      if (cnt >= 10) {
        return new Response(JSON.stringify({ error: 'Demasiados pedidos de exportação na última hora', requestId }), { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } });
      }
    }

    // Buscar payslips com RLS
    let query = `${supabaseUrl}/rest/v1/payroll_payslips?select=id,period_id,gross_cents,net_cents,irs_deduction_cents,ss_deduction_cents,meal_allowance_cents,other_allowances_cents,other_deductions_cents,period:payroll_periods(month,year)&order=period_id.asc`;
    if (ids.length) {
      const list = ids.map((x: string) => x).join(',');
      query += `&id=in.(${list})`;
    }
    const slipsRes = await fetchJson(query, { headers: { 'apikey': anonKey, 'Authorization': authHeader } });
    if (!slipsRes.ok) {
      console.error(JSON.stringify({ event: 'slips_fetch_failed', requestId, status: slipsRes.status }));
      return new Response(JSON.stringify({ error: 'Falha ao obter payslips', status: slipsRes.status, detail: slipsRes.text, requestId }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } });
    }
    const rows = Array.isArray(slipsRes.data) ? slipsRes.data : [];
    const limitedRows = clampCount(rows, 500);
    if (limitedRows.length === 0) {
      console.warn(JSON.stringify({ event: 'no_rows', requestId }));
      return new Response(JSON.stringify({ error: 'Nenhum payslip encontrado para exportação', requestId }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } });
    }

    // Normalizar para CSV/PDF
    const normalized = limitedRows.map((r: any) => {
      const period = r?.period ? `${String(r.period.year).padStart(4,'0')}-${String(r.period.month).padStart(2,'0')}` : '----';
      const gross_eur = toEuros(r?.gross_cents).toFixed(2);
      const net_eur = toEuros(r?.net_cents).toFixed(2);
      const irs_eur = toEuros(r?.irs_deduction_cents).toFixed(2);
      const ss_eur = toEuros(r?.ss_deduction_cents).toFixed(2);
      const meal_eur = toEuros(r?.meal_allowance_cents).toFixed(2);
      const other_allowances_eur = toEuros(r?.other_allowances_cents).toFixed(2);
      const other_deductions_eur = toEuros(r?.other_deductions_cents).toFixed(2);
      return {
        id: r.id,
        period,
        gross_eur,
        net_eur,
        irs_eur,
        ss_eur,
        meal_eur,
        other_allowances_eur,
        other_deductions_eur,
      } as Record<string, unknown>;
    });
    console.info(JSON.stringify({ event: 'rows_normalized', requestId, rows: normalized.length }));

    const baseName = monthYearStr(range, normalized.length);
    const fileBase = `payslips_${baseName}`;
    const ext = format === 'pdf' ? 'pdf' : 'csv';
    const path = `exports/payroll/${userId}/${fileBase}.${ext}`;

    let bytes: Uint8Array;
    let mime = 'text/csv';

    if (format === 'csv') {
      const header = Object.keys(normalized[0]);
      const lines = [formatCsvRow(header.reduce((acc:Record<string,unknown>,k)=>{acc[k]=k;return acc;}, {}))];
      for (const row of normalized) {
        lines.push(formatCsvRow(row));
      }
      const content = lines.join('\n');
      bytes = new TextEncoder().encode(content);
      mime = 'text/csv';
    } else {
      bytes = await generateSimplePDF('Recibos de Vencimento', normalized);
      mime = 'application/pdf';
    }

    const sizeBytes = bytes.byteLength;

    // Upload para Storage com service role
    if (!serviceKey) {
      console.error(JSON.stringify({ event: 'service_key_missing', requestId }));
      return new Response(JSON.stringify({ error: 'Service role key em falta para upload', requestId }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } });
    }

    const upRes = await fetch(`${supabaseUrl}/storage/v1/object/${path}`, {
      method: 'PUT',
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': mime },
      body: bytes
    });
    if (!upRes.ok) {
      const detail = await upRes.text().catch(()=>String(upRes.status));
      console.error(JSON.stringify({ event: 'upload_failed', requestId, status: upRes.status }));
      return new Response(JSON.stringify({ error: 'Falha no upload para Storage', status: upRes.status, detail, requestId }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } });
    }
    console.info(JSON.stringify({ event: 'upload_ok', requestId, path, sizeBytes, mime }));

    // TTL configurável, default 600s (10min)
    const ttlDefault = 600;
    const ttlEnv = Number(Deno.env.get('SIGNED_URL_TTL_SECONDS') || ttlDefault);
    const ttlSec = Number.isFinite(ttlEnv) ? Math.max(60, Math.min(3600, ttlEnv)) : ttlDefault;

    const signRes = await fetchJson(`${supabaseUrl}/storage/v1/object/sign/${path}`, {
      method: 'POST',
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: ttlSec })
    });
    if (!signRes.ok) {
      console.error(JSON.stringify({ event: 'sign_failed', requestId, status: signRes.status }));
      return new Response(JSON.stringify({ error: 'Falha ao criar signed URL', status: signRes.status, detail: signRes.text, requestId }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } });
    }
    const signedUrl = signRes.data?.signedURL || signRes.data?.signedUrl || signRes.data?.url || null;
    console.info(JSON.stringify({ event: 'sign_ok', requestId, expiresIn: ttlSec }));

    // Auditoria (com token do utilizador para respeitar RLS)
    const durationMs = Date.now() - startedAt;
    const auditBody = {
      user_id: userId,
      format,
      count: normalized.length,
      filters: { ids, range },
      duration_ms: durationMs,
      size_bytes: sizeBytes,
      status: 'success',
      file_path: path
    };
    const auditRes = await fetchJson(`${supabaseUrl}/rest/v1/export_audit`, {
      method: 'POST',
      headers: { 'apikey': anonKey, 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(auditBody)
    });
    if (!auditRes.ok) {
      console.warn(JSON.stringify({ event: 'audit_insert_failed', requestId, status: auditRes.status }));
    } else {
      console.info(JSON.stringify({ event: 'audit_ok', requestId }));
    }

    return new Response(JSON.stringify({ success: true, format, count: normalized.length, path, signedUrl, requestId, duration_ms: durationMs, size_bytes: sizeBytes }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(req) }
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    console.error(JSON.stringify({ event: 'export_error', requestId, error: msg }));
    return new Response(JSON.stringify({ error: 'Erro interno', detail: msg, requestId }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(req) } });
  }
});