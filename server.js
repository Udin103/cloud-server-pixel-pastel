'use strict';

/* ============================================================
   Cloud Server — backend minimal (tanpa dependency)
   - Static server + API + session + isolasi data per user
   - Kuota logis 50 GB per user
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || '0.0.0.0';
const QUOTA = 50 * 1024 * 1024 * 1024; // 50 GB per user (kuota logis)
const MAX_USERS = 4; // batas akun untuk sementara
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const SESSION_COOKIE = 'cloud_sid';
const MAX_UPLOAD = 2 * 1024 * 1024 * 1024; // batas satu file (2 GB)
const MAX_ZIP_FILES = 200;

/* ---------- Akun awal (bisa diubah via scripts/set-password.js) ---------- */
const SEED_USERS = [
  { id: 'u-admin',    username: 'admin',    name: 'Admin',    password: 'pixel123' },
  { id: 'u-andra',    username: 'andra',    name: 'Andra',    password: 'pixel123' },
  { id: 'u-keluarga', username: 'keluarga', name: 'Keluarga', password: 'pixel123' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
};

/* Klasifikasi kategori dari ekstensi file */
const TYPE_EXT = {
  doc: new Set(['pdf', 'doc', 'docx', 'txt', 'md', 'csv', 'xls', 'xlsx', 'ppt', 'pptx', 'm3u', 'sh', 'js', 'json', 'html', 'css', 'rtf', 'odt']),
  zip: new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz']),
  video: new Set(['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', 'wmv', 'flv']),
  image: new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'tiff']),
};

function inferType(name) {
  const ext = path.extname(String(name || '')).slice(1).toLowerCase();
  for (const key of Object.keys(TYPE_EXT)) {
    if (TYPE_EXT[key].has(ext)) return key;
  }
  return 'doc';
}

function fileMime(name) {
  return MIME[path.extname(String(name || '')).toLowerCase()] || 'application/octet-stream';
}

function safeFileName(name) {
  const base = path.basename(String(name || '')).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return base.slice(0, 120);
}

/* ---------- Password ---------- */
function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  return { salt: s, hash: crypto.scryptSync(password, s, 64).toString('hex') };
}

function verifyPassword(password, user) {
  try {
    const candidate = Buffer.from(hashPassword(password, user.salt).hash, 'hex');
    const stored = Buffer.from(user.hash, 'hex');
    return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
  } catch (e) {
    return false;
  }
}

