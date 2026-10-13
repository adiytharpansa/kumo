import Link from 'next/link';
import { getRecentReleases } from '../../lib/provider';
import ServerBusy from '../../components/ServerBusy';

export const revalidate = 300;

const titleOf = (item) =>
  typeof item?.title === 'string' ? item.title : item?.title?.english || item?.title?.romaji || '';

// Halaman Terbaru sesuai desain: baris episode terbaru berbentuk
// kartu dengan thumbnail 16:10; satu ketuk langsung memutar.
export default async function TerbaruPage() {
  const recent = await getRecentReleases(1);
  const list = (recent && recent.results) || [];

  if (!list.length) return <ServerBusy />;

  return (
    <div>
      <h2 className="sec" style={{ marginTop: 12 }}>
        Episode terbaru
      </h2>
      {list.map((item) => {
        const epId = item.episodeId || item.id;
        return (
          <Link
            key={String(epId) + '-' + (item.episodeNumber || '')}
            href={`/watch/${encodeURIComponent(epId)}`}
            className="ep"
          >
            <span className="th">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt={titleOf(item)} loading="lazy" />
              ) : null}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>{titleOf(item)}</b>
              <span>
                {item.episodeNumber ? `Episode ${item.episodeNumber} · ` : ''}Subtitle Inggris
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
