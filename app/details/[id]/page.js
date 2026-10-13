import Link from 'next/link';
import { getDetails } from '../../../lib/provider';
import ServerBusy from '../../../components/ServerBusy';
import SaveButton from '../../../components/SaveButton';

export const revalidate = 3600;

const titleOf = (info) =>
  typeof info?.title === 'string' ? info.title : info?.title?.english || info?.title?.romaji || 'Untitled';

// Halaman detail sesuai berkas desain pengguna: hero besar dengan
// tombol bulat kembali/simpan, judul + tag, tombol Tonton & Ikuti,
// sinopsis, lalu chip semua episode. Semua isi data asli provider.
export default async function DetailsPage({ params }) {
  const { id } = await params;
  const info = await getDetails(decodeURIComponent(id));
  if (!info) return <ServerBusy />;

  const episodes = [...(info.episodes || [])].sort((a, b) => (a.number || 0) - (b.number || 0));
  const firstEp = episodes[0];
  const year = (String(info.releaseDate || '').match(/\d{4}/) || [])[0];
  const title = titleOf(info);

  return (
    <div>
      <section style={{ position: 'relative' }}>
        <div className="dh">
          {info.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={info.image} alt={title} />
          ) : null}
          <div>
            <h1>{title}</h1>
            <div>
              {year ? <span className="tag">{year}</span> : null}
              {info.type ? <span className="tag">{info.type}</span> : null}
              {(info.genres || []).slice(0, 2).map((g) => (
                <span key={g} className="tag">
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="dtop">
          <Link href="/" className="rb" aria-label="Kembali">
            ←
          </Link>
          <SaveButton id={info.id} title={title} image={info.image} variant="round" />
        </div>
      </section>

      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', gap: 10, margin: '14px 0' }}>
          {firstEp ? (
            <Link href={`/watch/${encodeURIComponent(firstEp.id)}`} className="kbtn" style={{ flex: 1 }}>
              ▶ Tonton
            </Link>
          ) : (
            <span className="kbtn g" style={{ flex: 1 }}>
              Belum ada episode
            </span>
          )}
          <SaveButton id={info.id} title={title} image={info.image} variant="follow" />
        </div>

        {info.status ? (
          <span className={/ongoing|airing/i.test(info.status) ? 'tag ok' : 'tag'}>
            {info.status}
            {info.totalEpisodes ? ` · ${info.totalEpisodes} episode` : ''}
          </span>
        ) : null}

        {(info.genres || []).length > 2 ? (
          <p style={{ marginTop: 10 }}>
            {(info.genres || []).map((g) => (
              <span key={g} className="tag">
                {g}
              </span>
            ))}
          </p>
        ) : null}

        {info.description ? (
          <>
            <div className="krow">
              <h2>Sinopsis</h2>
            </div>
            <p style={{ color: 'var(--mu)', lineHeight: 1.6 }}>{info.description}</p>
          </>
        ) : null}

        <div className="krow">
          <h2>Semua Episode</h2>
          <a>{episodes.length} EP</a>
        </div>
        {episodes.length ? (
          <div className="eps">
            {episodes.map((ep) => (
              <Link key={ep.id} href={`/watch/${encodeURIComponent(ep.id)}`} className="ep">
                {ep.number}
              </Link>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--mu)' }}>Indeks episode belum tersedia.</p>
        )}
      </div>
    </div>
  );
}
