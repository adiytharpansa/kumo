import { supabase } from './supabase';

// Helper profil tampilan: sumber utama tabel public.profiles
// (kolom display_name + avatar_url dari supabase/profiles-avatar.sql),
// cadangan dari metadata akun auth (avatar_url/picture/name).
// Semua kegagalan dibiarkan senyap agar bar atas & halaman akun
// tetap tampil dengan inisial walau SQL profil belum dijalankan.
export async function fetchOwnProfile(user) {
  if (!supabase || !user || !user.id) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    if (error) return null;
    return data || null;
  } catch (e) {
    return null;
  }
}

export function profilePhoto(user, profile) {
  const meta = (user && user.user_metadata) || {};
  const candidates = [profile && profile.avatar_url, meta.avatar_url, meta.picture];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

export function profileDisplayName(user, profile) {
  const meta = (user && user.user_metadata) || {};
  const candidates = [
    profile && profile.display_name,
    meta.display_name,
    meta.full_name,
    meta.name,
    user && user.email,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return 'Penonton';
}

export function profileInitial(user, profile) {
  const name = profileDisplayName(user, profile);
  const first = name.trim().charAt(0);
  return first ? first.toUpperCase() : 'P';
}
