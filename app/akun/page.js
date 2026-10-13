'use client';

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { readList, syncList, LIST_EVENT } from '../../lib/list';

// Halaman Akun sesuai berkas desain pengguna: avatar gradasi,
// nama/email, statistik (Daftarku dari data asli perangkat),
// grup pengaturan, dan tombol Keluar merah.
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

  useEffect(() => {
    const refreshCount = () => setListCount(readList().length);
    refreshCount();
    window.addEventListener(LIST_EVENT, refreshCount);
    window.addEventListener('storage', refreshCount);
    return () => {
      window.removeEventListener(LIST_EVENT, refreshCount);
      window.removeEventListener('storage', refreshCount);
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
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 14px' }}>Akun</h1>
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

  const initial = (user && user.email ? user.email[0] : '☺').toUpperCase();

  return (
    <div>
      <div style={{ textAlign: 'center', paddingTop: 20 }}>
        <div
          aria-hidden
          style={{
            width: 84,
            height: 84,
            margin: '0 auto 10px',
            borderRadius: '50%',
            background: 'linear-gradient(145deg,#2d7ff9,#41295a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 34,
            fontWeight: 800,
            color: '#fff',
          }}
        >
          {initial}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>{user ? user.email : 'Akun'}</h1>
        <p style={{ color: 'var(--mu)', fontSize: 12 }}>
          {user ? 'Kamu sedang masuk' : 'Belum masuk'}
        </p>
      </div>

      <div className="st">
        <div>
          <b>{listCount}</b>
          <small>Daftarku</small>
        </div>
        <div>
          <b>{user ? 'Aktif' : '—'}</b>
          <small>Status Akun</small>
        </div>
        <div>
          <b>{user ? 'Otomatis' : '—'}</b>
          <small>Sinkronisasi</small>
        </div>
      </div>

      {user ? (
        <>
          <div className="sh">AKUN</div>
          <div className="sg">
            <div className="sr">
              <span className="si">☺</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Detail akun
                <small style={{ display: 'block', color: 'var(--mu)', fontSize: 11 }}>{user.email}</small>
              </span>
            </div>
            <div className="sr">
              <span className="si">↻</span>
              <span style={{ flex: 1 }}>
                Sinkronkan Daftarku
                <small style={{ display: 'block', color: 'var(--mu)', fontSize: 11 }}>
                  {syncMsg || 'Tersimpan di perangkat dan di akunmu'}
                </small>
              </span>
              <button type="button" onClick={manualSync} className="kbtn" style={{ padding: '8px 12px', fontSize: 12 }}>
                Sinkron
              </button>
            </div>
          </div>
          <button type="button" className="out" onClick={signOut}>
            ⎋ Keluar
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          <div className="sh">{mode === 'signup' ? 'BUAT AKUN' : 'MASUK'}</div>
          <div className="sg" style={{ padding: 14 }}>
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
          </div>
          <button type="submit" disabled={busy} className="kbtn" style={{ width: '100%', marginTop: 14 }}>
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
          <p style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.6, marginTop: 10 }}>
            Masuk bersifat opsional — hanya untuk menyinkronkan Daftarku antar perangkat. Menjelajah
            dan menonton tidak pernah memerlukan akun.
          </p>
        </form>
      )}
    </div>
  );
}
