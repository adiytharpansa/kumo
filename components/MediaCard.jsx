import Link from 'next/link';

// Kartu poster sesuai berkas desain pengguna (.pst): gambar 3:4
// radius 12px, lencana episode di kiri atas, judul 2 baris di bawah.
// - badge: teks lencana (mis. "EP 12").
// - playHref: bila diisi, tampil chip putar di kanan bawah poster
//   yang langsung membuka halaman nonton (satu ketuk putar).
export default function MediaCard({ item, badge, playHref }) {
  if (!item) return null;
  const title =
    typeof item.title === 'string' ? item.title : item.title?.english || item.title?.romaji || '';
  const href = `/details/${encodeURIComponent(item.id)}`;
  return (
    <div className="pst">
      <div style={{ position: 'relative' }}>
        <Link href={href}>
          <div className="im">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt={title} loading="lazy" />
            ) : null}
          </div>
        </Link>
        {badge ? <span className="bdg">{badge}</span> : null}
        {playHref ? (
          <Link href={playHref} className="playchip" aria-label="Putar langsung">
            ▶
          </Link>
        ) : null}
      </div>
      <Link href={href}>
        <p>{title}</p>
      </Link>
    </div>
  );
}
