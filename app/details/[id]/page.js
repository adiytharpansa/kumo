import Link from 'next/link';
import { getDetails, searchTitles } from '../../../lib/provider';
import ServerBusy from '../../../components/ServerBusy';
import SaveButton from '../../../components/SaveButton';
import ShareButton from '../../../components/ShareButton';
import RateStars from '../../../components/RateStars';
import ListStatus from '../../../components/ListStatus';
import MediaCard from '../../../components/MediaCard';

export const revalidate = 3600;

const titleOf = (info) =>
  typeof info?.title === 'string' ? info.title : info?.title?.english || info?.title?.romaji || 'Untitled';

// Halaman detail sesuai berkas desain: kepala poster besar dengan
// tombol kembali, statistik (Episode/Status/Tipe), chip genre,
// sinopsis, baris aksi Tonton/Daftarku/Bagikan, nilai bintang
// lokal, lalu tab Episode | Mirip. Semua isi data asli provider.
export default async function DetailsPage({ params, searchParams }) {
  const { id } = await params;
  const sp = (await searchParams) || {};
  const tab = sp.tab === 'mirip' ? 'mirip' : 'episode';
  const info = await getDetails(decodeURIComponent(id));
  if (!info) return <ServerBusy />;

  const episodes = [...(info.episodes || [])].sort((a, b) => (a.number || 0) - (b.number || 0));
  const desc = [...episodes].reverse();
  const firstEp = episodes[0];
  const title = titleOf(info);
  const year = (String(info.releaseDate || '').match(/\d{4}/) || [])[0];

  let similar = [];
  if (tab === 'mirip' && (info.genres || []).length) {
    const data = await searchTitles(info.genres[0]).catch(() => null);
    similar = ((data && data.results) || []).filter((x) => x.id !== info.id).slice(0, 6);
  }

  return (
    <div>
      <section className="ph">
        {info.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.image} alt={title} />
        ) : null}
        <Link href="/" className="x" aria-label="Kembali">
          ←
        </Link>
        <h1>{title}</h1>
      </section>

      <div className="bd">
        <div className="stt">
          <div>
            <b>{info.totalEpisodes || episodes.length || '—'}</b>
            <span>Episode</span>
          </div>
          <div>
            <b>{info.status || '—'}</b>
            <span>Status</span>
          </div>
          <div>
            <b>{info.type || '—'}</b>
            <span>Tipe{year ? ` · ${year}` : ''}</span>
          </div>
        </div>

        {(info.genres || []).length ? (
          <div className="chp2">
            {(info.genres || []).map((g) => (
              <span key={g}>{g}</span>
            ))}
          </div>
        ) : null}

        {info.description ? <p className="syn">{info.description}</p> : null}

        <div className="actrow">
          {firstEp ? (
            <Link href={`/watch/${encodeURIComponent(firstEp.id)}`} className="btn go">
              ▶ Tonton
            </Link>
          ) : (
            <span className="btn ol">Belum ada episode</span>
          )}
          <SaveButton id={info.id} title={title} image={info.image} />
          <ShareButton title={title} square />
        </div>

        <ListStatus id={info.id} />
        <RateStars id={info.id} />

        <div className="tb">
          <Link href={`/details/${encodeURIComponent(info.id)}`} className={tab === 'episode' ? 'on' : ''}>
            Episode
          </Link>
          <Link
            href={`/details/${encodeURIComponent(info.id)}?tab=mirip`}
            className={tab === 'mirip' ? 'on' : ''}
          >
            Mirip
          </Link>
        </div>

        {tab === 'mirip' ? (
          similar.length ? (
            <div className="grid" style={{ padding: 0 }}>
              {similar.map((item) => (
                <MediaCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="empty" style={{ margin: 0 }}>
              Belum ada judul mirip yang ditemukan.
            </div>
          )
        ) : episodes.length ? (
          desc.map((ep) => (
            <Link key={ep.id} href={`/watch/${encodeURIComponent(ep.id)}`} className="epl">
              <span className="th">
                {info.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={info.image} alt="" loading="lazy" />
                ) : null}
              </span>
              <span className="eb">
                <b>Episode {ep.number}</b>
                <span>Subtitle Inggris</span>
              </span>
            </Link>
          ))
        ) : (
          <p style={{ color: 'var(--mu)' }}>Indeks episode belum tersedia.</p>
        )}
      </div>
    </div>
  );
}
