import './globals.css';
import AppShell from '../components/AppShell';

export const metadata = {
  title: 'Kumo',
  description: 'Kumo — katalog dan tontonan anime dengan data langsung dari sumbernya.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b0d12',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