/* ---------- Seed data awal ---------- */
function baselineTree() {
  return {
    folders: [
      { id: 'home',  name: 'Home',        parent: null },
      { id: 'media', name: 'Media Vault', parent: null },
      { id: 'work',  name: 'Work',        parent: null },

      { id: 'docs',           name: 'Documents', parent: 'home' },
      { id: 'docs-tugas',     name: 'Tugas',     parent: 'docs' },
      { id: 'docs-catatan',   name: 'Catatan',   parent: 'docs' },
      { id: 'photos',         name: 'Photos',    parent: 'home' },
      { id: 'photos-2025',    name: '2025',      parent: 'photos' },
      { id: 'photos-2026',    name: '2026',      parent: 'photos' },
      { id: 'videos',         name: 'Videos',    parent: 'home' },
      { id: 'projects',       name: 'Projects',  parent: 'home' },
      { id: 'projects-cloud', name: 'Cloud',     parent: 'projects' },
      { id: 'archives',       name: 'Archives',  parent: 'home' },
      { id: 'media-film',     name: 'Film & Musik', parent: 'media' },
      { id: 'work-client',    name: 'Client A',     parent: 'work' },
    ],
    files: [
      { id: 'f01', name: 'README.txt',        type: 'doc',   size: 2048,       folder: 'home',          modified: '05 Nov 2026' },
      { id: 'f02', name: 'backup-2026.zip',   type: 'zip',   size: 134217728,  folder: 'home',          modified: '04 Nov 2026' },
      { id: 'f03', name: 'foto-pantai.jpg',   type: 'image', size: 4404019,    folder: 'home',          modified: '02 Nov 2026' },
      { id: 'f04', name: 'video-liburan.mp4', type: 'video', size: 335544320,  folder: 'home',          modified: '01 Nov 2026' },
      { id: 'f05', name: 'tugas-akhir.docx',  type: 'doc',   size: 1258291,    folder: 'docs',          modified: '30 Okt 2026' },
      { id: 'f06', name: 'catatan-kuliah.pdf',type: 'doc',   size: 3565158,    folder: 'docs',          modified: '28 Okt 2026' },
      { id: 'f07', name: 'laporan-pkl.docx',  type: 'doc',   size: 943718,     folder: 'docs-tugas',    modified: '29 Okt 2026' },
      { id: 'f08', name: 'catatan-algoritma.md', type: 'doc', size: 18432,     folder: 'docs-catatan',  modified: '26 Okt 2026' },
      { id: 'f09', name: 'keluarga.png',      type: 'image', size: 2202010,    folder: 'photos',        modified: '27 Okt 2026' },
      { id: 'f10', name: 'sunset.jpg',        type: 'image', size: 5872026,    folder: 'photos',        modified: '25 Okt 2026' },
      { id: 'f11', name: 'liburan-2025.jpg',  type: 'image', size: 3355443,    folder: 'photos-2025',   modified: '20 Des 2025' },
      { id: 'f12', name: 'rawon-night.png',   type: 'image', size: 1572864,    folder: 'photos-2026',   modified: '03 Nov 2026' },
      { id: 'f13', name: 'tutorial-docker.mp4', type: 'video', size: 503316480, folder: 'videos',       modified: '20 Okt 2026' },
      { id: 'f14', name: 'vlog-rumah.mp4',    type: 'video', size: 220200960,  folder: 'videos',        modified: '18 Okt 2026' },
      { id: 'f15', name: 'cloud-server.zip',  type: 'zip',   size: 47185920,   folder: 'projects',      modified: '15 Okt 2026' },
      { id: 'f16', name: 'script-backup.sh',  type: 'doc',   size: 8192,       folder: 'projects',      modified: '14 Okt 2026' },
      { id: 'f17', name: 'deploy-notes.md',   type: 'doc',   size: 24576,      folder: 'projects-cloud',modified: '16 Okt 2026' },
      { id: 'f18', name: 'arsip-2025.zip',    type: 'zip',   size: 1073741824, folder: 'archives',      modified: '10 Okt 2026' },
      { id: 'f19', name: 'foto-lama.zip',     type: 'zip',   size: 650117120,  folder: 'archives',      modified: '08 Okt 2026' },
      { id: 'f20', name: 'playlist.m3u',      type: 'doc',   size: 4096,       folder: 'media-film',    modified: '22 Okt 2026' },
      { id: 'f21', name: 'film-pendek.mp4',   type: 'video', size: 734003200,  folder: 'media-film',    modified: '21 Okt 2026' },
      { id: 'f22', name: 'kontrak-client-a.pdf', type: 'doc', size: 1048576,   folder: 'work-client',   modified: '19 Okt 2026' },
      { id: 'f23', name: 'aset-logo.zip',     type: 'zip',   size: 12582912,   folder: 'work-client',   modified: '18 Okt 2026' },
    ],
  };
}

function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJsonAtomic(file, value) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

function ensureUserStorage(userId) {
  const dir = path.join(USERS_DIR, userId);
  const treeFile = path.join(dir, 'tree.json');
  const filesDir = path.join(dir, 'files');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });
  if (!fs.existsSync(treeFile)) writeJsonAtomic(treeFile, baselineTree());
  return treeFile;
}

