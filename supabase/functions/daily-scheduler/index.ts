// supabase/functions/daily-scheduler/index.ts
// Replaces: recurrents_run (Edge Function) + reminders-push-cron (pg_cron)
// Schedule: 03:00 UTC daily (≈ 03:00 Europe/Lisbon in winter)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') || authHeader;

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Missing SUPABASE_URL or SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const rpcHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  } as const;

  const results: Record<string, unknown> = {};
  const startedAt = new Date().toISOString();

  // Step 1: Run goal funding rules (allocate per goal_funding_rules)
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/run_funding_rules`, {
      method: 'POST',
      headers: rpcHeaders,
      body: '{}',
    });
    results.funding_rules = res.ok ? await res.json() : { error: await res.text() };
  } catch (e) {
    results.funding_rules = { error: String(e) };
  }

  // Step 2: Run recurring rules (generate instances + inbox_items for confirm-mode)
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/run_recurring_rules`, {
      method: 'POST',
      headers: rpcHeaders,
      body: JSON.stringify({ p_horizon_days: 7 }),
    });
    results.recurring_rules = res.ok ? await res.json() : { error: await res.text() };
  } catch (e) {
    results.recurring_rules = { error: String(e) };
  }

  // Future steps (Units 8, 15, 16):
  // Step 3: run_monthly_budget_rollover (day 1 of month)
  // Step 4: generate_threshold_reminders
  // Step 5: send_push_notifications

  const finishedAt = new Date().toISOString();
  console.log(JSON.stringify({ event: 'daily-scheduler', startedAt, finishedAt, results }));

  return new Response(
    JSON.stringify({ ok: true, startedAt, finishedAt, results }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
