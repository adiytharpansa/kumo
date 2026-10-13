import 'server-only';

// =====================================================================
// Resolusi katalog putar utama (KAA) — DI DALAM PROSES server.
//
// Logika ini semula berjalan di worker tepi kumo-hls (rute /resolve
// & /eps) dan dipanggil aplikasi lewat HTTP. Di Cloudflare Workers
// cara itu mustahil: sesama Worker pada domain *.workers.dev yang
// sama tidak bisa saling fetch (error 1042). Karena itu resolusi
// kini berjalan langsung di proses server aplikasi — kode yang
// sama persis, tanpa lompatan HTTP. Worker kumo-hls tetap dipakai
// browser untuk /hls (proksi video), /fsearch, dan /subs.
//
// Ekspor:
//   resolveKaaStream(title, year, ep)   -> { url, subtitles, audio } | null
//   resolveKaaEpisodes(title, year)     -> { slug, score, numbers, playable } | null
// url/subtitles SUDAH dibungkus proksi /hls worker kumo-hls.
// =====================================================================

const KAA = 'https://kaa.lt';
const HLS_HOST = 'https://hls.krussdomi.com/manifest';
const HLS_BASE = 'https://kumo-hls.adiyth-arpansa.workers.dev';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// API katalog berada di balik pemeriksaan bot Cloudflare yang
// menantang permintaan ber-header minim ("Just a moment...") —
// pakai set header peramban lengkap + referer situsnya sendiri.
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

async function subtitlesFor(playerSrc) {
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
        url: `${HLS_BASE}/hls?u=${encodeURIComponent(m[2].replace(/\\u0026/g, '&').replace(/\\\//g, '/'))}`,
      });
    }
    return out;
  } catch (e) {
    return [];
  }
}

// CATATAN: host manifest membatasi laju permintaan per IP, jadi
// resolusi TIDAK memvalidasi manifest dengan fetch tambahan —
// cukup urutan server terbaik; kegagalan putar ditangani fallback
// pemutar di sisi klien.
async function streamForShow(show, epNumber) {
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
        const subtitles = await subtitlesFor(pick.src);
        return {
          url: `${HLS_BASE}/hls?u=${encodeURIComponent(master)}`,
          subtitles,
          audio: lang === 'en-US' ? 'dub' : 'sub',
        };
      }
    } catch (e) {}
  }
  return null;
}

// Setara rute /resolve worker lama (tanpa cache tepi — cache
// aplikasi di provider yang menampung hasilnya).
export async function resolveKaaStream(title, year, ep) {
  const epNum = parseFloat(ep);
  if (!title || !Number.isFinite(epNum)) return null;
  let out = null;
  // Dua percobaan penuh: pemeriksaan bot hulu bersifat
  // probabilistik antar-permintaan.
  for (let attempt = 0; attempt < 2 && !out; attempt++) {
    const candidates = await resolveCandidates(title, year).catch(() => []);
    for (const show of candidates.slice(0, 3)) {
      out = await streamForShow(show, epNum);
      if (out) break;
    }
    if (!out && attempt === 0) await sleep(600);
  }
  return out;
}

// Setara rute /eps worker lama.
export async function resolveKaaEpisodes(title, year) {
  if (!title) return null;
  let payload = null;
  for (let attempt = 0; attempt < 2 && !payload; attempt++) {
    const candidates = await resolveCandidates(title, year).catch(() => []);
    const show = candidates[0];
    if (show) {
      const numbers = await episodeNumbers(show.slug).catch(() => []);
      let playable = false;
      if (numbers.length) {
        playable = !!(await streamForShow(show, numbers[0]).catch(() => null));
      }
      payload = { slug: show.slug, score: show.score, numbers, playable };
    }
    if (!payload && attempt === 0) await sleep(600);
  }
  return payload;
}
