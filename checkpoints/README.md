# 📦 Checkpoint — Cloud Server

Snapshot file aplikasi (landing + tema + transisi) supaya hasil eksperimen bisa di-rollback
dengan satu perintah.

## Isi snapshot

| File | Keterangan |
| --- | --- |
| `index.html` | Struktur halaman (landing, header, footer, modal) |
| `css/styles.css` | Design system: token, tema, animasi, layout |
| `js/main.js` | Router, auth, upload, chart, tema, transisi mode |
| `JOURNAL.md` / `docs/STATUS.md` | Dokumentasi saat checkpoint diambil |

## Cara rollback

```bash
cd /home/andrayusha/portfolio
bash checkpoints/restore.sh <nama-checkpoint>
# contoh:
bash checkpoints/restore.sh rev10-pre-psychology-20261110-1245
```

Lalu restart server:

```bash
node server.js
```

## Daftar checkpoint

| Nama | Waktu | Isi |
| --- | --- | --- |
| `rev10-pre-psychology-20261110-1245` | 2026-11-10 12:45 | Sebelum revisi warna psikologis + transisi mode imersif |
| `rev12-after-fix-20261110-1321` | 2026-11-10 13:21 | Setelah bug panel categorized diperbaiki, sorting ditambahkan, dan split chart jadi irisan |

> Screenshot tetap ada di `docs/screenshots/` (tidak ikut di-rollback) — pakai sebagai pembanding hasil.
