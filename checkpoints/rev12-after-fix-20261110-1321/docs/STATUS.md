# STATUS PROYEK — Cloud Server Pixel Pastel

> Dokumen ringkas untuk handoff hemat token. Detail historis lengkap ada di [`JOURNAL.md`](../JOURNAL.md).
> Terakhir diperbarui: **2026-11-10** · Revisi terakhir: **#8**

## Snapshot

| Item | Nilai |
| --- | --- |
| Server | `http://localhost:8000` (background, `node server.js`) |
| Akun | 3 / 4 — `admin`, `andra`, `keluarga` (password `pixel123`), 1 slot registrasi bebas |
| Kuota | 50 GB logis per akun |
| Revisi | #11 selesai (69/69), #10 (13/13), #8 (59/59 + 28/28), Rev7 tetap 107/107 |
| File uji | Sudah dibersihkan, tidak ada `rev7-*` |

## ✅ Sudah selesai (Revisi #11)

### Checkpoint rollback
- Snapshot sebelum perubahan: `checkpoints/rev10-pre-psychology-20261110-1245/`.
- Rollback: `bash checkpoints/restore.sh rev10-pre-psychology-20261110-1245` lalu `node server.js`.

### Warna psikologis di semua tema
- **Sky Pastel** (biru 214° = kepercayaan), **Sakura Dusk** (rose 344° = kelembutan), **Autumn Studio** (amber 32° = kehangatan).
- Mode gelap: hue sama, brightness turun, desaturasi ringan.
- Token baru `--on-accent`: teks di atas warna aksen (tinta gelap saat terang, warna malam saat gelap) → tombol tetap berwarna kuat dan teksnya ≥ 4.5:1.

### Grid kotak animasi dihapus
- `landing__grid` / `landing-tile` / riak 3D / `tilePop` dihapus total (HTML + CSS + JS).
- Latar bersih: pola titik statis + spotlight lembut. Animasi lain (drift, twinkle, shoot, petalFall, leafFall, heroIn, float, sunFloat, moonFloat) tetap utuh.

### Transisi mode imersif
- Sapu lingkaran (`clip-path: circle()`) dari titik tombol yang ditekan → mode ditukar di balik overlay → overlay memudar. 620ms + 220ms, tanpa kedip.
- Hormati pengaturan Animasi & efek + `prefers-reduced-motion`.

## ✅ Sudah selesai (Revisi #10)

### Header & footer mepet
- Header 84px → **66px**, footer padding 22px → **11px** (font 6.5px). Isi header tetap sama, hanya lebih rapat.

### Judul web & tombol dominan
- Wordmark `CLOUD` 15px + ikon awan 32px; tombol Sign Up, jam pixel (46px), pengaturan (44px), dan nav lebih besar.
- Awan hero diperbesar ke **128px** (96px pada layar pendek).

### Matahari di dalam awan
- Ikon matahari digambar ulang dua warna (amber + awan krem) dengan *shade* gelap 1px ala 8-bit; dipakai juga sebagai logo hero.
- Baris petunjuk landing dihapus — tidak ada teks pengenalan/petunjuk baru.

### Warna berbasis psikologi
- Matahari amber hangat per tema (Autumn `#E8912D`, Sakura `#FFB37A`, Sky `#FFD166`), awan kremputih, halo radiasi lembut.

## ✅ Sudah selesai (Revisi #9)

### Landing bergaya game
- Judul `CLOUD SERVER` mepet ke logo awan (jarak ≤ 24px, logo 92px, margin judul 12px).
- Tombol CTA lebih dominan: min-width 232px, padding 18/22, border 4px, hard shadow 8px (hover 11px / active 3px), label pixel 11px + letter-spacing, ikon 36px, hover `steps(2, end)`.

### Login cepat (sementara)
- Tombol **"Isi Login Cepat"** di panel Masuk mengisi field username + password dari template.
- Template: `QUICK_LOGIN = { username: 'admin', password: 'pixel123' }` di `js/main.js` (ganti di satu tempat).
- Tidak auto-submit; toast konfirmasi menampilkan username yang terisi.

### Reset akun
- Semua akun dihapus dan dibuat ulang 3 akun awal (`admin`, `andra`, `keluarga` / `pixel123`).
- Akun hasil registrasi sebelumnya (`dadyy123`) dihapus permanen; `/api/login` untuk username itu kini 401.
- `/api/status` → `{"accounts":3,"max":4,"open":true}`. Cadangan lama: `/tmp/opencode/backup/`.

## ✅ Sudah selesai (Revisi #8)

### Tema Autumn Studio
- **Matcha Studio diganti Autumn Studio** (ID `autumn`), dengan palet terang krem–okre–karamel dan palet malam cokelat kayu.
- Tombol utama mode gelap memakai `--peach: #9A5628`; kontras teks `#FFEBDD` = **4.87:1**.
- Tema lama `mint` dan `matcha` otomatis dialihkan ke `autumn`, baik di JS maupun skrip anti-flash.

