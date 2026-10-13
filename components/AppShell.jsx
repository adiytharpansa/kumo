'use client';

import { usePathname } from 'next/navigation';
import BottomNav from './BottomNav';

// Kerangka aplikasi sesuai desain: kolom tengah maks 480px.
// Halaman detail & nonton memakai mode "flush" (konten menempel
// ke tepi kolom untuk hero/pemutar layar penuh kolom).
export default function AppShell({ children }) {
  const pathname = usePathname() || '/';
  const flush = pathname.startsWith('/watch') || pathname.startsWith('/details');
  return (
    <div className={flush ? 'appcol flush' : 'appcol'}>
      {children}
      <BottomNav />
    </div>
  );
}
