'use client';

import { useEffect, useState } from 'react';
import { readList, setItemStatus, LIST_EVENT } from '../lib/list';

const OPTS = [
  ['want', 'Ingin ditonton'],
  ['watching', 'Sedang ditonton'],
  ['done', 'Selesai'],
];

// Chip status Daftarku sesuai desain — tampil hanya bila judul
// sudah ada di Daftarku; mengubah status lokal (ikut tersinkron).
export default function ListStatus({ id }) {
  const [st, setSt] = useState(null);

  useEffect(() => {
    const sync = () => {
      const item = readList().find((x) => x.id === id);
      setSt(item ? item.st || 'want' : null);
    };
    sync();
    window.addEventListener(LIST_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(LIST_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [id]);

  if (!st) return null;

  return (
    <div className="chips" style={{ padding: 0, marginTop: 14 }}>
      {OPTS.map(([k, label]) => (
        <button
          key={k}
          type="button"
          className={st === k ? 'chip on' : 'chip'}
          onClick={() => {
            setItemStatus(id, k);
            setSt(k);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
