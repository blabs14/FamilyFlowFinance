// supabase/functions/process-account-deletion/index.ts
declare const Deno: any;

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500 });
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  // 1. Find expired deletion tokens (cooling-off elapsed)
  const tokensRes = await fetch(
    `${supabaseUrl}/rest/v1/deletion_tokens?expires_at=lte.${new Date().toISOString()}&select=user_id,token`,
    { headers }
  );
  if (!tokensRes.ok) {
    const errText = await tokensRes.text();
    console.error(JSON.stringify({ event: 'process-account-deletion', error: 'failed to fetch deletion_tokens', detail: errText }));
    return new Response(JSON.stringify({ error: 'failed to fetch deletion_tokens', detail: errText }), { status: 500 });
  }
  const tokens: { user_id: string; token: string }[] = await tokensRes.json();

  const results: Record<string, string> = {};

  for (const { user_id, token } of tokens) {
    try {
      // 2. Delete auth user (cascades all data via ON DELETE CASCADE)
      const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user_id}`, {
        method: 'DELETE',
        headers,
      });

      if (deleteRes.ok || deleteRes.status === 404) {
        // 3. Remove the token (cleanup)
        await fetch(
          `${supabaseUrl}/rest/v1/deletion_tokens?token=eq.${encodeURIComponent(token)}`,
          { method: 'DELETE', headers }
        );
        // 4. Write to deletion_audit (audit trail — user_id preserved for compliance)
        const auditRes = await fetch(`${supabaseUrl}/rest/v1/deletion_audit`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ user_id, token, deleted_at: new Date().toISOString() }),
        });
        if (!auditRes.ok) {
          console.warn(JSON.stringify({ event: 'process-account-deletion', warning: 'audit write failed', user_id, status: auditRes.status }));
        }
        results[user_id] = 'deleted';
      } else {
        const errText = await deleteRes.text();
        // Write failed attempt to audit
        await fetch(`${supabaseUrl}/rest/v1/deletion_audit`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ user_id, token, error_detail: `${deleteRes.status}: ${errText}` }),
        });
        results[user_id] = `error:${deleteRes.status}`;
      }
    } catch (e) {
      // Write unexpected exceptions to deletion_audit too (no FK — user may still exist)
      try {
        await fetch(`${supabaseUrl}/rest/v1/deletion_audit`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ user_id, token, error_detail: `exception:${String(e)}` }),
        });
      } catch (_) { /* best-effort audit write */ }
      results[user_id] = `exception:${String(e)}`;
    }
  }

  console.log(JSON.stringify({ event: 'process-account-deletion', processed: tokens.length, results }));
  return new Response(JSON.stringify({ processed: tokens.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
