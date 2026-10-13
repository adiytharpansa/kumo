// Worker tepi milik pengguna untuk sumber putar kumonime.
//
// 1) /hls?u=<url> — proksi HLS untuk CDN yang mewajibkan
//    Referer/Origin situs asal. Pemutar di browser tidak bisa
//    memasang header itu, jadi playlist + segmen diambil dari
//    sisi Cloudflare dan semua URI playlist ditulis ulang agar
//    kembali lewat proksi ini. Hanya host dalam daftar izin.
//
// 2) /resolve?title=&year=&ep= — resolusi stream dari katalog
//    streaming besar (API JSON publiknya): cari -> nilai kandidat
//    -> episode -> server -> master HLS. Dilakukan di tepi
//    Cloudflare karena egress hosting web (Netlify) tidak dapat
//    menjangkau API katalog itu dengan andal. Hasil di-cache di
//    tepi. Mengembalikan JSON { url, subtitles, audio } dengan
//    URL yang SUDAH dibungkus rute /hls worker ini.
//
// 3) /eps?title=&year= — daftar nomor episode lengkap + status
//    bisa-diputar untuk judul yang sama: { slug, score, numbers,
//    playable }.

const ALLOWED_SUFFIX = ['krussdomi.com', 'advancedairesearchlab.xyz'];
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ---------------- /hls ----------------

function allowed(u) {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return ALLOWED_SUFFIX.some((s) => h === s || h.endsWith('.' + s));
  } catch (e) {
    return false;
  }
}

function proxied(abs, base) {
  return `${base}/hls?u=${encodeURIComponent(abs)}`;
}

function rewritePlaylist(text, targetUrl, base) {
  const resolve = (ref) => {
    try {
      return new URL(ref, targetUrl).toString();
    } catch (e) {
      return null;
    }
  };
  return text
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (m, ref) => {
          const abs = resolve(ref);
          return abs ? `URI="${proxied(abs, base)}"` : m;
        });
      }
      const abs = resolve(t);
      return abs ? proxied(abs, base) : line;
    })
    .join('\n');
}

async function handleHls(request, url) {
  const target = url.searchParams.get('u') || '';
  if (!target || !/^https:\/\//i.test(target) || !allowed(target)) {
    return new Response('forbidden target', { status: 403 });
  }
  let resp;
  try {
    const headers = {
      'user-agent': UA,
      referer: 'https://krussdomi.com/',
      origin: 'https://krussdomi.com',
      accept: '*/*',
      'accept-language': 'id-ID,id;q=0.9,en;q=0.8',
      'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'cross-site',
    };
    resp = await fetch(target, { headers, cf: { cacheTtl: 60, cacheEverything: false } });
    if (resp.status === 429) {
      // Host hulu membatasi laju per IP — jeda singkat lalu coba
      // sekali lagi sebelum menyerah.
      await sleep(2000);
      resp = await fetch(target, { headers, cf: { cacheTtl: 60, cacheEverything: false } });
    }
  } catch (e) {
    return new Response('upstream error', { status: 502 });
  }
  if (!resp.ok) {
    return new Response('upstream HTTP ' + resp.status, { status: 502 });
  }
  const ct = resp.headers.get('content-type') || '';
  const isPlaylist = /mpegurl/i.test(ct) || /\.m3u8($|\?)/i.test(new URL(target).pathname);
  const cors = { 'access-control-allow-origin': '*' };
  if (isPlaylist) {
    const text = await resp.text();
    return new Response(rewritePlaylist(text, target, url.origin), {
      headers: {
        ...cors,
        'content-type': 'application/vnd.apple.mpegurl',
        'cache-control': 'public, max-age=30',
      },
    });
  }
  return new Response(resp.body, {
    headers: {
      ...cors,
      'content-type': ct || 'application/octet-stream',
      'cache-control': 'public, max-age=300',
    },
  });
}

// ---------------- katalog (KAA) ----------------

const KAA = 'https://kaa.lt';
const HLS_HOST = 'https://hls.krussdomi.com/manifest';
// API katalog berada di balik pemeriksaan bot Cloudflare yang
// menantang permintaan ber-header minim ("Just a moment...") —
// pakai set header peramban lengkap + referer situsnya sendiri,
// pola yang terbukti lolos pada rute /px.
const JH = {
  'user-agent': UA,
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9,id;q=0.8',
  referer: 'https://kaa.lt/',
  origin: 'https://kaa.lt',
  'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
};

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function jget(u, ms = 6000) {
  let lastErr;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(u, { headers: JH, signal: AbortSignal.timeout(ms) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      lastErr = e;
      if (i === 0) await sleep(400);
    }
  }
  throw lastErr;
}

