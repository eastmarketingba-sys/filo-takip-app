-- Filo Takip aktivasyon kodları tablosu
-- Supabase projenizde SQL Editor'e yapıştırıp çalıştırın.

create extension if not exists pgcrypto;

create table if not exists activation_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  status text not null default 'unused' check (status in ('unused','activated','revoked')),
  machine_id text,
  activated_at timestamptz,
  revoked_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

alter table activation_codes enable row level security;
-- Kasıtlı olarak hiç policy yok: RLS açıkken policy olmayınca anon/authenticated
-- rolleri için tüm SELECT/INSERT/UPDATE/DELETE varsayılan olarak reddedilir.
revoke all on activation_codes from anon, authenticated;
