// Kumo Cloudflare Worker — adaptasi dari server.js (plain JS)
// Cloudflare Workers tidak support: http module, fs, crypto (native)
// Solusi: pakai fetch/undici native + Web Crypto API + nodejs_compat flag

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { timingSafeEqual } from 'node:crypto';

// ---- Config dari env (diisi per-request dari c.env, bukan globalThis) ----
let SB = '', PUB = '', SECRET_KEY = '', ADMIN_KEY = '', ORIGIN = '*', ANILIST_PROXY_URL = 'https://graphql.anilist.co';

// ---- Hono app ----
const app = new Hono();

app.use('*', async (c, next) => {
  const e = c.env || {};
  SB = (e.SUPABASE_URL || '').replace(/\/$/, '');
  PUB = e.SUPABASE_PUBLISHABLE_KEY || '';
  SECRET_KEY = e.SUPABASE_SECRET_KEY || '';
  ADMIN_KEY = e.ADMIN_KEY || '';
  ORIGIN = e.CORS_ORIGIN || '*';
  ANILIST_PROXY_URL = e.ANILIST_PROXY_URL || 'https://graphql.anilist.co';
  await next();
});

app.use('*', cors({
  origin: ORIGIN,
  allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// ---- Util ----
class HttpError extends Error {
  constructor(code, msg) { 
    super(msg); 
    this.code = code; 
  }
}
const fail = (c, m) => { throw new HttpError(c, m); };
const same = (a, b) => timingSafeEqual(Buffer.from(a), Buffer.from(b));

const hits = new Map();
const limited = (key, max, win = 60000) => {
  const n = Date.now(), h = hits.get(key);
  if (!h || n > h.t) { hits.set(key, { t: n + win, c: 1 }); return false; }
  return ++h.c > max;
};

// ---- Supabase REST helper ----
async function sb(path, { method = 'GET', token, key = PUB, body, prefer } = {}) {
  const r = await fetch(SB + path, {
    method,
    signal: AbortSignal.timeout(10000),
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  let j = null;
  try { j = t ? JSON.parse(t) : null; } catch { }
  if (!r.ok) throw Object.assign(new Error(j?.msg || j?.message || j?.error_description || String(r.status)), { status: r.status, code: j?.error_code || j?.code });
  return j;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const userCache = new Map();

async function getUser(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  if (!token) fail(401, 'Sesi berakhir, silakan masuk lagi');
  const c = userCache.get(token);
  if (c && c.t > Date.now()) return c.u;
  try {
    const u = await sb('/auth/v1/user', { token });
    if (!UUID.test(u.id)) throw 0;
    const user = { id: u.id, email: u.email, name: u.user_metadata?.name || 'Penonton', token };
    userCache.set(token, { u: user, t: Date.now() + 60000 });
    if (userCache.size > 1000) userCache.delete(userCache.keys().next().value);
    return user;
  } catch { fail(401, 'Sesi berakhir, silakan masuk lagi'); }
}

// ---- AniList GraphQL (dengan cache) ----
const cache = new Map();

async function gql(query, variables, ttl = 600000) {
  const key = query + JSON.stringify(variables);
  const c = cache.get(key);
  if (c && c.t > Date.now()) return c.v;
  try {
    const proxyUrl = ANILIST_PROXY_URL;
    const r = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'Kumo/1.1 (https://github.com/adiytharpansa/kumo)' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10000),
    });
    if (r.status === 404) fail(404, 'Anime tidak ditemukan');
    if (r.status === 429) fail(429, 'AniList rate-limit, coba lagi sebentar'); if (!r.ok) fail(502, 'AniList sedang bermasalah (' + r.status + ')');
    const j = await r.json();
    cache.set(key, { v: j.data, t: Date.now() + ttl });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return j.data;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (c) return c.v;
    throw e instanceof HttpError ? e : new HttpError(502, 'AniList tidak bisa dijangkau');
  }
}

const MEDIA = `id title{romaji english userPreferred} description(asHtml:false) genres averageScore status episodes
  nextAiringEpisode{episode} studios(isMain:true){nodes{name}} seasonYear coverImage{large extraLarge} bannerImage`;
const STATUS = { RELEASING: 'Ongoing', HIATUS: 'Ongoing', FINISHED: 'Completed', CANCELLED: 'Completed', NOT_YET_RELEASED: 'Not yet aired' };
const mapMedia = (m) => ({
  id: m.id, title: m.title, image: m.coverImage?.extraLarge || m.coverImage?.large,
  cover: m.bannerImage || m.coverImage?.extraLarge, description: m.description,
  rating: m.averageScore, status: STATUS[m.status] || 'Ongoing', genres: m.genres || [],
  totalEpisodes: m.episodes, currentEpisode: m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : (m.episodes || 12),
});
const lastEp = (m) => m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : (m.episodes || 12);
const clampInt = (v, d, lo, hi) =>
  Math.min(hi, Math.max(lo, Number.isFinite(+v) && v !== null && v !== '' ? Math.trunc(+v) : d));

// ---- Routes: AniList Katalog ----
app.get('/meta/anilist/trending', async (c) => {
  if (limited('g:' + (c.req.header('x-forwarded-for') || 'unknown'), 120)) fail(429, 'Terlalu banyak permintaan');
  const perPage = clampInt(c.req.query('perPage'), 24, 1, 50);
  const d = await gql(`query($n:Int){Page(perPage:$n){media(type:ANIME,isAdult:false,sort:TRENDING_DESC){${MEDIA}}}}`, { n: perPage });
  return c.json({ results: d.Page.media.map(mapMedia) });
});

app.get('/meta/anilist/info/:id', async (c) => {
  const user = await getUser(c.req.raw);
  const id = clampInt(c.req.param('id'), 0, 0, 1e9);
  if (!id) fail(400, 'ID tidak valid');
  const d = await gql(`query($id:Int){Media(id:$id,type:ANIME,isAdult:false){${MEDIA}}}`, { id }, 1800000);
  const m = d.Media;
  const have = await sb(`/rest/v1/episodes?anime_id=eq.${id}&select=number,title&order=number`, { token: user.token }).catch(() => []);
  const titles = new Map(have.map((r) => [r.number, r.title]));
  const max = Math.min(500, Math.max(lastEp(m), ...have.map((r) => r.number), 0));
  const episodes = Array.from({ length: max }, (_, i) => ({
    id: `${id}-${i + 1}`, number: i + 1, title: titles.get(i + 1) || null, available: titles.has(i + 1)
  }));
  return c.json({ ...mapMedia(m), episodes });
});

app.get('/meta/anilist/watch/:epId', async (c) => {
  const user = await getUser(c.req.raw);
  const m = /^(\d+)-(\d+)$/.exec(c.req.param('epId'));
  if (!m) fail(400, 'ID episode tidak valid');
  const r = (await sb(`/rest/v1/episodes?anime_id=eq.${+m[1]}&number=eq.${+m[2]}&select=url`, { token: user.token }).catch(() => []))[0];
  if (!r) fail(404, 'Sumber video belum tersedia');
  return c.json({ sources: [{ url: r.url, quality: 'default', isM3U8: /\.m3u8(\?|$)/i.test(r.url) }] });
});

app.get('/meta/anilist/:query', async (c) => {
  const q = c.req.param('query').trim();
  if (q.length < 1 || q.length > 100) fail(400, 'Kata kunci tidak valid');
  const d = await gql(`query($q:String){Page(perPage:20){media(search:$q,type:ANIME,isAdult:false,sort:SEARCH_MATCH){${MEDIA}}}}`, { q });
  return c.json({ results: d.Page.media.map(mapMedia) });
});

app.get('/api/schedule', async (c) => {
  const from = Math.floor(Date.now() / 3600000) * 3600;
  const to = from + 7 * 86400;
  const d = await gql(`query($a:Int,$b:Int){Page(perPage:50){airingSchedules(airingAt_greater:$a,airingAt_lesser:$b,sort:TIME){airingAt episode media{id title{romaji english} coverImage{large} isAdult}}}}`, { a: from, b: to }, 900000);
  return c.json({ results: d.Page.airingSchedules.filter((s) => !s.media.isAdult).map((s) => ({
    animeId: s.media.id, title: s.media.title.english || s.media.title.romaji,
    image: s.media.coverImage.large, episode: s.episode, airingAt: s.airingAt })) });
});

// ---- Auth (Supabase) ----
const validEmail = (e) => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const session = (r) => ({ token: r.access_token, refresh: r.refresh_token, user: { id: r.user.id, email: r.user.email, name: r.user.user_metadata?.name || 'Penonton' } });
const authErr = (e) => {
  if (e.status === 429) fail(429, 'Terlalu banyak percobaan, coba lagi nanti');
  if (e.code === 'email_not_confirmed') fail(403, 'Email belum dikonfirmasi. Cek kotak masukmu.');
  if (e.code === 'user_already_exists' || /already registered/i.test(e.message)) fail(409, 'Email sudah terdaftar');
  if (e.code === 'weak_password') fail(400, 'Kata sandi terlalu lemah');
  if (e.status >= 500) fail(502, 'Layanan akun sedang bermasalah');
  if (e.code === 'invalid_credentials') fail(401, 'Email atau kata sandi salah');
  fail(400, 'Permintaan akun ditolak');
};

app.post('/api/auth/register', async (c) => {
  if (limited('a:/api/auth/register:' + (c.req.header('x-forwarded-for') || 'unknown'), 5)) fail(429, 'Terlalu banyak percobaan');
  const body = await c.req.json();
  const email = String(body.email || '').trim().toLowerCase();
  const pw = body.password;
  const name = String(body.name || 'Penonton').trim().slice(0, 40) || 'Penonton';
  if (!validEmail(email)) fail(400, 'Email tidak valid');
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 72) fail(400, 'Kata sandi 8-72 karakter');
  try {
    const r = await sb('/auth/v1/signup', { method: 'POST', body: { email, password: pw, data: { name } } });
    return c.json(r?.access_token ? session(r) : { confirm: true, message: 'Cek email-mu untuk konfirmasi, lalu masuk.' });
  } catch (e) { authErr(e); }
});

app.post('/api/auth/login', async (c) => {
  if (limited('a:/api/auth/login:' + (c.req.header('x-forwarded-for') || 'unknown'), 10)) fail(429, 'Terlalu banyak percobaan');
  const body = await c.req.json();
  try {
    return c.json(session(await sb('/auth/v1/token?grant_type=password', {
      method: 'POST', body: { email: String(body.email || '').trim().toLowerCase(), password: String(body.password || '') }
    })));
  } catch (e) { authErr(e); }
});

app.post('/api/auth/refresh', async (c) => {
  if (limited('a:/api/auth/refresh:' + (c.req.header('x-forwarded-for') || 'unknown'), 30)) fail(429, 'Terlalu banyak percobaan');
  const body = await c.req.json();
  if (typeof body.refresh !== 'string' || body.refresh.length > 500) fail(400, 'Token tidak valid');
  try { return c.json(session(await sb('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: body.refresh } }))); }
  catch { fail(401, 'Sesi berakhir, silakan masuk lagi'); }
});

app.get('/api/me', async (c) => {
  const user = await getUser(c.req.raw);
  return c.json({ user: { id: user.id, email: user.email, name: user.name } });
});

// ---- Sync (RLS) ----
app.get('/api/sync', async (c) => {
  const user = await getUser(c.req.raw);
  const r = (await sb(`/rest/v1/sync_state?user_id=eq.${user.id}&select=data,updated_at`, { token: user.token }))[0];
  return c.json(r ? { data: r.data, updatedAt: Date.parse(r.updated_at) } : { data: null, updatedAt: 0 });
});

app.put('/api/sync', async (c) => {
  const user = await getUser(c.req.raw);
  const body = await c.req.json();
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) fail(400, 'Data tidak valid');
  if (JSON.stringify(body.data).length > 350000) fail(413, 'Data terlalu besar');
  const r = await sb('/rest/v1/sync_state?on_conflict=user_id', {
    method: 'POST', token: user.token, prefer: 'resolution=merge-duplicates,return=representation',
    body: { user_id: user.id, data: body.data, updated_at: new Date().toISOString() }
  });
  return c.json({ updatedAt: Date.parse(r[0].updated_at) });
});

// ---- Admin Episodes ----
const epArgs = (b) => {
  const animeId = clampInt(b.animeId, 0, 0, 1e9);
  const number = clampInt(b.number, 0, 0, 5000);
  if (!animeId || !number) fail(400, 'animeId dan number wajib berupa angka positif');
  return { animeId, number };
};
const needSecret = () => { if (!SECRET_KEY) fail(503, 'SUPABASE_SECRET_KEY belum diisi'); };

app.post('/api/admin/episodes', async (c) => {
  needSecret();
  if (!same(c.req.header('x-admin-key') || '', ADMIN_KEY)) fail(403, 'Kunci admin salah');
  const body = await c.req.json();
  const { animeId, number } = epArgs(body);
  if (typeof body.url !== 'string' || !/^https?:\/\/\S+$/.test(body.url) || body.url.length > 2000) fail(400, 'url harus http(s)');
  await sb('/rest/v1/episodes?on_conflict=anime_id,number', {
    method: 'POST', key: SECRET_KEY, prefer: 'resolution=merge-duplicates,return=minimal',
    body: { anime_id: animeId, number, title: body.title ? String(body.title).slice(0, 200) : null, url: body.url }
  });
  return c.json({ ok: true, id: `${animeId}-${number}` });
});

app.get('/api/admin/episodes', async (c) => {
  needSecret();
  if (!same(c.req.header('x-admin-key') || '', ADMIN_KEY)) fail(403, 'Kunci admin salah');
  return c.json({ results: await sb('/rest/v1/episodes?select=anime_id,number,title,url&order=anime_id,number&limit=1000', { key: SECRET_KEY }) });
});

app.delete('/api/admin/episodes/:animeId/:number', async (c) => {
  needSecret();
  if (!same(c.req.header('x-admin-key') || '', ADMIN_KEY)) fail(403, 'Kunci admin salah');
  const { animeId, number } = epArgs(c.req.param());
  const r = await sb(`/rest/v1/episodes?anime_id=eq.${animeId}&number=eq.${number}`, { method: 'DELETE', key: SECRET_KEY, prefer: 'return=representation' });
  return c.json({ deleted: r.length });
});

app.get('/health', (c) => c.json({ ok: true }));

// ---- Static frontend (public/) via Workers Static Assets ----
app.get('*', async (c) => {
  try {
    if (!c.env.ASSETS) return c.json({ error: 'Tidak ditemukan' }, 404);
    const asset = await c.env.ASSETS.fetch(c.req.raw);
    if (asset.status !== 404) return asset;
    return c.env.ASSETS.fetch(new Request(new URL('/', c.req.url)));
  } catch {
    return c.json({ error: 'Tidak ditemukan' }, 404);
  }
});

// ---- Error handler ----
app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.code);
  console.error(err);
  return c.json({ error: 'Terjadi kesalahan di server' }, 500);
});

export default app;
