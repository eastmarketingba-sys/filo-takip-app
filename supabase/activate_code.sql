-- Uygulamanın çağırdığı tek RPC fonksiyonu.
-- schema.sql'den SONRA, Supabase SQL Editor'de çalıştırın.

create or replace function public.activate_code(p_code text, p_machine_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  rec activation_codes%rowtype;
begin
  if p_code is null or length(trim(p_code)) = 0
     or p_machine_id is null or length(trim(p_machine_id)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;

  select * into rec from activation_codes where code = p_code for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if rec.status = 'revoked' then
    return jsonb_build_object('ok', false, 'error', 'revoked');
  end if;

  if rec.status = 'activated' then
    if rec.machine_id = p_machine_id then
      return jsonb_build_object('ok', true, 'already', true);
    else
      return jsonb_build_object('ok', false, 'error', 'already_used');
    end if;
  end if;

  update activation_codes
    set status = 'activated', machine_id = p_machine_id, activated_at = now()
    where id = rec.id;

  return jsonb_build_object('ok', true, 'already', false);
end;
$$;

revoke all on function public.activate_code(text, text) from public;
grant execute on function public.activate_code(text, text) to anon;