function ensureData() {
  fs.mkdirSync(USERS_DIR, { recursive: true });

  if (!fs.existsSync(USERS_FILE)) {
    const users = SEED_USERS.map((u) => {
      const { salt, hash } = hashPassword(u.password);
      return { id: u.id, username: u.username, name: u.name, salt, hash, quota: QUOTA };
    });
    writeJsonAtomic(USERS_FILE, { users });
    console.log('[seed] users.json dibuat (' + users.length + ' akun)');
  }

  const users = readJsonFile(USERS_FILE).users;
  users.forEach((user) => {
    ensureUserStorage(user.id);
  });
}

/* ---------- Session ---------- */
const sessions = new Map();

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId, expires: Date.now() + SESSION_TTL });
  return token;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try { out[key] = decodeURIComponent(value); } catch (e) { out[key] = value; }
  });
  return out;
}

function getSessionUser(req) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expires) {
    sessions.delete(token);
    return null;
  }
  const users = readJsonFile(USERS_FILE).users;
  return users.find((u) => u.id === session.userId) || null;
}

function sessionCookie(token, maxAge) {
  return SESSION_COOKIE + '=' + token + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=' + maxAge;
}

function publicUser(user) {
  return { id: user.id, username: user.username, name: user.name, quota: QUOTA };
}

/* ---------- Tree helpers ---------- */
function treeFile(userId) {
  return path.join(USERS_DIR, userId, 'tree.json');
}

function readTree(userId) {
  return readJsonFile(treeFile(userId));
}

function writeTree(userId, tree) {
  writeJsonAtomic(treeFile(userId), tree);
}

function usedBytes(tree) {
  return tree.files.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
}

function userFilesDir(userId) {
  return path.join(USERS_DIR, userId, 'files');
}

function blobPath(userId, fileId) {
  return path.join(userFilesDir(userId), fileId);
}

function folderChain(tree, folderId) {
  const names = [];
  let cur = folderId ? tree.folders.find((f) => f.id === folderId) : null;
  let guard = 0;
  while (cur && guard < 64) {
    names.unshift(cur.name);
    cur = cur.parent ? tree.folders.find((f) => f.id === cur.parent) : null;
    guard += 1;
  }
  return names;
}

/* Terima body biner langsung ke file sementara (tanpa menahan di memori). */
function receiveUpload(req, dest, maxBytes) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dest);
    let size = 0;
    let settled = false;

    const fail = (message) => {
      if (settled) return;
      settled = true;
      out.destroy();
      fs.unlink(dest, () => {});
      reject(new Error(message));
    };

    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        fail('File melebihi batas ukuran atau kuota');
        return;
      }
      if (!out.write(chunk)) {
        req.pause();
        out.once('drain', () => {
          if (!settled) req.resume();
        });
      }
    });
    req.on('end', () => {
      if (!settled) out.end();
    });
    req.on('aborted', () => fail('Upload dibatalkan'));
    req.on('error', (err) => fail(err.message || 'Upload gagal'));
    out.on('error', (err) => fail(err.message || 'Gagal menyimpan file'));
    out.on('finish', () => {
      if (settled) return;
      settled = true;
      resolve(size);
    });
  });
}

function removeBlob(userId, fileId) {
  if (!fileId) return;
  fs.unlink(blobPath(userId, fileId), () => {});
}

/* Susun daftar entri ZIP dari file terpilih, lengkap dengan folder kosong. */
function buildZipPlan(userId, tree, ids) {
  const chosen = tree.files.filter((f) => ids.includes(f.id));
  const dirSet = new Set();
  const used = new Map();

  const files = chosen.map((file) => {
    const chain = folderChain(tree, file.folder);
    const folderPath = chain.map(zipSafeSegment).join('/');
    const base = zipSafeSegment(file.name);
    const key = (folderPath ? folderPath + '/' : '') + base;
    const count = used.get(key) || 0;
    used.set(key, count + 1);
    const finalName = count
      ? (folderPath ? folderPath + '/' : '') + base.replace(/(\.[^.]+)?$/, ' (' + count + ')$1')
      : key;

    const parts = folderPath ? folderPath.split('/') : [];
    let prefix = '';
    for (const part of parts) {
      prefix = prefix ? prefix + '/' + part : part;
      dirSet.add(prefix);
    }
    return { name: finalName, source: blobPath(userId, file.id), file };
  });

  return { files, dirs: Array.from(dirSet).sort() };
}

