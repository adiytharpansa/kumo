'use client';

import { useEffect, useState } from 'react';
import { hasItem, toggleItem, LIST_EVENT } from '../lib/list';

const LIKES_KEY = 'kumonime_likes';

function readLikes() {
  try {
    const arr = JSON.parse(localStorage.getItem(LIKES_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

// Baris aksi halaman nonton sesuai desain: Suka / Simpan / Bagikan.
// - Suka & Simpan tersimpan lokal di perangkat (Simpan = Daftarku,
//   ikut tersinkron ke Supabase bila masuk).
// - Bagikan memakai Web Share API, cadangan salin tautan.
export default function WatchActions({ id, title, image }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState('');

  useEffect(() => {
    const syncSaved = () => setSaved(hasItem(id));
    setLiked(readLikes().includes(id));
    syncSaved();
    window.addEventListener(LIST_EVENT, syncSaved);
    window.addEventListener('storage', syncSaved);
    return () => {
      window.removeEventListener(LIST_EVENT, syncSaved);
      window.removeEventListener('storage', syncSaved);
    };
  }, [id]);

  function toggleLike() {
    const likes = readLikes();
    const i = likes.indexOf(id);
    if (i >= 0) likes.splice(i, 1);
    else likes.unshift(id);
    try {
      localStorage.setItem(LIKES_KEY, JSON.stringify(likes));
    } catch (e) {}
    setLiked(i < 0);
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: title || 'Kumo', url });
        return;
      }
      throw new Error('no-share');
    } catch (e) {
      try {
        await navigator.clipboard.writeText(url);
        setShared('Tautan tersalin');
        setTimeout(() => setShared(''), 2000);
      } catch (e2) {}
    }
  }

  return (
    <div className="act">
      <button type="button" onClick={toggleLike} className={liked ? 'on' : ''}>
        {liked ? '♥' : '♡'}
        <br />
        Suka
      </button>
      <button
        type="button"
        onClick={() => setSaved(toggleItem({ id, title, image }))}
        className={saved ? 'on' : ''}
      >
        ⚑<br />
        {saved ? 'Disimpan' : 'Simpan'}
      </button>
      <button type="button" onClick={share}>
        ⇪<br />
        {shared || 'Bagikan'}
      </button>
    </div>
  );
}
