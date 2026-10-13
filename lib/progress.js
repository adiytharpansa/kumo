'use client';

import { supabase, isSupabaseConfigured } from './supabase';

// Progres tontonan (resume) lokal-pertama:
// - localStorage 'kumonime_progress' adalah sumber kebenaran di
//   perangkat: { [episodeId]: { p, d, animeId, title, image, ep, ts } }.
// - Bila pengguna masuk, progres dicerminkan ke tabel Supabase
//   'watch_history' (lihat supabase/watch-history.sql) — upsert
//   dibatasi 1x per 20 detik per episode, semua kegagalan senyap
//   (tabel belum dibuat pun aplikasi tetap berjalan lokal).
export const PROGRESS_KEY = 'kumonime_progress';

export function readProgressMap() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch (e) {
    return {};
  }
}

export function getProgress(episodeId) {
  if (!episodeId) return null;
  const entry = readProgressMap()[episodeId];
  if (!entry || !entry.p) return null;
  return entry;
}

const lastCloudWrite = new Map();

export function saveProgress({ episodeId, animeId, title, image, ep, progress, duration }) {
  if (!episodeId || !Number.isFinite(progress)) return;
  const p = Math.max(0, Math.floor(progress));
  const d = Number.isFinite(duration) ? Math.floor(duration) : 0;

  try {
    const map = readProgressMap();
    map[episodeId] = { p, d, animeId: animeId || '', title: title || '', image: image || '', ep: ep || '', ts: Date.now() };
    // Batasi 60 entri terbaru agar penyimpanan tidak membengkak.
    const entries = Object.entries(map).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0)).slice(0, 60);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch (e) {}

  // Cermin awan (dibatasi laju, senyap bila gagal/belum masuk).
  const now = Date.now();
  if (now - (lastCloudWrite.get(episodeId) || 0) < 20000) return;
  lastCloudWrite.set(episodeId, now);
  syncProgressToCloud({ episodeId, animeId, title, image, p, d }).catch(() => {});
}

async function syncProgressToCloud({ episodeId, animeId, title, image, p, d }) {
  if (!isSupabaseConfigured || !supabase) return;
  const { data } = await supabase.auth.getSession();
  const user = data && data.session ? data.session.user : null;
  if (!user) return;
  await supabase.from('watch_history').upsert(
    {
      user_id: user.id,
      episode_id: episodeId,
      series_id: animeId || '',
      title: title || '',
      image: image || '',
      progress_seconds: p,
      duration_seconds: d,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,episode_id' }
  );
}
