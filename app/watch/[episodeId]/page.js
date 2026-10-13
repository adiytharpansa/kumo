import Link from 'next/link';
import { getStreamSources, getStreamServers, pickStream } from '../../../lib/provider';
import Player from '../../../components/Player';
import AdPlacement from '../../../components/AdPlacement';
import ServerBusy from '../../../components/ServerBusy';

// [Media Playback Portal] Sumber stream bersifat dinamis per permintaan.
export const dynamic = 'force-dynamic';

export default async function WatchPage({ params }) {
  const { episodeId } = await params;
  const epId = decodeURIComponent(episodeId);

  const [sources, servers] = await Promise.all([getStreamSources(epId), getStreamServers(epId)]);
  const stream = pickStream(sources);
  const iframeUrl = (servers && servers[0] && servers[0].url) || null;

  if (!stream && !iframeUrl) {
    return <ServerBusy />;
  }

  const animeId = epId.replace(/-episode-\d+.*$/i, '');
  const epNum = (epId.match(/-episode-(\d+)/i) || [])[1];

  return (
    <div className="pt-5">
      {/* Wadah media */}
      <Player m3u8={stream ? stream.url : null} iframeUrl={iframeUrl} />

      {/* Wadah penempatan iklan: TEPAT di bawah pemutar (lazyOnload) */}
      <AdPlacement />

      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-base font-bold capitalize">
          {animeId.replace(/-/g, ' ')}
          {epNum ? <span className="text-violet-300"> — Episode {epNum}</span> : null}
        </h1>
        <Link
          href={`/details/${encodeURIComponent(animeId)}`}
          className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold ring-1 ring-white/15"
        >
          All Episodes
        </Link>
      </div>

      {servers && servers.length > 1 ? (
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Backup servers
          </div>
          <div className="flex flex-wrap gap-2">
            {servers.map((s) => (
              <a
                key={s.name + s.url}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-white/5 px-3 py-1.5 text-xs ring-1 ring-white/10"
              >
                {s.name}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
