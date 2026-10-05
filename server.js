// Kumo backend: tanpa dependensi npm (Node >= 20). Data & akun di Supabase.
// Fitur: katalog AniList (cache), akun (Supabase Auth), sinkronisasi (RLS),
// dan sumber video milik sendiri.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const PORT = +env.PORT || 3000;
const ADMIN_KEY = env.ADMIN_KEY || '';
const ORIGIN = env.CORS_ORIGIN || '*';
const PROXY = env.TRUST_PROXY === '1';
const SB = (env.SUPABASE_URL || '').replace(/\/$/, '');
const PUB = env.SUPABASE_PUBLISHABLE_KEY || '';
const SECRET_KEY = env.SUPABASE_SECRET_KEY || ''; // opsional: hanya untuk API admin
if (!SB || !PUB) { console.error('SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY wajib diisi (lihat .env.example)'); process.exit(1); }

/* ---------- Util ---------- */
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const fail = (c, m) => { throw new HttpError(c, m); };
const same = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };

const hits = new Map();
const limited = (key, max, win = 60000) => {
  const n = Date.now(), h = hits.get(key);
  if (!h || n > h.t) { hits.set(key, { t: n + win, c: 1 }); return false; }
  return ++h.c > max;
};
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (n > v.t) hits.delete(k); }, 60000).unref();

/* ---------- Supabase (REST, tanpa library) ---------- */
// Header Authorization hanya diisi token pengguna; kunci sb_* cukup lewat header apikey.
async function sb(p, { method = 'GET', token, key = PUB, body, prefer } = {}) {
  const r = await fetch(SB + p, {
    method, signal: AbortSignal.timeout(10000),
    headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { /* bukan JSON */ }
  if (!r.ok) throw Object.assign(new Error(j?.msg || j?.message || j?.error_description || String(r.status)), { status: r.status, code: j?.error_code || j?.code });
  return j;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const userCache = new Map();
async function getUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!token) fail(401, 'Sesi berakhir, silakan masuk lagi');
  const c = userCache.get(token); if (c && c.t > Date.now()) return c.u;
  try {
    const u = await sb('/auth/v1/user', { token });
    if (!UUID.test(u.id)) throw 0;
    const user = { id: u.id, email: u.email, name: u.user_metadata?.name || 'Penonton', token };
    userCache.set(token, { u: user, t: Date.now() + 60000 });
    if (userCache.size > 1000) userCache.delete(userCache.keys().next().value);
    return user;
  } catch { fail(401, 'Sesi berakhir, silakan masuk lagi'); }
}

/* ---------- AniList (dengan cache) ---------- */
const cache = new Map();
async function gql(query, variables, ttl = 600000) {
  const key = query + JSON.stringify(variables), c = cache.get(key);
  if (c && c.t > Date.now()) return c.v;
  try {
    const r = await fetch('https://graphql.anilist.co', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(10000)
    });
    if (r.status === 404) fail(404, 'Anime tidak ditemukan');
    if (!r.ok) fail(502, 'AniList sedang bermasalah');
    const j = await r.json();
    cache.set(key, { v: j.data, t: Date.now() + ttl });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return j.data;
  } catch (e) {
    if (e instanceof HttpError && e.code === 404) throw e;
    if (c) return c.v; // pakai cache lama kalau AniList down
    throw e instanceof HttpError ? e : new HttpError(502, 'AniList tidak bisa dijangkau');
  }
}
const MEDIA = `id title{romaji english userPreferred} description(asHtml:false) genres averageScore status episodes
  nextAiringEpisode{episode} studios(isMain:true){nodes{name}} seasonYear coverImage{large extraLarge} bannerImage`;
