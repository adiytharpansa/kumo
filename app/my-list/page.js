'use client';

import { useEffect, useState } from 'react';
import MediaCard from '../../components/MediaCard';
import { readList, LIST_EVENT, syncList } from '../../lib/list';

// My List: judul yang disimpan pengguna. Lokal-pertama (localStorage);
// tersinkron ke Supabase (tabel user_data, kunci 'kumonime_list') bila
// pengguna masuk.
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
    <div className="pt-5">
      <h1 className="mb-1 text-lg font-bold">My List</h1>
      <p className="mb-4 text-xs text-zinc-500">
        Saved on this device — and synced to your account when you are signed in.
      </p>
      {items.length ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">
          Nothing saved yet. Open any title and tap “Add to My List”.
        </p>
      )}
    </div>
  );
}
