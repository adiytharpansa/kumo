import 'server-only';
import { ANIME } from '@consumet/extensions';
import { unstable_cache } from 'next/cache';

// =====================================================================
// Lapisan agregasi metadata — SERVER-ONLY.
// Seluruh fungsi @consumet/extensions berjalan eksklusif di Server
// Components melalui modul ini. Tidak ada impor library ini di
// komponen klien mana pun.
//
// Provider: AnimePahe (modul "Zoro" pada versi library lama sudah
// diganti namanya — versi kini mengekspor Hianime sebagai penerusnya;
// spesifikasi mengizinkan Zoro ATAU AnimePahe, dan yang dipakai di
// sini adalah AnimePahe dari @consumet/extensions terbaru).
//
// Setiap panggilan dibungkus try/catch struktural: kegagalan sumber
// (403, timeout, TLS, domain mati) menghasilkan null, dan UI merender
// fallback "Server Connection Busy" — tidak pernah crash 500.
// =====================================================================

const provider = new ANIME.AnimePahe();

async function safe(fn) {
  try {
    const r = await fn();
    return r ?? null;
  } catch (e) {
    return null;
  }
}

// Rilisan terbaru (beranda)
export const getRecentReleases = unstable_cache(
  async (page = 1) => safe(() => provider.fetchRecentEpisodes(page)),
  ['pahe-recent'],
  { revalidate: 300 }
);

// Konten trending: provider ini tidak menyediakan daftar "top airing"
// khusus; dipakai pencarian katalog umum sebagai umpan trending.
export const getTrending = unstable_cache(
  async () => safe(() => provider.search('', 1)),
  ['pahe-trending'],
  { revalidate: 600 }
);

export const searchTitles = unstable_cache(
  async (query, page = 1) => safe(() => provider.search(query, page)),
  ['pahe-search'],
  { revalidate: 300 }
);

export const getDetails = unstable_cache(
  async (id) => safe(() => provider.fetchAnimeInfo(id)),
  ['pahe-info'],
  { revalidate: 3600 }
);

export const getStreamSources = unstable_cache(
  async (episodeId) => safe(() => provider.fetchEpisodeSources(episodeId)),
  ['pahe-sources'],
  { revalidate: 240 }
);

export const getStreamServers = unstable_cache(
  async (episodeId) => safe(() => provider.fetchEpisodeServers(episodeId)),
  { revalidate: 240 }
);

// Ambil tautan .m3u8 terbaik + header Referer yang menyertainya.
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
