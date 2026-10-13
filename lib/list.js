'use client';

import { supabase, isSupabaseConfigured } from './supabase';

// "My List" lokal-pertama (pola yang sama dengan aplikasi pengguna):
// - localStorage adalah sumber kebenaran di perangkat; fitur bekerja
//   penuh tanpa akun dan tanpa jaringan.
// - Bila pengguna masuk (Supabase Auth), daftar dicerminkan ke tabel
//   user_data proyek "kumo" dengan kunci 'kumonime_list' dan format
//   nilai { raw: '<json>' } — sama seperti baris data aplikasi lain,
//   terpisah rapi per kunci dan terlindungi RLS per pengguna.
export const LIST_KEY = 'kumonime_list';
const ROW_KEY = 'kumonime_list';
export const LIST_EVENT = 'kumonime-list-changed';

export function readList() {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => x && x.id) : [];
  } catch (e) {
    return [];
  }
}

export function writeList(list) {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(list));
  } catch (e) {}
  try {
    window.dispatchEvent(new Event(LIST_EVENT));
  } catch (e) {}
}

export function hasItem(id) {
  return readList().some((x) => x.id === id);
}

export function toggleItem(item) {
  const list = readList();
  const i = list.findIndex((x) => x.id === item.id);
  let saved;
  if (i >= 0) {
    list.splice(i, 1);
    saved = false;
  } else {
    list.unshift({ id: item.id, title: item.title || item.id, image: item.image || '' });
    saved = true;
  }
  writeList(list);
  // Dorong ke cloud di latar belakang bila sedang masuk.
  syncList().catch(() => {});
  return saved;
}

let syncing = false;

// Gabung lokal + cloud (union per id), simpan hasil gabungan ke
// keduanya. Mengembalikan { ok, reason? }.
export async function syncList() {
  if (!isSupabaseConfigured || !supabase || syncing) return { ok: false, reason: 'inactive/busy' };
  const { data } = await supabase.auth.getSession();
  const user = data && data.session ? data.session.user : null;
  if (!user) return { ok: false, reason: 'signed out' };
  syncing = true;
  try {
    const local = readList();
    const { data: rows, error } = await supabase
      .from('user_data')
      .select('value,updated_at')
      .eq('user_id', user.id)
      .eq('key', ROW_KEY);
    if (error) throw error;
    let remote = [];
    if (rows && rows[0] && rows[0].value && typeof rows[0].value.raw === 'string') {
      try {
        const parsed = JSON.parse(rows[0].value.raw);
        if (Array.isArray(parsed)) remote = parsed.filter((x) => x && x.id);
      } catch (e) {}
    }
    const byId = new Map();
    for (const x of remote) byId.set(x.id, x);
    for (const x of local) if (!byId.has(x.id)) byId.set(x.id, x);
    const merged = [...byId.values()];
    writeList(merged);
    const { error: upErr } = await supabase.from('user_data').upsert(
      {
        user_id: user.id,
        key: ROW_KEY,
        value: { raw: JSON.stringify(merged) },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' }
    );
    if (upErr) throw upErr;
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e) };
  } finally {
    syncing = false;
  }
}
