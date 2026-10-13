import Link from 'next/link';
import { getStreamSources, getStreamServers, pickStream, getDetails } from '../../../lib/provider';
import Player from '../../../components/Player';
import AdPlacement from '../../../components/AdPlacement';
import ServerBusy from '../../../components/ServerBusy';
import WatchActions from '../../../components/WatchActions';

// [Media Playback Portal] Sumber stream bersifat dinamis per permintaan.
export const dynamic = 'force-dynamic';

const titleOf = (info, fallback) =>
  (typeof info?.title === 'string' ? info.title : info?.title?.english || info?.title?.romaji) ||
  fallback;

// Halaman nonton sesuai berkas desain pengguna: pemutar 16:9 di
// atas, judul + episode, baris aksi Suka/Simpan/Bagikan, lalu chip
// semua episode. Wadah iklan tetap tepat di bawah pemutar.
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
      {/* Wadah media — pemutar bawaan stream memenuhi lebar kolom */}
      <Player m3u8={stream ? stream.url : null} iframeUrl={iframeUrl} />

      <div style={{ padding: '0 16px' }}>
        {/* Wadah penempatan iklan: TEPAT di bawah pemutar (lazyOnload) */}
        <AdPlacement />

        <div className="krow" style={{ marginTop: 4 }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ textTransform: 'capitalize' }}>{title}</h2>
            <p style={{ color: 'var(--mu)', fontSize: 12, marginTop: 2 }}>
              {epNum ? `EP ${epNum}` : 'Episode'}
              {info && info.type ? ` · ${info.type}` : ''}
            </p>
          </div>
        </div>

        <WatchActions id={animeId} title={title} image={(info && info.image) || ''} />

        {episodes.length ? (
          <>
            <div className="krow">
              <h2>Semua Episode</h2>
              <a>{episodes.length} EP</a>
            </div>
            <div className="eps">
              {episodes.map((ep) => (
                <Link
                  key={ep.id}
                  href={`/watch/${encodeURIComponent(ep.id)}`}
                  className={String(ep.number) === String(epNum) ? 'ep on' : 'ep'}
                >
                  {ep.number}
                </Link>
              ))}
            </div>
          </>
        ) : (
          <Link href={`/details/${encodeURIComponent(animeId)}`} className="kbtn g">
            Lihat Semua Episode
          </Link>
        )}

        {servers && servers.length > 1 ? (
          <div style={{ marginTop: 18 }}>
            <div className="sh" style={{ margin: '0 4px 8px' }}>
              SERVER CADANGAN
            </div>
            <div className="kchips" style={{ margin: 0 }}>
              {servers.map((s) => (
                <a key={s.name + s.url} href={s.url} target="_blank" rel="noreferrer" className="kchip">
                  {s.name}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
