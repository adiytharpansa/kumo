'use client';

import { useEffect, useState } from 'react';
import { hasItem, toggleItem, LIST_EVENT } from '../lib/list';

// Tombol simpan "My List" di halaman detail. Bekerja lokal; otomatis
// tersinkron ke Supabase bila pengguna sedang masuk.
export default function SaveButton({ id, title, image }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(hasItem(id));
    sync();
    window.addEventListener(LIST_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(LIST_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [id]);

  return (
    <button
      type="button"
      onClick={() => setSaved(toggleItem({ id, title, image }))}
      className={`mt-4 rounded-lg px-4 py-2 text-sm font-semibold ring-1 transition ${
        saved
          ? 'bg-violet-600 text-white ring-violet-400/60'
          : 'bg-white/10 text-zinc-100 ring-white/15 hover:bg-white/15'
      }`}
    >
      {saved ? '✓ In My List' : '+ Add to My List'}
    </button>
  );
}
