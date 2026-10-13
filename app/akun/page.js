'use client';

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { syncList } from '../../lib/list';

// Account page: email + password sign-in against the owner's Supabase
// project ("kumo"). Password auth is used (instead of magic links) so
// sign-in works on any domain without redirect configuration.
export default function AccountPage() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('signin');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data && data.session ? data.session.user : null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session ? session.user : null);
      if (event === 'SIGNED_IN') {
        syncList().then((r) => setSyncMsg(r.ok ? 'My List synced.' : ''));
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="pt-10">
        <h1 className="text-2xl font-extrabold">Account</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
          Accounts are not configured on this deployment yet (Supabase environment variables are
          missing). Browsing and My List still work locally on this device.
        </p>
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
          setMsg('Account created and signed in.');
        } else {
          setMsg('Account created. Please confirm via the email we sent, then sign in here.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMsg('Signed in.');
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
    setSyncMsg('Syncing…');
    const r = await syncList();
    setSyncMsg(r.ok ? 'My List synced just now.' : `Sync failed: ${r.reason || 'unknown'}`);
  }

  return (
    <div className="pt-10">
      <h1 className="text-2xl font-extrabold">Account</h1>
      {user ? (
        <div className="mt-4 max-w-xl">
          <p className="text-sm text-zinc-300">
            Signed in as <span className="font-semibold text-white">{user.email}</span>
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Your My List is stored on this device and synced to your account.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={manualSync}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Sync My List now
            </button>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/15"
            >
              Sign out
            </button>
          </div>
          {syncMsg ? <p className="mt-3 text-sm text-zinc-400">{syncMsg}</p> : null}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 max-w-md space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-white/5 px-3 py-2.5 text-sm text-white ring-1 ring-white/15 outline-none focus:ring-violet-400"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-white/5 px-3 py-2.5 text-sm text-white ring-1 ring-white/15 outline-none focus:ring-violet-400"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signup' ? 'signin' : 'signup');
              setMsg('');
            }}
            className="w-full text-center text-xs text-zinc-400 underline underline-offset-2"
          >
            {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </button>
          {msg ? <p className="text-sm text-zinc-300">{msg}</p> : null}
          <p className="text-xs leading-relaxed text-zinc-500">
            Signing in is optional — it only syncs your My List across devices. Browsing and
            watching never require an account.
          </p>
        </form>
      )}
    </div>
  );
}
