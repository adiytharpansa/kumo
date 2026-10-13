import Link from 'next/link';
import { ChevronLeft, SkipForward, Captions } from 'lucide-react';
import { getStreamSources, getStreamServers, pickStream, getDetails } from '../../../lib/provider';
import WatchPlayer from '../../../components/WatchPlayer';
import EpisodeGrid from '../../../components/EpisodeGrid';
import AdPlacement from '../../../components/AdPlacement';
import SaveButton from '../../../components/SaveButton';
import ShareButton from '../../../components/ShareButton';
import HistoryPing from '../../../components/HistoryPing';

// [Media Playback Portal] Sumber stream bersifat dinamis per permintaan.
export const dynamic = 'force-dynamic';

const titleOf = (info, fallback) =>
  (typeof info?.title === 'string' ? info.title : info?.title?.english || info?.title?.romaji) ||
  fallback;

// Halaman nonton ala OTT: pemutar dalam kartu membulat dengan
// jarak dari kepala aplikasi (tidak lagi menempel/menabrak
// TopBar), pemilih server pil tepat di bawah pemutar, wadah
// iklan di bawah blok pemutar, baris aksi Episode Berikutnya /
// Daftarku / Bagikan, lencana meta lengkap, dan grid episode
// dengan pemilih rentang. Progres putar tersinkron lewat
// WatchPlayer -> lib/progress (lokal + Supabase watch_history).
export default async function WatchPage({ params }) {
  const { episodeId } = await params;
  const epId = decodeURIComponent(episodeId);

  const animeId = epId.replace(/-episode-\d+.*$/i, '');
  const epNum = (epId.match(/-episode-(\d+)/i) || [])[1];

  const [sources, servers, info] = await Promise.all([
    getStreamSources(epId),
    getStreamServers(epId),
    getDetails(animeId).catch(() => null),
  ]);
  const stream = pickStream(sources);

  const title = titleOf(info, animeId.replace(/-/g, ' '));
  const episodes = [...((info && info.episodes) || [])].sort(
    (a, b) => (a.number || 0) - (b.number || 0)
  );
  const nextEp = epNum
    ? episodes.find((e) => Number(e.number) > Number(epNum))
    : episodes[0] || null;
  const genres = ((info && info.genres) || []).slice(0, 3);
  const isDub = stream && stream.audio === 'dub';

  const metaPill = {
    background: 'var(--sf2)',
    color: 'var(--tx)',
  };

  return (
    <div>
      <HistoryPing id={animeId} epId={epId} ep={epNum || ''} title={title} image={(info && info.image) || ''} />

      {/* Kartu pemutar: mt-3 + sudut membulat memisahkan pemutar
          dari TopBar global (logo & avatar) — tidak ada lagi
          tabrakan overlay judul dengan kepala aplikasi. */}
      <div
        className="relative mx-3 mt-3 overflow-hidden rounded-3xl shadow-2xl sm:mx-4"
        style={{ background: 'var(--sf)' }}
      >
        <WatchPlayer
          title={title}
          ep={epNum}
          epId={epId}
          animeId={animeId}
          image={(info && info.image) || ''}
          serverM3u8={stream ? stream.url : null}
          serverSubtitle={stream ? stream.subtitle : null}
          servers={servers || []}
        />
        <Link
          href={`/details/${encodeURIComponent(animeId)}`}
          aria-label="Kembali ke detail"
          className="absolute left-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-md transition hover:bg-black/65 active:scale-95"
        >
          <ChevronLeft size={20} />
        </Link>
      </div>

      <div className="bd">
        {/* Wadah penempatan iklan: tepat di bawah blok pemutar */}
        <AdPlacement />

        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', textTransform: 'capitalize' }}>
          {title}
        </h1>

        {/* Lencana meta: episode, status, tipe, subtitle, genre */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-2.5 py-1 text-[11px] font-black tracking-wide text-white">
            {epNum ? `EPISODE ${epNum}` : 'EPISODE'}
          </span>
          {info && info.status ? (
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={metaPill}>
              {info.status}
            </span>
          ) : null}
          {info && info.type ? (
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={metaPill}>
              {info.type}
            </span>
          ) : null}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={metaPill}
          >
            <Captions size={12} /> {isDub ? 'Dub Inggris' : 'Subtitle Inggris'}
          </span>
          {genres.map((g) => (
            <span
              key={g}
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ border: '1px solid var(--ln)', color: 'var(--mu)' }}
            >
              {g}
            </span>
          ))}
        </div>

        {/* Baris aksi: Episode Berikutnya (utama) + Daftarku + Bagikan */}
        <div className="actrow" style={{ marginTop: 14 }}>
          {nextEp ? (
            <Link
              href={`/watch/${encodeURIComponent(nextEp.id)}`}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition hover:scale-105 active:scale-95"
            >
              Episode Berikutnya <SkipForward size={16} className="fill-white" />
            </Link>
          ) : null}
          <SaveButton id={animeId} title={title} image={(info && info.image) || ''} />
          <ShareButton title={title} />
        </div>

        {episodes.length ? (
          <>
            <h2 className="sec" style={{ padding: 0, margin: '24px 0 12px' }}>
              Semua Episode
            </h2>
            <EpisodeGrid episodes={episodes} current={epNum} />
          </>
        ) : (
          <Link href={`/details/${encodeURIComponent(animeId)}`} className="btn ol" style={{ marginTop: 16 }}>
            Lihat Semua Episode
          </Link>
        )}
      </div>
    </div>
  );
}