/* ---------- ZIP tanpa dependency (metode store) ---------- */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32Update(crc, buffer) {
  let c = crc;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xFF] ^ (c >>> 8);
  }
  return c;
}

function dosStamp(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: day };
}

function writeChunk(res, buffer) {
  return new Promise((resolve, reject) => {
    res.write(buffer, (err) => (err ? reject(err) : resolve()));
  });
}

function zipSafeSegment(value) {
  const clean = String(value || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/^\.+$/, '')
    .trim();
  return clean || 'file';
}

function contentDisposition(name) {
  const ascii = String(name).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return 'attachment; filename="' + ascii + '"; filename*=UTF-8\'\'' + encodeURIComponent(name);
}

/* Tulis ZIP store secara streaming: lokal header → isi → data descriptor → central directory. */
async function streamZip(res, dirs, entries) {
  const stamp = dosStamp(new Date());
  const central = [];
  let offset = 0;

  const localHeader = (nameBuf, isDir) => {
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(isDir ? 0x0800 : 0x0808, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(stamp.time, 10);
    header.writeUInt16LE(stamp.date, 12);
    header.writeUInt16LE(nameBuf.length, 26);
    return header;
  };

  for (const dir of dirs) {
    const nameBuf = Buffer.from(dir + '/', 'utf8');
    const start = offset;
    await writeChunk(res, localHeader(nameBuf, true));
    await writeChunk(res, nameBuf);
    central.push({ nameBuf, crc: 0, size: 0, offset: start, flags: 0x0800 });
    offset += 30 + nameBuf.length;
  }

  for (const item of entries) {
    const nameBuf = Buffer.from(item.name, 'utf8');
    const start = offset;
    await writeChunk(res, localHeader(nameBuf, false));
    await writeChunk(res, nameBuf);

    let crc = 0xFFFFFFFF;
    let size = 0;
    for await (const chunk of fs.createReadStream(item.source)) {
      crc = crc32Update(crc, chunk);
      size += chunk.length;
      await writeChunk(res, chunk);
    }
    crc = (crc ^ 0xFFFFFFFF) >>> 0;

    const descriptor = Buffer.alloc(16);
    descriptor.writeUInt32LE(0x08074b50, 0);
    descriptor.writeUInt32LE(crc, 4);
    descriptor.writeUInt32LE(size, 8);
    descriptor.writeUInt32LE(size, 12);
    await writeChunk(res, descriptor);

    central.push({ nameBuf, crc, size, offset: start, flags: 0x0808 });
    offset += 30 + nameBuf.length + size + 16;
  }

  const centralStart = offset;
  for (const item of central) {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(item.flags, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(stamp.time, 12);
    header.writeUInt16LE(stamp.date, 14);
    header.writeUInt32LE(item.crc, 16);
    header.writeUInt32LE(item.size, 20);
    header.writeUInt32LE(item.size, 24);
    header.writeUInt16LE(item.nameBuf.length, 28);
    header.writeUInt32LE(item.offset, 42);
    await writeChunk(res, header);
    await writeChunk(res, item.nameBuf);
    offset += 46 + item.nameBuf.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(central.length, 8);
  eocd.writeUInt16LE(central.length, 10);
  eocd.writeUInt32LE(offset - centralStart, 12);
  eocd.writeUInt32LE(centralStart, 16);
  await writeChunk(res, eocd);
  res.end();
}



function todayLabel() {
  const d = new Date();
  return String(d.getDate()).padStart(2, '0') + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

function folderExists(tree, id) {
  return tree.folders.some((f) => f.id === id);
}

function isDescendant(tree, ancestorId, candidateId) {
  let cur = tree.folders.find((f) => f.id === candidateId);
  while (cur) {
    if (cur.id === ancestorId) return true;
    cur = cur.parent ? tree.folders.find((f) => f.id === cur.parent) : null;
  }
  return false;
}

/* ---------- Rate limit login ---------- */
const attempts = new Map();

function attemptKey(req, username) {
  const ip = (req.socket && req.socket.remoteAddress) || '?';
  return ip + '|' + String(username || '').trim().toLowerCase();
}

function isRateLimited(key) {
  const rec = attempts.get(key);
  if (!rec) return false;
  if (Date.now() > rec.reset) {
    attempts.delete(key);
    return false;
  }
  return rec.count >= 5;
}

function noteFailedAttempt(key) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now > rec.reset) attempts.set(key, { count: 1, reset: now + 60 * 1000 });
  else rec.count += 1;
}

/* ---------- HTTP helpers ---------- */
function sendJson(res, status, payload, extraHeaders) {
  const headers = Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }, extraHeaders || {});
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
  res.end(text);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1024 * 1024) {
        reject(new Error('Body terlalu besar'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('JSON tidak valid'));
      }
    });
    req.on('error', reject);
  });
}

