import 'server-only';

// =====================================================================
// Sumber putar tambahan (server-only): API JSON sebuah katalog
// streaming besar yang terverifikasi hidup ujung-ke-ujung pada
// 13 Okt 2026 (cari -> info -> episode -> server -> HLS asli).
//
// Alur: POST /api/fsearch {page, query} -> kandidat dinilai dengan
// kemiripan judul (dice) + jumlah episode; GET /api/show/{slug};
// GET /api/show/{slug}/episodes?ep=N&lang=ja-JP (100 per halaman,
// fullSlug = ep-{nomor}-{hash}); GET /api/show/{slug}/episode/
// {fullSlug} -> servers[] yang src-nya memuat id stream ->
// master HLS https://hls.krussdomi.com/manifest/{id}/master.m3u8.
//
// CDN video mewajibkan Referer/Origin situs asal, jadi semua URL
// video + berkas subtitle dibungkus proksi HLS milik pengguna
// (Worker kumo-hls) yang memasang header tersebut di sisi server.
//
// Nama sumber tidak pernah tampil di UI — pemanggil membungkus
// hasilnya sebagai "HD Server" generik.
// =====================================================================

const KAA = 'https://kaa.lt';
const HLS_HOST = 'https://hls.krussdomi.com/manifest';
const PROXY = 'https://kumo-hls.adiyth-arpansa.workers.dev/hls?u=';
const PX = 'https://kumo.adiyth-arpansa.workers.dev/px?u=';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const H = { 'user-agent': UA, accept: 'application/json' };

const prox = (u) => PROXY + encodeURIComponent(u);

async function jget(url, ms = 9000) {
  const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

async function search(query) {
  const r = await fetch(`${KAA}/api/fsearch`, {
    method: 'POST',
    headers: { ...H, 'content-type': 'application/json' },
    body: JSON.stringify({ page: 1, query }),
    signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) throw new Error('search HTTP ' + r.status);
  const j = await r.json();
  return Array.isArray(j && j.result) ? j.result : [];
}

// --- penilaian kandidat (dice coefficient atas bigram) ---
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

// Kandidat acara untuk judul (+ tahun bila ada), terurut skor.
// Sebagian entri katalog ternyata cangkang tanpa server putar,
// jadi pemanggil stream mencoba beberapa kandidat berurutan.
export async function resolveCandidates(title, year) {
  const q = cleanQuery(title);
  if (!q || q.length < 3) return [];
  const queries = [q];
  const words = q.split(' ');
  if (words.length > 3) queries.push(words.slice(0, 3).join(' '));
  const seen = new Map();
  for (const query of queries) {
    try {
      const res = await search(query);
      for (const c of res) if (c && c.slug && !seen.has(c.slug)) seen.set(c.slug, c);
    } catch (e) {
      /* lanjut ke kueri berikutnya */
    }
  }
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

export async function resolveShow(title, year) {
  const list = await resolveCandidates(title, year);
  return list[0] || null;
}

// Daftar nomor episode lengkap (semua halaman, 100 per halaman).
export async function episodeNumbers(slug) {
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

// Cari satu episode pada sebuah locale; kembalikan entri + fullSlug.
async function findEpisode(slug, epNumber, lang) {
  const pages = await jget(`${KAA}/api/show/${slug}/episodes?ep=1&lang=${lang}`);
  const scan = (arr) => {
    for (const e of arr || []) {
      if (Number(e.episode_number) === Number(epNumber)) {
        return { entry: e, fullSlug: `ep-${e.episode_number}-${e.slug}` };
      }
    }
    return null;
  };
  let hit = scan(pages && pages.result);
  if (hit) return hit;
  const extra = Array.isArray(pages && pages.pages) ? pages.pages : [];
  for (const pg of extra.slice(1, 40)) {
    const startEp = pg && pg.eps && pg.eps[0];
    if (!startEp) continue;
    // Lewati halaman yang rentangnya tidak memuat nomor ini.
    const eps = (pg && pg.eps) || [];
    if (eps.length && (Number(epNumber) < Number(eps[0]) || Number(epNumber) > Number(eps[eps.length - 1])))
      continue;
    try {
      const d = await jget(`${KAA}/api/show/${slug}/episodes?ep=${startEp}&lang=${lang}`);
      hit = scan(d && d.result);
      if (hit) return hit;
    } catch (e) {
      /* abaikan halaman gagal */
    }
  }
  return null;
}

// Subtitle lunak dari halaman pemutar sumber (payload RSC):
// pasangan bahasa -> berkas .vtt. Dikembalikan sudah dibungkus proksi.
async function subtitlesFor(playerSrc) {
  try {
    const r = await fetch(PX + encodeURIComponent(playerSrc), {
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return [];
    // Payload RSC di dalam HTML ter-escape (&quot;) — normalkan dulu.
    const t = (await r.text()).replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    const out = [];
    const seen = new Set();
    const re = /"language":\[0,"([a-z-]+)"\][\s\S]{0,160}?"src":\[0,"(https:[^"]+?\.vtt)"\]/g;
    let m;
    while ((m = re.exec(t)) && out.length < 12) {
      const lang = m[1];
      if (seen.has(lang)) continue;
      seen.add(lang);
      out.push({ lang, url: prox(m[2].replace(/\\u0026/g, '&').replace(/\\\//g, '/')) });
    }
    return out;
  } catch (e) {
    return [];
  }
}

// Stream untuk satu acara yang sudah terpilih (dipakai juga
// sebagai uji "acara ini benar-benar bisa diputar" oleh pemanggil).
export async function streamForShow(show, epNumber) {
  for (const lang of ['ja-JP', 'en-US']) {
    try {
      const found = await findEpisode(show.slug, epNumber, lang).catch(() => null);
      if (!found) continue;
      const data = await jget(`${KAA}/api/show/${show.slug}/episode/${found.fullSlug}`);
      const servers = Array.isArray(data && data.servers) ? data.servers : [];
      const pick =
        servers.find((s) => s && s.src && /vidstream/i.test(s.src)) ||
        servers.find((s) => s && s.src && /[?&]id=/.test(s.src));
      if (!pick) continue;
      const idm = pick.src.match(/[?&]id=([^&]+)/);
      if (!idm) continue;
      const master = `${HLS_HOST}/${idm[1]}/master.m3u8`;
      const subtitles = await subtitlesFor(pick.src);
      return {
        url: prox(master),
        subtitles,
        audio: lang === 'en-US' ? 'dub' : 'sub',
      };
    } catch (e) {
      /* coba locale berikutnya */
    }
  }
  return null;
}

// Resolusi stream untuk (judul, tahun, nomor episode).
// Mencoba sampai 3 kandidat acara sampai menemukan server yang
// benar-benar berisi id stream.
export async function streamFor(title, year, epNumber) {
  const candidates = await resolveCandidates(title, year);
  for (const show of candidates.slice(0, 3)) {
    const s = await streamForShow(show, epNumber);
    if (s) return s;
  }
  return null;
}
