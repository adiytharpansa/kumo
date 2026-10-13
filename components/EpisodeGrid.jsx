'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

const RANGE = 50;

// Grid "Semua Episode": sel angka rapi, episode aktif menyala
// gradasi neon, dan pemilih rentang (1–50, 51–100, ...) untuk
// seri panjang agar halaman tidak dibanjiri ratusan tombol.
export default function EpisodeGrid({ episodes, current }) {
  const list = Array.isArray(episodes) ? episodes : [];
  const currentIdx = list.findIndex((e) => String(e.number) === String(current));
  const ranges = useMemo(() => {
    const out = [];
    for (let i = 0; i < list.length; i += RANGE) {
      out.push({ start: i, end: Math.min(i + RANGE, list.length) });
    }
    return out;
  }, [list.length]);
  const [rangeIdx, setRangeIdx] = useState(() =>
    currentIdx >= 0 ? Math.floor(currentIdx / RANGE) : 0
  );

  if (!list.length) return null;
  const range = ranges[Math.min(rangeIdx, ranges.length - 1)] || ranges[0];
  const visible = list.slice(range.start, range.end);

  return (
    <div>
      {ranges.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {ranges.map((r, i) => {
            const on = i === rangeIdx;
            const label = `${list[r.start].number}–${list[r.end - 1].number}`;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setRangeIdx(i)}
                aria-pressed={on}
                className={
                  on
                    ? 'rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-purple-500/25 transition active:scale-95'
                    : 'rounded-full px-3.5 py-1.5 text-xs font-bold transition active:scale-95'
                }
                style={on ? undefined : { background: 'var(--sf2)', color: 'var(--mu)' }}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="grid grid-cols-5 gap-2 min-[420px]:grid-cols-6 sm:grid-cols-8">
        {visible.map((ep) => {
          const on = String(ep.number) === String(current);
          return (
            <Link
              key={ep.id}
              href={`/watch/${encodeURIComponent(ep.id)}`}
              aria-current={on ? 'true' : undefined}
              className={
                on
                  ? 'rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 py-2.5 text-center text-sm font-black text-white shadow-lg shadow-purple-500/40 ring-2 ring-pink-400/60 transition active:scale-95'
                  : 'rounded-xl py-2.5 text-center text-sm font-bold transition hover:ring-2 hover:ring-purple-400/40 active:scale-95'
              }
              style={on ? undefined : { background: 'var(--sf2)', color: 'var(--tx)' }}
            >
              {ep.number}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
