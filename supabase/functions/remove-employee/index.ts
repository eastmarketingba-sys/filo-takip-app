// Bir kurumun admin'i, kendi kurumundan bir çalışanı kaldırır (auth.users'tan siler;
// profiles satırı "on delete cascade" ile otomatik silinir).
//
// Deploy: supabase functions deploy remove-employee
// Güvenlik: hem çağıranın hem de silinecek kullanıcının AYNI kurumda olduğu
// doğrulanır - bir kurumun admin'i başka bir kurumun çalışanını silemez.
//
// İstek gövdesi: { "userId": "..." }

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

    const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerData?.user) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile, error: profileErr } = await adminClient
      .from('profiles')
      .select('org_id, role')
      .eq('id', callerData.user.id)
      .single();

    if (profileErr || !callerProfile || callerProfile.role !== 'admin') {
      return json({ ok: false, error: 'forbidden' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || '').trim();
    if (!userId) {
      return json({ ok: false, error: 'invalid_input' }, 400);
    }
    if (userId === callerData.user.id) {
      return json({ ok: false, error: 'cannot_remove_self' }, 400);
    }

    const { data: targetProfile, error: targetErr } = await adminClient
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    if (targetErr || !targetProfile) {
      return json({ ok: false, error: 'not_found' }, 404);
    }
    if (targetProfile.org_id !== callerProfile.org_id) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }

    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteErr) {
      return json({ ok: false, error: deleteErr.message || 'delete_failed' }, 400);
    }

    return json({ ok: true });
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
