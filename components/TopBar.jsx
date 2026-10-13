'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { fetchOwnProfile, profileDisplayName, profileInitial, profilePhoto } from '../lib/profile';

// Bar atas: logo "kumo." di kiri; di kanan SELALU ada lingkaran
// profil menuju /akun. Setelah masuk lingkaran menampilkan foto
// profil (tabel profiles / metadata akun) bila ada, selain itu
// inisial nama/email. Belum masuk: lingkaran berisi ikon orang,
// sebagai pintu masuk ke halaman Profil/Masuk.
// Di beranda bar melayang transparan di atas hero.
export default function TopBar() {
  const pathname = usePathname() || '/';
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;

    const apply = async (session) => {
      const nextUser = session ? session.user : null;
      if (!alive) return;
      setUser(nextUser);
      setProfile(null);
      if (nextUser) {
        const own = await fetchOwnProfile(nextUser);
        if (alive) setProfile(own);
      }
    };

    supabase.auth.getSession().then(({ data }) => apply(data && data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      apply(session);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const hm = pathname === '/';
  const photo = profilePhoto(user, profile);
  const name = profileDisplayName(user, profile);
  const initial = profileInitial(user, profile);

  return (
    <header className={hm ? 'top hm' : 'top'}>
      <Link href="/" className="logo">
        kumo<i>.</i>
      </Link>
      <Link
        href="/akun"
        className="ib avb profile-btn"
        aria-label={user ? `Profil ${name}` : 'Profil — masuk atau buat akun'}
        title={user ? name : 'Profil'}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="Foto profil" />
        ) : user ? (
          initial
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
              fill="currentColor"
            />
            <path
              d="M4.6 20.1c.8-3.2 3.8-5.1 7.4-5.1s6.6 1.9 7.4 5.1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </Link>
    </header>
  );
}
