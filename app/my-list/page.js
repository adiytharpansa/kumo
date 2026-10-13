'use client';

import { useEffect, useState } from 'react';
import MediaCard from '../../components/MediaCard';
import { readList, LIST_EVENT, syncList } from '../../lib/list';

const FILTERS = [
  ['all', 'Semua'],
  ['want', 'Ingin ditonton'],
  ['watching', 'Sedang ditonton'],
  ['done', 'Selesai'],
];

// Daftarku sesuai berkas desain: chip saring status dengan
// hitungan, lalu grid poster. Data lokal perangkat, tersinkron
// ke Supabase (user_data 'kumonime_list') bila pengguna masuk.
export default function MyListPage() {
  const [items, setItems] = useState([]);
  const [f, setF] = useState('all');

  useEffect(() => {
    const refresh = () => setItems(readList());
    refresh();
    syncList().then(refresh).catch(() => {});
    window.addEventListener(LIST_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(LIST_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const count = (k) =>
    k === 'all' ? items.length : items.filter((x) => (x.st || 'want') === k).length;
  const shown = f === 'all' ? items : items.filter((x) => (x.st || 'want') === f);

  return (
    <div>
      <h2 className="sec" style={{ marginTop: 12 }}>
        Daftarku
      </h2>
      <div className="chips nowrap" style={{ marginBottom: 16 }}>
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" className={`chip${f === k ? ' on' : ''}`} onClick={() => setF(k)}>
            {label} · {count(k)}
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="grid">
          {shown.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="empty">
          {items.length
            ? 'Tidak ada anime di kategori ini.'
            : 'Belum ada anime di daftar. Ketuk ♡ pada anime yang ingin kamu tonton nanti.'}
        </div>
      )}
    </div>
  );
}
