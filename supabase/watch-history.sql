-- Tabel riwayat progres tontonan untuk sinkronisasi antarperangkat.
-- Jalankan SEKALI di Supabase Dashboard > SQL Editor (proyek "kumo").
-- Aplikasi tetap berjalan tanpa tabel ini (progres hanya lokal);
-- tabel ini mengaktifkan cermin awan watch_history.
create table if not exists public.watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  episode_id text not null,
  series_id text not null default '',
  title text not null default '',
  image text not null default '',
  progress_seconds integer not null default 0,
  duration_seconds integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, episode_id)
);

create index if not exists watch_history_user_updated_idx
  on public.watch_history (user_id, updated_at desc);

alter table public.watch_history enable row level security;

drop policy if exists "watch_history_select_own" on public.watch_history;
create policy "watch_history_select_own" on public.watch_history
  for select using (auth.uid() = user_id);

drop policy if exists "watch_history_insert_own" on public.watch_history;
create policy "watch_history_insert_own" on public.watch_history
  for insert with check (auth.uid() = user_id);

drop policy if exists "watch_history_update_own" on public.watch_history;
create policy "watch_history_update_own" on public.watch_history
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "watch_history_delete_own" on public.watch_history;
create policy "watch_history_delete_own" on public.watch_history
  for delete using (auth.uid() = user_id);
