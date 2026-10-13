import Link from 'next/link';

// Kartu katalog (presentasional; dipakai Server Components).
export default function MediaCard({ item, badge }) {
  if (!item) return null;
  const title = typeof item.title === 'string' ? item.title : item.title?.english || item.title?.romaji || '';
  return (
    <Link
      href={`/details/${encodeURIComponent(item.id)}`}
      className="group block overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10 transition hover:ring-violet-400/60"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-white/5">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : null}
        {badge ? (
          <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-violet-300">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-2.5">
        <div className="line-clamp-2 min-h-10 text-[13px] font-medium leading-snug">{title}</div>
        <div className="mt-1 text-[11px] text-zinc-400">
          {[item.type, item.releaseDate].filter(Boolean).join(' · ')}
        </div>
      </div>
    </Link>
  );
}
