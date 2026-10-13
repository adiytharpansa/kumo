import 'server-only';
import { unstable_cache } from 'next/cache';

// =====================================================================
// Lapisan agregasi metadata — SERVER-ONLY.
//
// Lapisan data diganti dari @consumet/extensions (AnimePahe terbukti
// tidak mengembalikan data dari jaringan mana pun yang diuji — VM,
// lokal, Netlify) ke jalur yang terbukti hidup di perangkat pengguna:
// halaman-halaman sumber bergaya WordPress/dramastream diambil lewat
// rute proksi /px milik pengguna sendiri (fetch sisi Cloudflare dengan
// UA browser + referer origin target), lalu diurai di server.
//
// Bentuk data keluar disamakan persis dengan kontrak lama agar semua
// halaman/komponen tidak berubah:
//   daftar  -> { results: [{ id, title, image, type, releaseDate,
//                            episodeId?, episodeNumber? }] }
//   detail  -> { id, title, image, description, genres[], type,
//                releaseDate, status, totalEpisodes,
//                episodes: [{ id, number }] }
//   server  -> [{ name, url }]   (url = embed iframe)
//   sources -> { sources: [], headers } (pemutaran memakai embed)
//
// Setiap panggilan dibungkus try/catch: kegagalan sumber menghasilkan
// null dan UI merender fallback "Server Connection Busy" — bukan 500.
// =====================================================================

const GG = 'https://gogoanime.by';
const PX = 'https://kumo.adiyth-arpansa.workers.dev/px?u=';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function safe(fn) {
  try {
    const r = await fn();
    return r ?? null;
  } catch (e) {
    return null;
  }
}

// --- lapisan ambil (port dari fText/okText aplikasi yang terbukti) ---
function okText(t) {
  return (
    !!t &&
    t.length >= 80 &&
    !/translate\.goog/.test(t.slice(0, 3000)) &&
    !(t.length < 500 && /^\s*\{/.test(t) && /"(error|message|detail)"/i.test(t))
  );
}

async function fetchPx(url, ms) {
  const r = await fetch(PX + encodeURIComponent(url), {
    signal: AbortSignal.timeout(ms),
    headers: { 'user-agent': UA },
  });
  if (!r.ok) throw new Error('px HTTP ' + r.status);
  return r.text();
}

async function fetchDirect(url, ms) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { 'user-agent': UA, referer: GG + '/' },
  });
  if (!r.ok) throw new Error('direct HTTP ' + r.status);
  return r.text();
}

// Jalur utama /px (terbukti), cadangan ambil langsung tervalidasi.
async function fText(url, ms = 10000) {
  try {
    const t = await fetchPx(url, ms);
    if (okText(t)) return t;
    throw new Error('respons kosong');
  } catch (e) {
    const t = await fetchDirect(url, Math.min(ms, 8000));
    if (!okText(t)) throw new Error('respons kosong');
    return t;
  }
}

// --- util urai ---
const dec = (s) =>
  String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&#0?38;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));

