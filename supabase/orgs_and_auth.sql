-- Kurumlar (şirketler), çalışan girişleri (Supabase Auth) ve bulut veri tabloları.
-- schema.sql, activate_code.sql, multi_device_sync.sql VE customer_groups.sql
-- ÇALIŞTIRILDIKTAN SONRA, Supabase SQL Editor'e yapıştırıp çalıştırın.
--
-- Bir "organization" (kurum) = bir customer_code grubu. customer_groups.sql zaten
-- aynı müşteriye ait birden fazla activation_code'u (birden fazla bilgisayar) tek bir
-- customer_code altında gruplamıştı — kurum sınırı olarak da onu kullanıyoruz, ayrı
-- bir "müşteri" kavramı icat etmiyoruz.
--
-- Bu dosyadan sonra cars/rentals verisi artık bulutta (bu tablolarda) tutulur ve
-- masaüstü uygulaması + mobil PWA aynı veriyi canlı olarak paylaşır. Yerel SQLite
-- (src/main/db.js) sadece geçiş dönemi için bir yedek/kaynak olarak kalır.

create extension if not exists pgcrypto;

/* ---------- organizations ---------- */

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  customer_code text unique not null,
  created_at timestamptz not null default now()
);

/* ---------- profiles (çalışanlar) ---------- */

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id),
  role text not null check (role in ('admin','user')),
  display_name text,
  email text,
  created_at timestamptz not null default now()
);

/* ---------- cars / rentals (bulut veri) ---------- */

create table if not exists cars (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null,
  plate text,
  photo text,
  avg_price numeric,
  note text,
  favorite boolean not null default false,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_cars_org on cars(org_id);
create index if not exists idx_cars_plate on cars(plate);

create table if not exists rentals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  car_id uuid not null references cars(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  price_per_day numeric not null,
  price_mode text not null default 'daily',
  price_total numeric,
  renter_name text,
  renter_phone text,
  renter_photo text,
  note text,
  destination text,
  delivered_at timestamptz,
  delivered_note text,
  returned_at timestamptz,
  returned_note text,
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rentals_org on rentals(org_id);
create index if not exists idx_rentals_car on rentals(car_id);
create index if not exists idx_rentals_dates on rentals(start_date, end_date);

/* ---------- yardımcı fonksiyonlar ----------
   RLS policy'lerinin doğrudan "select org_id from profiles where id = auth.uid()"
   yapması, profiles tablosunun kendi policy'siyle çakışıp özyinelemeye/performans
   sorununa yol açabilir (Supabase'in belgelerinde uyarılan bilinen bir durum).
   Bunun yerine security definer fonksiyon üzerinden okuyoruz. */

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from profiles where id = auth.uid()
$$;

create or replace function public.current_role_()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

revoke all on function public.current_org_id() from public;
grant execute on function public.current_org_id() to authenticated;
revoke all on function public.current_role_() from public;
grant execute on function public.current_role_() to authenticated;

/* ---------- RLS ---------- */

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table cars enable row level security;
alter table rentals enable row level security;

-- organizations: sadece kendi kurumunu görebilir, hiç yazamaz (yazma Edge Function/service_role işi).
create policy org_select on organizations
  for select to authenticated
  using (id = current_org_id());

-- profiles: kendi kurumundaki herkesi görebilir; sadece kendi display_name'ini
-- değiştirebilir (kolon bazlı grant, satır policy'si insert/delete/role değişimini
-- kapsamaz — bunlar Edge Function üzerinden yapılır).
create policy profiles_select on profiles
  for select to authenticated
  using (org_id = current_org_id());

create policy profiles_update_self on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on profiles from authenticated;
grant update (display_name) on profiles to authenticated;

-- cars: aynı kurumdaki herkes görebilir/ekleyebilir/güncelleyebilir; silme sadece admin.
create policy cars_select on cars
  for select to authenticated
  using (org_id = current_org_id());

create policy cars_insert on cars
  for insert to authenticated
  with check (org_id = current_org_id());

create policy cars_update on cars
  for update to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy cars_delete on cars
  for delete to authenticated
  using (org_id = current_org_id() and current_role_() = 'admin');

-- rentals: aynı kurumdaki herkes görebilir/ekleyebilir/güncelleyebilir/silebilir.
create policy rentals_select on rentals
  for select to authenticated
  using (org_id = current_org_id());

create policy rentals_insert on rentals
  for insert to authenticated
  with check (org_id = current_org_id());

create policy rentals_update on rentals
  for update to authenticated
  using (org_id = current_org_id())
  with check (org_id = current_org_id());

create policy rentals_delete on rentals
  for delete to authenticated
  using (org_id = current_org_id());

/* ---------- yeni çalışan kaydı: auth.users -> profiles ----------
   invite-employee Edge Function, auth.users satırını raw_user_meta_data içinde
   org_id/role/display_name ile oluşturur (bkz. supabase/functions/invite-employee).
   Bu trigger, o veriden otomatik olarak profiles satırını oluşturur. */

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, org_id, role, display_name, email)
  values (
    new.id,
    (new.raw_user_meta_data ->> 'org_id')::uuid,
    coalesce(new.raw_user_meta_data ->> 'role', 'user'),
    new.raw_user_meta_data ->> 'display_name',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
