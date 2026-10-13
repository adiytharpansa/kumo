import TopBar from './TopBar';
import BottomNav from './BottomNav';

// Kerangka aplikasi sesuai berkas desain: kolom tengah, bar atas
// lengket (melayang di beranda), navigasi bawah 5 tab.
export default function AppShell({ children }) {
  return (
    <div className="appcol">
      <TopBar />
      <main>{children}</main>
      <BottomNav />
    </div>
  );
}
