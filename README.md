# Kumo

Frontend (`public/index.html`) + backend Node.js tanpa dependensi npm (Node 20+). Akun dan data di **Supabase** (proyek `kumo`, Singapura). Tabel dan RLS sudah terpasang.

## Jalankan
```bash
cp .env.example .env     # URL dan publishable key Supabase sudah terisi
node --env-file=.env server.js
# buka http://localhost:3000
```
Docker: `docker build -t kumo . && docker run -p 3000:3000 --env-file .env kumo`

## Yang disediakan backend
| Endpoint | Fungsi |
|---|---|
| `GET /meta/anilist/trending`, `/meta/anilist/:query`, `/meta/anilist/info/:id` | Katalog AniList (cache, konten dewasa disaring) |
| `GET /meta/anilist/watch/:animeId-:nomor` | Sumber video dari tabel `episodes` |
| `GET /api/schedule` | Jadwal rilis 7 hari (belum dipakai UI) |
| `GET /api/auth/google`, `POST /api/auth/refresh`, `GET /api/me` | Akun via Google OAuth lewat Supabase Auth |
| `GET/PUT /api/sync` | Sinkron Daftarku, riwayat, rating, pengaturan (dilindungi RLS) |
| `POST/GET/DELETE /api/admin/episodes` | Kelola video (`X-Admin-Key` + `SUPABASE_SECRET_KEY`) |

## Keamanan
- **Katalog dan jadwal publik, video dan sinkronisasi butuh login Google.** Tanpa login, pengguna bebas menjelajah; tombol "Masuk dengan Google" tampil di tab Profil dan saat memutar video; endpoint video (`watch`), `sync`, dan `me` ditolak server (401); tabel `episodes` hanya bisa dibaca role `authenticated`.
- Batasan: link video mentah (mis. URL .m3u8 di CDN-mu) tetap bisa dibuka siapa pun yang tahu link-nya. Untuk perlindungan ketat, simpan video di Supabase Storage (bucket privat) dengan signed URL.
- Ingin pendaftaran hanya lewat undangan? Matikan *Allow new users to sign up* di Authentication > Sign In / Providers, lalu undang pengguna dari dashboard.
- Server memakai kunci publik; data pengguna diakses dengan token pengguna sehingga RLS yang menjaga isolasi data.
- Tabel `episodes` hanya bisa ditulis dengan secret key. Secret key tidak boleh masuk frontend atau repositori.
- Pengecekan keamanan Supabase (advisors): bersih.

## Pengaturan di dashboard Supabase (disarankan)
- **Authentication > Providers > Google:** aktifkan provider Google dan isi Client ID/Secret. Nonaktifkan provider Email agar login hanya via Google.
- **Authentication > Rate limits** dan **Attack protection** bisa diaktifkan.

## Menambah video (hanya konten milikmu / berlisensi)
```bash
curl -X POST http://localhost:3000/api/admin/episodes \
  -H "X-Admin-Key: $ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"animeId":21,"number":1,"title":"Episode 1","url":"https://cdn-kamu.id/video/1/index.m3u8"}'
```
`animeId` = ID AniList (angka di `anilist.co/anime/<id>`).
