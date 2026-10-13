'use client';

import { useEffect, useState } from 'react';

const KEY = 'kumonime_ratings';

// "Nilaimu" sesuai desain: nilai bintang pribadi tersimpan lokal
// di perangkat (bukan rating publik).
export default function RateStars({ id }) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem(KEY) || '{}');
      setVal(all[id] || 0);
    } catch (e) {}
  }, [id]);

  function rate(n) {
    const next = val === n ? 0 : n;
    setVal(next);
    try {
      const all = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (next) all[id] = next;
      else delete all[id];
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch (e) {}
  }

  return (
    <div className="rate">
      <span>Nilaimu</span>
      <div className="stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={n <= val ? 'on' : ''}
            onClick={() => rate(n)}
            aria-label={`${n} bintang`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
