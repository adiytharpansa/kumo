'use client';

import { useState } from 'react';

// Tombol bagikan sesuai desain: Web Share API bila tersedia,
// cadangan salin tautan ke papan klip.
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
        {done ? '✓' : '⇪'}
      </button>
    );
  }
  return (
    <button type="button" onClick={share} className="btn ol">
      ⇪ {done ? 'Tersalin' : 'Bagikan'}
    </button>
  );
}
