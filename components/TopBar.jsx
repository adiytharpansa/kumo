'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '../lib/supabase';

// Bar atas: logo "kumo." di kiri. Di kanan HANYA tampil foto
// profil pengguna SETELAH masuk (permintaan pengguna): lingkaran
// berisi foto akun (user_metadata.avatar_url/picture) bila ada,
// atau inisial email di lingkaran gradasi. Belum masuk = kanan
// kosong. Ketuk foto -> halaman Profil (/akun).
// Di beranda bar melayang transparan di atas hero.
export default function TopBar() {
  const pathname = usePathname() || '/';
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data && data.session ? data.session.user : null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session ? session.user : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const hm = pathname === '/';
  const meta = (user && user.user_metadata) || {};
  const photo = meta.avatar_url || meta.picture || null;
  const initial = user && user.email ? user.email[0].toUpperCase() : '';

  return (
    <header className={hm ? 'top hm' : 'top'}>
      <Link href="/" className="logo">
        kumo<i>.</i>
      </Link>
      {user ? (
        <Link href="/akun" className="ib avb" aria-label="Profil" style={{ overflow: 'hidden', padding: 0 }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt="Foto profil"
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
            />
          ) : (
            initial
          )}
        </Link>
      ) : null}
    </header>
  );
}
