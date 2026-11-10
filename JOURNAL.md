# 📓 Journal — Cloud Server (Pixel Pastel)

Dokumentasi perubahan & keputusan teknis proyek.
**Lokasi:** `/home/andrayusha/portfolio/`

---

## 📂 Struktur Proyek

```
portfolio/
├── server.js             # Backend: static + API + session + isolasi user
├── package.json          # npm start
├── scripts/
│   └── set-password.js   # Ganti password akun
├── data/                 # Dibuat otomatis saat server pertama kali jalan
│   ├── users.json        # 3 akun seed + slot registrasi (maks 4)
│   └── users/<id>/tree.json
├── index.html            # SPA: Landing, Dashboard, Categorized + modal
├── css/
│   └── styles.css        # Design system Pixel Pastel (3 tema)
├── js/
│   └── main.js           # Router, API client, auth, DnD, file manager
├── assets/
│   ├── cursor-arrow.svg   # cursor pixel (panah)
│   ├── cursor-hand.svg    # cursor pixel (tangan)
│   ├── cursor-hand-light.svg # tangan versi terang (mode gelap)
│   └── pixel-avatar.svg   # (warisan versi lama, belum dipakai)
├── JOURNAL.md        # Dokumentasi ini
└── Fitur tambahan.txt
```

**Menjalankan server:**
```bash
cd /home/andrayusha/portfolio
npm start          # = node server.js
# buka http://localhost:8000
```

**Akun awal** (password bisa diganti lewat script):

| Username | Password awal | Nama tampilan |
|---|---|---|
| `admin` | `pixel123` | Admin |
| `andra` | `pixel123` | Andra |
| `keluarga` | `pixel123` | Keluarga |

> Akun `tamu` dihapus di Revisi #5 agar ada **1 slot** untuk registrasi. Maksimum tetap **4 akun**; setelah penuh, tombol Buat Akun dinonaktifkan.

```bash
node scripts/set-password.js <username> <password-baru>
# contoh: node scripts/set-password.js admin rahasia123
```
> Ganti password lalu restart server. Session disimpan di memori, jadi restart = semua user logout.

**Kuota:** 50 GB per akun, bersifat **kuota logis aplikasi** (server menolak tambah file jika total melewati 50 GB) — bukan partisi/quota disk OS.

---

## 🗓️ Riwayat Perubahan (terbaru di atas)

### 2026-11-10 — Revisi #12: Bug Panel Categorized, Sorting Nama/Ukuran, Split Chart Jadi Potongan
**Status:** ✅ Selesai

- 🐛 **KRUSIAL — Panel kategori "kebuka sendiri & tidak bisa ditutup" diperbaiki**
  - Penyebab: aturan `body.is-app #view-categorized .cat-panel { display: flex }` (spesifisitas lebih tinggi) **menimpa** aturan `.cat-panel[hidden] { display: none }` → panel selalu tampil, dan tombol "Tutup" hanya mengubah layout split tanpa menyembunyikan panel
  - Perbaikan: aturan display flex hanya berlaku saat panel **tidak** tersembunyi (`:not([hidden])`)
  - Perilaku sekarang benar: panel tersembunyi saat halaman dibuka, terbuka saat kategori diklik, **tertutup kembali** lewat tombol "Tutup" maupun klik kategori yang sama
- ✨ **Opsi urutan (sort) nama & ukuran**
  - Kontrol pixel **NAMA / UKURAN** baru: di toolbar Dashboard (sejajar dengan pencarian) dan di header halaman Categorized
  - Satu state global `state.sort` dipakai bersama oleh grid file Dashboard **dan** daftar file per kategori
  - "Nama" → A–Z (locale `id`), "Ukuran" → terbesar lebih dulu, nama sebagai pemutus seri
  - Folder ikut terurut; status aktif ditandai lewat `aria-pressed` + highlight
- 🔴 **Split chart sekarang benar-benar "potongan" (irisan), bukan lingkaran penuh**
  - Cincin menampilkan **irisan kategori terpilih**: sudut = porsi kategori terhadap storage yang terpakai (minimum 12% supaya irisan kecil tetap terlihat), sisanya warna netral
  - Tengah ring: ukuran + nama kategori + "% dari terpakai"; legenda hanya 1 baris (kategori terpilih) supaya tidak ada angka yang bertentangan
  - Consequence: pindah kategori mengganti **ukuran irisan** sesuai proporsinya (mis. Zip ≈ 51%, Doc ≈ 0,2% tapi tetap terlihat) — bukan lagi lingkaran solid
