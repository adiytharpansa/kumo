import Link from 'next/link';
import { getRecentReleases, getTrending } from '../lib/provider';
import MediaCard from '../components/MediaCard';
import ServerBusy from '../components/ServerBusy';

export const revalidate = 300;

// [Main Dashboard Hub] Server Component asinkron:
// mengambil "Recent Releases" + "Top Trending Content" dari provider
// server-side dan merender grid responsif Tailwind.
export default async function HomePage() {
  const [recent, trending] = await Promise.all([getRecentReleases(1), getTrending()]);
  const recentList = (recent && recent.results) || [];
  const trendingList = (trending && trending.results) || [];

  if (!recentList.length && !trendingList.length) {
    return <ServerBusy />;
  }

  return (
    <div className="pt-5">
      {trendingList.length ? (
        <section>
          <h1 className="mb-3 text-lg font-bold">Top Trending Content</h1>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {trendingList.slice(0, 12).map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {recentList.length ? (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">Recent Releases</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {recentList.map((item) => {
              const epId = item.episodeId || item.id;
              return (
                <div key={String(epId) + '-' + (item.episodeNumber || '')}>
                  <MediaCard
                    item={item}
                    badge={item.episodeNumber ? `Ep ${item.episodeNumber}` : undefined}
                  />
                  <Link
                    href={`/watch/${encodeURIComponent(epId)}`}
                    className="mt-1.5 block rounded-lg bg-violet-600/90 py-1.5 text-center text-xs font-semibold text-white"
                  >
                    ▶ Watch
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