### Bintang jatuh
- Tiga elemen `.sky-shoot` di langit landing, **hanya aktif di mode gelap**.
- Siklus 11s / 13s / 15s dengan delay berbeda → melintas sesekali, bukan terus-menerus.
- Mode terang: opacity 0, tanpa animasi. Animasi berhenti saat pengaturan **Animasi & efek** dimatikan atau `prefers-reduced-motion`.

### Ciri khas tiap tema (mode terang)
- **Sakura Dusk**: 8 kelopak sakura pixel berguguran.
- **Autumn Studio**: 6 daun gugur pixel melayang turun.
- **Sky Pastel**: partikel putih melayang (seperti sebelumnya).

### Categorized — chart per kategori
- Bar chart vertikal + animasi `barRise` dihapus.
- Memilih kategori → **donut tetap donut**, hanya menampilkan potongan kategori itu; tengah ring berisi ukuran, nama kategori, dan % terhadap kuota; legenda jadi 2 baris.
- Ganti kategori tidak memicu animasi yang menyesatkan.

### Dashboard & Categorized fullscreen
- `body.is-app`: `height: 100dvh` + `overflow: hidden`, footer tetap terlihat, daftar/panel scroll internal.
- Terverifikasi tanpa scroll halaman pada 1440×900, 1366×768, dan 1280×720. Mobile (≤1000px) tetap scroll normal.

### Tagline
- Paragraf "Simpan, kelola, dan unduh file dari perangkatmu…" dihapus dari landing.

## ✅ Sudah selesai (Revisi #7)

### Home & header
- Klik matahari → mode gelap; klik bulan → mode terang.
- Indikator “Server Online” hanya tampil di luar home; chip status di hero dihapus.
- Logo cloud pixel 4 balok; CTA landing punya judul + subteks; lead 620px satu baris di desktop.

### Upload & penyimpanan
- `POST /api/upload?name=&folder=` menerima body biner dan menyimpannya ke `data/users/<id>/files/<file-id>`.
- Batas 2 GB per file, kuota 50 GB dicek server, kategori dari ekstensi, `stored: true`.
- Nama file disanitasi; file sementara dibersihkan bila gagal.

### Unduh & seleksi
- `GET /api/files/:id/download` mengalirkan file dengan nama asli.
- `POST /api/download-zip` membuat ZIP metode *store* (CRC32) dan mempertahankan struktur folder.
- File demo lama `f01`–`f23` hanya metadata → server menjawab `409` dengan pesan jujur.
- Advanced selection: Shift+klik rentang, pilih semua, total ukuran, unduh, ZIP, hapus massal.
- Hapus file (single/multi) ikut menghapus blob di disk.

### Konfirmasi & Categorized
- Modal konfirmasi reusable untuk upload/tambah file dan hapus.
- Legend kategori memakai dotted leader `........`.
- Klik kategori → donut memudar, bar chart vertikal muncul di kanan, preview kategori di kiri; batang bisa diklik, tombol tutup mengembalikan donut.

## 🚧 WIP / batasan yang diketahui

| Status | Item | Catatan |
| --- | --- | --- |
| WIP | Suite tes belum masuk repo | Playwright ada di `/tmp/opencode/uitest/test-rev7.js`; perlu disalin ke `tests/` agar reproducible. |
| WIP | Belum ada CI | Belum ada GitHub Actions/lint/build; verifikasi masih manual. |
| Batasan | File demo tanpa blob | `f01`–`f23` hanya metadata; unduhan menjawab `409`, bukan byte palsu. |
| Batasan | Session in-memory | Session hilang saat server restart; user harus login ulang. |
| Batasan | ZIP tanpa kompresi | Memakai metode *store* agar writer minim dependency; ukuran ZIP ≈ total file. |
| Batasan | Upload sekuensial | Multi-file diunggah satu per satu; progres berbasis jumlah file, bukan byte. |
| Batasan | Penyimpanan lokal disk | Belum ada object storage/cloud sync; data ada di `data/users/<id>/`. |

## 🔌 Endpoint baru / berubah

- `POST /api/upload?name=<nama>&folder=<id>` — upload biner.
- `GET /api/files/:id/download` — unduh satu file.
- `POST /api/download-zip` — body `{ "ids": ["file-id", ...] }`, balasan `arsip-cloud.zip`.
- Endpoint lama tetap: `status`, `register`, `login`, `logout`, `session`, `data`, `folders`, `files`, `PATCH`/`DELETE` file & folder.

## 📁 File yang diubah