const STATUS = { RELEASING: 'Ongoing', HIATUS: 'Ongoing', FINISHED: 'Completed', CANCELLED: 'Completed', NOT_YET_RELEASED: 'Not yet aired' };
// Bentuk respons dibuat kompatibel dengan format yang dipakai frontend (gaya Consumet).
const mapMedia = m => ({
  id: m.id, title: m.title, image: m.coverImage?.extraLarge || m.coverImage?.large,
  cover: m.bannerImage || m.coverImage?.extraLarge, description: m.description,
  rating: m.averageScore, status: STATUS[m.status] || 'Ongoing', genres: m.genres || [],
  totalEpisodes: m.episodes, currentEpisode: m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : m.episodes,
  releaseDate: m.seasonYear, studios: (m.studios?.nodes || []).map(s => s.name)
});
const lastEp = m => m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : (m.episodes || 12);

/* ---------- Router ---------- */
const routes = [];
const route = (method, p, h, o = {}) =>
  routes.push({ method, re: new RegExp('^' + p.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '/?$'), h, o });
const clampInt = (v, d, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+v) && v !== null && v !== '' ? Math.trunc(+v) : d));

// Katalog
route('GET', '/meta/anilist/trending', async ({ url }) => {
  const perPage = clampInt(url.searchParams.get('perPage'), 24, 1, 50);
  const d = await gql(`query($n:Int){Page(perPage:$n){media(type:ANIME,isAdult:false,sort:TRENDING_DESC){${MEDIA}}}}`, { n: perPage });
  return { results: d.Page.media.map(mapMedia) };
});
route('GET', '/meta/anilist/info/:id', async ({ params, user }) => {
  const id = clampInt(params.id, 0, 0, 1e9); if (!id) fail(400, 'ID tidak valid');
  const d = await gql(`query($id:Int){Media(id:$id,type:ANIME,isAdult:false){${MEDIA}}}`, { id }, 1800000);
  const m = d.Media, have = await sb(`/rest/v1/episodes?anime_id=eq.${id}&select=number,title&order=number`, { token: user.token }).catch(() => []);
  const titles = new Map(have.map(r => [r.number, r.title]));
  const max = Math.min(500, Math.max(lastEp(m), ...have.map(r => r.number)));
  const episodes = Array.from({ length: max }, (_, i) => ({
    id: `${id}-${i + 1}`, number: i + 1, title: titles.get(i + 1) || null, available: titles.has(i + 1)
  }));
  return { ...mapMedia(m), episodes };
});
route('GET', '/meta/anilist/watch/:epId', async ({ params, user }) => {
  const m = /^(\d+)-(\d+)$/.exec(params.epId); if (!m) fail(400, 'ID episode tidak valid');
  const r = (await sb(`/rest/v1/episodes?anime_id=eq.${+m[1]}&number=eq.${+m[2]}&select=url`, { token: user.token }).catch(() => []))[0];
  if (!r) fail(404, 'Sumber video belum tersedia');
  return { sources: [{ url: r.url, quality: 'default', isM3U8: /\.m3u8(\?|$)/i.test(r.url) }] };
});
route('GET', '/meta/anilist/:query', async ({ params }) => {
  const q = params.query.trim(); if (q.length < 1 || q.length > 100) fail(400, 'Kata kunci tidak valid');
  const d = await gql(`query($q:String){Page(perPage:20){media(search:$q,type:ANIME,isAdult:false,sort:SEARCH_MATCH){${MEDIA}}}}`, { q });
  return { results: d.Page.media.map(mapMedia) };
});
route('GET', '/api/schedule', async () => {
  const from = Math.floor(Date.now() / 3600000) * 3600, to = from + 7 * 86400;
  const d = await gql(`query($a:Int,$b:Int){Page(perPage:50){airingSchedules(airingAt_greater:$a,airingAt_lesser:$b,sort:TIME){
    airingAt episode media{id title{romaji english} coverImage{large} isAdult}}}}`, { a: from, b: to }, 900000);
  return { results: d.Page.airingSchedules.filter(s => !s.media.isAdult).map(s => ({
    animeId: s.media.id, title: s.media.title.english || s.media.title.romaji,
    image: s.media.coverImage.large, episode: s.episode, airingAt: s.airingAt })) };
});

