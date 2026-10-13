'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readProgressMap } from '../lib/progress';

export const HISTORY_KEY = 'kumonime_history';

export function readHistory() {
  try {
    const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(arr) ? arr.filter((x) => x && x.id && x.epId) : [];
  } catch (e) {
    return [];
  }
}

// Seksi "Lanjutkan menonton" di beranda sesuai desain: kartu
// 16:9 dari riwayat tontonan ASLI perangkat ini (dicatat saat
// membuka halaman nonton). Kosong = seksi tidak tampil.
export default function ContinueWatching() {
  const [items, setItems] = useState([]);
  const [progress, setProgress] = useState({});

  useEffect(() => {
    setItems(readHistory());
    setProgress(readProgressMap());
  }, []);

  if (!items.length) return null;

  return (
    <section>
      <h2 className="sec">Lanjutkan menonton</h2>
      <div className="sc">
        {items.map((h) => (
          <div className="cw" key={h.id}>
            <Link href={`/watch/${encodeURIComponent(h.epId)}`} className="th">
              {h.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={h.image} alt={h.title} loading="lazy" />
              ) : null}
              <span className="ply">▶</span>
              {progress[h.epId] && progress[h.epId].d > 0 ? (
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: 0,
                    height: 4,
                    width: `${Math.min(100, Math.round((progress[h.epId].p / progress[h.epId].d) * 100))}%`,
                    background: 'var(--gr)',
                  }}
                />
              ) : null}
            </Link>
            <div className="t">{h.title}</div>
            <small>Episode {h.ep}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
