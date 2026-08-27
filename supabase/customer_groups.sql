-- Müşteri bazlı cihaz eşleştirme.
-- schema.sql, activate_code.sql ve multi_device_sync.sql ÇALIŞTIRILDIKTAN SONRA,
-- Supabase SQL Editor'e yapıştırıp çalıştırın.
--
-- SORUN: multi_device_sync.sql'deki eşleştirme, cihazları birebir AYNI aktivasyon
-- koduna göre grupluyordu. Ama her bilgisayar kendi ayrı kodunu kullanıyor (bir kod
-- = bir makine kilidi), yani aynı müşterinin 2 farklı bilgisayarı hiçbir zaman
-- "kardeş cihaz" olarak görünmüyordu — paylaş her zaman "kimseye ulaşmıyordu".
--
-- ÇÖZÜM: Her aktivasyon koduna bir customer_code (müşteri kodu) atanır. Aynı
-- customer_code'a sahip TÜM kodlar/cihazlar artık birbirini görüp veri
-- paylaşabilir/getirebilir — kod farklı olsa bile. Yeni bir kod aynı müşteriye
-- ait olacaksa mint-codes.js'e --customer <MUSTERI_KODU> vererek üretin, otomatik
-- olarak aynı gruba katılır.

alter table activation_codes add column if not exists customer_code text;
update activation_codes set customer_code = code where customer_code is null;

alter table activation_devices add column if not exists customer_code text;
alter table activation_snapshots add column if not exists customer_code text;

update activation_devices d set customer_code = coalesce(
  (select c.customer_code from activation_codes c where c.code = d.code), d.code
) where customer_code is null;

update activation_snapshots s set customer_code = coalesce(
  (select c.customer_code from activation_codes c where c.code = s.code), s.code
) where customer_code is null;

create index if not exists idx_activation_devices_customer on activation_devices(customer_code);
create index if not exists idx_activation_snapshots_customer on activation_snapshots(customer_code);

-- register_device: artık device_limit kontrolü ve kayıt customer_code grubuna göre.
create or replace function public.register_device(p_code text, p_machine_id text, p_label text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ccode text;
  device_count integer;
  cap integer;
  already_registered boolean;
begin
  if p_code is null or length(trim(p_code)) = 0
     or p_machine_id is null or length(trim(p_machine_id)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;

  select coalesce(customer_code, code) into ccode from activation_codes where code = p_code;
  if ccode is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select max(max_devices) into cap from activation_codes where coalesce(customer_code, code) = ccode;

  select exists(select 1 from activation_devices where customer_code = ccode and machine_id = p_machine_id) into already_registered;

  if not already_registered then
    select count(*) into device_count from activation_devices where customer_code = ccode;
    if device_count >= cap then
      return jsonb_build_object('ok', false, 'error', 'device_limit_reached');
    end if;
  end if;

  insert into activation_devices (code, customer_code, machine_id, device_label, last_seen)
    values (p_code, ccode, p_machine_id, p_label, now())
  on conflict (code, machine_id) do update
    set last_seen = now(),
        customer_code = excluded.customer_code,
        device_label = coalesce(excluded.device_label, activation_devices.device_label);

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.register_device(text, text, text) from public;
grant execute on function public.register_device(text, text, text) to anon;

-- list_sibling_devices: artık aynı customer_code grubundaki TÜM cihazları listeler
-- (kod farklı olsa bile), kendisi hariç.
create or replace function public.list_sibling_devices(p_code text, p_machine_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ccode text;
  caller_registered boolean;
  result jsonb;
begin
  select coalesce(customer_code, code) into ccode from activation_codes where code = p_code;
  if ccode is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select exists(select 1 from activation_devices where customer_code = ccode and machine_id = p_machine_id) into caller_registered;
  if not caller_registered then
    return jsonb_build_object('ok', false, 'error', 'not_registered');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'machineId', d.machine_id,
    'label', d.device_label,
    'lastSeen', d.last_seen,
    'hasSnapshot', exists(select 1 from activation_snapshots s where s.customer_code = ccode and s.machine_id = d.machine_id)
  ) order by d.last_seen desc), '[]'::jsonb)
  into result
  from activation_devices d
  where d.customer_code = ccode and d.machine_id <> p_machine_id;

  return jsonb_build_object('ok', true, 'devices', result);
end;
$$;
revoke all on function public.list_sibling_devices(text, text) from public;
grant execute on function public.list_sibling_devices(text, text) to anon;

-- push_snapshot: veriyi customer_code grubuna göre etiketler.
create or replace function public.push_snapshot(p_code text, p_machine_id text, p_data text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ccode text;
  caller_registered boolean;
begin
  select coalesce(customer_code, code) into ccode from activation_codes where code = p_code;
  if ccode is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select exists(select 1 from activation_devices where customer_code = ccode and machine_id = p_machine_id) into caller_registered;
  if not caller_registered then
    return jsonb_build_object('ok', false, 'error', 'not_registered');
  end if;

  insert into activation_snapshots (code, customer_code, machine_id, data, updated_at)
    values (p_code, ccode, p_machine_id, p_data, now())
  on conflict (code, machine_id) do update
    set data = excluded.data, updated_at = now(), customer_code = excluded.customer_code;

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.push_snapshot(text, text, text) from public;
grant execute on function public.push_snapshot(text, text, text) to anon;

-- pull_snapshot: kaynak cihazın snapshot'ını customer_code grubu içinde arar
-- (kaynak cihaz farklı bir kod kullanıyor olsa bile bulur).
create or replace function public.pull_snapshot(p_code text, p_machine_id text, p_source_machine_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ccode text;
  caller_registered boolean;
  snap_data text;
  snap_updated timestamptz;
begin
  select coalesce(customer_code, code) into ccode from activation_codes where code = p_code;
  if ccode is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select exists(select 1 from activation_devices where customer_code = ccode and machine_id = p_machine_id) into caller_registered;
  if not caller_registered then
    return jsonb_build_object('ok', false, 'error', 'not_registered');
  end if;

  select data, updated_at into snap_data, snap_updated
  from activation_snapshots
  where customer_code = ccode and machine_id = p_source_machine_id;

  if snap_data is null then
    return jsonb_build_object('ok', false, 'error', 'no_snapshot');
  end if;

  return jsonb_build_object('ok', true, 'data', snap_data, 'updatedAt', snap_updated);
end;
$$;
revoke all on function public.pull_snapshot(text, text, text) from public;
grant execute on function public.pull_snapshot(text, text, text) to anon;
