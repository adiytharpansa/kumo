'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Navigasi bawah sesuai berkas desain: 5 tab Beranda / Genre /
// Terbaru / Cari / Daftarku dengan ikon SVG; tab aktif berwarna
// aksen dengan pil tint di belakang ikon. Disembunyikan di
// halaman nonton agar pemutar bersih.
const I = ({ d, extra }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {d}
    {extra}
  </svg>
);

const TABS = [
  {
    href: '/',
    label: 'Beranda',
    match: (p) => p === '/',
    icon: (
      <I d={<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />} />
    ),
  },
  {
    href: '/genre',
    label: 'Genre',
    match: (p) => p.startsWith('/genre'),
    icon: (
      <I
        d={
          <>
            <rect x="3" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="3" width="7" height="7" rx="2" />
            <rect x="3" y="14" width="7" height="7" rx="2" />
            <rect x="14" y="14" width="7" height="7" rx="2" />
          </>
        }
      />
    ),
  },
  {
    href: '/terbaru',
    label: 'Terbaru',
    match: (p) => p.startsWith('/terbaru'),
    icon: (
      <I
        d={
          <>
            <rect x="3" y="5" width="18" height="14" rx="3.5" />
            <path d="M10.2 9.4l4.6 2.6-4.6 2.6z" />
          </>
        }
      />
    ),
  },
  {
    href: '/cari',
    label: 'Cari',
    match: (p) => p.startsWith('/cari'),
    icon: (
      <I
        d={
          <>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </>
        }
      />
    ),
  },
  {
    href: '/my-list',
    label: 'Daftarku',
    match: (p) => p.startsWith('/my-list'),
    icon: (
      <I
        d={
          <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.5 3.3 5 6.8 5c2 0 3.6 1.1 5.2 3 1.6-1.9 3.2-3 5.2-3 3.5 0 5.6 3.5 4.3 6.8C19.5 16.4 12 21 12 21z" />
        }
      />
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname() || '/';
  if (pathname.startsWith('/watch')) return null;
  return (
    <nav className="bnav">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={t.match(pathname) ? 'on' : ''}>
          <span className="nip">{t.icon}</span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
