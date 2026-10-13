'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Navigasi bawah 5 tab sesuai berkas desain pengguna:
// Beranda / Jadwal / Jelajahi / Pustaka / Akun.
// Disembunyikan di halaman nonton agar pemutar bersih
// (di desain, layar putar adalah lapisan di atas navigasi).
const TABS = [
  { href: '/', icon: '⌂', label: 'Beranda', match: (p) => p === '/' },
  { href: '/jadwal', icon: '▦', label: 'Jadwal', match: (p) => p.startsWith('/jadwal') },
  { href: '/jelajahi', icon: '◎', label: 'Jelajahi', match: (p) => p.startsWith('/jelajahi') },
  { href: '/my-list', icon: '❖', label: 'Pustaka', match: (p) => p.startsWith('/my-list') },
  { href: '/akun', icon: '☺', label: 'Akun', match: (p) => p.startsWith('/akun') },
];

export default function BottomNav() {
  const pathname = usePathname() || '/';
  if (pathname.startsWith('/watch')) return null;
  return (
    <nav className="bnav">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={t.match(pathname) ? 'on' : ''}>
          <span>{t.icon}</span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
