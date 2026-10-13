'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { readList, syncList, LIST_EVENT } from '../../lib/list';
import { readHistory, HISTORY_KEY } from '../../components/ContinueWatching';

// Halaman Profil sesuai berkas desain: avatar gradasi + nama,
// statistik (Daftarku asli dari perangkat), grup akun/sinkron,
// riwayat tontonan lokal, dan tombol Keluar.
// Masuk memakai email + kata sandi ke proyek Supabase "kumo"
// milik pengguna (tanpa tautan ajaib agar bekerja di domain apa pun).
export default function AccountPage() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [listCount, setListCount] = useState(0);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const refresh = () => {
      setListCount(readList().length);
      setHistory(readHistory());
    };
    refresh();
    window.addEventListener(LIST_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(LIST_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data && data.session ? data.session.user : null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session ? session.user : null);
      if (event === 'SIGNED_IN') {
        syncList().then((r) => setSyncMsg(r.ok ? 'Daftarku tersinkron.' : ''));
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div>
        <h2 className="sec" style={{ marginTop: 12 }}>
          Profil
        </h2>
        <div className="empty">
          Akun belum dikonfigurasi di penerapan ini (variabel lingkungan Supabase belum terpasang).
          Menjelajah dan Daftarku tetap bekerja lokal di perangkat ini.
        </div>
      </div>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          setMsg('Akun dibuat dan kamu sudah masuk.');
        } else {
          setMsg('Akun dibuat. Silakan konfirmasi lewat email yang kami kirim, lalu masuk di sini.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMsg('Berhasil masuk.');
      }
    } catch (err) {
      setMsg(String((err && err.message) || err));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSyncMsg('');
  }

  async function manualSync() {
    setSyncMsg('Menyinkronkan…');
    const r = await syncList();
    setSyncMsg(r.ok ? 'Daftarku baru saja tersinkron.' : `Sinkron gagal: ${r.reason || 'tidak diketahui'}`);
  }

  function clearHistory() {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {}
    setHistory([]);
  }

  const initial = (user && user.email ? user.email[0] : '☺').toUpperCase();

  return (
    <div>
      <div className="pf">
        <div className="av" aria-hidden>
          {initial}
        </div>
        <div className="who">
          <b>{user ? user.email : 'Penonton'}</b>
          <small>{user ? 'Kamu sedang masuk' : 'Belum masuk — Daftarku tersimpan lokal'}</small>
        </div>
      </div>

      <div className="stt" style={{ margin: '16px 18px 0' }}>
        <div>
          <b>{listCount}</b>
          <span>Daftarku</span>
        </div>
        <div>
          <b>{history.length}</b>
          <span>Riwayat</span>
        </div>
        <div>
          <b>{user ? 'Aktif' : '—'}</b>
          <span>Akun</span>
        </div>
      </div>

      {user ? (
        <>
          <div className="secttl">AKUN</div>
          <div className="sg">
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              Masuk sebagai <b>{user.email}</b>. Daftarku tersimpan di perangkat ini dan tersinkron
              ke akunmu.
            </p>
            {syncMsg ? (
              <p style={{ fontSize: 13, color: 'var(--mu)', marginTop: 6 }}>{syncMsg}</p>
            ) : null}
            <button type="button" onClick={manualSync} className="btn go" style={{ width: '100%', marginTop: 12 }}>
              ↻ Sinkronkan Daftarku
            </button>
          </div>
          <button type="button" className="outl" onClick={signOut}>
            ⎋ Keluar
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          <div className="secttl">{mode === 'signup' ? 'BUAT AKUN' : 'MASUK'}</div>
          <div className="sg">
            <label style={{ display: 'block', marginBottom: 10 }}>
              <small style={{ display: 'block', color: 'var(--mu)', marginBottom: 4 }}>Email</small>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="kin"
                placeholder="kamu@contoh.com"
              />
            </label>
            <label style={{ display: 'block' }}>
              <small style={{ display: 'block', color: 'var(--mu)', marginBottom: 4 }}>Kata sandi</small>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="kin"
                placeholder="••••••••"
              />
            </label>
            <button type="submit" disabled={busy} className="btn go" style={{ width: '100%', marginTop: 14 }}>
              {busy ? 'Mohon tunggu…' : mode === 'signup' ? 'Buat Akun' : 'Masuk'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signup' ? 'signin' : 'signup');
                setMsg('');
              }}
              style={{
                width: '100%',
                textAlign: 'center',
                fontSize: 12,
                color: 'var(--mu)',
                textDecoration: 'underline',
                marginTop: 12,
                background: 'none',
                border: 0,
                cursor: 'pointer',
              }}
            >
              {mode === 'signup' ? 'Sudah punya akun? Masuk' : 'Baru di sini? Buat akun'}
            </button>
            {msg ? <p style={{ marginTop: 10, fontSize: 13 }}>{msg}</p> : null}
          </div>
          <p style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.6, margin: '10px 18px 0' }}>
            Masuk bersifat opsional — hanya untuk menyinkronkan Daftarku antar perangkat. Menjelajah
            dan menonton tidak pernah memerlukan akun.
          </p>
        </form>
      )}

      <h2 className="sec">Riwayat tontonan</h2>
      {history.length ? (
        <>
          <div style={{ padding: '0 18px' }}>
            {history.map((h) => (
              <Link key={h.id} href={`/watch/${encodeURIComponent(h.epId)}`} className="epl">
                <span className="th">
                  {h.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={h.image} alt="" loading="lazy" />
                  ) : null}
                </span>
                <span className="eb">
                  <b>{h.title}</b>
                  <span>Episode {h.ep}</span>
                </span>
              </Link>
            ))}
          </div>
          <div className="chips" style={{ marginTop: 12 }}>
            <button type="button" className="chip" onClick={clearHistory}>
              Hapus riwayat
            </button>
          </div>
        </>
      ) : (
        <div className="empty">Belum ada riwayat. Tonton episode pertamamu.</div>
      )}
    </div>
  );
}
