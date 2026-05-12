// supabase/functions/ingest_csv/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { detectFormat }         from './parsers/detect-format.ts';
import { detectBank }           from './parsers/detect-bank.ts';
import { parseCsvWithTemplate } from './parsers/csv-bank-template.ts';
import { parseCsvGeneric }      from './parsers/csv-generic.ts';
import { parseOfx }             from './parsers/ofx.ts';
import { runFuzzyDedup }        from './dedup/fuzzy-dedup.ts';
import { applyRules }           from './rules/apply-rules.ts';

declare const Deno: any;

const MAX_ROWS = 5000;

function corsHeaders(req: Request): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': req.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status = 200, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader  = req.headers.get('Authorization') || '';
  const restHeaders = { apikey: anonKey, Authorization: authHeader, 'Content-Type': 'application/json' };

  const body      = await req.json().catch(() => ({})) as Record<string, unknown>;
  const fileId    = body.file_id as string;
  const accountId = body.account_id as string;
  const manualMap = body.mapping as Record<string, string> | undefined;

  if (!fileId || !accountId) return json({ error: 'missing file_id or account_id' }, 400, req);

  try {
    // 1. Fetch file record
    const fileRes  = await fetch(`${supabaseUrl}/rest/v1/ingestion_files?id=eq.${fileId}&select=storage_bucket,storage_path`, { headers: restHeaders });
    const [fileRow] = await fileRes.json();
    if (!fileRow) return json({ error: 'file not found' }, 404, req);

    // 2. Download content from Storage
    const storagePath = fileRow.storage_path.startsWith('imports/')
      ? fileRow.storage_path
      : `imports/${fileRow.storage_path}`;
    const objUrl  = `${supabaseUrl}/storage/v1/object/${fileRow.storage_bucket}/${storagePath.split('/').map(encodeURIComponent).join('/')}`;
    const objRes  = await fetch(objUrl, { headers: { apikey: anonKey, Authorization: authHeader } });
    if (!objRes.ok) return json({ error: 'failed to download file' }, 500, req);
    const content = await objRes.text();

    const filename = fileRow.storage_path.split('/').pop() ?? '';

    // 3. Detect format
    const fmt = detectFormat(content, filename);
    if (fmt.format === 'unknown' && !manualMap) return json({ error: 'unknown format — provide manual mapping' }, 400, req);

    // 4. Parse
    let rawRows;
    let detectedBank: string | null = null;

    if (fmt.format === 'ofx') {
      rawRows = parseOfx(content);
    } else {
      const tplRes  = await fetch(`${supabaseUrl}/rest/v1/bank_templates?active=eq.true&select=*`, { headers: restHeaders });
      const templates = await tplRes.json();

      const headerLine = content.split(/\r?\n/)[0] ?? '';
      detectedBank = detectBank(headerLine, templates);

      if (detectedBank) {
        const tpl = templates.find((t: any) => t.bank_code === detectedBank);
        rawRows = parseCsvWithTemplate(content, tpl.mapping);
      } else if (manualMap) {
        rawRows = parseCsvGeneric(content, manualMap as any);
      } else {
        return json({ error: 'unrecognised bank — provide manual mapping', detected_format: 'csv' }, 400, req);
      }
    }

    // 5. Line cap
    if (rawRows.length > MAX_ROWS) {
      return json({ error: `Ficheiro demasiado grande (máx. ${MAX_ROWS} linhas). Suporte para ficheiros maiores em breve.` }, 422, req);
    }

    // 6. Fuzzy dedup (bulk RPC)
    const rpcFn = async (params: { p_account_id: string; p_rows: unknown[] }) => {
      const r = await fetch(`${supabaseUrl}/rest/v1/rpc/bulk_fuzzy_dedup`, {
        method: 'POST', headers: restHeaders,
        body: JSON.stringify(params),
      });
      return r.json();
    };
    const dedupedRows = await runFuzzyDedup(rawRows, accountId, rpcFn);

    // 7. Apply categorisation rules
    const rulesRes = await fetch(`${supabaseUrl}/rest/v1/import_categorization_rules?active=eq.true&order=priority.asc`, { headers: restHeaders });
    const rules    = await rulesRes.json();
    const ruledRows = applyRules(dedupedRows, rules);

    // 8. Upsert staging_transactions in batches of 100
    const BATCH = 100;
    let ok = 0, errors = 0, dups = 0, recurring = 0;

    for (let i = 0; i < ruledRows.length; i += BATCH) {
      const batch = ruledRows.slice(i, i + BATCH).map((r: any, j: number) => ({
        file_id: fileId,
        account_id: accountId,
        row_index: i + j + 1,
        date: r.date,
        amount_cents: r.amount_cents,
        description: r.description,
        raw_json: r.raw_json,
        row_status: r.row_status ?? 'ok',
        category_id: r.category_id ?? null,
        applied_rule_id: r.applied_rule_id ?? null,
        matched_recurring_instance_id: r.matched_recurring_instance_id ?? null,
      }));

      const ins = await fetch(`${supabaseUrl}/rest/v1/staging_transactions`, {
        method: 'POST',
        headers: { ...restHeaders, Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify(batch),
      });
      if (!ins.ok) {
        const msg = await ins.text();
        return json({ error: 'staging upsert failed', detail: msg }, 500, req);
      }

      for (const r of batch) {
        if (r.row_status === 'duplicate') dups++;
        else if (r.row_status === 'matches_recurring') recurring++;
        else if (r.row_status === 'error') errors++;
        else ok++;
      }
    }

    // 9. Update ingestion_files with stats + detected info
    await fetch(`${supabaseUrl}/rest/v1/ingestion_files?id=eq.${fileId}`, {
      method: 'PATCH',
      headers: restHeaders,
      body: JSON.stringify({
        detected_format: fmt.format,
        detected_bank: detectedBank,
        total_rows: ruledRows.length,
        ok_rows: ok,
        error_rows: errors,
        duplicate_rows: dups,
        matched_recurring_rows: recurring,
        status: 'ready',
      }),
    });

    return json({ ok: true, total: ruledRows.length, ok_rows: ok, duplicate_rows: dups, matched_recurring_rows: recurring, detected_bank: detectedBank }, 200, req);
  } catch (e) {
    return json({ error: String(e) }, 500, req);
  }
});
