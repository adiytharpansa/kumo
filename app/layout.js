import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Media Hub — Dynamic Media Metadata Aggregation',
  description: 'Educational boilerplate: server-side media metadata aggregation hub.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b0b14',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0b14]/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
            <Link href="/" className="text-lg font-extrabold tracking-tight">
              MEDIA<span className="text-violet-400">HUB</span>
            </Link>
            <span className="ml-3 hidden text-xs text-zinc-500 sm:inline">
              Dynamic Media Metadata Aggregation
            </span>
            <nav className="ml-auto flex items-center gap-4 text-sm font-medium text-zinc-300">
              <Link href="/my-list" className="transition hover:text-white">
                My List
              </Link>
              <Link href="/akun" className="transition hover:text-white">
                Account
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-16">{children}</main>
      </body>
    </html>
  );
}
