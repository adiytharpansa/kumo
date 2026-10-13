import 'server-only';

// =====================================================================
// Klien tipis sumber putar utama (server-only).
//
// Resolusi katalog streaming (cari -> nilai kandidat -> episode ->
// server -> HLS) berjalan di Worker tepi milik pengguna sendiri
// (kumo-hls, rute /resolve dan /eps), karena egress hosting web
// tidak dapat menjangkau API katalog itu dengan andal, sedangkan
// egress Cloudflare terbukti bisa (terverifikasi 13 Okt 2026).
// Worker juga membungkus URL video + subtitle lewat rute /hls-nya
// (CDN mewajibkan Referer/Origin situs asal) dan meng-cache hasil
// resolusi di tepi selama 1 jam.
//
// Nama sumber tidak pernah tampil di UI — pemanggil membungkus
// hasilnya sebagai server generik.
// =====================================================================

const EDGE = 'https://kumo-hls.adiyth-arpansa.workers.dev';

async function edgeJson(path, params, ms = 9500) {
  const qs = new URLSearchParams(params);
  const r = await fetch(`${EDGE}${path}?${qs.toString()}`, {
    signal: AbortSignal.timeout(ms),
    headers: { accept: 'application/json' },
  });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

// Daftar episode lengkap + status bisa-diputar untuk sebuah judul.
// -> { slug, score, numbers: [...], playable } atau null.
export async function kaaEpisodesFor(title, year) {
  if (!title) return null;
  const j = await edgeJson('/eps', year ? { title, year } : { title });
  if (!j || !Array.isArray(j.numbers)) return null;
  return j;
}

// Resolusi stream untuk (judul, tahun, nomor episode).
// -> { url (HLS terbungkus proksi), subtitles, audio } atau null.
export async function streamFor(title, year, epNumber) {
  if (!title || !Number.isFinite(Number(epNumber))) return null;
  const j = await edgeJson(
    '/resolve',
    year
      ? { title, year, ep: String(epNumber) }
      : { title, ep: String(epNumber) }
  );
  if (!j || !j.url) return null;
  return { url: j.url, subtitles: j.subtitles || [], audio: j.audio || 'sub' };
}
