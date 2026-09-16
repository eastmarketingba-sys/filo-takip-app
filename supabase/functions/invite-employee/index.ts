// Bir kurumun admin'i, yeni bir çalışanı e-postayla davet eder.
// service_role anahtarı SADECE bu fonksiyonun içinde (sunucu tarafında) kullanılır -
// ne masaüstü uygulamasına ne de mobil PWA'ya asla gömülmez/gönderilmez.
//
// Deploy: supabase functions deploy invite-employee
// Çağıran (admin) kimliği, Authorization header'daki JWT'den doğrulanır; caller'ın
// kendi profiles satırındaki role='admin' olması şart, aksi halde 403 döner.
//
// İstek gövdesi: { "email": "...", "role": "admin"|"user", "displayName": "..." }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Çağıranı doğrulamak için: kendi JWT'siyle "authenticated" bir client.
    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData?.user) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    // Ayrıcalıklı işlemler (profiles okuma - RLS'i bypass ederek admin kontrolü,
    // auth.admin.inviteUserByEmail) için service_role client.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile, error: profileErr } = await adminClient
      .from('profiles')
      .select('org_id, role')
      .eq('id', callerData.user.id)
      .single();

    if (profileErr || !callerProfile) {
      return json({ ok: false, error: 'no_profile' }, 403);
    }
    if (callerProfile.role !== 'admin') {
      return json({ ok: false, error: 'forbidden' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const role = body.role === 'admin' ? 'admin' : 'user';
    const displayName = body.displayName ? String(body.displayName).trim() : null;

    if (!email || !email.includes('@')) {
      return json({ ok: false, error: 'invalid_email' }, 400);
    }

    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        org_id: callerProfile.org_id,
        role,
        display_name: displayName
      }
    });

    if (inviteErr) {
      return json({ ok: false, error: inviteErr.message || 'invite_failed' }, 400);
    }

    return json({ ok: true, userId: inviteData.user?.id });
  } catch (e) {
    return json({ ok: false, error: 'server_error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
