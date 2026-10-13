'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '../lib/supabase';

// Bar atas sesuai desain: logo "kumo." bertanda gradasi di kiri,
// tombol avatar gradasi (inisial akun) di kanan menuju Profil.
// Di beranda bar melayang transparan di atas hero.
export default function TopBar() {
  const pathname = usePathname() || '/';
  const [initial, setInitial] = useState('☺');

  useEffect(() => {
    if (!supabase) return;
    const apply = (user) => setInitial(user && user.email ? user.email[0].toUpperCase() : '☺');
    supabase.auth.getSession().then(({ data }) => apply(data && data.session ? data.session.user : null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      apply(session ? session.user : null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const hm = pathname === '/';
  return (
    <header className={hm ? 'top hm' : 'top'}>
      <Link href="/" className="logo">
        <span className="lm">☁</span>
        kumo<i>.</i>
      </Link>
      <Link href="/akun" className="ib avb" aria-label="Profil">
        {initial}
      </Link>
    </header>
  );
}