/* ---------- Static file ---------- */
const BLOCKED_TOP = new Set(['data', 'scripts', 'node_modules']);
const BLOCKED_FILES = new Set(['server.js', 'package.json', 'JOURNAL.md', 'Fitur tambahan.txt']);

function safeStaticPath(pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch (e) {
    return null;
  }
  if (rel.includes('\0')) return null;
  rel = rel.replace(/\\/g, '/');
  if (rel === '/') rel = '/index.html';
  if (!rel.startsWith('/')) rel = '/' + rel;

  const segments = rel.split('/').filter(Boolean);
  if (!segments.length) return null;
  if (segments.some((s) => s === '..' || s === '.')) return null;
  if (BLOCKED_TOP.has(segments[0])) return null;
  if (BLOCKED_FILES.has(segments.join('/'))) return null;

  const filePath = path.join(ROOT, ...segments);
  if (!filePath.startsWith(ROOT + path.sep)) return null;
  return filePath;
}

function serveStatic(req, res, pathname) {
  const filePath = safeStaticPath(pathname);
  if (!filePath) return sendText(res, 404, 'Not found');

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return sendText(res, 404, 'Not found');
    fs.readFile(filePath, (readErr, buffer) => {
      if (readErr) return sendText(res, 404, 'Not found');
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': buffer.length,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      if (req.method === 'HEAD') return res.end();
      res.end(buffer);
    });
  });
}

