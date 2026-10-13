-- Profil tampilan kumonime: nama + foto untuk lingkaran profil kanan atas.
--
-- Jalankan SEKALI di Supabase Dashboard > SQL Editor pada proyek "kumo".
-- Aman dijalankan ulang: semua pernyataan bersifat idempotent.
-- Kode aplikasi tetap tampil walau SQL ini belum dijalankan (memakai
-- metadata akun / inisial sebagai cadangan); SQL ini mengaktifkan
-- penyimpanan profil terpusat di tabel public.profiles.

-- 1) Tabel profil (sudah ada di proyek dari skema awal; dibuat bila belum).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  updated_at timestamptz not null default now()
);

-- 2) Kolom profil tampilan.
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists avatar_url text;

-- 3) Keamanan baris: setiap pengguna hanya boleh membaca/mengubah
--    profil miliknya sendiri.
alter table public.profiles enable row level security;

drop policy if exists "profiles milik sendiri" on public.profiles;
create policy "profiles milik sendiri" on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 4) Profil otomatis saat akun dibuat, termasuk nama/foto dari
--    metadata pendaftaran (mis. penyedia OAuth) bila tersedia.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles as prof (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(prof.display_name, excluded.display_name),
    avatar_url = coalesce(prof.avatar_url, excluded.avatar_url),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) Isi profil lama dari data auth.users yang sudah terdaftar.
insert into public.profiles as prof (id, email, display_name, avatar_url)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data ->> 'display_name',
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name'
  ),
  coalesce(
    u.raw_user_meta_data ->> 'avatar_url',
    u.raw_user_meta_data ->> 'picture'
  )
from auth.users u
on conflict (id) do update
set
  email = excluded.email,
  display_name = coalesce(prof.display_name, excluded.display_name),
  avatar_url = coalesce(prof.avatar_url, excluded.avatar_url),
  updated_at = now();

-- Selesai. avatar_url berisi URL foto publik (https://...);
-- unggah berkas foto langsung belum memakai Storage bucket.
