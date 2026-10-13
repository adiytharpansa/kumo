import Link from 'next/link';
import { getStreamSources, getStreamServers, pickStream, getDetails } from '../../../lib/provider';
import Player from '../../../components/Player';
import AdPlacement from '../../../components/AdPlacement';
import ServerBusy from '../../../components/ServerBusy';
import SaveButton from '../../../components/SaveButton';
import ShareButton from '../../../components/ShareButton';
import HistoryPing from '../../../components/HistoryPing';

// [Media Playback Portal] Sumber stream bersifat dinamis per permintaan.
export const dynamic = 'force-dynamic';

const titleOf = (info, fallback) =>
  (typeof info?.title === 'string' ? info.title : info?.title?.english || info?.title?.romaji) ||
  fallback;

// Halaman nonton sesuai berkas desain: pemutar memenuhi lebar
// kolom dengan tombol kembali melayang, wadah iklan tepat di
// bawah pemutar, judul + episode, aksi Daftarku/Bagikan, dan
// chip semua episode. Kunjungan dicatat ke riwayat lokal.
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
  const iframeUrl = (servers && servers[0] && servers[0].url) || null;

  if (!stream && !iframeUrl) {
    return <ServerBusy />;
  }

  const title = titleOf(info, animeId.replace(/-/g, ' '));
  const episodes = [...((info && info.episodes) || [])].sort(
    (a, b) => (a.number || 0) - (b.number || 0)
  );

  return (
    <div>
      <HistoryPing id={animeId} epId={epId} ep={epNum || ''} title={title} image={(info && info.image) || ''} />

      <div style={{ position: 'relative' }}>
        {/* Wadah media */}
        <Player m3u8={stream ? stream.url : null} iframeUrl={iframeUrl} />
        <Link href={`/details/${encodeURIComponent(animeId)}`} className="x" style={{ top: 10, left: 10 }} aria-label="Kembali ke detail">
          ←
        </Link>
      </div>

      <div className="bd">
        {/* Wadah penempatan iklan: TEPAT di bawah pemutar (lazyOnload) */}
        <AdPlacement />

        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', textTransform: 'capitalize' }}>
          {title}
        </h1>
        <p style={{ color: 'var(--mu)', fontSize: 13, marginTop: 2 }}>
          {epNum ? `Episode ${epNum}` : 'Episode'}
          {info && info.type ? ` · ${info.type}` : ''} · Subtitle Inggris
        </p>

        <div className="actrow" style={{ marginTop: 14 }}>
          <SaveButton id={animeId} title={title} image={(info && info.image) || ''} />
          <ShareButton title={title} />
        </div>

        {episodes.length ? (
          <>
            <h2 className="sec" style={{ padding: 0, margin: '24px 0 12px' }}>
              Semua Episode
            </h2>
            <div className="epsx">
              {episodes.map((ep) => (
                <Link
                  key={ep.id}
                  href={`/watch/${encodeURIComponent(ep.id)}`}
                  className={String(ep.number) === String(epNum) ? 'on' : ''}
                >
                  {ep.number}
                </Link>
              ))}
            </div>
          </>
        ) : (
          <Link href={`/details/${encodeURIComponent(animeId)}`} className="btn ol" style={{ marginTop: 16 }}>
            Lihat Semua Episode
          </Link>
        )}

        {servers && servers.length > 1 ? (
          <>
            <div className="secttl" style={{ margin: '22px 4px 8px' }}>
              SERVER CADANGAN
            </div>
            <div className="chips" style={{ padding: 0 }}>
              {servers.map((s) => (
                <a key={s.name + s.url} href={s.url} target="_blank" rel="noreferrer" className="chip">
                  {s.name}
                </a>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
