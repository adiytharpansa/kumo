import Link from 'next/link';
import { getTrending, searchTitles } from '../../lib/provider';
import MediaCard from '../../components/MediaCard';

export const revalidate = 300;

const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Sci-Fi', 'Horror'];

// Halaman Cari sesuai desain: kotak pencarian pil besar; tanpa
// kata kunci tampil chip "Sedang dicari" (judul tren), chip genre
// populer, dan grid semua anime tren; dengan kata kunci tampil
// hasil pencarian sumber (data asli).
export default async function CariPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = (sp.q || '').trim();

  const trending = await getTrending();
  const trendingList = (trending && trending.results) || [];

  let results = trendingList;
  if (q) {
    const data = await searchTitles(q);
    results = (data && data.results) || [];
  }

  return (
    <div>
      <form action="/cari" className="srch">
        <span className="sic" aria-hidden>
          ⌕
        </span>
        <input name="q" defaultValue={q} placeholder="Cari judul atau genre" aria-label="Cari judul atau genre" />
      </form>

      {!q ? (
        <>
          {trendingList.length ? (
            <>
              <h2 className="sec">Sedang dicari</h2>
              <div className="chips">
                {trendingList.slice(0, 5).map((item) => (
                  <Link
                    key={item.id}
                    href={`/details/${encodeURIComponent(item.id)}`}
                    className="chip"
                  >
                    {typeof item.title === 'string' ? item.title : item.title?.english || item.title?.romaji || ''}
                  </Link>
                ))}
              </div>
            </>
          ) : null}
          <h2 className="sec">Genre populer</h2>
          <div className="chips">
            {GENRES.map((g) => (
              <Link key={g} href={`/genre?g=${encodeURIComponent(g)}`} className="chip">
                {g}
              </Link>
            ))}
          </div>
        </>
      ) : null}

      <h2 className="sec" style={{ fontSize: 20 }}>
        {q ? 'Hasil' : 'Semua anime'}
      </h2>
      {results.length ? (
        <div className="grid">
          {results.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="empty">Tidak ada hasil untuk “{q}”. Coba kata lain atau cek ejaan.</div>
      )}
    </div>
  );
}
