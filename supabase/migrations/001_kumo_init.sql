-- Sudah diterapkan ke proyek "kumo". Disimpan di sini sebagai dokumentasi / untuk proyek baru.
create table public.sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint sync_state_size check (pg_column_size(data) < 400000)
);
alter table public.sync_state enable row level security;
create policy "sync_select_own" on public.sync_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "sync_insert_own" on public.sync_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "sync_update_own" on public.sync_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "sync_delete_own" on public.sync_state for delete to authenticated using ((select auth.uid()) = user_id);

create table public.episodes (
  anime_id integer not null,
  number integer not null check (number between 1 and 5000),
  title text,
  url text not null check (url ~ '^https?://' and length(url) <= 2000),
  created_at timestamptz not null default now(),
  primary key (anime_id, number)
);
alter table public.episodes enable row level security;
-- Hanya pengguna yang sudah login yang boleh membaca link video.
create policy "episodes_authenticated_read" on public.episodes for select to authenticated using (true);
