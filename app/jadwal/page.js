import Link from 'next/link';
import { getRecentReleases } from '../../lib/provider';
import ServerBusy from '../../components/ServerBusy';

export const revalidate = 300;

const titleOf = (item) =>
  typeof item?.title === 'string' ? item.title : item?.title?.english || item?.title?.romaji || '';

// Halaman Jadwal sesuai desain: daftar baris rilisan dengan
// thumbnail kecil, judul, dan tag episode. Sumber tidak menyediakan
// jadwal per hari, jadi yang ditampilkan adalah rilisan episode
// terbaru (data asli) dalam gaya daftar yang sama.
export default async function JadwalPage() {
  const recent = await getRecentReleases(1);
  const list = (recent && recent.results) || [];

  if (!list.length) return <ServerBusy />;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 6px' }}>Jadwal</h1>
      <p style={{ color: 'var(--mu)', fontSize: 12, marginBottom: 14 }}>
        Rilisan episode terbaru dari sumber.
      </p>
      {list.map((item) => (
        <Link
          key={String(item.episodeId || item.id) + '-' + (item.episodeNumber || '')}
          href={`/details/${encodeURIComponent(item.id)}`}
          className="kli"
        >
          <div className="im">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt={titleOf(item)} loading="lazy" />
            ) : null}
          </div>
          <div className="t">
            <b>{titleOf(item)}</b>
            {item.episodeNumber ? <span className="tag ac">EP {item.episodeNumber}</span> : null}
            <span className="tag ok">Terbaru</span>
          </div>
          <span aria-hidden style={{ color: 'var(--mu)' }}>
            ›
          </span>
        </Link>
      ))}
    </div>
  );
}
