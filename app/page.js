import Link from 'next/link';
import { getRecentReleases, getTrending } from '../lib/provider';
import MediaCard from '../components/MediaCard';
import ServerBusy from '../components/ServerBusy';
import Hero from '../components/Hero';
import ContinueWatching from '../components/ContinueWatching';

export const revalidate = 300;

const GENRE_PREVIEW = ['Action', 'Romance', 'Comedy', 'Fantasy', 'Drama', 'Sci-Fi', 'Horror', 'Sports'];

// Beranda sesuai berkas desain: hero layar penuh judul tren,
// Lanjutkan menonton (riwayat asli perangkat), Baru rilis,
// Sedang Tren, dan chip genre. Semua isi data asli provider.
export default async function HomePage() {
  const [recent, trending] = await Promise.all([getRecentReleases(1), getTrending()]);
  const recentList = (recent && recent.results) || [];
  const trendingList = (trending && trending.results) || [];

  if (!recentList.length && !trendingList.length) {
    return <ServerBusy />;
  }

  return (
    <div>
      <Hero items={trendingList} />

      <ContinueWatching />

      {recentList.length ? (
        <section>
          <h2 className="sec">Baru rilis</h2>
          <div className="sc lg">
            {recentList.map((item) => (
              <MediaCard
                key={String(item.episodeId || item.id) + '-' + (item.episodeNumber || '')}
                item={item}
                badge={item.episodeNumber ? `EP ${item.episodeNumber}` : undefined}
                sub={item.episodeNumber ? `Episode ${item.episodeNumber} · Subtitle Inggris` : undefined}
              />
            ))}
          </div>
        </section>
      ) : null}

      {trendingList.length ? (
        <section>
          <h2 className="sec">Sedang Tren</h2>
          <div className="sc lg">
            {trendingList.map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="sec">Genre populer</h2>
        <div className="chips">
          {GENRE_PREVIEW.map((g) => (
            <Link key={g} href={`/genre?g=${encodeURIComponent(g)}`} className="chip">
              {g}
            </Link>
          ))}
          <Link href="/genre" className="chip">
            Semua genre ›
          </Link>
        </div>
      </section>
    </div>
  );
}
