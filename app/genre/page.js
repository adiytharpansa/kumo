import Link from 'next/link';
import { getTrending, searchTitles } from '../../lib/provider';
import MediaCard from '../../components/MediaCard';

export const revalidate = 300;

// Genre asli dari basis data sumber (nama Inggris sesuai data).
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

const titleOf = (item) =>
  typeof item?.title === 'string' ? item.title : item?.title?.english || item?.title?.romaji || '';

// Halaman Genre sesuai desain: chip genre yang dapat digeser,
// chip urutan (Populer / A–Z), hitungan judul, lalu grid poster.
// Hasil genre = pencarian sumber (data asli), bukan katalog tanam.
export default async function GenrePage({ searchParams }) {
  const sp = (await searchParams) || {};
  const g = (sp.g || '').trim();
  const so = sp.so === 'az' ? 'az' : 'pop';

  const data = g ? await searchTitles(g) : await getTrending();
  let results = [...((data && data.results) || [])];
  if (so === 'az') results.sort((a, b) => titleOf(a).localeCompare(titleOf(b)));

  const chipHref = (genre, sort) =>
    `/genre?${new URLSearchParams({ ...(genre ? { g: genre } : {}), ...(sort === 'az' ? { so: 'az' } : {}) }).toString()}`;

  return (
    <div>
      <h2 className="sec" style={{ marginTop: 12 }}>
        Genre
      </h2>
      <div className="chips nowrap">
        <Link href={chipHref('', so)} className={`chip${!g ? ' on' : ''}`}>
          Semua
        </Link>
        {GENRES.map((genre) => (
          <Link key={genre} href={chipHref(genre, so)} className={`chip${g === genre ? ' on' : ''}`}>
            {genre}
          </Link>
        ))}
      </div>
      <div className="chips" style={{ marginTop: 10 }}>
        <Link href={chipHref(g, 'pop')} className={`chip${so === 'pop' ? ' on' : ''}`}>
          Populer
        </Link>
        <Link href={chipHref(g, 'az')} className={`chip${so === 'az' ? ' on' : ''}`}>
          A–Z
        </Link>
      </div>

      <h2 className="sec" style={{ fontSize: 18, marginTop: 24 }}>
        {results.length} anime{g ? ` · ${g}` : ''}
      </h2>
      {results.length ? (
        <div className="grid">
          {results.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="empty">Belum ada judul untuk genre ini.</div>
      )}
    </div>
  );
}
