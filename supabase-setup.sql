-- Catatan Keuangan Indek: struktur database Supabase
-- Jalankan sekali di Supabase > SQL Editor > New query > tempel semua > Run.

create table if not exists public.tx (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.projects (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Indeks supaya sinkron tetap cepat walau datanya puluhan ribu baris
create index if not exists tx_user_updated on public.tx (user_id, updated_at);
create index if not exists projects_user_updated on public.projects (user_id, updated_at);

-- Waktu perubahan selalu diisi server, dipakai untuk sinkron bertahap
create or replace function public.indek_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists tx_touch on public.tx;
create trigger tx_touch before insert or update on public.tx for each row execute function public.indek_touch();
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before insert or update on public.projects for each row execute function public.indek_touch();

-- Keamanan: setiap akun hanya bisa membaca dan mengubah datanya sendiri
alter table public.tx enable row level security;
alter table public.projects enable row level security;

drop policy if exists "pemilik tx" on public.tx;
create policy "pemilik tx" on public.tx for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "pemilik projects" on public.projects;
create policy "pemilik projects" on public.projects for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Update otomatis antar perangkat (realtime)
do $$ begin
  alter publication supabase_realtime add table public.tx;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.projects;
exception when duplicate_object then null; end $$;
