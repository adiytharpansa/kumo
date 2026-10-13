import Link from 'next/link';
import { getDetails } from '../../../lib/provider';
import ServerBusy from '../../../components/ServerBusy';

export const revalidate = 3600;

const titleOf = (info) =>
  typeof info?.title === 'string' ? info.title : info?.title?.english || info?.title?.romaji || 'Untitled';

// [Content Detail Node] Metadata lengkap + daftar indeks episode dinamis.
export default async function DetailsPage({ params }) {
  const { id } = await params;
  const info = await getDetails(decodeURIComponent(id));
  if (!info) return <ServerBusy />;

  const episodes = [...(info.episodes || [])].sort((a, b) => (a.number || 0) - (b.number || 0));

  return (
    <div className="pt-5">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="w-40 shrink-0 sm:w-52">
          {info.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={info.image}
              alt={titleOf(info)}
              className="w-full rounded-xl ring-1 ring-white/10"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight">{titleOf(info)}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(info.genres || []).map((g) => (
              <span
                key={g}
                className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] text-zinc-300"
              >
                {g}
              </span>
            ))}
          </div>
          <dl className="mt-3 space-y-1 text-sm text-zinc-400">
            {info.type ? (
              <div>
                <dt className="inline font-medium text-zinc-300">Type: </dt>
                <dd className="inline">{info.type}</dd>
              </div>
            ) : null}
            {info.releaseDate ? (
              <div>
                <dt className="inline font-medium text-zinc-300">Released: </dt>
                <dd className="inline">{info.releaseDate}</dd>
              </div>
            ) : null}
            {info.status ? (
              <div>
                <dt className="inline font-medium text-zinc-300">Status: </dt>
                <dd className="inline">{info.status}</dd>
              </div>
            ) : null}
            {info.totalEpisodes ? (
              <div>
                <dt className="inline font-medium text-zinc-300">Episodes: </dt>
                <dd className="inline">{info.totalEpisodes}</dd>
              </div>
            ) : null}
          </dl>
          {info.description ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300">{info.description}</p>
          ) : null}
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-bold">Episodes</h2>
      {episodes.length ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          {episodes.map((ep) => (
            <Link
              key={ep.id}
              href={`/watch/${encodeURIComponent(ep.id)}`}
              className="rounded-lg bg-white/10 py-2.5 text-center text-sm font-semibold ring-1 ring-white/10 transition hover:bg-violet-600"
            >
              {ep.number}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">No episode index available yet.</p>
      )}
    </div>
  );
}
