# Media Hub — Dynamic Media Metadata Aggregation (Boilerplate)

Boilerplate frontend Next.js (App Router) untuk proyek edukasi agregasi
metadata media dinamis memakai library serverless `@consumet/extensions`
secara internal — seluruh panggilan library berjalan eksklusif di Server
Components (modul `lib/provider.js` bertanda `server-only`), tidak ada
impor library di komponen klien, tanpa endpoint proksi publik.

## Pilihan provider

Spesifikasi menyebut **Zoro atau AnimePahe**. Pada `@consumet/extensions`
versi terkini, modul "Zoro" sudah tidak ada (penerusnya bernama **Hianime**),
jadi boilerplate ini memakai **AnimePahe** (`new ANIME.AnimePahe()`), sesuai
pilihan yang diizinkan spesifikasi. Mengganti provider cukup di satu tempat:
`lib/provider.js`.

## ⚠️ Hasil uji lingkungan ini (13 Okt 2026)

Domain sumber provider (animepahe.si) **tidak terjangkau dari jaringan
lingkungan pengujian ini** (koneksi TLS ditolak di level jaringan; situs
pembanding normal). Akibatnya panggilan provider gagal anggun dan semua
halaman menampilkan fallback **"Server Connection Busy"** — persis perilaku
defensif yang diminta spesifikasi, dan terbukti BUKAN crash 500. Di jaringan
hosting yang dapat menjangkau domain sumber, halaman yang sama akan terisi
data asli tanpa perubahan kode.

## Inisialisasi

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Syarat: Node.js 18.18+ (disarankan 20+), npm. Tidak ada variabel lingkungan
wajib. Untuk mengaktifkan skrip iklan, isi:

```
NEXT_PUBLIC_ADSTERRA_SRC=<url skrip Adsterra>
NEXT_PUBLIC_MONETAG_SRC=<url skrip Monetag>
```

## Struktur direktori

```
app/
  layout.js                    kerangka + header
  page.js                      [Main Dashboard Hub] Recent + Trending (ISR 300s)
  loading.js, error.js         skeleton grid / fallback Server Connection Busy
  details/[id]/page.js         [Content Detail Node] metadata + indeks episode
  details/[id]/loading.js
  watch/[episodeId]/page.js    [Media Playback Portal] stream + ad container
  watch/[episodeId]/loading.js
components/
  Player.jsx        (klien) ArtPlayer + Hls.js (.m3u8) / fallback iframe
  AdPlacement.jsx   (klien) div#ad-placement-container di bawah pemutar,
                    skrip via next/script strategy="lazyOnload"
  MediaCard.jsx, ServerBusy.jsx
lib/
  provider.js       SERVER-ONLY: singleton provider + cache + try/catch
next.config.js      serverExternalPackages: ['@consumet/extensions']
```

Belum di-deploy.

## Konsolidasi proyek (13 Okt 2026)

Atas keputusan pemilik, proyek ini adalah SATU-SATUNYA proyek aktif.
Proyek-proyek pendahulu tidak dihapus, melainkan digantikan oleh proyek
ini dan sumbernya diarsipkan di `arsip-proyek-lama/`:

- `arsip-proyek-lama/kumo-next/` — aplikasi Next.js + Supabase yang SEDANG
  LIVE di https://kumo.adiyth-arpansa.workers.dev/ (sumbernya kini di
  sini, termasuk cf.py dan .env.local; alur deploy live tidak berubah,
  jalankan dari folder arsip itu).
- `arsip-proyek-lama/kumo-stream/` — spesifikasi Consumet Gogoanime.
- `arsip-proyek-lama/kumo-ak/` — aplikasi satu-berkas + seluruh tesnya.

Catatan platform terverifikasi: library `@consumet/extensions` TIDAK bisa
berjalan di Cloudflare Workers (dependensinya `got-scraping` gagal
di-bundle untuk runtime Workers) — proyek ini membutuhkan host Node.js
(Netlify/Render sesuai target spesifikasi), sehingga TIDAK menggantikan
deployment Cloudflare yang live sampai ada keputusan hosting baru.
