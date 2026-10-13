'use client';

import { useEffect, useState } from 'react';
import { hasItem, toggleItem, LIST_EVENT } from '../lib/list';

const Heart = ({ filled }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.5 3.3 5 6.8 5c2 0 3.6 1.1 5.2 3 1.6-1.9 3.2-3 5.2-3 3.5 0 5.6 3.5 4.3 6.8C19.5 16.4 12 21 12 21z" />
  </svg>
);

// Tombol Daftarku sesuai berkas desain: tombol garis tepi dengan
// ikon hati — "Daftarku" / "Di daftar". Bekerja lokal; otomatis
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
      className={saved ? 'btn ol on' : 'btn ol'}
    >
      <Heart filled={saved} />
      {saved ? 'Di daftar' : 'Daftarku'}
    </button>
  );
}
