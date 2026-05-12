// supabase/functions/export-user-data/index.ts
declare const Deno: any;

// JSZip via esm.sh
import JSZip from 'https://esm.sh/jszip@3.10.1';

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');
  const authHeader = req.headers.get('Authorization');

  if (!supabaseUrl || !serviceRoleKey || !authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized or missing env vars' }), { status: 401 });
  }

  // Identify calling user
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: serviceRoleKey },
  });
  if (!userRes.ok) return new Response(JSON.stringify({ error: 'Could not identify user' }), { status: 401 });
  const { id: userId } = await userRes.json();

  const svcHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  // Rate limit: 1 export per 7 days
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const auditRes = await fetch(
    `${supabaseUrl}/rest/v1/export_audit?user_id=eq.${userId}&created_at=gte.${cutoff}&select=id`,
    { headers: svcHeaders }
  );
  const recent: unknown[] = auditRes.ok ? await auditRes.json() : [];
  if (recent.length > 0) {
    return new Response(JSON.stringify({ error: 'Rate limit: 1 export per 7 days' }), { status: 429 });
  }

  // Fetch user data tables
  const tables = ['transactions', 'accounts', 'goals', 'categories', 'budgets', 'recurring_rules'];
  const zip = new JSZip();

  for (const table of tables) {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/${table}?user_id=eq.${userId}&select=*`,
      { headers: svcHeaders }
    );
    const rows: Record<string, unknown>[] = res.ok ? await res.json() : [];
    if (rows.length === 0) { zip.file(`${table}.csv`, ''); continue; }
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
    ].join('\n');
    zip.file(`${table}.csv`, csv);
  }

  const zipBlob = await zip.generateAsync({ type: 'uint8array' });
  const zipPath = `exports/${userId}/${Date.now()}.zip`;

  // Upload to exports bucket
  const uploadRes = await fetch(
    `${supabaseUrl}/storage/v1/object/${zipPath}`,
    {
      method: 'POST',
      headers: { ...svcHeaders, 'Content-Type': 'application/zip' },
      body: zipBlob,
    }
  );

  if (!uploadRes.ok) {
    return new Response(JSON.stringify({ error: 'Upload failed' }), { status: 500 });
  }

  // Record in export_audit
  await fetch(`${supabaseUrl}/rest/v1/export_audit`, {
    method: 'POST',
    headers: svcHeaders,
    body: JSON.stringify({ user_id: userId, file_path: zipPath }),
  });

  // Generate signed URL (1 hour validity)
  const signRes = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/${zipPath}`,
    {
      method: 'POST',
      headers: svcHeaders,
      body: JSON.stringify({ expiresIn: 3600 }),
    }
  );
  const { signedURL } = signRes.ok ? await signRes.json() : { signedURL: null };

  return new Response(
    JSON.stringify({ message: 'Export ready', download_url: signedURL ? `${supabaseUrl}/storage/v1${signedURL}` : null }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
