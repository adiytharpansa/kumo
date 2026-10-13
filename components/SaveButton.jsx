'use client';

import { useEffect, useState } from 'react';
import { hasItem, toggleItem, LIST_EVENT } from '../lib/list';

// Tombol simpan Daftarku. Bekerja lokal (localStorage); otomatis
// tersinkron ke Supabase bila pengguna sedang masuk.
// Varian tampilan mengikuti berkas desain pengguna:
// - "follow": tombol sekunder lebar (Ikuti / Diikuti) di halaman detail.
// - "round": tombol bulat ⚑ di pojok hero detail.
// - default: pil kecil.
export default function SaveButton({ id, title, image, variant = 'default' }) {
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

  const onClick = () => setSaved(toggleItem({ id, title, image }));

  if (variant === 'round') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rb"
        aria-label="Simpan ke Daftarku"
        style={saved ? { color: 'var(--ac)' } : undefined}
      >
        {saved ? '✓' : '⚑'}
      </button>
    );
  }

  if (variant === 'follow') {
    return (
      <button type="button" onClick={onClick} className="kbtn g" style={{ flex: 1 }}>
        {saved ? '✓ Diikuti' : '⚑ Ikuti'}
      </button>
    );
  }

  return (
    <button type="button" onClick={onClick} className={saved ? 'kbtn' : 'kbtn g'}>
      {saved ? '✓ Di Daftarku' : '+ Daftarku'}
    </button>
  );
}
