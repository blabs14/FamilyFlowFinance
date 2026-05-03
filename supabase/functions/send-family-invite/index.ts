// supabase/functions/send-family-invite/index.ts
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const APP_URL = Deno.env.get('APP_URL') ?? 'https://familyflow.app';

const ROLE_LABELS_PT: Record<string, string> = {
  owner: 'Owner', admin: 'Administrador', member: 'Membro', viewer: 'Visualizador',
};

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { family_id, email, role = 'member' } = body;

  if (!family_id || !email) {
    return new Response(JSON.stringify({ error: 'family_id and email required' }), { status: 400 });
  }

  // Verify caller is owner or admin
  const { data: membership } = await supabase
    .from('family_members')
    .select('role')
    .eq('family_id', family_id)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return new Response(JSON.stringify({ error: 'PERMISSION_DENIED' }), { status: 403 });
  }

  // Rate limit: max 10 invites/day per caller
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const { count: todayCount } = await supabase
    .from('family_invites')
    .select('id', { count: 'exact', head: true })
    .eq('invited_by', user.id)
    .gte('created_at', dayStart.toISOString());

  if ((todayCount ?? 0) >= 10) {
    return new Response(JSON.stringify({ error: 'RATE_LIMIT_DAY' }), { status: 429 });
  }

  // Rate limit: max 3 invites to same email in 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { count: emailCount } = await supabase
    .from('family_invites')
    .select('id', { count: 'exact', head: true })
    .eq('email', email.toLowerCase())
    .eq('family_id', family_id)
    .gte('created_at', thirtyDaysAgo);

  if ((emailCount ?? 0) >= 3) {
    return new Response(JSON.stringify({ error: 'RATE_LIMIT_EMAIL' }), { status: 429 });
  }

  // Fetch family + inviter name
  const [{ data: family }, { data: inviterProfile }] = await Promise.all([
    supabase.from('families').select('nome').eq('id', family_id).single(),
    supabase.from('profiles').select('nome').eq('user_id', user.id).single(),
  ]);

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  // Insert invite
  const { data: invite, error: inviteErr } = await supabase
    .from('family_invites')
    .insert({
      family_id,
      email: email.toLowerCase(),
      role,
      token,
      expires_at: expiresAt,
      invited_by: user.id,
      status: 'pending',
    })
    .select('id')
    .single();

  if (inviteErr) {
    return new Response(JSON.stringify({ error: inviteErr.message }), { status: 500 });
  }

  const inviteLink = `${APP_URL}/invite?token=${token}`;
  const familyName = family?.nome ?? 'Família';
  const inviterName = inviterProfile?.nome ?? user.email ?? 'Alguém';
  const rolePt = ROLE_LABELS_PT[role] ?? role;

  // Load PT template
  let html: string;
  try {
    const templatePath = new URL('./templates/invite_pt.html', import.meta.url);
    html = await Deno.readTextFile(templatePath);
  } catch {
    html = `<p>Clica <a href="${inviteLink}">aqui</a> para aceitares o convite para ${familyName}.</p>`;
  }
  html = html
    .replace(/\{\{FAMILY_NAME\}\}/g, familyName)
    .replace(/\{\{INVITER_NAME\}\}/g, inviterName)
    .replace(/\{\{ROLE_PT\}\}/g, rolePt)
    .replace(/\{\{INVITE_LINK\}\}/g, inviteLink);

  // Send via Resend (skip if no API key — dev environment)
  if (RESEND_API_KEY) {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FamilyFlow <noreply@familyflow.app>',
        to: [email],
        subject: `${inviterName} convidou-te para a família ${familyName}`,
        html,
      }),
    });
    if (!resendRes.ok) {
      console.error('Resend error:', await resendRes.text());
    }
  }

  return new Response(JSON.stringify({ invite_id: invite.id, link: inviteLink }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
