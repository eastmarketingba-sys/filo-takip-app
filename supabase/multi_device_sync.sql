-- Çoklu cihaz eşleştirme desteği.
-- schema.sql ve activate_code.sql ÇALIŞTIRILDIKTAN SONRA, Supabase SQL Editor'e
-- yapıştırıp çalıştırın.
--
-- Bunu çalıştırdıktan sonra: bir aktivasyon kodu artık tek bir bilgisayara değil,
-- aynı anda en fazla max_devices (varsayılan 5) bilgisayara kayıtlı olabilir.
-- Her cihaz kendi verisini "paylaşabilir" (push_snapshot), başka bir cihazın
-- paylaştığı en son veriyi "çekebilir" (pull_snapshot) — bu tek seferlik bir
-- kopyalama işlemidir, sürekli senkronizasyon değildir.

alter table activation_codes add column if not exists max_devices integer not null default 5;

create table if not exists activation_devices (
  id uuid primary key default gen_random_uuid(),
  code text not null references activation_codes(code) on delete cascade,
  machine_id text not null,
  device_label text,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique(code, machine_id)
);
alter table activation_devices enable row level security;
revoke all on activation_devices from anon, authenticated;

create table if not exists activation_snapshots (
  code text not null references activation_codes(code) on delete cascade,
  machine_id text not null,
  data text not null,
  updated_at timestamptz not null default now(),
  primary key (code, machine_id)
);
alter table activation_snapshots enable row level security;
revoke all on activation_snapshots from anon, authenticated;

-- Cihazı bu kod altında kaydeder / son görülme zamanını günceller.
-- Aktivasyon sırasında ve her uygulama açılışında çağrılır (idempotent).
create or replace function public.register_device(p_code text, p_machine_id text, p_label text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  device_count integer;
  cap integer;
  already_registered boolean;
begin
  if p_code is null or length(trim(p_code)) = 0
     or p_machine_id is null or length(trim(p_machine_id)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;

  select max_devices into cap from activation_codes where code = p_code;
  if cap is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select exists(select 1 from activation_devices where code = p_code and machine_id = p_machine_id) into already_registered;

  if not already_registered then
    select count(*) into device_count from activation_devices where code = p_code;
    if device_count >= cap then
      return jsonb_build_object('ok', false, 'error', 'device_limit_reached');
    end if;
  end if;

  insert into activation_devices (code, machine_id, device_label, last_seen)
    values (p_code, p_machine_id, p_label, now())
  on conflict (code, machine_id) do update
    set last_seen = now(),
        device_label = coalesce(excluded.device_label, activation_devices.device_label);

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.register_device(text, text, text) from public;
grant execute on function public.register_device(text, text, text) to anon;

-- Aynı koda kayıtlı DİĞER cihazları listeler (kendisi hariç).
-- Çağıran cihazın o kod altında zaten kayıtlı olması şart.
create or replace function public.list_sibling_devices(p_code text, p_machine_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_registered boolean;
  result jsonb;
begin
  select exists(select 1 from activation_devices where code = p_code and machine_id = p_machine_id) into caller_registered;
  if not caller_registered then
    return jsonb_build_object('ok', false, 'error', 'not_registered');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'machineId', d.machine_id,
    'label', d.device_label,
    'lastSeen', d.last_seen,
    'hasSnapshot', exists(select 1 from activation_snapshots s where s.code = p_code and s.machine_id = d.machine_id)
  ) order by d.last_seen desc), '[]'::jsonb)
  into result
  from activation_devices d
  where d.code = p_code and d.machine_id <> p_machine_id;

  return jsonb_build_object('ok', true, 'devices', result);
end;
$$;
revoke all on function public.list_sibling_devices(text, text) from public;
grant execute on function public.list_sibling_devices(text, text) to anon;

-- Bu cihazın verisini (base64 .db dosyası) o kod altında paylaşır/günceller.
create or replace function public.push_snapshot(p_code text, p_machine_id text, p_data text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_registered boolean;
begin
  select exists(select 1 from activation_devices where code = p_code and machine_id = p_machine_id) into caller_registered;
  if not caller_registered then
    return jsonb_build_object('ok', false, 'error', 'not_registered');
  end if;

  insert into activation_snapshots (code, machine_id, data, updated_at)
    values (p_code, p_machine_id, p_data, now())
  on conflict (code, machine_id) do update set data = excluded.data, updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.push_snapshot(text, text, text) from public;
grant execute on function public.push_snapshot(text, text, text) to anon;

-- Başka bir cihazın en son paylaştığı veriyi indirir.
create or replace function public.pull_snapshot(p_code text, p_machine_id text, p_source_machine_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_registered boolean;
  snap_data text;
  snap_updated timestamptz;
begin
  select exists(select 1 from activation_devices where code = p_code and machine_id = p_machine_id) into caller_registered;
  if not caller_registered then
    return jsonb_build_object('ok', false, 'error', 'not_registered');
  end if;

  select data, updated_at into snap_data, snap_updated
  from activation_snapshots
  where code = p_code and machine_id = p_source_machine_id;

  if snap_data is null then
    return jsonb_build_object('ok', false, 'error', 'no_snapshot');
  end if;

  return jsonb_build_object('ok', true, 'data', snap_data, 'updatedAt', snap_updated);
end;
$$;
revoke all on function public.pull_snapshot(text, text, text) from public;
grant execute on function public.pull_snapshot(text, text, text) to anon;
