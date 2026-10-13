'use client';

import { useEffect, useState } from 'react';
import MediaCard from '../../components/MediaCard';
import { readList, LIST_EVENT, syncList } from '../../lib/list';

// Pustaka > Daftarku: judul yang disimpan pengguna. Lokal-pertama
// (localStorage); tersinkron ke Supabase (tabel user_data, kunci
// 'kumonime_list') bila pengguna masuk.
export default function MyListPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const refresh = () => setItems(readList());
    refresh();
    // Tarik versi cloud sekali saat halaman dibuka (bila masuk).
    syncList().then(refresh).catch(() => {});
    window.addEventListener(LIST_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(LIST_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 14px' }}>Pustaka</h1>
      <div className="ktabs">
        <b className="on">Daftarku{items.length ? ` (${items.length})` : ''}</b>
      </div>
      <p style={{ color: 'var(--mu)', fontSize: 12, marginBottom: 14 }}>
        Tersimpan di perangkat ini — dan tersinkron ke akunmu saat masuk.
      </p>
      {items.length ? (
        <div className="pgrid">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="empty">Daftar simpananmu masih kosong</div>
      )}
    </div>
  );
}
