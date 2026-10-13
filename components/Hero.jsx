'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { hasItem, toggleItem, LIST_EVENT } from '../lib/list';

const titleOf = (item) =>
  typeof item?.title === 'string' ? item.title : item?.title?.english || item?.title?.romaji || '';

// Hero beranda sesuai berkas desain: poster layar penuh, judul
// besar di tengah bawah, lencana, meta, dan baris aksi
// Bagikan | ▶ Tonton | Daftarku. Berganti otomatis tiap 6 detik
// di antara judul tren teratas (data asli dari server).
export default function Hero({ items }) {
  const [hi, setHi] = useState(0);
  const [saved, setSaved] = useState(false);
  const list = (items || []).slice(0, 3);
  const a = list[hi];

  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setHi((v) => (v + 1) % list.length), 6000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  useEffect(() => {
    if (!a) return;
    const sync = () => setSaved(hasItem(a.id));
    sync();
    window.addEventListener(LIST_EVENT, sync);
    return () => window.removeEventListener(LIST_EVENT, sync);
  }, [a]);

  if (!a) return null;
  const title = titleOf(a);
  const year = (String(a.releaseDate || '').match(/\d{4}/) || [])[0];

  async function share() {
    const url = `${window.location.origin}/details/${encodeURIComponent(a.id)}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else await navigator.clipboard.writeText(url);
    } catch (e) {}
  }

  return (
    <>
      <section className="hero">
        {a.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.image} alt={title} />
        ) : null}
        <h1>{title}</h1>
        <div className="bgs">
          {a.type ? <span>{a.type}</span> : null}
          <span>Sedang Tren</span>
          {year ? <span>{year}</span> : null}
        </div>
        <div className="hmeta">
          <span>{[a.type, a.releaseDate].filter(Boolean).join(' · ') || 'Anime'}</span>
        </div>
        <div className="hact">
          <button type="button" className="ab" onClick={share} aria-label="Bagikan">
            <span className="abi">⇪</span>
            Bagikan
          </button>
          <Link href={`/details/${encodeURIComponent(a.id)}`} className="btn pri">
            ▶ Tonton
          </Link>
          <button
            type="button"
            className={saved ? 'ab on' : 'ab'}
            onClick={() => setSaved(toggleItem({ id: a.id, title, image: a.image }))}
            aria-label="Daftarku"
          >
            <span className="abi">{saved ? '♥' : '♡'}</span>
            Daftarku
          </button>
        </div>
      </section>
      {list.length > 1 ? (
        <div className="seg" aria-hidden>
          {list.map((_, i) => (
            <i key={i} className={i === hi ? 'on' : ''} />
          ))}
        </div>
      ) : null}
    </>
  );
}
