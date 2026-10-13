'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

// Tombol bagikan: Web Share API bila tersedia, cadangan salin
// tautan ke papan klip. Ikon memakai Lucide Share2.
export default function ShareButton({ title, square = false }) {
  const [done, setDone] = useState(false);

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
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      } catch (e2) {}
    }
  }

  if (square) {
    return (
      <button type="button" onClick={share} className="btn ol sq" aria-label="Bagikan">
        {done ? <Check size={18} /> : <Share2 size={18} />}
      </button>
    );
  }
  return (
    <button type="button" onClick={share} className="btn ol" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      {done ? <Check size={16} /> : <Share2 size={16} />}
      {done ? 'Tersalin' : 'Bagikan'}
    </button>
  );
}
