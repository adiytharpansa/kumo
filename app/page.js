import Link from 'next/link';
import { getRecentReleases, getTrending } from '../lib/provider';
import MediaCard from '../components/MediaCard';
import ServerBusy from '../components/ServerBusy';

export const revalidate = 300;

const titleOf = (item) =>
  typeof item?.title === 'string' ? item.title : item?.title?.english || item?.title?.romaji || '';

// Beranda sesuai berkas desain pengguna: kolom pencarian, tab
// Semua/Anime/Donghua, hero besar judul tren teratas, baris poster
// "Sedang Tren" dan "Episode Terbaru" yang dapat digeser menyamping.
// Semua isi dari data asli provider (bukan data tanam).
export default async function HomePage() {
  const [recent, trending] = await Promise.all([getRecentReleases(1), getTrending()]);
  const recentList = (recent && recent.results) || [];
  const trendingList = (trending && trending.results) || [];

  if (!recentList.length && !trendingList.length) {
    return <ServerBusy />;
  }

  const hero = trendingList[0];

  return (
    <div>
      <form action="/jelajahi" className="ksearch">
        <span aria-hidden>⌕</span>
        <input name="q" placeholder="Cari anime, donghua..." aria-label="Cari judul" />
      </form>

      <div className="ktabs">
        <b className="on">Semua</b>
        <Link href="/jelajahi?g=Anime">Anime</Link>
        <Link href="/jelajahi?g=Donghua">Donghua</Link>
      </div>

      {hero ? (
        <>
          <Link href={`/details/${encodeURIComponent(hero.id)}`} className="khero">
            {hero.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero.image} alt={titleOf(hero)} />
            ) : null}
            <div>
              <h2>{titleOf(hero)}</h2>
              <p>
                {[hero.type, hero.releaseDate, 'Sedang tren saat ini'].filter(Boolean).join(' · ')}
              </p>
            </div>
          </Link>
          <div className="kdots" aria-hidden>
            {trendingList.slice(0, 5).map((_, i) => (
              <i key={i} className={i === 0 ? 'on' : ''} />
            ))}
          </div>
        </>
      ) : null}

      {trendingList.length ? (
        <section>
          <div className="krow">
            <h2>Sedang Tren</h2>
            <Link href="/jelajahi">Lihat Semua</Link>
          </div>
          <div className="kscroll">
            {trendingList.map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {recentList.length ? (
        <section>
          <div className="krow">
            <h2>Episode Terbaru</h2>
            <Link href="/jadwal">Lihat Semua</Link>
          </div>
          <div className="kscroll">
            {recentList.map((item) => {
              const epId = item.episodeId || item.id;
              return (
                <MediaCard
                  key={String(epId) + '-' + (item.episodeNumber || '')}
                  item={item}
                  badge={item.episodeNumber ? `EP ${item.episodeNumber}` : undefined}
                  playHref={`/watch/${encodeURIComponent(epId)}`}
                />
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