/* ---------- API ---------- */
async function handleApi(req, res, url) {
  const pathname = url.pathname;
  const method = req.method;

  // Proteksi sederhana untuk request yang mengubah data (same-origin)
  if (method !== 'GET' && method !== 'HEAD') {
    const origin = req.headers.origin;
    if (origin && origin !== 'http://' + req.headers.host && origin !== 'https://' + req.headers.host) {
      return sendJson(res, 403, { error: 'Origin tidak valid' });
    }
  }

  /* Status kapasitas akun (publik) */
  if (pathname === '/api/status' && method === 'GET') {
    const accounts = readJsonFile(USERS_FILE).users.length;
    return sendJson(res, 200, { accounts, max: MAX_USERS, open: accounts < MAX_USERS });
  }

  /* Registrasi akun baru */
  if (pathname === '/api/register' && method === 'POST') {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }

    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!/^[a-z0-9._-]{3,20}$/.test(username)) {
      return sendJson(res, 400, { error: 'Username 3–20 karakter: huruf, angka, titik, garis bawah, atau strip' });
    }
    if (password.length < 8 || password.length > 200) {
      return sendJson(res, 400, { error: 'Password minimal 8 karakter' });
    }

    const data = readJsonFile(USERS_FILE);
    if (data.users.length >= MAX_USERS) {
      return sendJson(res, 409, { error: 'Kapasitas akun penuh (' + data.users.length + '/' + MAX_USERS + ')' });
    }
    if (data.users.some((u) => u.username.toLowerCase() === username)) {
      return sendJson(res, 409, { error: 'Username sudah dipakai' });
    }

    const { salt, hash } = hashPassword(password);
    const user = {
      id: 'u-' + crypto.randomUUID(),
      username,
      name: username,
      salt,
      hash,
      quota: QUOTA,
    };
    data.users.push(user);
    writeJsonAtomic(USERS_FILE, data);
    ensureUserStorage(user.id);

    const token = createSession(user.id);
    return sendJson(res, 201, { user: publicUser(user) }, {
      'Set-Cookie': sessionCookie(token, Math.floor(SESSION_TTL / 1000)),
    });
  }

  /* Login */
  if (pathname === '/api/login' && method === 'POST') {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }

    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) return sendJson(res, 400, { error: 'Username dan password wajib diisi' });

    const key = attemptKey(req, username);
    if (isRateLimited(key)) return sendJson(res, 429, { error: 'Terlalu banyak percobaan. Coba lagi sebentar.' });

    const user = readJsonFile(USERS_FILE).users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );
    if (!user || !verifyPassword(password, user)) {
      noteFailedAttempt(key);
      return sendJson(res, 401, { error: 'Username atau password salah' });
    }
    attempts.delete(key);

    const token = createSession(user.id);
    return sendJson(res, 200, { user: publicUser(user) }, {
      'Set-Cookie': sessionCookie(token, Math.floor(SESSION_TTL / 1000)),
    });
  }

  /* Logout */
  if (pathname === '/api/logout' && method === 'POST') {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) sessions.delete(token);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
  }

  /* Session */
  if (pathname === '/api/session' && method === 'GET') {
    const user = getSessionUser(req);
    if (!user) return sendJson(res, 401, { error: 'Belum login' });
    return sendJson(res, 200, { user: publicUser(user) });
  }

  /* Semua endpoint di bawah ini butuh login */
  const user = getSessionUser(req);
  if (!user) return sendJson(res, 401, { error: 'Sesi berakhir, silakan login lagi' });

  /* Data user */
  if (pathname === '/api/data' && method === 'GET') {
    const tree = readTree(user.id);
    return sendJson(res, 200, {
      folders: tree.folders,
      files: tree.files,
      quota: { limit: QUOTA, used: usedBytes(tree) },
    });
  }

  /* Buat folder */
  if (pathname === '/api/folders' && method === 'POST') {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }

    const name = String(body.name || '').trim();
    const parent = body.parent === null || body.parent === undefined ? null : String(body.parent);
    if (!name || name.length > 60) return sendJson(res, 400, { error: 'Nama folder tidak valid' });

    const tree = readTree(user.id);
    if (parent !== null && !folderExists(tree, parent)) {
      return sendJson(res, 400, { error: 'Folder induk tidak ditemukan' });
    }
    const duplicate = tree.folders.some(
      (f) => f.parent === parent && f.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) return sendJson(res, 409, { error: 'Folder dengan nama itu sudah ada' });

    const folder = { id: 'folder-' + crypto.randomUUID(), name, parent };
    tree.folders.push(folder);
    writeTree(user.id, tree);
    return sendJson(res, 201, { folder });
  }

  /* Tambah file (metadata) */
  if (pathname === '/api/files' && method === 'POST') {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }

    const name = String(body.name || '').trim();
    const type = String(body.type || '');
    const size = Math.round(Number(body.size));
    const folder = String(body.folder || '');

    if (!name || name.length > 120) return sendJson(res, 400, { error: 'Nama file tidak valid' });
    if (!['doc', 'zip', 'video', 'image'].includes(type)) return sendJson(res, 400, { error: 'Jenis file tidak valid' });
    if (!Number.isFinite(size) || size < 0) return sendJson(res, 400, { error: 'Ukuran file tidak valid' });

    const tree = readTree(user.id);
    if (!folderExists(tree, folder)) return sendJson(res, 400, { error: 'Folder tujuan tidak ditemukan' });
    if (usedBytes(tree) + size > QUOTA) return sendJson(res, 409, { error: 'Kuota 50 GB terlampaui' });

    const file = {
      id: 'file-' + crypto.randomUUID(),
      name,
      type,
      size,
      folder,
      modified: todayLabel(),
    };
    tree.files.push(file);
    writeTree(user.id, tree);
    return sendJson(res, 201, { file, quota: { limit: QUOTA, used: usedBytes(tree) } });
  }

  /* Upload file biner dari perangkat */
  if (pathname === '/api/upload' && method === 'POST') {
    const name = safeFileName(url.searchParams.get('name') || '');
    const folder = String(url.searchParams.get('folder') || '');
    if (!name) return sendJson(res, 400, { error: 'Nama file tidak valid' });

    const tree = readTree(user.id);
    if (!folderExists(tree, folder)) return sendJson(res, 400, { error: 'Folder tujuan tidak ditemukan' });

    const used = usedBytes(tree);
    if (used >= QUOTA) return sendJson(res, 409, { error: 'Kuota 50 GB terlampaui' });

    const fileId = 'file-' + crypto.randomUUID();
    const tempPath = path.join(userFilesDir(user.id), fileId + '.part');
    let size;
    try {
      size = await receiveUpload(req, tempPath, Math.min(MAX_UPLOAD, QUOTA - used));
      fs.renameSync(tempPath, blobPath(user.id, fileId));
    } catch (e) {
      return sendJson(res, 413, { error: e.message || 'Upload gagal' });
    }

    const file = {
      id: fileId,
      name,
      type: inferType(name),
      size,
      folder,
      modified: todayLabel(),
      stored: true,
    };
    tree.files.push(file);
    writeTree(user.id, tree);
    return sendJson(res, 201, { file, quota: { limit: QUOTA, used: usedBytes(tree) } });
  }

  /* Unduh satu file */
  const downloadMatch = pathname.match(/^\/api\/files\/([^/]+)\/download$/);
  if (downloadMatch && method === 'GET') {
    const id = decodeURIComponent(downloadMatch[1]);
    const tree = readTree(user.id);
    const file = tree.files.find((f) => f.id === id);
    if (!file) return sendJson(res, 404, { error: 'File tidak ditemukan' });

    const source = blobPath(user.id, file.id);
    let stat;
    try { stat = fs.statSync(source); } catch (e) {
      return sendJson(res, 409, { error: 'File ini belum punya isi tersimpan (contoh bawaan)' });
    }
    if (!stat.isFile()) return sendJson(res, 404, { error: 'File tidak ditemukan' });

    res.writeHead(200, {
      'Content-Type': fileMime(file.name),
      'Content-Length': stat.size,
      'Content-Disposition': contentDisposition(file.name),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    const stream = fs.createReadStream(source);
    stream.on('error', () => { try { res.destroy(); } catch (e) { /* abaikan */ } });
    return stream.pipe(res);
  }

  /* Unduh banyak file sebagai ZIP (struktur folder dipertahankan) */
  if (pathname === '/api/download-zip' && method === 'POST') {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }

    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    if (!ids.length) return sendJson(res, 400, { error: 'Pilih minimal satu file' });
    if (ids.length > MAX_ZIP_FILES) {
      return sendJson(res, 400, { error: 'Maksimal ' + MAX_ZIP_FILES + ' file per ZIP' });
    }

    const tree = readTree(user.id);
    const chosen = tree.files.filter((f) => ids.includes(f.id));
    if (!chosen.length) return sendJson(res, 400, { error: 'File yang dipilih tidak ditemukan' });

    const plan = buildZipPlan(user.id, tree, ids);
    const missing = plan.files.filter((item) => !fs.existsSync(item.source));
    if (missing.length) {
      return sendJson(res, 409, {
        error: 'Sebagian file belum punya isi tersimpan: ' +
          missing.slice(0, 3).map((item) => item.file.name).join(', ') +
          (missing.length > 3 ? ', dll.' : ''),
        missing: missing.map((item) => item.file.name),
      });
    }

    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': contentDisposition('arsip-cloud.zip'),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    try {
      await streamZip(res, plan.dirs, plan.files);
    } catch (e) {
      try { res.destroy(); } catch (err) { /* abaikan */ }
    }
    return;
  }

  /* Hapus file */
  const fileDeleteMatch = pathname.match(/^\/api\/files\/([^/]+)$/);
  if (fileDeleteMatch && method === 'DELETE') {
    const id = decodeURIComponent(fileDeleteMatch[1]);
    const tree = readTree(user.id);
    const index = tree.files.findIndex((f) => f.id === id);
    if (index === -1) return sendJson(res, 404, { error: 'File tidak ditemukan' });
    const [removed] = tree.files.splice(index, 1);
    writeTree(user.id, tree);
    removeBlob(user.id, removed.id);
    return sendJson(res, 200, { ok: true, removed });
  }

  /* Pindah file */
  if (fileDeleteMatch && method === 'PATCH') {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const id = decodeURIComponent(fileDeleteMatch[1]);
    const folder = String(body.folder || '');
    const tree = readTree(user.id);
    const file = tree.files.find((f) => f.id === id);
    if (!file) return sendJson(res, 404, { error: 'File tidak ditemukan' });
    if (!folderExists(tree, folder)) return sendJson(res, 400, { error: 'Folder tujuan tidak ditemukan' });
    if (file.folder === folder) return sendJson(res, 200, { ok: true, unchanged: true });
    file.folder = folder;
    writeTree(user.id, tree);
    return sendJson(res, 200, { ok: true, file });
  }

  /* Pindah folder */
  const folderMatch = pathname.match(/^\/api\/folders\/([^/]+)$/);
  if (folderMatch && method === 'PATCH') {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const id = decodeURIComponent(folderMatch[1]);
    const parent = body.parent === null || body.parent === undefined ? null : String(body.parent);
    const tree = readTree(user.id);
    const folder = tree.folders.find((f) => f.id === id);
    if (!folder) return sendJson(res, 404, { error: 'Folder tidak ditemukan' });
    if (parent !== null && !folderExists(tree, parent)) return sendJson(res, 400, { error: 'Folder tujuan tidak ditemukan' });
    if (parent === id) return sendJson(res, 400, { error: 'Folder tidak bisa dipindah ke dirinya sendiri' });
    if (parent !== null && isDescendant(tree, id, parent)) {
      return sendJson(res, 400, { error: 'Folder tidak bisa dipindah ke turunannya sendiri' });
    }
    const duplicate = tree.folders.some(
      (f) => f.id !== id && f.parent === parent && f.name.toLowerCase() === folder.name.toLowerCase()
    );
    if (duplicate) return sendJson(res, 409, { error: 'Sudah ada folder dengan nama itu di lokasi tujuan' });

    folder.parent = parent;
    writeTree(user.id, tree);
    return sendJson(res, 200, { ok: true, folder });
  }

  return sendJson(res, 404, { error: 'Endpoint tidak ditemukan' });
}

/* ---------- Server ---------- */
ensureData();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((err) => {
      console.error('[api]', err);
      if (!res.headersSent) sendJson(res, 500, { error: 'Terjadi kesalahan di server' });
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendText(res, 405, 'Method not allowed');
  }
  serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log('Cloud Server berjalan di http://localhost:' + PORT);
  console.log('Akun awal: admin, andra, keluarga (ganti password via scripts/set-password.js)');
  console.log('Registrasi terbuka selama akun < ' + MAX_USERS);
});