const cleanT = (s) => dec(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const stripTags = (html) => dec(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

function epInfo(u) {
  const m = String(u || '').match(/\/([a-z0-9\-]+?)-episode-(\d+(?:\.\d+)?)(?:-[^/]*)?\/?(?:[?#]|$)/i);
  return m ? { slug: m[1], n: parseFloat(m[2]) } : null;
}

function seriesSlugOf(u) {
  const s = String(u || '');
  let m = s.match(/\/category\/([a-z0-9\-]+)\/?(?:[?#]|$)/i);
  if (m) return m[1];
  m = s.match(/\/series\/([a-z0-9\-]+?)(?:-anime|-online)?\/?(?:[?#]|$)/i);
  if (m) return m[1];
  return null;
}

function cardBlocks(html) {
  return html.match(/<article class="bs"[\s\S]*?<\/article>/g) || [];
}

function cardOf(block) {
  const a = block.match(/<a[^>]+href="(https:\/\/gogoanime\.by\/[^"]+)"[^>]*>/i);
  if (!a) return null;
  const url = dec(a[1]);
  const imgTag = (block.match(/<img[^>]+>/i) || [''])[0];
  const img =
    dec(
      (imgTag.match(/(?:data-src|data-lazy-src|src)="([^"]+)"/i) || [])[1] ||
        (imgTag.match(/srcset="([^",\s]+)/i) || [])[1] ||
        ''
    ) || '';
  const imgTitle = cleanT((imgTag.match(/(?:title|alt)="([^"]+)"/i) || [])[1] || '');
  const tt = cleanT((block.match(/<div class="tt">\s*([^<]+)/i) || [])[1] || '');
  const aTitle = cleanT((a[0].match(/title="([^"]+)"/i) || [])[1] || '');
  const type = cleanT((block.match(/typez[^>]*>([^<]+)/i) || [])[1] || '');
  return { url, img, imgTitle, tt, aTitle, type };
}

const stripEpSuffix = (t) => cleanT(t).replace(/\s+Episode\s+\d+(?:\.\d+)?\s+English Subbed$/i, '').trim();

// --- daftar: rilisan terbaru (beranda sumber = "Latest Release") ---
async function recentRaw(page = 1) {
  const url = page > 1 ? `${GG}/page/${page}/` : `${GG}/`;
  const html = await fText(url);
  const out = [];
  const seen = new Set();
  for (const b of cardBlocks(html)) {
    const c = cardOf(b);
    if (!c) continue;
    const ei = epInfo(c.url);
    if (!ei) continue;
    const epId = `${ei.slug}-episode-${ei.n}`;
    if (seen.has(epId)) continue;
    seen.add(epId);
    const epBadge = (b.match(/<span class="epx">\s*Ep\s*([\d.]+)/i) || [])[1];
    out.push({
      id: ei.slug,
      title: stripEpSuffix(c.aTitle || c.imgTitle) || c.tt || ei.slug.replace(/-/g, ' '),
      image: c.img,
      type: c.type || 'TV',
      releaseDate: '',
      episodeId: epId,
      episodeNumber: epBadge ? parseFloat(epBadge) : ei.n,
    });
    if (out.length >= 24) break;
  }
  return { results: out };
}

// --- daftar: seri teratas (halaman indeks seri, urutan terakhir diperbarui) ---
async function trendingRaw() {
  const html = await fText(`${GG}/series/?order=update`);
  const out = [];
  const seen = new Set();
  for (const b of cardBlocks(html)) {
    const c = cardOf(b);
    if (!c) continue;
    const slug = seriesSlugOf(c.url);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    let title = c.tt || c.aTitle || c.imgTitle || slug.replace(/-/g, ' ');
    title = stripEpSuffix(title);
    try {
      title = decodeURIComponent(title);
    } catch (e) {}
    out.push({ id: slug, title, image: c.img, type: c.type || '', releaseDate: '' });
    if (out.length >= 18) break;
  }
  return { results: out };
}

// --- pencarian katalog (WordPress REST search, seperti jalur terbukti) ---
async function searchRaw(query, page = 1) {
  const tx = await fText(
    `${GG}/wp-json/wp/v2/search?search=${encodeURIComponent(query)}&per_page=20&page=${page}`,
    9000
  );
  const j = JSON.parse(tx);
  const results = (Array.isArray(j) ? j : [])
    .map((x) => {
      const slug = seriesSlugOf(x.url);
      if (!slug) return null;
      return { id: slug, title: cleanT(x.title && (x.title.rendered || x.title)) || slug, image: '', type: '', releaseDate: '' };
    })
    .filter((x) => x && x.title);
  return { results };
}

// --- detail seri ---
function parseDetailHtml(html, id) {
  const og = (p) => {
    const m = html.match(new RegExp(`<meta[^>]+property="og:${p}"[^>]+content="([^"]*)"`, 'i'));
    return m ? dec(m[1]) : '';
  };
  let title = cleanT(og('title'))
    .replace(/^Watch\s+/i, '')
    .replace(/\s+Anime Free on Gogoanime.*$/i, '')
    .replace(/\s+Archives\s*[-|–].*$/i, '')
    .replace(/\s+Archives\s*$/i, '')
    .replace(/\s*[-|–]\s*Gogoanime.*$/i, '')
    .trim();
  if (!title) {
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1) title = cleanT(h1[1]);
  }
  title = stripEpSuffix(title);
  const image = og('image');
  let description = '';
  const md = html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i);
  if (md) description = dec(md[1]);
  if (!description || description.length < 60) description = og('description') || description;
  if (/online free on gogoanime|download your favorite anime/i.test(description)) description = '';
  description = description.slice(0, 480);

  const genres = [];
  const gSeen = new Set();
  for (const m of html.matchAll(/href="https:\/\/gogoanime\.by\/genres?\/[^"]+"[^>]*>([^<]+)</gi)) {
    const g = cleanT(m[1]);
    if (g && !gSeen.has(g.toLowerCase())) {
      gSeen.add(g.toLowerCase());
      genres.push(g);
    }
    if (genres.length >= 12) break;
  }

  const text = stripTags(html);
  const statusM = text.match(/Status\s*:\s*(Ongoing|Completed|Currently Airing|Finished Airing)/i);
  const typeM = text.match(/Type\s*:\s*(TV Show|TV|Movie|ONA|OVA|Special)/i);
  const yearM = text.match(/(?:Released|Release|Year)\s*:\s*(\d{4})/i);

  // Semua tautan episode di halaman; kelompokkan per slug episode.
  const groups = new Map();
  for (const m of html.matchAll(/href="(https:\/\/gogoanime\.by\/[^"]+-episode-[^"]+)"/gi)) {
    const ei = epInfo(dec(m[1]));
    if (!ei) continue;
    if (!groups.has(ei.slug)) groups.set(ei.slug, new Map());
    groups.get(ei.slug).set(ei.n, true);
  }
  let bestSlug = null;
  let bestMap = null;
  for (const [slug, map] of groups) {
    if (slug === id) {
      bestSlug = slug;
      bestMap = map;
      break;
    }
    if (!bestMap || map.size > bestMap.size) {
      bestSlug = slug;
      bestMap = map;
    }
  }
  const episodes = bestMap
    ? [...bestMap.keys()]
        .sort((a, b) => a - b)
        .map((n) => ({ id: `${bestSlug}-episode-${n}`, number: n }))
    : [];

  if (!title && !episodes.length) return null;
  return {
    id,
    title: title || id.replace(/-/g, ' '),
    image,
    description,
    genres,
    type: typeM ? typeM[1] : '',
    releaseDate: yearM ? yearM[1] : '',
    status: statusM ? statusM[1] : '',
    totalEpisodes: episodes.length ? episodes[episodes.length - 1].number : 0,
    episodes,
  };
}

async function detailsRaw(id) {
  // Halaman /series/ adalah halaman detail sebenarnya (poster og:image +
  // daftar episode terbanyak); /category/ hanya arsip 10 pos terbaru.
  // Semua kandidat diambil paralel dan dipilih hasil terbaik.
  const candidates = [
    `${GG}/series/${id}/`,
    `${GG}/series/${id}-anime/`,
    `${GG}/series/${id}-online/`,
    `${GG}/category/${id}/`,
  ];
  const pages = await Promise.all(candidates.map((u) => safe(() => fText(u, 9000))));
  let best = null;
  let bestScore = -1;
  for (const html of pages) {
    if (!html) continue;
    const info = parseDetailHtml(html, id);
    if (!info) continue;
    const score = info.episodes.length * 10 + (info.image ? 2 : 0) + (info.title ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = info;
    }
  }
  return best;
}

// --- server stream (port ggServers + ggVerify dari aplikasi terbukti) ---
const HOSTOK = /megaplay|megacloud|vidcloud|filemoon|streamwish|vidhide|voe|dood|mp4upload|histream/i;

async function ggVerify(src) {
  try {
    const r = await fetch(PX + encodeURIComponent(src), {
      signal: AbortSignal.timeout(7000),
      headers: { 'user-agent': UA },
    });
    if (r.status === 404 || r.status === 410 || r.status >= 500) return false;
    if (!r.ok) return true;
    const t = await r.text();
    if (/<title>[^<]*(404|not found)[^<]*<\/title>/i.test(t)) return false;
    return true;
  } catch (e) {
    return true; // ambigu -> pertahankan (perilaku terbukti)
  }
}

async function serversRaw(episodeId) {
  const epUrl = `${GG}/${episodeId}-english-subbed/`;
  const html = await fText(epUrl, 10000);
  const links = [
    ...new Set(
      [...html.matchAll(/data-src="(https:\/\/gogoanime\.by\/player\/[^"]+)"/g)].map((m) => dec(m[1]))
    ),
  ];
  const ordered = [
    ...links.filter((x) => x.indexOf('source=embed') >= 0),
    ...links.filter((x) => x.indexOf('source=embed') < 0),
  ];

  const pages = await Promise.all(
    ordered.slice(0, 4).map((pu) => safe(() => fetchPx(pu, 8000)))
  );
  const seen = new Set();
  const frames = [];
  for (const ph of pages) {
    if (!ph) continue;
    if (ph.indexOf('iframe') < 0 && ph.indexOf('googlevideo') < 0) continue;
    const fs = [...ph.matchAll(/<iframe[^>]+src="(https?:\/\/[^"]+)"/gi)]
      .map((m) => dec(m[1]))
      .filter((s) => s.indexOf('gogoanime.by') < 0 && !seen.has(s));
    fs.sort((a, b) => (HOSTOK.test(b) ? 1 : 0) - (HOSTOK.test(a) ? 1 : 0));
    for (const s of fs) {
      seen.add(s);
      frames.push(s);
    }
  }
  const candidates = frames.slice(0, 5);
  const verdicts = await Promise.all(candidates.map((s) => ggVerify(s)));
  const out = [];
  candidates.forEach((s, i) => {
    if (verdicts[i] && out.length < 3) out.push({ name: `HD Server ${out.length + 1}`, url: s });
  });
  return out;
}

// =====================================================================
// Ekspor publik — tanda tangan sama seperti lapisan sebelumnya.
// =====================================================================

export const getRecentReleases = unstable_cache(
  async (page = 1) => safe(() => recentRaw(page)),
  ['gg-recent'],
  { revalidate: 300 }
);

export const getTrending = unstable_cache(async () => safe(() => trendingRaw()), ['gg-trending'], {
  revalidate: 600,
});

export const searchTitles = unstable_cache(
  async (query, page = 1) => safe(() => searchRaw(query, page)),
  ['gg-search'],
  { revalidate: 300 }
);

export const getDetails = unstable_cache(async (id) => safe(() => detailsRaw(id)), ['gg-info'], {
  revalidate: 3600,
});

export const getStreamSources = unstable_cache(
  async (episodeId) => ({ sources: [], headers: { Referer: GG + '/' } }),
  ['gg-sources'],
  { revalidate: 240 }
);

export const getStreamServers = unstable_cache(
  async (episodeId) => safe(() => serversRaw(episodeId)),
  ['gg-servers'],
  { revalidate: 240 }
);

// Ambil tautan .m3u8 terbaik + header Referer (dipertahankan untuk
// kompatibilitas halaman watch; jalur terbukti memakai embed iframe,
// jadi fungsi ini mengembalikan null selama sources kosong).
export function pickStream(sources) {
  const list = (sources && sources.sources) || [];
  const m3u8 = list.filter((s) => s && s.url && (s.isM3U8 || /\.m3u8($|\?)/i.test(s.url)));
  const referer = (sources && sources.headers && (sources.headers.Referer || sources.headers.referer)) || '';
  if (!m3u8.length) return null;
  const score = (q) => {
    q = String(q || '').toLowerCase();
    if (q.includes('1080')) return 4;
    if (q.includes('720')) return 3;
    if (q.includes('default')) return 2;
    if (q.includes('backup')) return 0;
    return 1;
  };
  m3u8.sort((a, b) => score(b.quality) - score(a.quality));
  return { url: m3u8[0].url, referer };
}