async function kaaSearch(query) {
  let lastErr;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(`${KAA}/api/fsearch`, {
        method: 'POST',
        headers: { ...JH, 'content-type': 'application/json' },
        body: JSON.stringify({ page: 1, query }),
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) throw new Error('search HTTP ' + r.status);
      const j = await r.json();
      return Array.isArray(j && j.result) ? j.result : [];
    } catch (e) {
      lastErr = e;
      if (i === 0) await sleep(400);
    }
  }
  throw lastErr;
}

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function bigrams(s) {
  const m = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const b = s.slice(i, i + 2);
    m.set(b, (m.get(b) || 0) + 1);
  }
  return m;
}

function dice(a, b) {
  a = norm(a);
  b = norm(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) || 0);
  return (2 * inter) / (a.length - 1 + (b.length - 1));
}

const cleanQuery = (t) =>
  String(t || '')
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .replace(/\s+(?:on\s+)?gogoanime\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

async function resolveCandidates(title, year) {
  const q = cleanQuery(title);
  if (!q || q.length < 3) return [];
  const queries = [q];
  const words = q.split(' ');
  if (words.length > 3) queries.push(words.slice(0, 3).join(' '));
  const seen = new Map();
  await Promise.all(
    queries.map(async (query) => {
      try {
        const res = await kaaSearch(query);
        for (const c of res) if (c && c.slug && !seen.has(c.slug)) seen.set(c.slug, c);
      } catch (e) {}
    })
  );
  const scored = [];
  for (const c of seen.values()) {
    if (!(c.episode_count > 0) && !(c.locales || []).length) continue;
    let s = Math.max(dice(q, c.title_en || ''), dice(q, c.title || ''));
    if (year && c.year) {
      const d = Math.abs(Number(year) - Number(c.year));
      if (d === 0) s *= 1.15;
      else if (d > 1) s *= 0.7;
    }
    if ((c.locales || []).includes('ja-JP')) s *= 1.05;
    if (s >= 0.5) scored.push({ slug: c.slug, title: c.title_en || c.title || q, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

async function episodeNumbers(slug) {
  const first = await jget(`${KAA}/api/show/${slug}/episodes?ep=1&lang=ja-JP`);
  const nums = new Set();
  const eat = (arr) => {
    for (const e of arr || []) {
      const n = parseFloat(e.episode_number);
      if (Number.isFinite(n)) nums.add(n);
    }
  };
  eat(first && first.result);
  const pages = Array.isArray(first && first.pages) ? first.pages : [];
  if (pages.length > 1) {
    const rest = await Promise.all(
      pages.slice(1, 40).map(async (pg) => {
        const startEp = pg && pg.eps && pg.eps[0];
        if (!startEp) return null;
        try {
          return await jget(`${KAA}/api/show/${slug}/episodes?ep=${startEp}&lang=ja-JP`);
        } catch (e) {
          return null;
        }
      })
    );
    for (const p of rest) if (p) eat(p.result);
  }
  return [...nums].sort((a, b) => a - b);
}

async function findEpisode(slug, epNumber, lang) {
  const first = await jget(`${KAA}/api/show/${slug}/episodes?ep=1&lang=${lang}`);
  const scan = (arr) => {
    for (const e of arr || []) {
      if (Number(e.episode_number) === Number(epNumber)) {
        return { entry: e, fullSlug: `ep-${e.episode_number}-${e.slug}` };
      }
    }
    return null;
  };
  let hit = scan(first && first.result);
  if (hit) return hit;
  const pages = Array.isArray(first && first.pages) ? first.pages : [];
  for (const pg of pages.slice(1, 40)) {
    const eps = (pg && pg.eps) || [];
    if (!eps.length) continue;
    if (Number(epNumber) < Number(eps[0]) || Number(epNumber) > Number(eps[eps.length - 1]))
      continue;
    try {
      const d = await jget(`${KAA}/api/show/${slug}/episodes?ep=${eps[0]}&lang=${lang}`);
      hit = scan(d && d.result);
      if (hit) return hit;
    } catch (e) {}
  }
  return null;
}

async function subtitlesFor(playerSrc, base) {
  try {
    const r = await fetch(playerSrc, {
      headers: { 'user-agent': UA, referer: 'https://krussdomi.com/' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return [];
    const t = (await r.text()).replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const out = [];
    const seen = new Set();
    const re = /"language":\[0,"([a-z-]+)"\][\s\S]{0,160}?"src":\[0,"(https:[^"]+?\.vtt)"\]/g;
    let m;
    while ((m = re.exec(t)) && out.length < 12) {
      const lang = m[1];
      if (seen.has(lang)) continue;
      seen.add(lang);
      out.push({
        lang,
        url: `${base}/hls?u=${encodeURIComponent(m[2].replace(/\\u0026/g, '&').replace(/\\\//g, '/'))}`,
      });
    }
    return out;
  } catch (e) {
    return [];
  }
}

function cdnHeaders() {
  return {
    'user-agent': UA,
    referer: 'https://krussdomi.com/',
    origin: 'https://krussdomi.com',
    accept: '*/*',
    'accept-language': 'id-ID,id;q=0.9,en;q=0.8',
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
  };
}

// CATATAN: host manifest membatasi laju permintaan per IP, jadi
// resolusi TIDAK memvalidasi manifest dengan fetch tambahan —
// cukup urutan server terbaik; kegagalan putar ditangani fallback
// pemutar di sisi klien.
async function streamForShow(show, epNumber, base) {
  for (const lang of ['ja-JP', 'en-US']) {
    try {
      const found = await findEpisode(show.slug, epNumber, lang);
      if (!found) continue;
      const data = await jget(`${KAA}/api/show/${show.slug}/episode/${found.fullSlug}`);
      const servers = (Array.isArray(data && data.servers) ? data.servers : []).filter(
        (s) => s && s.src && /[?&]id=/.test(s.src)
      );
      // Urutkan: server HLS (bukan DASH) dulu, nama Vid* didahulukan.
      servers.sort((a, b) => {
        const rank = (s) =>
          (/type=dash/i.test(s.src) ? 0 : 2) + (/vid/i.test(s.name || '') ? 1 : 0);
        return rank(b) - rank(a);
      });
      for (const pick of servers) {
        const idm = pick.src.match(/[?&]id=([^&]+)/);
        if (!idm) continue;
        const master = `${HLS_HOST}/${idm[1]}/master.m3u8`;
        const subtitles = await subtitlesFor(pick.src, base);
        return {
          url: `${base}/hls?u=${encodeURIComponent(master)}`,
          subtitles,
          audio: lang === 'en-US' ? 'dub' : 'sub',
        };
      }
    } catch (e) {}
  }
  return null;
}

// ---------------- rute JSON + cache tepi ----------------

function jsonResp(obj, status, maxAge) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': `public, max-age=${maxAge}`,
    },
  });
}

// Versi kunci cache tepi — naikkan untuk membuang entri basi
// setiap logika resolusi berubah.
const CACHE_VER = '5';

function cacheKey(url, params) {
  const qs = new URLSearchParams({ cv: CACHE_VER, ...params });
  return new Request(`${url.origin}${url.pathname}?${qs.toString()}`);
}

async function handleResolve(url, ctx, request) {
  const cache = caches.default;
  const key = cacheKey(url, {
    title: url.searchParams.get('title') || '',
    year: url.searchParams.get('year') || '',
    ep: url.searchParams.get('ep') || '',
  });
  const hit = await cache.match(key);
  if (hit) return hit;
  const title = url.searchParams.get('title') || '';
  const year = url.searchParams.get('year') || '';
  const ep = parseFloat(url.searchParams.get('ep') || '');
  let out = null;
  if (title && Number.isFinite(ep)) {
    // Dua percobaan penuh: pemeriksaan bot hulu bersifat
    // probabilistik antar-permintaan.
    for (let attempt = 0; attempt < 2 && !out; attempt++) {
      const candidates = await resolveCandidates(title, year).catch(() => []);
      for (const show of candidates.slice(0, 3)) {
        out = await streamForShow(show, ep, url.origin);
        if (out) break;
      }
      if (!out && attempt === 0) await sleep(600);
    }
  }
  const resp = out ? jsonResp(out, 200, 3600) : jsonResp({ error: 'not found' }, 404, 30);
  ctx.waitUntil(cache.put(key, resp.clone()));
  return resp;
}

async function handleEps(url, ctx, request) {
  const cache = caches.default;
  const key = cacheKey(url, {
    title: url.searchParams.get('title') || '',
    year: url.searchParams.get('year') || '',
  });
  const hit = await cache.match(key);
  if (hit) return hit;
  const title = url.searchParams.get('title') || '';
  const year = url.searchParams.get('year') || '';
  let payload = null;
  if (title) {
    for (let attempt = 0; attempt < 2 && !payload; attempt++) {
      const candidates = await resolveCandidates(title, year).catch(() => []);
      const show = candidates[0];
      if (show) {
        const numbers = await episodeNumbers(show.slug).catch(() => []);
        let playable = false;
        if (numbers.length) {
          playable = !!(await streamForShow(show, numbers[0], url.origin).catch(() => null));
        }
        payload = { slug: show.slug, score: show.score, numbers, playable };
      }
      if (!payload && attempt === 0) await sleep(600);
    }
  }
  const resp = payload ? jsonResp(payload, 200, 3600) : jsonResp({ error: 'not found' }, 404, 30);
  ctx.waitUntil(cache.put(key, resp.clone()));
  return resp;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/hls') return handleHls(request, url);
    if (url.pathname === '/resolve') return handleResolve(url, ctx, request);
    if (url.pathname === '/eps') return handleEps(url, ctx, request);
    return new Response('not found', { status: 404 });
  },
}
