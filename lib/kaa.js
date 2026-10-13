import 'server-only';

import { resolveKaaEpisodes, resolveKaaStream } from './kaa-resolve';

// =====================================================================
// Sumber putar utama (server-only) — adapter tipis.
//
// Resolusi katalog streaming (cari -> nilai kandidat -> episode ->
// server -> HLS) berjalan DI DALAM PROSES lewat lib/kaa-resolve.js.
// Versi sebelumnya memanggil Worker tepi kumo-hls lewat HTTP;
// cara itu runtuh di Cloudflare Workers karena sesama Worker pada
// domain *.workers.dev yang sama tidak bisa saling fetch
// (error 1042 — terverifikasi 13 Okt 2026 malam). Logika resolusi
// di kumo-hls dan di sini identik; worker tetap melayani browser
// untuk /hls (proksi video), /fsearch, dan /subs.
//
// Nama sumber tidak pernah tampil di UI — pemanggil membungkus
// hasilnya sebagai server generik.
// =====================================================================

// Daftar episode lengkap + status bisa-diputar untuk sebuah judul.
// -> { slug, score, numbers: [...], playable } atau null.
export async function kaaEpisodesFor(title, year) {
  if (!title) return null;
  try {
    const j = await resolveKaaEpisodes(title, year || '');
    if (!j || !Array.isArray(j.numbers)) return null;
    return j;
  } catch (e) {
    return null;
  }
}

// Resolusi stream untuk (judul, tahun, nomor episode).
// -> { url (HLS terbungkus proksi), subtitles, audio } atau null.
export async function streamFor(title, year, epNumber) {
  if (!title || !Number.isFinite(Number(epNumber))) return null;
  try {
    const j = await resolveKaaStream(title, year || '', epNumber);
    if (!j || !j.url) return null;
    return { url: j.url, subtitles: j.subtitles || [], audio: j.audio || 'sub' };
  } catch (e) {
    return null;
  }
}
