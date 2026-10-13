import Link from 'next/link';

// Kartu poster sesuai berkas desain (.poster): gambar 2:3 radius
// 14px dengan bayangan, judul menimpa bagian bawah poster, pil
// tag gradasi di kiri atas; di bawahnya judul + baris sub.
// - badge: teks pil (mis. "EP 12" untuk rilisan terbaru).
// - sub: baris kecil di bawah judul (mis. tipe / genre).
export default function MediaCard({ item, badge, sub }) {
  if (!item) return null;
  const title =
    typeof item.title === 'string' ? item.title : item.title?.english || item.title?.romaji || '';
  const href = `/details/${encodeURIComponent(item.id)}`;
  const subText = sub || [item.type, item.releaseDate].filter(Boolean).join(' · ');
  return (
    <div className="c">
      <Link href={href} className="poster">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt={title} loading="lazy" />
        ) : null}
        {badge ? <span className="ptag">{badge}</span> : null}
        <b>{title}</b>
      </Link>
      <div className="t">
        {title}
        {subText ? <span className="sub">{subText}</span> : null}
      </div>
    </div>
  );
}
