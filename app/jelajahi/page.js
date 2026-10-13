import Link from 'next/link';
import { getTrending, searchTitles } from '../../lib/provider';
import MediaCard from '../../components/MediaCard';

export const revalidate = 300;

// Genre asli yang dipakai sebagai chip pencarian (hasilnya data asli
// dari pencarian sumber, bukan katalog tanam).
const GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Romance',
  'School',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
];

// Halaman Jelajahi sesuai desain: pencarian + chip genre + grid
// poster 3 kolom. Tanpa kata kunci -> judul tren; dengan kata
// kunci/genre -> hasil pencarian sumber.
export default async function JelajahiPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = (sp.q || '').trim();
  const g = (sp.g || '').trim();
  const term = q || g;

  const data = term ? await searchTitles(term) : await getTrending();
  const results = (data && data.results) || [];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 14px' }}>Jelajahi</h1>

      <form action="/jelajahi" className="ksearch">
        <span aria-hidden>⌕</span>
        <input name="q" defaultValue={q} placeholder="Cari judul" aria-label="Cari judul" />
      </form>

      <div className="kchips">
        <Link href="/jelajahi" className={`kchip${!term ? ' on' : ''}`}>
          Semua
        </Link>
        {GENRES.map((genre) => (
          <Link
            key={genre}
            href={`/jelajahi?g=${encodeURIComponent(genre)}`}
            className={`kchip${g === genre ? ' on' : ''}`}
          >
            {genre}
          </Link>
        ))}
      </div>

      {term ? (
        <p style={{ color: 'var(--mu)', fontSize: 12, marginBottom: 12 }}>
          Hasil untuk “{term}” — {results.length} judul
        </p>
      ) : null}

      {results.length ? (
        <div className="pgrid">
          {results.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="empty">
          {term ? `Tidak ada hasil untuk “${term}”.` : 'Belum ada judul yang bisa ditampilkan.'}
        </div>
      )}
    </div>
  );
}
