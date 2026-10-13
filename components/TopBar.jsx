'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Bar atas sesuai desain: logo "kumo." bertanda gradasi di kiri.
// (Tombol avatar kanan atas dihapus atas permintaan pengguna —
// halaman Profil tetap ada di /akun.)
// Di beranda bar melayang transparan di atas hero.
export default function TopBar() {
  const pathname = usePathname() || '/';
  const hm = pathname === '/';
  return (
    <header className={hm ? 'top hm' : 'top'}>
      <Link href="/" className="logo">
        <span className="lm">☁</span>
        kumo<i>.</i>
      </Link>
    </header>
  );
}