| File | Perubahan utama |
| --- | --- |
| `server.js` | Route upload/download/ZIP, streaming, ZIP writer, validasi, cleanup blob. |
| `index.html` | Header minimal, hero sun/moon, `.sky-shoot`/`.sky-petal`/`.sky-leaf`, modal upload + konfirmasi, selection bar, donut chart (tanpa tagline). |
| `css/styles.css` | Style upload/selection/konfirmasi, palet `autumn` terang & gelap, animasi bintang jatuh + efek musiman, mode app fullscreen, responsive. |
| `js/main.js` | Toggle landing, upload flow, selection/download/ZIP, konfirmasi, chart per kategori, tema `autumn`, settings sync. |
| `JOURNAL.md` | Entri Revisi #8 + #7. |

## 🧪 Verifikasi cepat

```bash
cd /home/andrayusha/portfolio
node --check server.js
node --check js/main.js
curl -s http://localhost:8000/api/status
# suite Revisi #8 (butuh Playwright di /tmp/opencode/uitest):
cd /tmp/opencode/uitest && node test-rev8.js
# suite Revisi #11 (warna psikologis, grid, transisi mode):
cd /tmp/opencode/uitest && node test-rev11.js
# suite login cepat + landing:
cd /tmp/opencode/uitest && node test-login-ui.js
# suite tema & bintang jatuh:
cd /tmp/opencode/uitest && node test-theme-stars.js
# suite Rev7:
cd /tmp/opencode/uitest && node test-rev7.js
```

Hasil terakhir: **PASS 59 / 59** (Revisi #8) dan **PASS 28 / 28** (tema & bintang jatuh), 0 error console/page. Suite Rev7 tetap **107 / 107**. Status akun: `{"accounts":4,"max":4,"open":false}`.

## 🖼️ Screenshot

Semua tersimpan lokal di [`docs/screenshots/`](screenshots/).

| File | Isi |
| --- | --- |
| `autumn-light.png` | Home dengan tema Autumn Studio (terang) |
| `autumn-dark.png` | Home dengan tema Autumn Studio (malam) |
| `home-shooting-star.png` | Bintang jatuh terlihat di mode gelap |
| `home-header-sky.png` / `home-header-sakura.png` / `home-header-autumn.png` | Landing dengan header/footer mepet & ikon matahari-dalam-awan |
| `icon-sun-cloud.png` | Detail ikon matahari di dalam awan |
| `icon-moon-dark.png` | Ikon bulan di mode gelap |
| `psych-sky.png` / `psych-sakura.png` / `psych-autumn.png` | Landing tiap tema setelah penataan warna psikologis |
| `psych-autumn-dark.png` | Autumn Studio mode gelap |
| `mode-wipe-mid.png` | Sapu lingkaran transisi mode (menengah) |
| `mode-dark-after-wipe.png` | Hasil setelah transisi selesai |
| `mobile-home-game.png` | Landing mobile 390px |
| `categorized-compact-header.png` | Categorized fullscreen dengan header ringkas |
| `home-game-light.png` / `home-game-dark.png` | Landing bergaya game (judul mepet logo, tombol dominan) |
| `login-quick.png` | Modal login + tombol Isi Login Cepat |
| `sakura-petals.png` | Kelopak sakura berguguran (tema Sakura, mode terang) |
| `autumn-leaves.png` | Daun gugur melayang (tema Autumn, mode terang) |
| `categorized-split-doc.png` | Chart hanya menampilkan potongan kategori Doc |
| `categorized-split-image.png` | Chart hanya menampilkan potongan kategori Gambar |
| `dashboard-fullscreen.png` | Dashboard fullscreen tanpa scroll halaman |
| `categorized-fullscreen-split.png` | Categorized fullscreen + split kategori |
| `home-light.png` / `home-dark.png` | Landing siang / malam |
| `logo-cloud.png` | Detail logo awan pixel |
| `dashboard.png` | Dashboard setelah login |
| `upload-queue.png` | Modal upload + antrean file |
| `dashboard-uploaded.png` | File hasil upload di folder |
| `download-inspector.png` | Panel file + tombol unduh |
| `selection.png` | Mode seleksi lanjutan |
| `categorized-default.png` | Categorized dengan donut + dotted leader |
| `categorized-split.png` | Split chart + preview kategori |
| `mobile-light.png` / `mobile-dark.png` | Tampilan mobile 390px |

## ➡️ Rekomendasi lanjutan (hemat token)

1. Salin suite Playwright ke `tests/` dan tambahkan `npm test` agar tidak perlu setup ulang di `/tmp`.
2. Tambahkan kompresi deflate pada ZIP bila ukuran arsip menjadi masalah.
3. Pertimbangkan session persisten (file/DB) agar tidak logout saat restart.
4. Tandai atau sembunyikan file demo tanpa blob agar unduhan tidak membingungkan.
