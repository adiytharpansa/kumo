'use client';

import { useEffect } from 'react';
import { HISTORY_KEY } from './ContinueWatching';

// Mencatat tontonan ke riwayat lokal perangkat (maks 20, terbaru
// di depan) — sumber data "Lanjutkan menonton" & riwayat profil.
// Murni lokal; tidak dikirim ke mana pun.
export default function HistoryPing({ id, epId, ep, title, image }) {
  useEffect(() => {
    try {
      const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      const rest = (Array.isArray(arr) ? arr : []).filter((x) => x && x.id !== id);
      rest.unshift({ id, epId, ep, title, image, ts: Date.now() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(rest.slice(0, 20)));
    } catch (e) {}
  }, [id, epId, ep, title, image]);
  return null;
}
