'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Play, Plus, Check, Star, Share2, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { hasItem, toggleItem, LIST_EVENT } from '../lib/list';

const titleOf = (item) =>
  typeof item?.title === 'string' ? item.title : item?.title?.english || item?.title?.romaji || '';

// Hero / Featured Anime ala OTT (Netflix/Crunchyroll):
// - Slideshow otomatis 5 detik dari data tren server, jeda saat
//   disentuh / di-hover / halaman tidak terlihat.
// - Backdrop berganti halus (crossfade), gradasi gelap kontras
//   tinggi agar teks selalu terbaca.
// - Lencana meta hanya dari data asli item (rating/episode/genre
//   tampil bila API menyediakannya — tidak dikarang).
// - Tombol Tonton langsung ke /watch/[episodeId] bila item
//   membawa episodeId; selain itu ke halaman detail judul.
// - Tombol Daftarku tersinkron localStorage lewat lib/list
//   (sumber kebenaran yang sama dengan seluruh aplikasi).
export default function Hero({ items }) {
  const list = (items || []).filter((x) => x && x.id).slice(0, 5);
  const [hi, setHi] = useState(0);
  const [paused, setPaused] = useState(false);
  const [saved, setSaved] = useState(false);
  const touchPause = useRef(false);
  const a = list[Math.min(hi, Math.max(0, list.length - 1))];

  // Putar otomatis tiap 5 detik; berhenti saat dijeda.
  useEffect(() => {
    if (list.length < 2 || paused) return;
    const t = setTimeout(() => {
      if (!document.hidden && !touchPause.current) {
        setHi((v) => (v + 1) % list.length);
      }
    }, 5000);
    return () => clearTimeout(t);
  }, [hi, paused, list.length]);

  // Status Daftarku mengikuti slide aktif + perubahan daftar.
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
  const rating = a.rating ?? a.score ?? null;
  const genres = Array.isArray(a.genres) ? a.genres.slice(0, 2) : [];
  const synopsis = a.description || a.synopsis || '';
  const watchHref = a.episodeId
    ? `/watch/${encodeURIComponent(a.episodeId)}`
    : `/details/${encodeURIComponent(a.id)}`;

  const go = (dir) => setHi((v) => (v + dir + list.length) % list.length);

  async function share() {
    const url = `${window.location.origin}/details/${encodeURIComponent(a.id)}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else await navigator.clipboard.writeText(url);
    } catch (e) {}
  }

  const pill =
    'inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white backdrop-blur-md';

  return (
    <section
      className="group relative mx-3 mt-3 aspect-[9/12] max-h-[70vh] w-auto overflow-hidden rounded-3xl bg-[#0b0c10] shadow-2xl sm:mx-4 sm:aspect-[16/9]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => {
        touchPause.current = true;
        setPaused(true);
      }}
      onTouchEnd={() => {
        touchPause.current = false;
        setPaused(false);
      }}
      aria-roledescription="carousel"
      aria-label="Anime unggulan"
    >
      {/* Backdrop semua slide ditumpuk untuk crossfade halus */}
      {list.map((item, i) =>
        item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            src={item.image}
            alt={i === hi ? titleOf(item) : ''}
            loading={i === 0 ? 'eager' : 'lazy'}
            draggable={false}
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-[900ms] ease-out ${
              i === hi ? 'scale-100 opacity-100' : 'scale-105 opacity-0'
            }`}
          />
        ) : null
      )}

      {/* Gradasi gelap kontras tinggi (sesuai spesifikasi) */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0c10] via-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent" />

      {/* Lencana tren + indikator slide */}
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-2.5 py-1 text-[11px] font-black tracking-wide text-white shadow-lg shadow-purple-500/25">
          <Flame size={12} strokeWidth={2.5} /> SEDANG TREN
        </span>
      </div>
      {list.length > 1 ? (
        <div className="absolute right-4 top-4 flex items-center gap-1.5">
          {list.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setHi(i)}
              aria-label={`Slide ${i + 1}: ${titleOf(item)}`}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === hi ? 'w-6 bg-gradient-to-r from-purple-500 to-pink-500' : 'w-2 bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      ) : null}

      {/* Panah navigasi (desktop) */}
      {list.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Sebelumnya"
            className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white opacity-0 backdrop-blur-md transition hover:bg-black/50 group-hover:opacity-100 sm:flex"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Berikutnya"
            className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white opacity-0 backdrop-blur-md transition hover:bg-black/50 group-hover:opacity-100 sm:flex"
          >
            <ChevronRight size={20} />
          </button>
        </>
      ) : null}

      {/* Isi: lencana meta, judul, sinopsis, CTA */}
      <div key={a.id} className="absolute inset-x-0 bottom-0 space-y-3 p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-md bg-white px-1.5 py-0.5 text-[10px] font-black tracking-widest text-black">
            HD
          </span>
          {rating ? (
            <span className={pill}>
              <Star size={11} className="fill-amber-400 text-amber-400" /> {rating}
            </span>
          ) : null}
          {a.episodeNumber ? <span className={pill}>EP {a.episodeNumber}</span> : null}
          {a.type ? <span className={pill}>{a.type}</span> : null}
          {year ? <span className={pill}>{year}</span> : null}
          {genres.map((g) => (
            <span key={g} className={pill}>
              {g}
            </span>
          ))}
        </div>

        <h1 className="line-clamp-2 text-2xl font-black leading-tight text-white drop-shadow-md sm:text-4xl">
          {title}
        </h1>

        {synopsis ? (
          <p className="line-clamp-3 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
            {synopsis}
          </p>
        ) : null}

        <div className="flex items-center gap-2.5 pt-1">
          <Link
            href={watchHref}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition hover:scale-105 active:scale-95"
          >
            <Play size={17} className="fill-white" /> Tonton
          </Link>
          <button
            type="button"
            onClick={() => setSaved(toggleItem({ id: a.id, title, image: a.image }))}
            aria-pressed={saved}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
          >
            {saved ? <Check size={17} /> : <Plus size={17} />}
            {saved ? 'Di Daftarku' : 'Daftarku'}
          </button>
          <button
            type="button"
            onClick={share}
            aria-label="Bagikan"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
          >
            <Share2 size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
