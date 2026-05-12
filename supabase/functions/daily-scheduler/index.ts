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

  // Step 3: Process expired account deletions (30-day cooling-off elapsed)
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/process-account-deletion`, {
      method: 'POST',
      headers: { ...rpcHeaders, 'Content-Type': 'application/json' },
      body: '{}',
    });
    results.account_deletions = res.ok ? await res.json() : { error: await res.text() };
  } catch (e) {
    results.account_deletions = { error: String(e) };
  }

  // Step 4: Queue notification emails based on user_preferences.notif_* typed columns
  // Actual email delivery is handled by Unit 16's email service. This step determines
  // recipients by reading the typed columns that replaced profiles.personal_settings JSONB.
  try {
    // Helper: fetch all users' notification preferences in one REST call
    const upRes = await fetch(
      `${supabaseUrl}/rest/v1/user_preferences?select=user_id,` +
        'notif_budget_80pct_email,notif_budget_100pct_email,' +
        'notif_goal_target_reached_email,notif_goal_deadline_near_email,' +
        'notif_recurring_needs_confirm_email,notif_recurring_posted_email,' +
        'notif_card_statement_ready_email,' +
        'notif_large_inbound_email,notif_large_outbound_email,' +
        'notif_family_invite_email,notif_family_audit_email,' +
        'notif_import_completed_email',
      { headers: rpcHeaders }
    );
    const allPrefs: Array<{
      user_id: string;
      notif_budget_80pct_email: boolean;
      notif_budget_100pct_email: boolean;
      notif_goal_target_reached_email: boolean;
      notif_goal_deadline_near_email: boolean;
      notif_recurring_needs_confirm_email: boolean;
      notif_recurring_posted_email: boolean;
      notif_card_statement_ready_email: boolean;
      notif_large_inbound_email: boolean;
      notif_large_outbound_email: boolean;
      notif_family_invite_email: boolean;
      notif_family_audit_email: boolean;
      notif_import_completed_email: boolean;
    }> = upRes.ok ? await upRes.json() : [];

    // Build per-event recipient lists (12 events × email channel)
    const recipients = {
      budget_80pct:            allPrefs.filter(p => p.notif_budget_80pct_email).map(p => p.user_id),
      budget_100pct:           allPrefs.filter(p => p.notif_budget_100pct_email).map(p => p.user_id),
      goal_target_reached:     allPrefs.filter(p => p.notif_goal_target_reached_email).map(p => p.user_id),
      goal_deadline_near:      allPrefs.filter(p => p.notif_goal_deadline_near_email).map(p => p.user_id),
      recurring_needs_confirm: allPrefs.filter(p => p.notif_recurring_needs_confirm_email).map(p => p.user_id),
      recurring_posted:        allPrefs.filter(p => p.notif_recurring_posted_email).map(p => p.user_id),
      card_statement_ready:    allPrefs.filter(p => p.notif_card_statement_ready_email).map(p => p.user_id),
      large_inbound:           allPrefs.filter(p => p.notif_large_inbound_email).map(p => p.user_id),
      large_outbound:          allPrefs.filter(p => p.notif_large_outbound_email).map(p => p.user_id),
      family_invite:           allPrefs.filter(p => p.notif_family_invite_email).map(p => p.user_id),
      family_audit:            allPrefs.filter(p => p.notif_family_audit_email).map(p => p.user_id),
      import_completed:        allPrefs.filter(p => p.notif_import_completed_email).map(p => p.user_id),
    };

    // TODO(Unit-16): cross-join each recipient list with today's relevant events
    // and call the email service (e.g. Resend) per user. For now, log candidate counts.
    console.log(JSON.stringify({ event: 'notification_email_candidates', recipients: Object.fromEntries(
      Object.entries(recipients).map(([k, v]) => [k, v.length])
    )}));

    results.notification_emails = { queued: Object.fromEntries(
      Object.entries(recipients).map(([k, v]) => [k, v.length])
    )};
  } catch (e) {
    results.notification_emails = { error: String(e) };
  }

  const finishedAt = new Date().toISOString();
  console.log(JSON.stringify({ event: 'daily-scheduler', startedAt, finishedAt, results }));

  return new Response(
    JSON.stringify({ ok: true, startedAt, finishedAt, results }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
