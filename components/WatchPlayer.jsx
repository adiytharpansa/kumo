'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Server } from 'lucide-react';
import ProPlayer from './ProPlayer';
import { resolveOnClient } from './KaaResolver';
import { getProgress, saveProgress } from '../lib/progress';

// Blok pemutar halaman nonton: pemutar + pemilih server berbentuk
// pil tepat di bawahnya.
// - Sumber utama = HLS (ProPlayer) dari server atau resolusi klien.
// - Server cadangan = embed iframe dari provider (maks 3).
// - Progres putar dilaporkan ProPlayer -> lib/progress (lokal +
//   cermin Supabase watch_history) dan dipakai lagi sebagai
//   titik lanjut (resume) saat episode dibuka kembali.
// - Jalur iframe lintas domain tidak bisa melaporkan stempel
//   waktu; untuknya hanya riwayat kunjungan yang dicatat.
export default function WatchPlayer({
  title,
  ep,
  epId,
  animeId,
  image,
  serverM3u8,
  serverSubtitle,
  servers,
}) {
  const iframes = Array.isArray(servers) ? servers.filter((s) => s && s.url) : [];
  const [primary, setPrimary] = useState(
    serverM3u8
      ? { status: 'ready', m3u8: serverM3u8, subtitle: serverSubtitle || null }
      : { status: 'loading', m3u8: null, subtitle: null }
  );
  const [activeKey, setActiveKey] = useState('primary');

  // Resolusi klien katalog utama (sama seperti KaaResolver).
  useEffect(() => {
    if (serverM3u8) return;
    let stop = false;
    const soft = setTimeout(() => {
      if (!stop) setPrimary((p) => (p.status === 'loading' ? { ...p, status: 'failed' } : p));
    }, iframes.length ? 9000 : 25000);
    (async () => {
      const found = await resolveOnClient(title, ep).catch(() => null);
      if (stop) return;
      clearTimeout(soft);
      if (found) setPrimary({ status: 'ready', m3u8: found.m3u8, subtitle: found.subtitle });
      else setPrimary((p) => ({ ...p, status: 'failed' }));
    })();
    return () => {
      stop = true;
      clearTimeout(soft);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, ep]);

  const sources = useMemo(() => {
    const out = [];
    if (primary.status !== 'failed') {
      out.push({
        key: 'primary',
        label: primary.status === 'loading' ? 'Server 1 · Memuat…' : 'Server 1 (Utama)',
        kind: 'hls',
      });
    }
    iframes.forEach((s, i) => {
      out.push({
        key: `if-${i}`,
        label: i === 0 ? 'Server 2 (Cadangan)' : i === 1 ? 'HD Player' : `Server ${i + 2} (Cadangan)`,
        kind: 'iframe',
        url: s.url,
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary.status, servers]);

  const active = sources.find((s) => s.key === activeKey) || sources[0] || null;

  // Titik lanjut dari progres tersimpan (sekali baca saat mount).
  const resumeAt = useMemo(() => {
    const p = getProgress(epId);
    return p && p.d && p.p > 5 && p.p < p.d - 15 ? p.p : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epId]);

  const handleProgress = useCallback(
    ({ progress, duration }) => {
      saveProgress({ episodeId: epId, animeId, title, image, ep, progress, duration });
    },
    [epId, animeId, title, image, ep]
  );

  const handleFatal = useCallback(() => {
    const firstIframe = sources.find((s) => s.kind === 'iframe');
    if (firstIframe) setActiveKey(firstIframe.key);
    else setPrimary((p) => ({ ...p, status: 'failed' }));
  }, [sources]);

  return (
    <div>
      {active && active.kind === 'hls' && primary.status === 'ready' ? (
        <ProPlayer
          key={primary.m3u8}
          src={primary.m3u8}
          subtitleUrl={primary.subtitle}
          title={title}
          episodeLabel={ep ? `Episode ${ep}` : ''}
          onFatal={handleFatal}
          onProgress={handleProgress}
          resumeAt={resumeAt}
        />
      ) : active && active.kind === 'iframe' ? (
        <div className="aspect-video w-full overflow-hidden bg-black">
          <iframe
            key={active.url}
            src={active.url}
            title="Media player"
            className="h-full w-full"
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture"
            referrerPolicy="origin"
          />
        </div>
      ) : primary.status === 'loading' ? (
        <div className="flex aspect-video w-full items-center justify-center bg-black">
          <span style={{ color: 'var(--mu)', fontSize: 13 }}>Memuat pemutar…</span>
        </div>
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-black">
          <span style={{ color: 'var(--mu)', fontSize: 13 }}>
            Stream tidak tersedia untuk episode ini.
          </span>
        </div>
      )}

      {sources.length > 1 ? (
        <div className="px-4 pb-4 pt-3 sm:px-5">
          <div
            className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest"
            style={{ color: 'var(--mu)' }}
          >
            <Server size={12} /> Server
          </div>
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => {
              const on = active && s.key === active.key;
              const disabled = s.kind === 'hls' && primary.status === 'loading';
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => setActiveKey(s.key)}
                  aria-pressed={on}
                  className={
                    on
                      ? 'rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-purple-500/25 transition active:scale-95'
                      : 'rounded-full border border-white/15 px-4 py-2 text-xs font-bold transition active:scale-95 disabled:opacity-50'
                  }
                  style={on ? undefined : { background: 'var(--sf2)', color: 'var(--tx)' }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
