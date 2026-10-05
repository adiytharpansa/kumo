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
| `POST /api/auth/register`, `/login`, `/refresh`, `GET /api/me` | Akun lewat Supabase Auth |
| `GET/PUT /api/sync` | Sinkron Daftarku, riwayat, rating, pengaturan (dilindungi RLS) |
| `POST/GET/DELETE /api/admin/episodes` | Kelola video (`X-Admin-Key` + `SUPABASE_SECRET_KEY`) |

## Keamanan
- **Kumo hanya untuk pengguna yang sudah login.** Tanpa login, tampilan hanya menampilkan layar masuk; katalog, jadwal, dan video ditolak server (401); tabel `episodes` hanya bisa dibaca role `authenticated`.
- Batasan: link video mentah (mis. URL .m3u8 di CDN-mu) tetap bisa dibuka siapa pun yang tahu link-nya. Untuk perlindungan ketat, simpan video di Supabase Storage (bucket privat) dengan signed URL.
- Ingin pendaftaran hanya lewat undangan? Matikan *Allow new users to sign up* di Authentication > Sign In / Providers, lalu undang pengguna dari dashboard.
- Server memakai kunci publik; data pengguna diakses dengan token pengguna sehingga RLS yang menjaga isolasi data.
- Tabel `episodes` hanya bisa ditulis dengan secret key. Secret key tidak boleh masuk frontend atau repositori.
- Pengecekan keamanan Supabase (advisors): bersih.

## Pengaturan di dashboard Supabase (disarankan)
- **Authentication > Providers > Email:** matikan *Confirm email* kalau ingin pendaftar langsung masuk. Kalau dibiarkan aktif, pengguna diminta konfirmasi lewat email dulu (email bawaan Supabase dibatasi beberapa email per jam).
- **Authentication > Rate limits** dan **Attack protection** (leaked password protection) bisa diaktifkan.

## Menambah video (hanya konten milikmu / berlisensi)
```bash
curl -X POST http://localhost:3000/api/admin/episodes \
  -H "X-Admin-Key: $ADMIN_KEY" -H "Content-Type: application/json" \
  -d '{"animeId":21,"number":1,"title":"Episode 1","url":"https://cdn-kamu.id/video/1/index.m3u8"}'
```
`animeId` = ID AniList (angka di `anilist.co/anime/<id>`).