// Akun (Supabase Auth)
const validEmail = e => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const session = r => ({ token: r.access_token, refresh: r.refresh_token, user: { id: r.user.id, email: r.user.email, name: r.user.user_metadata?.name || 'Penonton' } });
const authErr = e => {
  if (e.status === 429) fail(429, 'Terlalu banyak percobaan, coba lagi nanti');
  if (e.code === 'email_not_confirmed') fail(403, 'Email belum dikonfirmasi. Cek kotak masukmu.');
  if (e.code === 'user_already_exists' || /already registered/i.test(e.message)) fail(409, 'Email sudah terdaftar');
  if (e.code === 'weak_password') fail(400, 'Kata sandi terlalu lemah');
  if (e.status >= 500) fail(502, 'Layanan akun sedang bermasalah');
  if (e.code === 'invalid_credentials') fail(401, 'Email atau kata sandi salah');
  fail(400, 'Permintaan akun ditolak');
};
route('POST', '/api/auth/register', async ({ body }) => {
  const email = String(body.email || '').trim().toLowerCase(), pw = body.password, name = String(body.name || 'Penonton').trim().slice(0, 40) || 'Penonton';
  if (!validEmail(email)) fail(400, 'Email tidak valid');
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 72) fail(400, 'Kata sandi 8-72 karakter');
  try {
    const r = await sb('/auth/v1/signup', { method: 'POST', body: { email, password: pw, data: { name } } });
    return r?.access_token ? session(r) : { confirm: true, message: 'Cek email-mu untuk konfirmasi, lalu masuk.' };
  } catch (e) { authErr(e); }
}, { rate: 5 });
route('POST', '/api/auth/login', async ({ body }) => {
  try { return session(await sb('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: String(body.email || '').trim().toLowerCase(), password: String(body.password || '') } })); }
  catch (e) { authErr(e); }
}, { rate: 10 });
route('POST', '/api/auth/refresh', async ({ body }) => {
  if (typeof body.refresh !== 'string' || body.refresh.length > 500) fail(400, 'Token tidak valid');
  try { return session(await sb('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: body.refresh } })); }
  catch { fail(401, 'Sesi berakhir, silakan masuk lagi'); }
}, { rate: 30 });
route('GET', '/api/me', ({ user }) => ({ user: { id: user.id, email: user.email, name: user.name } }), { auth: true });

// Sinkronisasi (Daftarku, riwayat, rating, pengaturan). RLS Supabase memastikan hanya baris milik sendiri.
route('GET', '/api/sync', async ({ user }) => {
  const r = (await sb(`/rest/v1/sync_state?user_id=eq.${user.id}&select=data,updated_at`, { token: user.token }))[0];
  return r ? { data: r.data, updatedAt: Date.parse(r.updated_at) } : { data: null, updatedAt: 0 };
}, { auth: true });
route('PUT', '/api/sync', async ({ user, body }) => {
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) fail(400, 'Data tidak valid');
  if (JSON.stringify(body.data).length > 350000) fail(413, 'Data terlalu besar');
  const r = await sb('/rest/v1/sync_state?on_conflict=user_id', { method: 'POST', token: user.token, prefer: 'resolution=merge-duplicates,return=representation',
    body: { user_id: user.id, data: body.data, updated_at: new Date().toISOString() } });
  return { updatedAt: Date.parse(r[0].updated_at) };
}, { auth: true });

// Admin: kelola sumber video (hanya untuk konten milikmu / berlisensi). Butuh SUPABASE_SECRET_KEY.
const epArgs = b => {
  const animeId = clampInt(b.animeId, 0, 0, 1e9), number = clampInt(b.number, 0, 0, 5000);
  if (!animeId || !number) fail(400, 'animeId dan number wajib berupa angka positif');
  return { animeId, number };
};
const needSecret = () => { if (!SECRET_KEY) fail(503, 'SUPABASE_SECRET_KEY belum diisi'); };
route('POST', '/api/admin/episodes', async ({ body }) => {
  needSecret(); const { animeId, number } = epArgs(body);
  if (typeof body.url !== 'string' || !/^https?:\/\/\S+$/.test(body.url) || body.url.length > 2000) fail(400, 'url harus http(s)');
  await sb('/rest/v1/episodes?on_conflict=anime_id,number', { method: 'POST', key: SECRET_KEY, prefer: 'resolution=merge-duplicates,return=minimal',
    body: { anime_id: animeId, number, title: body.title ? String(body.title).slice(0, 200) : null, url: body.url } });
  return { ok: true, id: `${animeId}-${number}` };
}, { admin: true });
route('GET', '/api/admin/episodes', async () => { needSecret(); return { results: await sb('/rest/v1/episodes?select=anime_id,number,title,url&order=anime_id,number&limit=1000', { key: SECRET_KEY }) }; }, { admin: true });
route('DELETE', '/api/admin/episodes/:animeId/:number', async ({ params }) => {
  needSecret(); const { animeId, number } = epArgs(params);
  const r = await sb(`/rest/v1/episodes?anime_id=eq.${animeId}&number=eq.${number}`, { method: 'DELETE', key: SECRET_KEY, prefer: 'return=representation' });
  return { deleted: r.length };
}, { admin: true });
route('GET', '/health', () => ({ ok: true }));

/* ---------- Static (frontend) ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const pub = path.join(dir, 'public');
function serveStatic(req, res, pathname) {
  let f = path.join(pub, pathname === '/' ? 'index.html' : decodeURIComponent(pathname));
  if (!f.startsWith(pub + path.sep) && f !== pub) return false;
  if (!fs.existsSync(f) || !fs.statSync(f).isFile()) f = path.join(pub, 'index.html');
  if (!fs.existsSync(f)) return false;
  const ext = path.extname(f);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400' });
  fs.createReadStream(f).pipe(res);
  return true;
}

/* ---------- Server ---------- */
const send = (res, code, obj, extra = {}) => {
  const s = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...extra }); res.end(s);
};
const readBody = req => new Promise((ok, no) => {
  let n = 0; const ch = [];
  req.on('data', c => { n += c.length; if (n > 600000) { no(new HttpError(413, 'Permintaan terlalu besar')); req.destroy(); } else ch.push(c); });
  req.on('end', () => { try { ok(ch.length ? JSON.parse(Buffer.concat(ch)) : {}); } catch { no(new HttpError(400, 'JSON tidak valid')); } });
  req.on('error', no);
});

http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  try {
    const url = new URL(req.url, 'http://x'), pathname = url.pathname;
    const ip = (PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.re.exec(pathname); if (!m) continue;
      if (limited('g:' + ip, 120)) fail(429, 'Terlalu banyak permintaan, coba lagi sebentar');
      if (r.o.rate && limited(`a:${pathname}:${ip}`, r.o.rate)) fail(429, 'Terlalu banyak percobaan, coba lagi nanti');
      const params = Object.fromEntries(Object.entries(m.groups || {}).map(([k, v]) => [k, decodeURIComponent(v)]));
      // Semua katalog, jadwal, dan video hanya untuk pengguna yang sudah login.
      const user = (r.o.auth || pathname.startsWith('/meta/') || pathname === '/api/schedule') ? await getUser(req) : null;
      if (r.o.admin) {
        if (!ADMIN_KEY) fail(503, 'API admin nonaktif (ADMIN_KEY belum diisi)');
        if (!same(req.headers['x-admin-key'] || '', ADMIN_KEY)) fail(403, 'Kunci admin salah');
      }
      const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {};
      const out = await r.h({ req, url, params, body, user });
      return send(res, 200, out, req.method === 'GET' && pathname.startsWith('/meta/') ? { 'Cache-Control': 'private, max-age=60' } : {});
    }
    if (req.method === 'GET' && !pathname.startsWith('/api/') && !pathname.startsWith('/meta/') && serveStatic(req, res, pathname)) return;
    fail(404, 'Tidak ditemukan');
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.code, { error: e.message });
    console.error(e); send(res, 500, { error: 'Terjadi kesalahan di server' });
  }
}).listen(PORT, () => console.log(`Kumo berjalan di http://localhost:${PORT} (Supabase: ${SB})`));