- 📦 **Checkpoint baru** `checkpoints/rev12-after-fix-20261110-1321/` (state setelah perbaikan)
- ✅ **Verifikasi**
  - Suite: **24/24** (Revisi #12), **69/69** (Revisi #11), **28/28** (tema), **13/13** (login cepat), **59/59** (Revisi #8) — total 193 pemeriksaan, 0 error console/page
  - Screenshot: `docs/screenshots/categorized-slice-doc.png`, `categorized-slice-zip.png`, `categorized-sort-name.png`
  - File yang diubah: `index.html`, `css/styles.css`, `js/main.js`

### 2026-11-10 — Deploy ke Railway (gratis, tanpa Docker, tanpa kartu)

**Status:** ✅ Terverifikasi live

- 🚀 **App live di:** `https://cloud-server-production-ea2a.up.railway.app` (Railway, free plan — trial $5 / free $1 per bulan)
- 🚫 Tidak pakai Docker, tidak perlu kartu kredit.
- 🔧 Build via Nixpacks: install `npm install`, start `npm start`; Railway assign `PORT` (8080) — `server.js` sudah membaca `process.env.PORT`.
- 🐛 Perbaikan saat deploy: domain pertama dibuat dengan target port **8000** → 502 (app benar-benar listen di **8080**). Setelah hapus & buat ulang domain pakai port **8080** → **HTTP 200**.
- ✅ Verifikasi live: `GET /` → **200** (HTML SPA valid), `GET /api/status` → `{"accounts":3,...}`, asset CSS/JS → **200**.
- 📦 Deploy via Railway CLI: `railway login --browserless` → `railway init --name cloud-server` → staging runtime-only → `railway up -y --detach --new --name cloud-server` → `railway domain -p 8080`.
- 🔗 Opsi auto-deploy: connect repo `Udin103/cloud-server-pixel-pastel` via Railway GitHub App (dashboard) — push ke `main` → auto-deploy.
- ⚠️ Catatan: free plan Railway (service sleep saat idle, storage ephemeral) — wajar untuk prototype. Akun/seed (`admin`/`andra`/`keluarga`) & file upload reset per redeploy.

### 2026-11-10 — Revisi #11: Warna Psikologis, Grid Kotak Dihapus, Transisi Mode Imersif
**Status:** ✅ Selesai

- 📦 **Checkpoint rollback (dibuat SEBELUM perubahan)**
  - `checkpoints/rev10-pre-psychology-20261110-1245/` berisi snapshot `index.html`, `css/styles.css`, `js/main.js`, `JOURNAL.md`, `docs/STATUS.md`
  - Rollback 1 perintah: `bash checkpoints/restore.sh rev10-pre-psychology-20261110-1245` → `node server.js`
  - Dokumentasi: `checkpoints/README.md`
- 🎨 **Prinsip warna psikologis diterapkan ke semua tema**
  - **Sky Pastel — "Tenang & Terpercaya"**: biru dominan (hue 214°) = kepercayaan & kejelasan; CTA oranye hangat (26°) = energi & aksi; aksen ungu (252°) = imajinasi
  - **Sakura Dusk — "Hangat & Merawat"**: merah muda (344°) = kelembutan & kepedulian; plum (275°) = nostalgia & ekspresi diri; mint (158°) = kesegaran
  - **Autumn Studio — "Nyaman & Panen"**: amber (32°) = kehangatan, nostalgia, kelimpahan; sienna (22°) = kedalaman
  - Mode gelap memakai **hue yang sama dengan brightness turun + sedikit desaturasi** → warna tetap dikenali, tapi tenang dan tidak menyilaukan
  - Teks sekunder (`--muted`) digelapkan supaya tetap ≥ 4.5:1 di semua tema
  - Token baru **`--on-accent`**: warna teks di atas aksen. Mode terang = tinta gelap; mode gelap = warna malam tema → tombol tetap berwarna kuat **dan** teksnya terbaca
  - Semua tombol/label di atas aksen (tombol, tab auth, kartu kategori aktif, file terpilih, folder aktif, quick login, kartu tema aktif, hover header) sekarang memakai `--on-accent`
- 🧹 **Background kotak-kotak animasi dihapus**
  - Grid pixel 32px yang bisa "timbul 3D" (`landing__grid`, `landing-tile`, riak `is-near-*`, `tilePop`) **dihapus** dari HTML, CSS, dan JS (bersama `GRID`, `landingState`, `canExtrude`)
  - Latar sekarang bersih: pola titik statis + spotlight lembut yang mengikuti kursor
  - **Animasi lain tidak berubah**: partikel `drift`, bintang `twinkle`, bintang jatuh `shoot`, kelopak `petalFall`, daun `leafFall`, `heroIn`, `float`, `sunFloat`, `moonFloat`, hover tombol & huruf judul — semua tetap hidup (dicek otomatis)
- 🌗 **Transisi dark ↔ light yang imersif & seamless**
  - Overlay `#modeWipe`: **sapu lingkaran** (`clip-path: circle()`) yang tumbuh dari titik tombol yang ditekan (matahari, bulan, jam header, atau switch Pengaturan)
  - 3 tahap: ① overlay warna tujuan menyapu layar (620ms, easing `cubic-bezier(.65,0,.35,1)`) → ② mode ditukar di balik overlay → ③ overlay memudar (220ms) → hasil akhir tanpa kedip warna
  - Transisi warna body dimatikan selama wipe (`body.is-mode-wiping`) supaya tidak berkedip dua kali
  - Hormati **Animasi & efek** dan `prefers-reduced-motion` → langsung ganti mode tanpa animasi
- 🐛 **Bug diperbaiki: token `--moon` hilang**
  - Komentar `//` (tidak valid di CSS) sempat membuat parser menghentikan blok `:root` → ikon bulan di mode gelap terisi hitam
  - Diganti komentar `/* … */`; sekarang ada tes penjaga "semua token CSS terisi"
- ✅ **Verifikasi**
  - Suite: **69/69** (Revisi #11), **28/28** (tema & bintang), **59/59** (Revisi #8), **13/13** (login cepat) — 0 error console/page
  - Tes baru memverifikasi: grid tile benar-benar hilang, semua animasi lama masih hidup, wipe berjalan (clip-path lingkaran, pointer-events none, mode tertukar), dan kontras ≥ 4.5 (tombol) / ≥ 7 (teks utama) untuk **3 tema × 2 mode**
  - Screenshot: `docs/screenshots/psych-sky.png`, `psych-sakura.png`, `psych-autumn.png`, `psych-autumn-dark.png`, `mode-wipe-mid.png`, `mode-dark-after-wipe.png`, `icon-moon-dark.png`
  - File yang diubah: `index.html`, `css/styles.css`, `js/main.js`

### 2026-11-10 — Revisi #10: Header/Footer Mepet, Matahari Dalam Awan
**Status:** ✅ Selesai

- ✨ **Header & footer lebih mepet (isi tetap)**
  - Header 84px → **66px** (`body` padding-top ikut 66px, nav mobile `top: 66px`, tinggi landing `calc(100dvh - 66px)`)
  - Footer padding 22px → **11px**, font 7px → **6.5px**, padding horizontal 5% → 4%
  - Isi header (judul web, nav, Sign Up, jam pixel, pengaturan) tidak berubah — hanya rapat dan proporsional
- ✨ **Judul web & tombol lebih dominan**
  - Wordmark header `CLOUD` 12px → **15px**, ikon awan 26px → **32px**
  - Tombol header membesar: Sign Up (font 8→9px, padding 9/11→10/12), jam pixel 42→**46px**, ikon pengaturan 40→**44px**, nav 8→**9px**
  - Awan di landing diperbesar 92px → **128px** (96px pada layar pendek) agar tetap proporsional dengan judul 50px
- ✨ **Matahari di dalam awan (gaya sun & clouds)**
  - Ikon matahari digambar ulang sebagai **SVG dua warna**: matahari amber mengintip dari belakang awan
  - Depth pixel achieved dengan *shade* gelap yang digeser 1px di belakang awan (gaya 8-bit), bukan gradient
  - Ikon yang sama dipakai sebagai **logo besar di hero landing** (awan gelap + matahari hangat)
  - Tidak ada teks penjelasan/petunjuk baru: ikon itu speak itself, dan baris petunjuk landing ("Pilih salah satu untuk mulai…") dihapus
- 🎨 **Warna berbasis science (psikologi warna)**
  - Matahari memakai **amber hangat** (hue ~32° pada tema Autumn, ~28° pada Sakura, 45° pada Sky): rentang hue hangat dikaitkan dengan cahaya siang, kehangatan, dan optimisme → terasa ramah & energik
  - Awan memakai **kremputih** yang berkontras tinggi terhadap latar, sehingga ikon terbaca di semua tema tanpa garis tambahan
  - Token baru: `--sun` (per tema) dan `--sun-cloud`; halo lembut di belakang matahari meniru radiasi cahaya (radial gradient, intensitas rendah)
  - Kontras tetap aman: teks ikon gelap pada awan terang, matahari terang pada awan gelap
- ✅ **Verifikasi**
  - Suite tetap hijau: **13/13** (landing + login cepat), **59/59** (Revisi #8), **28/28** (tema & bintang), 0 error console/page
  - Screenshot: `docs/screenshots/home-header-sky.png`, `home-header-sakura.png`, `home-header-autumn.png`, `icon-sun-cloud.png`, `mobile-home-game.png`, `categorized-compact-header.png`
  - File yang diubah: `index.html`, `css/styles.css`

### 2026-11-10 — Revisi #9: Landing Bergaya Game, Login Cepat, Reset Akun
**Status:** ✅ Selesai

- ✨ **Home lebih "game"**
  - Judul `CLOUD SERVER` sekarang **mepet ke logo awan** (jarak logo → judul turun ke ≤ 24px, logo 110px → 92px, margin judul 26px → 12px)
  - **Tombol CTA didominasi**: lebar minimum 196px → 232px, padding 15/18 → 18/22, border 3px → **4px**, hard shadow 6px → **8px** (hover 11px, active 3px), label pixel 9px → **11px** dengan letter-spacing 1px, ikon 30px → 36px
  - Efek hover memakai `steps(2, end)` supaya terasa seperti tombol menu game, bukan animasi mulus
- ✨ **Tombol Login Cepat (sementara)**
  - Tombol baru **"Isi Login Cepat"** di panel Masuk: sekali klik, field username + password langsung terisi dari template
  - Template berada di satu konstanta: `QUICK_LOGIN = { username: 'admin', password: 'pixel123' }` (`js/main.js`) — gampang diganti
  - Tombol hanya mengisi field (tidak auto-submit) dan menampilkan toast "Login cepat terisi: …"
- 🔴 **Reset seluruh akun**
  - `data/users.json` dan seluruh `data/users/*` dihapus, lalu server membuat ulang 3 akun awal: `admin`, `andra`, `keluarga` (password `pixel123`)
  - Akun hasil registrasi sebelumnya (`dadyy123`) **dihapus permanen**; endpoint `/api/login` untuk username itu kini 401
  - Status `/api/status` kembali `{"accounts":3,"max":4,"open":true}` → satu slot registrasi tersedia lagi
  - Cadangan lama disimpan di `/tmp/opencode/backup/` (users.json + folder data) bila sewaktu-waktu perlu dipulihkan
- ✅ **Verifikasi**
  - **13/13 tes login UI & landing PASS**: jarak logo→judul, ukuran tombol, isi template, login berhasil, status akun, akun lama ditolak
  - Screenshot: `docs/screenshots/home-game-light.png`, `home-game-dark.png`, `login-quick.png`
  - File yang diubah: `index.html`, `css/styles.css`, `js/main.js`, `data/users.json` (di-reset)

### 2026-11-10 — Revisi #8: Bintang Jatuh, Musim Gugur, Efek Tema, Chart per Kategori & Fullscreen
**Status:** ✅ Selesai

- 🔴 **KRUSIAL — Matcha Studio diganti menjadi Autumn Studio**
  - Tema `matcha` dihapus dari daftar tema; penggantinya **Autumn Studio** dengan ID `autumn`
  - Palet terang memakai krem–okre–karamel (`--bg: #F6E7D2`, `--header: #E7B48A`, aksen `#C98B5E`), sedangkan mode gelap memakai cokelat kayu malam (`--bg: #1A100B`, `--surface: #2A1B12`, `--ink: #FFEBDD`)
  - Tombol utama mode gelap memakai `--peach: #9A5628` agar kontras teks `#FFEBDD` mencapai **4.87:1** (sebelumnya 4.27:1)
  - Kompatibilitas penyimpanan lama: `mint` dan `matcha` dinormalisasi ke `autumn`, baik di `main.js` (`LEGACY_THEMES`) maupun skrip anti-flash di `<head>`
- 🔴 **KRUSIAL — Animasi bintang jatuh khusus mode gelap**
  - Tiga elemen `.sky-shoot` ditambahkan ke langit landing; hanya terlihat saat `html[data-mode="dark"]`
  - Siklus panjang **11s / 13s / 15s** dengan delay berbeda (1,2s / 5,6s / 9,1s), jadi bintang melintas **sesekali**, bukan terus-menerus
  - Di mode terang elemen beropacity 0 dan tanpa animasi; saat **Animasi & efek** dimatikan atau `prefers-reduced-motion`, animasi ikut berhenti
- 🔴 **KRUSIAL — Tiap tema punya ciri khas sendiri (mode terang)**
  - **Sakura Dusk**: 8 kelopak sakura pixel (bunga 5 blok) berguguran, siklus 12–19s dengan delay berjenjang
  - **Autumn Studio**: 6 daun gugur pixel (blok L + tangkai) melayang turun, siklus 14–20s
  - **Sky Pastel**: tetap memakai partikel putih melayang seperti sebelumnya
  - Semua efek hanya aktif di mode terang pada tema yang sesuai; di mode gelap berubah menjadi bintang berkedip + bintang jatuh
- 🔴 **KRUSIAL — Categorized: chart tetap chart, hanya potongan kategori terpilih**
  - Bar chart vertikal beserta animasi `barRise` **dihapus** — tidak lagi ada batang yang "tumbuh" padahal jumlah data tidak berubah
  - Saat kategori dipilih, **donut tetap donut**: cincin hanya menampilkan potongan kategori itu, tengah ring memuat ukuran + nama kategori + persentasenya terhadap kuota, dan legenda menyusut jadi 2 baris (kategori terpilih + ruang kosong)
  - Ganti kategori hanya menukar isi ring, tanpa animasi yang menyesatkan; klik kategori yang sama menutup split
- 🔴 **KRUSIAL — Dashboard & Categorized dikunci fullscreen**
  - `body.is-app` aktif di kedua halaman: `height: 100dvh`, `overflow: hidden`, footer tetap terlihat di dalam viewport
  - `.workspace`, panel directory, grid file, daftar kategori, dan isi chart jadi area scroll internal, sehingga halaman tidak bergulir
  - Panel/list di dalam categorized dirapatkan tinggi fleksibel supaya tetap muat pada 1440×900, 1366×768, dan 1280×720
  - Di mobile (≤1000px) tetap scroll normal seperti sebelumnya
- ✨ **Tagline dihapus**
  - Paragraf "Simpan, kelola, dan unduh file dari perangkatmu — rapi dalam satu tempat." dihapus dari landing
  - Jarak judul ke tombol dirapikan supaya landing tetap seimbang
- ✅ **Verifikasi**
  - `node --check server.js` dan `node --check js/main.js`: OK; kurung CSS seimbang
  - **28/28 tes tema & bintang jatuh PASS** + **59/59 tes Revisi #8 PASS** (0 error console/page): tagline hilang, kelopak sakura & daun autumn hanya di mode terang, chart tetap bulat & hanya berisi kategori terpilih, legend 2 baris, tanpa scroll halaman di tiga ukuran layar, mobile tetap scroll
  - Screenshot: `docs/screenshots/autumn-light.png`, `autumn-dark.png`, `home-shooting-star.png`, `sakura-petals.png`, `autumn-leaves.png`, `categorized-split-doc.png`, `categorized-split-image.png`, `dashboard-fullscreen.png`, `categorized-fullscreen-split.png`
  - File yang diubah: `index.html`, `css/styles.css`, `js/main.js`

### 2026-11-09 — Revisi #7: Upload Lokal, Unduh/ZIP, Split Chart, Header Minimal
**Status:** ✅ Selesai

- 🔴 **KRUSIAL — Upload nyata dari perangkat ke cloud**
  - `POST /api/upload?name=&folder=` menerima **body biner mentah** dan menulis langsung ke disk per akun (`data/users/<id>/files/<file-id>`), bukan lagi metadata saja
  - Kategori ditentukan dari ekstensi; file baru ditandai `stored: true`; kuota dan batas **2 GB per file** dicek di server
  - Nama file disanitasi (tanpa path traversal / karakter kontrol); file sementara dibersihkan saat gagal
  - Modal **Tambah File** kini dropzone + pemilih file asli, antrean multi-file, ukuran per file, dan total kuota real-time
- 🔴 **KRUSIAL — Unduh satu file & ZIP dengan struktur folder**
  - `GET /api/files/:id/download` mengalirkan blob dengan `Content-Disposition` dan nama file asli
  - `POST /api/download-zip` membuat ZIP di server (metode *store*, CRC32 + data descriptor) berisi file terpilih **beserta folder asalnya**, jadi hasil ekstrak tetap `Home/Documents/...`
  - Folder kosong ikut ditulis sebagai entri direktori; unduhan ZIP dinamis diberi nama `arsip-cloud.zip`
  - File demo lama (`f01`–`f23`) tidak punya blob: server menjawab `409` dengan pesan jujur, UI menampilkan catatan “hanya metadata” — tidak ada byte palsu
  - Hapus file ikut menghapus blob di disk (single maupun multi-hapus)
- 🔴 **KRUSIAL — Advanced selection**
  - Mode **Pilih** menampilkan bar seleksi: jumlah item, total ukuran, pilih semua, kosongkan, unduh, ZIP, dan hapus massal
  - Klik biasa = toggle; **Shift+klik** = pilih rentang; tombol berubah menjadi **Selesai**; seleksi dibersihkan saat keluar mode/ganti folder
- 🔴 **KRUSIAL — Popup konfirmasi untuk aksi krusial**
  - Modal konfirmasi reusable dipakai untuk **upload/tambah file** (menyebut jumlah file + folder tujuan) dan **hapus** (single/multi, menyebut nama/jumlah)
  - Batal mengembalikan fokus tanpa mengubah apa pun; Esc dan klik backdrop juga membatalkan
- 🔴 **KRUSIAL — Split chart beranimasi di Categorized**
  - Saat kategori dipilih, donut memudar dan area chart berubah menjadi **bar chart vertikal di kanan**; panel preview kategori muncul di kiri dan konten merapat
  - Batang bisa diklik untuk berpindah kategori; tombol tutup mengembalikan donut dan layout normal dengan transisi halus
  - Di layar ≤1000px split menumpuk vertikal agar tetap terbaca
- ✨ **Home, header, dan logo**
  - **Matahari & bulan adalah tombol nyata**: klik matahari → mode gelap, klik bulan → mode terang (hook `.sky-icon--sun` / `.sky-icon--moon` dipertahankan)
  - Indikator **Server Online** hanya tampil di luar home (`body.is-landing .status { display:none }`); chip status di hero juga dihapus agar aturan ini konsisten, dan tools header diringkas tetap minimalis
  - Dua kartu aksi landing kini punya judul + subteks yang jelas; logo cloud digambar ulang sebagai **4 balok pixel** agar lebih mirip awan
  - Lead landing dilebarkan ke 620px supaya tidak menggantung satu kata di baris kedua
- 📊 **Legend kategori**
  - Setiap baris persentase memakai **dotted leader “........”** (radial-gradient titik) yang mengisi ruang antara label dan nilai, seperti daftar isi
- ✅ **Verifikasi**
  - `node --check server.js` dan `node --check js/main.js`: OK; kurung CSS seimbang
  - **107 tes Playwright PASS, 0 gagal, 0 error console**: sun/moon, header, auth/settings, upload + batal/konfirmasi, blob di disk, unduh tunggal, pesan jujur file demo, Shift-seleksi, pilih semua, isi ZIP (`unzip -l`), isolasi akun, dotted leader, split chart + ganti batang, konfirmasi hapus + pembersihan blob, kuota/akun 3/4, dan mobile 390px
  - Screenshot final `41`–`51`: landing terang/gelap, dashboard, antrean upload, file terunggah, inspector unduh, seleksi, categorized default/split, mobile terang/gelap
  - Dokumentasi handoff ringkas: [`docs/STATUS.md`](docs/STATUS.md) + screenshot lokal di `docs/screenshots/`
  - File uji `rev7-*` dan blob-nya dihapus; status akhir tetap **3/4** (`{"accounts":3,"max":4,"open":true}`)
  - File yang diubah: `server.js`, `index.html`, `css/styles.css`, `js/main.js`

### 2026-11-08 — Revisi #6: Mode Gelap, Pixel Clock, Grid 32px
**Status:** ✅ Selesai

- 🔴 **KRUSIAL — Mode gelap penuh, terpisah dari tema warna**
  - Root memakai `data-mode="light|dark"`; tiap tema punya versi malam sendiri: **Sky Night**, **Sakura Night**, **Matcha Night**
  - Token gelap mengganti permukaan, header, teks, border, aksen, chart, error, toast, dan warna tipe file tanpa mengubah identitas tema
  - `--ink` menjadi terang di mode gelap, sedangkan `--shadow` tetap hampir hitam agar hard shadow pixel tetap terbaca
  - Anti-flash: skrip inline di `<head>` menerapkan `cloud.mode` sebelum CSS dimuat (diverifikasi `data-mode` sudah `dark` saat `DOMContentLoaded`)
- 🔴 **KRUSIAL — Pixel clock di header = tombol mode**
  - Jam pixel real-time dengan jarum jam, menit, dan detik (detik bergerak tiap 1 detik)
  - Klik jam mengganti terang ↔ gelap, menyimpan `cloud.mode`, dan memutar animasi `steps(4)` sebagai umpan balik
  - `aria-pressed`, `aria-label`, dan `title` ikut berubah agar tetap aksesibel
  - Ukuran 42px di desktop, 34px di mobile; tetap muat di header 390px tanpa overflow
- 🔴 **KRUSIAL — Langit ambient khusus landing**
  - Mode terang: matahari pixel + 10 partikel melayang
  - Mode gelap: bulan pixel berkawah + 10 bintang kecil berkedip ala Minecraft
  - Partikel disembunyikan di mode gelap dan bintang disembunyikan di mode terang (animasi tidak lagi menimpa `opacity`)
  - Dekorasi berada di belakang konten, hanya di landing, dan ikut mati saat **Animasi & efek** dimatikan atau `prefers-reduced-motion`
- ✨ **Grid landing dirapikan**
  - Ukuran kotak **48px → 32px** (CSS dan `GRID` di JS tetap sinkron); ripple diperluas ke radius 3 dengan lift 1/2/3px
  - Ekstrusi 3D, pop, spotlight, dan hover tetap dipertahankan dengan skala sisi baru
  - Centering hero diperbaiki: `.landing` memakai `display:grid; place-items:center` + padding simetris; delta hero vs area = **0px** pada 1440×900, 1024×768, dan 390×844
- ⚙️ **Settings tersinkron**
  - Switch baru **Mode gelap** selalu sinkron dengan clock, termasuk setelah reload/login/logout
  - Reset mengembalikan tema ke Sky, mode ke terang, kursor & animasi ke on, serta membersihkan `cloud.mode`
- 🖱️ **Kursor mode gelap**
  - Varian `cursor-hand-light.svg` dipakai di mode gelap agar tangan pixel tidak tenggelam di latar malam
- ✅ **Verifikasi**
  - `node --check server.js` dan `node --check js/main.js`: OK; kurung CSS seimbang
  - **109 tes Playwright PASS, 0 gagal, 0 error console**: tile 32px, centering, jam real-time, toggle + persistensi anti-flash, sinkronisasi settings, 3 palet gelap (kontras teks ≥ 7:1), dekorasi terang/gelap, kursor gelap, Animasi off, mobile 390px, login/dashboard/categorized gelap, regresi kategori → lompat ke file, kuota 50 GB (file 60 GB ditolak 409), isolasi data antar akun, registrasi slot ke-4 + penolakan akun ke-5 (409)
  - Screenshot final: `30`–`40` (landing terang/gelap, settings, 3 tema gelap, auth gelap, mobile 390/320, dashboard, categorized, lompat file)
  - Akun uji dihapus; status akhir kembali **3/4** (`{"accounts":3,"max":4,"open":true}`)

### 2026-11-07 — Revisi #5: Sign Up, Registrasi Akun, Landing Grid 3D
**Status:** ✅ Selesai

- 🔴 **KRUSIAL — Auth diubah menjadi Sign Up dengan dua tab**
  - Tombol header kini **Sign Up**; modal berisi tab **Masuk** dan **Buat Akun**
  - Tagline/hint di modal login dihapus; judul modal menjadi “Akun”
  - Klik Dashboard/Categorized saat belum login tetap membuka tab **Masuk**
  - Klik Sign Up dari header langsung membuka tab **Buat Akun**
- 🔴 **KRUSIAL — Registrasi nyata + batas 4 akun**
  - Endpoint baru `POST /api/register` (username + password), langsung membuat session
  - Username 3–20 karakter (`a-z`, `0-9`, titik, garis bawah, strip), unik tanpa beda huruf besar/kecil
  - Password minimal 8 karakter, di-hash **scrypt + salt** seperti akun seed
  - Akun baru otomatis mendapat `tree.json` baseline dan kuota logis 50 GB terpisah
  - **Maksimum 4 akun**; server menolak pendaftaran ke-5 dengan `409`
  - `GET /api/status` (publik) melaporkan `accounts`, `max`, dan `open`; UI menampilkan “Slot akun: 3/4” dan menonaktifkan tombol saat penuh
  - Akun seed `tamu` dihapus (beserta datanya) agar tersedia 1 slot; akun aktif sekarang `admin`, `andra`, `keluarga`
  - Login `tamu` tidak berlaku lagi; data akun lain tidak tersentuh
- 🔴 **KRUSIAL — Landing diganti grid pixel penuh + ekstrusi 3D**
  - Kubus tunggal dan mask reveal dihapus; background landing kini **grid kotak pixel 48px** yang selalu terlihat penuh layar (±510 kotak pada 1440×900)
  - Kotak di bawah kursor **timbul jadi balok 3D**: sisi atas beraksen tema, sisi kanan dan bawah lebih gelap, plus border ink
  - Kotak tetangga ikut naik bergelombang (radius 2) sehingga terasa seperti riak, bukan kubus yang muncul tiba-tiba
  - Klik background memicu animasi pop pada kotak aktif
  - Grid dibangun ulang saat resize; otomatis statis saat **Animasi off**, `prefers-reduced-motion`, atau perangkat sentuh
  - Warna sisi tile mengikuti tema (`--tile-right`, `--tile-bottom`); Sky/Sakura/Matcha tetap konsisten
- 🩹 **Perbaikan tambahan**
  - `authModal` typo yang membuat modal gagal terbuka diperbaiki menjadi `loginModal`
  - Field registrasi dikosongkan saat logout; pesan error dipisah antara login dan registrasi
  - Tombol submit disabled saat kapasitas penuh, tetap ada validasi ganda di server
- ✅ **Verifikasi**
  - `node --check server.js` dan `node --check js/main.js`: OK
  - API diuji: register sukses (201) + session + tree baseline, duplikat (409), username tidak valid (400), password pendek (400), akun ke-5 (409)
  - **20 tes UI Playwright**: grid >100 kotak, hover 3D + ripple, Sign Up/tabs, login admin, registrasi UI, validasi konfirmasi password, status 3/4 → 4/4, tombol disabled, gating Dashboard — semua PASS, 0 error console
  - Screenshot dicek: landing grid hover, modal Buat Akun, dashboard, registrasi sukses, kondisi penuh
  - Akun uji `uitest` dihapus setelah tes; status akhir kembali **3/4**

### 2026-11-07 — Revisi #4: Backend, Login, DnD, Tambah File, Tema Baru, Landing Kubus
**Status:** ✅ Selesai

- 🔴 **KRUSIAL — Backend nyata + isolasi penyimpanan per akun**
  - `server.js` tanpa dependency (hanya `http`, `fs`, `path`, `crypto`)
  - 4 akun tetap: `admin`, `andra`, `keluarga`, `tamu` — password di-hash **scrypt + salt**
  - Session `HttpOnly` + `SameSite=Lax` disimpan di memori; request API tidak pernah percaya user id dari client
  - Data per user di `data/users/<id>/tree.json`; user lain tidak bisa membacanya
  - Login dibatasi **5 percobaan/menit** per IP + username
  - Endpoint: `POST /api/login`, `POST /api/logout`, `GET /api/session`, `GET /api/data`, `POST /api/folders`, `POST /api/files`, `DELETE /api/files/:id`, `PATCH /api/files/:id`, `PATCH /api/folders/:id`
  - Kuota **50 GB per akun** dicek di server (kuota logis, bukan partisi disk OS)
  - `/data`, `/scripts`, `server.js`, `package.json`, `JOURNAL.md`, `Fitur tambahan.txt` diblokir dari static server
- 🔴 **KRUSIAL — Login di header + gate otomatis**
  - Area auth di header: **Login** saat tamu, **nama user + Keluar** saat masuk
  - Klik Dashboard/Categorized saat belum login → modal login muncul; setelah sukses langsung masuk ke halaman yang tadi diklik
  - Reload di halaman terkunci tanpa session juga memunculkan login
  - Session berakhir saat server restart (disimpan di memori)
- 🔴 **KRUSIAL — Default semua super folder tertutup**
  - `defaultCollapsed()` sekarang mencakup **semua folder yang punya anak**, termasuk Home/Media Vault/Work
  - ROOT tetap tampil; caret membuka isi folder
- ✨ **Drag & drop di Dashboard**
  - File dan folder bisa ditarik ke baris Directory, breadcrumb, atau tile folder
  - Folder tidak bisa dipindah ke dirinya sendiri/turunannya (dicek di client + server)
  - Drop ke ROOT hanya untuk folder; file wajib berada di dalam folder
  - Highlight target (`is-drop`), ghost tile, dan toast hasil
- ➕ **Tambah File**
  - Tombol baru di toolbar → modal metadata: nama, jenis, ukuran (MB), folder tujuan
  - Ukuran dikonversi ke byte, kuota ditampilkan real-time, penolakan kuota datang dari server
  - Bukan upload biner — hanya metadata (sesuai keputusan)
- 🗂️ **Categorized clickable**
  - Kartu Doc/Zip/Video/Gambar kini tombol; klik membuka panel daftar file kategori tersebut
  - Baris menampilkan nama, ukuran, dan lokasi; klik baris → lompat ke Dashboard, buka folder, dan pilih file
  - Donut chart memakai kuota 50 GB per akun
- 🎨 **Tema dirombak: 3 preset dengan identitas penuh**
  - **Sky Pastel** (default), **Sakura Dusk** (rose–plum), **Matcha Studio** (matcha–cream)
  - Peach Sunset & Lavender Haze dihapus (paling terasa “cuma ganti latar”)
  - Tiap tema mengganti `--bg`, `--bg-alt`, `--header`, `--surface`, `--free`, keluarga aksen (`--sky`, `--lavender`, `--mint`, `--peach`, `--folder`), pola titik, dan warna kubus landing
  - `--ink` tetap gelap; warna tipe file tetap konsisten
  - Tema lama di `localStorage` dinormalisasi: `mint → matcha`, `peach/lavender → sky`
- 🧊 **Landing: grid blok + kubus 3D**
  - Hover background memunculkan grid blok pixel dengan mask radial di sekitar kursor
  - Kubus isometrik **snap ke blok di bawah pointer** (ukuran grid 56px, sama di JS & CSS)
  - Kubus memakai warna aksen tema aktif; klik di background memicu animasi pop
  - Hanya 1 overlay grid + 1 SVG kubus (ringan); otomatis mati saat Animasi off / `prefers-reduced-motion` / perangkat sentuh
  - Parallax blok melayang dan hover huruf judul tetap ada
- 🩹 **Perbaikan tambahan**
  - Header tepat 84px agar tidak ada celah dengan `body padding-top`
  - Logout mengosongkan field username/password
  - Modal login, tambah file, dan panel kategori punya style pixel yang konsisten
  - Responsive: workspace 1 kolom di ≤1000px, menu drawer ≤768px, auth ringkas ≤560px
- ✅ **Verifikasi**
  - `node --check` untuk `server.js`, `js/main.js`, `scripts/set-password.js`: OK
  - API diuji dengan curl: login benar/salah, isolasi admin vs tamu, kuota 60 GB ditolak (409), folder ke turunan ditolak (400), duplikat (409), rate limit (429), logout (401)
  - **32 tes UI Playwright** + **16 tes final**: login gate, 3 super collapsed, caret, tambah folder/file, categorized klik + lompat, 3 tema + persist, DnD, logout, mobile — semua PASS, 0 error console
  - Screenshot final: landing + hover, login, dashboard (Sky/Matcha), categorized, 1024px, mobile dashboard, gate logout
  - `scripts/set-password.js` diuji (ganti lalu kembalikan `tamu`)

### 2026-11-07 — Revisi #3: Directory Tree, Landing Interaktif, Settings
**Status:** ✅ Selesai

- 🔴 **KRUSIAL — Directory collapsible (Super Folder → Family Folder)**
  - 3 super folder dummy: **Home**, **Media Vault**, **Work**
  - Family folder bertingkat: Documents→Tugas/Catatan, Photos→2025/2026, Projects→Cloud, Media Vault→Film & Musik, Work→Client A
  - Caret `▶/▼` dengan `aria-expanded`; klik nama tetap navigasi, klik caret hanya buka/tutup
  - State `state.collapsed` (in-memory); default **family tertutup**, super terbuka
  - Auto-expand leluhur saat masuk folder yang tersembunyi
  - Baris `ROOT` untuk kembali ke level super folder
  - Animasi buka/tutup pakai CSS grid `grid-template-rows` (tanpa mengukur tinggi via JS)
- 🔴 **KRUSIAL — New Folder otomatis menentukan jenis**
  - Di ROOT → **Super Folder** (`parent: null`)
  - Di dalam folder → **Family Folder** (`parent: folder aktif`)
  - Judul modal, hint, dan toast menyesuaikan otomatis
- ✨ **Landing interaktif ala Minecraft (warna tetap)**
  - Tombol: highlight sisi atas + lift + hard shadow + efek tekan
  - Judul dipecah per huruf (JS) → hover pop/rotate + warna aksen
  - Pixel-float: parallax kursor + pause/highlight saat hover
  - Chip Online: titik pulse + lift
  - Spotlight lembut mengikuti kursor
- 🖱️ **Cursor pixel kustom**
  - `assets/cursor-arrow.svg` + `assets/cursor-hand.svg`
  - Hanya aktif di `@media (hover: hover) and (pointer: fine)`; input tetap `text`
  - Bisa dimatikan lewat Settings
- ⚙️ **Settings / kustomisasi**
  - 4 preset tema: **Sky Pastel**, **Mint Meadow**, **Peach Sunset**, **Lavender Haze**
  - Toggle kursor pixel & animasi/efek
  - Reset ke default
  - Persist di `localStorage` (`cloud.theme`, `cloud.cursor`, `cloud.motion`)
  - Skrip inline di `<head>` mencegah flash tema saat reload
- 🩹 **Perbaikan data & layout**
  - `arsip-2025.zip` 1.99 GB → 1 GB supaya total **3.48 GB** tidak melebihi kapasitas 4 GB
  - `body` flex column + `main { flex: 1 }` → footer tidak lagi menggantung di tengah halaman non-landing
  - Directory 220px → 250px; tag `FAMILY` dihapus dari tree (nama folder tidak terpotong) — label tetap muncul di tile konten
- ✅ **Verifikasi:** `node --check` OK; 13 tes logika lolos (ROOT→super, folder→family, caret, auto-expand, settings, reset, localStorage); CSS braces seimbang; screenshot Firefox headless untuk landing (desktop + mobile), dashboard (1440 & 1024), categorized, settings, dan tema mint

### 2026-11-07 — Revisi #2: Landing Fixed, Header, Journal
**Status:** ✅ Selesai

- 🔴 **KRUSIAL — Landing fixed tanpa scroll**
  - `.landing` → `height: calc(100vh - 84px)`, `overflow: hidden`
  - `body.is-landing` → `overflow: hidden` (class ditoggle oleh router di `js/main.js`)
  - Footer **tetap tampil** dengan `position: fixed; bottom: 0` saat di landing (Opsi B)
  - Media query `max-height: 720px` → mengecilkan logo/judul/tombol agar tetap muat 1 layar
- 🎨 **Header dibedakan dari background**
  - Token baru `--header: #A8C8FF` (sky pastel — se-nada dengan `--bg: #D6E6FF`)
  - `.topbar` memakai `background: var(--header)` (sebelumnya semi-transparan senada bg)
- ✂️ **Tagline landing dihapus**
  - Elemen `<p class="landing__tagline">` dihapus dari `index.html`
  - Aturan CSS `.landing__tagline` dihapus
- 📓 `JOURNAL.md` dibuat (dokumen ini)
- ✅ **Verifikasi:** `node --check` lolos, tidak ada sisa referensi `tagline`, CSS braces seimbang (146/146), preview `localhost:8000` → semua aset `200`

### 2026-11-07 — Build Awal: Website Cloud Server (SPA)
**Status:** ✅ Selesai

- Rewrite total dari website portofolio → **cloud server SPA**
- 3 view dengan hash router: `#/`, `#/dashboard`, `#/categorized`
- **Dashboard:** toolbar (New Folder modal, Delete, Search), breadcrumb, Directory tree, Content grid, panel Preview + File Info
- **Categorized:** kartu kategori (Doc/Zip/Video/Gambar) + donut chart `conic-gradient` + legend persentase
- **Dummy data:** 6 folder, 14 file, kapasitas 4 GB (in-memory, reset saat refresh)
- **Design system Pixel Pastel:** token warna, `Press Start 2P` + `Space Grotesk`, chunky 8-bit buttons, pixel frames
- Responsive (burger menu) + `prefers-reduced-motion`

### Arsip — Iterasi Sebelumnya
- Portofolio Pixel Pastel (hero/about/skills/projects/contact) + animasi heroIn/float/reveal
- Konversi portofolio → home server (Server Info / Services / Storage)
- Konsep diubah total → Cloud Server SPA (versi sekarang)

---

## 🎨 Keputusan Desain

| Token | Fungsi | Nilai |
|---|---|---|
| `--bg` | background utama | `#D6E6FF` |
| `--bg-alt` | panel header / alt | `#C2D6F5` |
| `--surface` | kartu / pane | `#FFFFFF` |
| `--ink` | teks & border | `#2D2A32` |
| `--muted` | teks sekunder | `#8A8494` |
| `--lavender` | aksen | `#B8A9FF` |
| `--mint` | aksen | `#9FE8C9` |
| `--peach` | tombol / selected | `#FFD3B8` |
| `--sky` | aksen | `#A8C8FF` |
| `--folder` | ikon folder | `#C98B3F` |
| `--free` | chart ruang kosong | `#DCE7F8` |
| `--header` | background header | `#A8C8FF` |
| `--dot` | pola titik background | `rgba(184,169,255,.18)` |
| `--cube-top` | sisi atas kubus landing | `#FFD3B8` |
| `--cube-left` | sisi kiri kubus | `#B8A9FF` |
| `--cube-right` | sisi kanan kubus | `#A8C8FF` |

**Preset tema** (Settings → Tema Warna): **Sky Pastel** (default), **Sakura Dusk**, **Autumn Studio**. Ketiganya mengganti seluruh token permukaan & aksen, bukan hanya background. `--ink` dan warna tipe file tetap agar kontras dan makna kategori aman.

**Mode gelap** dikendalikan terpisah lewat `data-mode="dark"` dan punya palet malam per tema (Sky Night, Sakura Night, Autumn Night). Di mode gelap `--ink` berubah menjadi warna terang untuk teks/border, `--shadow` tetap gelap, dan aksen diperdalam. Kontras teks minimum ketiga palet terverifikasi **≥ 7:1**.

**Warna tipe file** (di `js/main.js`):
Doc `#7C5CFF` · Zip `#2FA37C` · Video `#E07A43` · Gambar `#3D7BE0`

**Prinsip anti-slop:**
- Animasi subtle (heroIn, float, viewIn) — bukan bounce/parallax berlebih
- `prefers-reduced-motion` dihormati
- Border tebal + hard shadow (pixel style), tanpa gradient norak

---

## 🔧 Catatan Teknis

- **Router:** hash-based (`#/`, `#/dashboard`, `#/categorized`), back/forward browser berfungsi
- **Auth:** `POST /api/login` → cookie `cloud_sid` (HttpOnly, SameSite=Lax); `GET /api/session` saat boot; logout menghapus session
- **Isolasi:** server hanya membaca `data/users/<id>/tree.json` milik user dari session — id user tidak pernah dikirim/dipercaya dari client
- **Data:** 23 file di 15 folder (3 super + 12 family) per akun, tersimpan di server (bertahan setelah refresh)
- **State UI:** `state` di `main.js` (folder aktif, selection, collapsed, filter kategori) — in-memory; data file/folder dari server
- **`is-landing`:** class di `<body>` saat view landing → mengatur `overflow: hidden` + footer fixed
- **ROOT:** `state.folderId === null` = level super folder; breadcrumb & baris `ROOT` mengarah ke sini
- **Kuota:** `GET /api/data` mengembalikan `{ limit, used }`; server menolak `POST /api/files` jika melewati limit
- **Settings:** `localStorage` (`cloud.theme`, `cloud.mode`, `cloud.cursor`, `cloud.motion`); inline script di `<head>` menerapkan sebelum CSS (anti-flash)
- **Mode:** `data-mode="light|dark"` di `<html>`; clock header & switch Settings memanggil `setMode()` yang sama, sehingga selalu sinkron
- **Tema:** `data-theme="sky|sakura|autumn"`; ID lama `mint`/`matcha` dinormalisasi ke `autumn` saat boot
- **Landing:** grid **32px** (CSS `.landing-tile` + `GRID` di JS), ripple radius 3, ekstrusi 3D; centering memakai grid + padding simetris
- **Mode app:** `body.is-app` (Dashboard & Categorized, ≥1001px) → `height: 100dvh` + `overflow: hidden`; footer tetap di dalam viewport dan daftar/panel menjadi area scroll internal
- **Split chart:** memilih kategori tidak lagi mengganti donut dengan bar chart; cincin hanya menampilkan potongan kategori terpilih, legenda jadi 2 baris
- **Ikon:** SVG sprite inline (`<symbol>`) — pixel style, warna via `currentColor`
- **Cursor:** file SVG di `assets/`, dipasang via CSS `cursor: url(...)`, fallback ke cursor OS; mode gelap memakai `cursor-hand-light.svg`
- **Clock:** `renderClock()` memperbarui `--deg` jarum tiap detik; klik clock = `setMode(!settings.dark)` + animasi `clockSpin`
- **Keamanan file:** path traversal ditolak, input divalidasi (nama, tipe file, ukuran, folder tujuan), body JSON dibatasi 1 MB

---

## 🚨 Daftar Perbaikan Krusial

1. **Backend nyata + isolasi 4 akun** (2026-11-07) — session HttpOnly, scrypt, `data/users/<id>`, rate limit, kuota 50 GB
2. **Login gate di header + Dashboard/Categorized** (2026-11-07) — modal otomatis, lanjut ke halaman tujuan setelah sukses
3. **Default super folder tertutup** (2026-11-07) — semua folder ber-anak collapsed, ROOT tetap tampil
4. **Drag & drop + Tambah File + Categorized clickable** (2026-11-07) — move file/folder, modal metadata, panel kategori + lompat ke file
5. **Landing grid blok + kubus 3D snap** (2026-11-07) — overlay grid 56px, 1 SVG kubus, hormati setting Animasi
6. **3 tema penuh** (2026-11-07) — Sky Pastel, Sakura Dusk, Matcha Studio; Peach/Lavender dihapus
7. **Landing no-scroll + footer tetap terlihat** (2026-11-07) — `height: calc(100vh - 84px)` + footer fixed + `body.is-landing`
8. **Header kontras se-nada** (2026-11-07) — `--header: #A8C8FF`
9. **Tagline slop dihapus** (2026-11-07)
10. **Directory collapsible + super/family otomatis** (2026-11-07) — tree 3 level, caret, `state.collapsed`, `createFolder()` auto jenis
11. **Settings persisten + anti-flash** (2026-11-07) — tema, toggle cursor/motion, `localStorage`
12. **Storage tidak overload + footer menempel bawah** (2026-11-07) — `body` flex column
13. **Nama folder tidak terpotong** (2026-11-07) — tag FAMILY dihapus dari tree, directory 250px
14. **Kartu placeholder kotak sempurna + pixel bg + gradient Minecraft** (iterasi sebelumnya)
15. **Fix overflow hero** (`max-width: 860px`) (iterasi sebelumnya)
16. **Mode gelap + pixel clock + grid 32px** (2026-11-08) — 3 palet malam, clock header sebagai switch, langit ambient, centering hero, sinkron Settings

---

## 📝 Template Entri Baru

```md
### YYYY-MM-DD — Judul Perubahan
**Status:** ✅ Selesai / 🚧 WIP

- 🔴 **KRUSIAL — ...** (jika ada)
- Perubahan lainnya...
- File yang diubah: `...`
```
