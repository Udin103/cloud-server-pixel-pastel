/* ============================================================
   Cloud Server — Pixel Pastel
   Vanilla SPA: hash router, API session, file manager, theming
   ============================================================ */

'use strict';

/* ---------- Config ---------- */
const DEFAULT_QUOTA = 50 * 1024 * 1024 * 1024; // 50 GB per akun
const GRID = 32; // ukuran kotak landing (px) — harus sama dengan CSS

const CATS = {
  doc:   { label: 'Doc',    cls: 'type-doc',   color: '#7C5CFF', cssVar: '--type-doc' },
  zip:   { label: 'Zip',    cls: 'type-zip',   color: '#2FA37C', cssVar: '--type-zip' },
  video: { label: 'Video',  cls: 'type-video', color: '#E07A43', cssVar: '--type-video' },
  image: { label: 'Gambar', cls: 'type-image', color: '#3D7BE0', cssVar: '--type-image' },
};
const CAT_ORDER = ['doc', 'zip', 'video', 'image'];

function catColor(key) {
  const cat = CATS[key] || CATS.doc;
  return cssVar(cat.cssVar, cat.color);
}

/* ---------- Themes ---------- */
const THEMES = [
  { id: 'sky',    name: 'Sky Pastel',   bg: '#D6E6FF', header: '#A8C8FF', accent: '#FFD3B8' },
  { id: 'sakura', name: 'Sakura Dusk',  bg: '#FFE6EE', header: '#F3B8CC', accent: '#C9A7E0' },
  { id: 'autumn', name: 'Autumn Studio', bg: '#F6E7D2', header: '#E7B48A', accent: '#C98B5E' },
];
const LEGACY_THEMES = { mint: 'autumn', matcha: 'autumn', peach: 'sky', lavender: 'sky' };

function normalizeTheme(id) {
  if (id && LEGACY_THEMES[id]) return LEGACY_THEMES[id];
  return THEMES.some((t) => t.id === id) ? id : 'sky';
}

/* ---------- Settings (localStorage) ---------- */
function readStored(key, fallback) {
  try {
    const value = localStorage.getItem('cloud.' + key);
    return value === null ? fallback : value;
  } catch (e) {
    return fallback;
  }
}

function saveSetting(key, value) {
  try {
    localStorage.setItem('cloud.' + key, value);
  } catch (e) { /* localStorage tidak tersedia */ }
}

const settings = {
  theme: normalizeTheme(readStored('theme', 'sky')),
  dark: readStored('mode', 'light') === 'dark',
  cursor: readStored('cursor', 'on') !== 'off',
  motion: readStored('motion', 'on') !== 'off',
};

function syncClockLabel() {
  const clock = document.getElementById('modeClock');
  if (!clock) return;
  clock.setAttribute('aria-pressed', String(settings.dark));
  clock.setAttribute('aria-label', settings.dark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap');
  clock.title = settings.dark ? 'Mode gelap aktif — klik untuk mode terang' : 'Mode terang aktif — klik untuk mode gelap';
}

function applySettings() {
  const root = document.documentElement;
  root.setAttribute('data-theme', settings.theme);
  root.setAttribute('data-mode', settings.dark ? 'dark' : 'light');
  root.setAttribute('data-cursor', settings.cursor ? 'on' : 'off');
  root.setAttribute('data-motion', settings.motion ? 'on' : 'off');
  syncClockLabel();
}

/* ---------- Runtime state ---------- */
const session = { user: null };

let folders = [];
let files = [];
let quota = { limit: DEFAULT_QUOTA, used: 0 };
let dataLoaded = false;

const state = {
  folderId: null,      // null = ROOT (level super folder)
  selectedId: null,
  query: '',
  catFilter: null,
  collapsed: new Set(),
  pendingView: null,
  selection: new Set(),
  selectionMode: false,
  lastPicked: null,
};

const $ = (sel) => document.querySelector(sel);

/* ---------- Helpers ---------- */
function fmtSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes >= 1024 ** 4) return (bytes / 1024 ** 4).toFixed(2) + ' TB';
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

function folderPath(id) {
  const path = [];
  let cur = id ? folders.find((f) => f.id === id) : null;
  let guard = 0;
  while (cur && guard < 64) {
    path.unshift(cur);
    cur = cur.parent ? folders.find((f) => f.id === cur.parent) : null;
    guard += 1;
  }
  return path;
}

function folderLabel(id) {
  if (!id) return 'ROOT';
  const path = folderPath(id);
  return path.length ? path.map((f) => f.name).join(' / ') : 'ROOT';
}

function hasChildren(id) {
  return folders.some((f) => f.parent === id);
}

/* Semua folder yang punya anak default tertutup (termasuk super folder) */
function defaultCollapsed() {
  return new Set(folders.filter((f) => hasChildren(f.id)).map((f) => f.id));
}

function expandAncestors(id) {
  let cur = folders.find((f) => f.id === id);
  let guard = 0;
  while (cur && cur.parent && guard < 64) {
    state.collapsed.delete(cur.parent);
    cur = folders.find((f) => f.id === cur.parent);
    guard += 1;
  }
}

function isDescendant(ancestorId, candidateId) {
  let cur = folders.find((f) => f.id === candidateId);
  let guard = 0;
  while (cur && guard < 64) {
    if (cur.id === ancestorId) return true;
    cur = cur.parent ? folders.find((f) => f.id === cur.parent) : null;
    guard += 1;
  }
  return false;
}

function cssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ---------- API client ---------- */
async function api(path, options = {}) {
  const opts = { method: options.method || 'GET', credentials: 'same-origin' };
  if (options.body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(options.body);
  }

  const res = await fetch(path, opts);
  let data = null;
  try { data = await res.json(); } catch (e) { /* respons tanpa JSON */ }

  if (!res.ok) {
    const err = new Error((data && data.error) || 'Permintaan gagal (' + res.status + ')');
    err.status = res.status;
    throw err;
  }
  return data;
}

function handleApiError(err) {
  if (err && err.status === 401) {
    session.user = null;
    dataLoaded = false;
    renderAuth();
    state.pendingView = currentView() === 'landing' ? null : currentView();
    if (location.hash !== '#/' && location.hash !== '') history.replaceState(null, '', '#/');
    renderView();
    openLogin(state.pendingView);
    toast('Sesi berakhir. Silakan masuk lagi.');
    return;
  }
  toast((err && err.message) || 'Terjadi kesalahan');
}

/* ---------- Data ---------- */
async function loadData() {
  const data = await api('/api/data');
  folders = Array.isArray(data.folders) ? data.folders : [];
  files = Array.isArray(data.files) ? data.files : [];
  quota = data.quota || { limit: DEFAULT_QUOTA, used: 0 };

  if (state.folderId && !folders.some((f) => f.id === state.folderId)) state.folderId = null;
  if (state.selectedId && !files.some((f) => f.id === state.selectedId)) state.selectedId = null;

  if (!dataLoaded) {
    state.collapsed = defaultCollapsed();
    dataLoaded = true;
  } else {
    const ids = new Set(folders.map((f) => f.id));
    state.collapsed = new Set([...state.collapsed].filter((id) => ids.has(id)));
  }
}

function clearData() {
  folders = [];
  files = [];
  quota = { limit: DEFAULT_QUOTA, used: 0 };
  dataLoaded = false;
  state.folderId = null;
  state.selectedId = null;
  state.query = '';
  state.catFilter = null;
  state.collapsed = new Set();
  state.selection = new Set();
  state.selectionMode = false;
  state.lastPicked = null;
}

/* ---------- Router ---------- */
function currentView() {
  const hash = location.hash.replace(/^#\/?/, '');
  return hash === 'dashboard' || hash === 'categorized' ? hash : 'landing';
}

function viewLabel(view) {
  if (view === 'dashboard') return 'Dashboard';
  if (view === 'categorized') return 'Categorized';
  return 'Home';
}

function renderView() {
  let view = currentView();

  if (view !== 'landing' && !session.user) {
    state.pendingView = view;
    openLogin(view);
    if (location.hash && location.hash !== '#/') history.replaceState(null, '', '#/');
    view = 'landing';
  }

  document.querySelectorAll('.view').forEach((section) => {
    section.hidden = section.id !== 'view-' + view;
  });
  document.querySelectorAll('.topnav a').forEach((a) => {
    a.classList.toggle('is-active', a.dataset.view === view);
  });
  const nav = $('#topnav');
  nav.classList.remove('is-open');
  $('#burger').setAttribute('aria-expanded', 'false');
  document.body.classList.toggle('is-landing', view === 'landing');
  document.body.classList.toggle('is-app', view !== 'landing');

  if (view === 'landing') ensureLandingGrid();
  if (view === 'dashboard') renderDashboard();
  if (view === 'categorized') renderCategorized();
}

/* ---------- Auth UI ---------- */
function renderAuth() {
  const area = $('#authArea');
  area.innerHTML = '';

  if (session.user) {
    const chip = document.createElement('span');
    chip.className = 'auth__user';
    chip.title = 'Masuk sebagai @' + session.user.username + ' · kuota ' + fmtSize(quota.limit || DEFAULT_QUOTA);
    chip.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-user"/></svg><span></span>';
    chip.querySelector('span').textContent = session.user.name || session.user.username;

    const out = document.createElement('button');
    out.type = 'button';
    out.className = 'auth__logout';
    out.textContent = 'Keluar';
    out.addEventListener('click', logout);

    area.append(chip, out);
  } else {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'auth__login';
    btn.setAttribute('aria-label', 'Sign up atau masuk');
    btn.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-user"/></svg><span>Sign Up</span>';
    btn.addEventListener('click', () => {
      state.pendingView = null;
      openAuth('register');
    });
    area.appendChild(btn);
  }
}

const loginModal = $('#loginModal');
let authReturnFocus = null;
let authTab = 'login';
let accountSlots = { accounts: 0, max: 4, open: true };
let capacityKnown = false;

function hideAuthErrors() {
  ['#loginError', '#registerError'].forEach((sel) => {
    const el = $(sel);
    el.hidden = true;
    el.textContent = '';
  });
}

function renderCapacity() {
  const slot = $('#registerSlot');
  const submit = $('#registerSubmit');
  if (!slot || !submit) return;

  if (!capacityKnown) {
    slot.textContent = 'Slot akun tidak bisa diperiksa saat ini.';
    slot.classList.remove('is-full');
    submit.disabled = false;
    return;
  }

  const full = !accountSlots.open;
  slot.textContent = full
    ? 'Kapasitas penuh (' + accountSlots.accounts + '/' + accountSlots.max + '). Masuk dengan akun yang ada.'
    : 'Slot akun: ' + accountSlots.accounts + '/' + accountSlots.max + ' terpakai.';
  slot.classList.toggle('is-full', full);
  submit.disabled = full;
}

async function refreshCapacity() {
  try {
    accountSlots = await api('/api/status');
    capacityKnown = true;
  } catch (e) {
    capacityKnown = false;
  }
  renderCapacity();
}

function setAuthTab(tab) {
  authTab = tab === 'register' ? 'register' : 'login';
  const isLogin = authTab === 'login';
  const tabLogin = $('#tabLogin');
  const tabRegister = $('#tabRegister');

  tabLogin.classList.toggle('is-active', isLogin);
  tabRegister.classList.toggle('is-active', !isLogin);
  tabLogin.setAttribute('aria-selected', String(isLogin));
  tabRegister.setAttribute('aria-selected', String(!isLogin));
  $('#panelLogin').hidden = !isLogin;
  $('#panelRegister').hidden = isLogin;
  hideAuthErrors();

  if (isLogin) {
    setTimeout(() => $('#loginUser').focus(), 30);
  } else {
    refreshCapacity();
    setTimeout(() => $('#registerUser').focus(), 30);
  }
}

function openAuth(tab, pending) {
  if (session.user) return;
  if (pending !== undefined) state.pendingView = pending;
  authReturnFocus = document.activeElement;
  hideAuthErrors();
  loginModal.hidden = false;
  authTab = tab === 'register' ? 'register' : 'login';
  setAuthTab(authTab);
}

function openLogin(pending) {
  openAuth('login', pending);
}

function closeLogin(keepPending) {
  loginModal.hidden = true;
  hideAuthErrors();
  if (keepPending !== true) state.pendingView = null;
  if (authReturnFocus && authReturnFocus.focus) authReturnFocus.focus();
}

/* ---------- Login cepat (sementara) ----------
   Template username + password yang dipakai tombol "Isi Login Cepat".
   Ubah nilai di sini kalau template akunnya diganti. */
const QUICK_LOGIN = { username: 'admin', password: 'pixel123' };

function showLoginError(message) {
  const error = $('#loginError');
  error.textContent = message;
  error.hidden = false;
}

function showRegisterError(message) {
  const error = $('#registerError');
  error.textContent = message;
  error.hidden = false;
}

async function submitLogin(event) {
  if (event) event.preventDefault();

  const username = $('#loginUser').value.trim();
  const password = $('#loginPass').value;
  const submit = $('#loginSubmit');

  if (!username || !password) {
    showLoginError('Username dan password wajib diisi.');
    return;
  }

  submit.disabled = true;
  submit.textContent = 'Masuk...';

  try {
    const data = await api('/api/login', { method: 'POST', body: { username, password } });
    session.user = data.user;
    await loadData();
    $('#loginPass').value = '';
    closeLogin(true);
    renderAuth();

    const target = state.pendingView || 'dashboard';
    state.pendingView = null;
    if (location.hash !== '#/' + target) location.hash = '#/' + target;
    renderView();
    toast('Selamat datang, ' + (data.user.name || data.user.username));
  } catch (err) {
    showLoginError(err.message || 'Gagal masuk');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Masuk';
  }
}

async function submitRegister(event) {
  if (event) event.preventDefault();

  const username = $('#registerUser').value.trim().toLowerCase();
  const password = $('#registerPass').value;
  const confirm = $('#registerPass2').value;
  const submit = $('#registerSubmit');

  if (!/^[a-z0-9._-]{3,20}$/.test(username)) {
    showRegisterError('Username 3–20 karakter: huruf, angka, titik, garis bawah, atau strip.');
    return;
  }
  if (password.length < 8) {
    showRegisterError('Password minimal 8 karakter.');
    return;
  }
  if (password !== confirm) {
    showRegisterError('Ulangi password belum sama.');
    return;
  }
  if (capacityKnown && !accountSlots.open) {
    showRegisterError('Kapasitas akun penuh (' + accountSlots.accounts + '/' + accountSlots.max + ').');
    refreshCapacity();
    return;
  }

  submit.disabled = true;
  submit.textContent = 'Membuat...';

  try {
    const data = await api('/api/register', { method: 'POST', body: { username, password } });
    session.user = data.user;
    await loadData();

    $('#registerUser').value = '';
    $('#registerPass').value = '';
    $('#registerPass2').value = '';
    closeLogin(true);
    renderAuth();

    const target = state.pendingView || 'dashboard';
    state.pendingView = null;
    if (location.hash !== '#/' + target) location.hash = '#/' + target;
    renderView();
    toast('Akun @' + data.user.username + ' dibuat. Selamat datang!');
    refreshCapacity();
  } catch (err) {
    showRegisterError(err.message || 'Gagal membuat akun');
    if (err.status === 409) refreshCapacity();
  } finally {
    submit.disabled = false;
    submit.textContent = 'Buat Akun';
    renderCapacity();
  }
}

async function logout() {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch (e) { /* abaikan */ }

  session.user = null;
  clearData();
  $('#loginUser').value = '';
  $('#loginPass').value = '';
  $('#registerUser').value = '';
  $('#registerPass').value = '';
  $('#registerPass2').value = '';
  renderAuth();
  if (location.hash !== '#/' && location.hash !== '') location.hash = '#/';
  renderView();
  toast('Kamu sudah keluar');
}

/* ---------- Dashboard ---------- */
const dirList = $('#dirList');
const fileGrid = $('#fileGrid');
const crumbs = $('#crumbs');
const emptyState = $('#emptyState');
const searchInput = $('#searchInput');

function renderDashboard() {
  if (!session.user) return;
  renderDirTree();
  renderCrumbs();
  renderContent();
  renderInspector();
  renderSelectionBar();
}

function goToFolder(id) {
  state.folderId = id;
  state.selectedId = null;
  state.query = '';
  state.selection.clear();
  state.lastPicked = null;
  searchInput.value = '';
  searchInput.placeholder = id ? 'Cari file di folder ini...' : 'Cari super folder...';
  if (id) expandAncestors(id);
  renderDashboard();
}

/* ---------- Drag & drop ---------- */
function makeDraggable(el, payload) {
  el.draggable = true;
  el.addEventListener('dragstart', (e) => {
    try {
      e.dataTransfer.setData('application/json', JSON.stringify(payload));
      e.dataTransfer.setData('text/plain', payload.id);
    } catch (err) { /* abaikan */ }
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('is-dragging');
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('is-dragging');
    clearDropHints();
  });
}

function clearDropHints() {
  document.querySelectorAll('.is-drop').forEach((el) => el.classList.remove('is-drop'));
}

function readDrag(event) {
  try {
    return JSON.parse(event.dataTransfer.getData('application/json'));
  } catch (e) {
    return null;
  }
}

function makeDropTarget(el, targetFolderId) {
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('is-drop');
  });
  el.addEventListener('dragleave', (e) => {
    if (!el.contains(e.relatedTarget)) el.classList.remove('is-drop');
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.remove('is-drop');
    const payload = readDrag(e);
    if (payload) handleDrop(payload, targetFolderId);
  });
}

async function handleDrop(payload, targetId) {
  if (!payload || !session.user) return;

  if (payload.kind === 'file') {
    if (targetId === null) {
      toast('File harus berada di dalam folder');
      return;
    }
    const file = files.find((f) => f.id === payload.id);
    if (!file) return;
    if (file.folder === targetId) {
      toast('File sudah ada di folder itu');
      return;
    }
    try {
      await api('/api/files/' + encodeURIComponent(file.id), { method: 'PATCH', body: { folder: targetId } });
      await loadData();
      renderDashboard();
      toast('"' + file.name + '" dipindah ke ' + folderLabel(targetId));
    } catch (err) {
      handleApiError(err);
    }
    return;
  }

  if (payload.kind === 'folder') {
    const folder = folders.find((f) => f.id === payload.id);
    if (!folder) return;
    if (targetId === folder.id) {
      toast('Folder tidak bisa dipindah ke dirinya sendiri');
      return;
    }
    if (targetId !== null && isDescendant(folder.id, targetId)) {
      toast('Folder tidak bisa dipindah ke turunannya sendiri');
      return;
    }
    if (folder.parent === targetId) {
      toast('Folder sudah ada di lokasi itu');
      return;
    }
    try {
      await api('/api/folders/' + encodeURIComponent(folder.id), { method: 'PATCH', body: { parent: targetId } });
      await loadData();
      if (targetId) state.collapsed.delete(targetId);
      renderDashboard();
      toast('Folder "' + folder.name + '" dipindah ke ' + (targetId ? folderLabel(targetId) : 'ROOT'));
    } catch (err) {
      handleApiError(err);
    }
  }
}

/* ---------- Directory tree ---------- */
function buildDirNode(folder) {
  const kids = folders.filter((f) => f.parent === folder.id);
  const kidsCount = kids.length;
  const collapsed = state.collapsed.has(folder.id);
  const isSuper = folder.parent === null;

  const li = document.createElement('li');
  li.className = 'dir-node' + (collapsed && kidsCount ? ' is-collapsed' : '');
  li.dataset.id = folder.id;

  const row = document.createElement('div');
  row.className = 'dir-row';

  if (kidsCount) {
    const caret = document.createElement('button');
    caret.type = 'button';
    caret.className = 'dir-caret';
    caret.setAttribute('aria-expanded', String(!collapsed));
    caret.setAttribute('aria-label', (collapsed ? 'Buka ' : 'Tutup ') + folder.name);
    caret.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-chevron"/></svg>';
    caret.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasCollapsed = state.collapsed.has(folder.id);
      if (wasCollapsed) state.collapsed.delete(folder.id);
      else state.collapsed.add(folder.id);
      li.classList.toggle('is-collapsed', !wasCollapsed);
      caret.setAttribute('aria-expanded', String(wasCollapsed));
      caret.setAttribute('aria-label', (wasCollapsed ? 'Tutup ' : 'Buka ') + folder.name);
    });
    row.appendChild(caret);
  } else {
    const spacer = document.createElement('span');
    spacer.className = 'dir-caret dir-caret--empty';
    spacer.setAttribute('aria-hidden', 'true');
    row.appendChild(spacer);
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'dir-item' + (state.folderId === folder.id ? ' is-active' : '');
  btn.title = folder.name + ' — ' + (isSuper ? 'Super folder' : 'Family folder');
  btn.innerHTML =
    `<svg class="icon dir-icon" aria-hidden="true"><use href="#${isSuper ? 'i-crown' : 'i-folder'}"/></svg>` +
    '<span class="dir-name"></span>' +
    (isSuper ? '<span class="dir-tier">SUPER</span>' : '');
  btn.querySelector('.dir-name').textContent = folder.name;
  btn.addEventListener('click', () => goToFolder(folder.id));
  makeDraggable(btn, { kind: 'folder', id: folder.id });
  makeDropTarget(btn, folder.id);
  row.appendChild(btn);
  li.appendChild(row);

  if (kidsCount) {
    const wrap = document.createElement('div');
    wrap.className = 'dir-children-wrap';
    const ul = document.createElement('ul');
    ul.className = 'dir-children';
    kids.forEach((kid) => ul.appendChild(buildDirNode(kid)));
    wrap.appendChild(ul);
    li.appendChild(wrap);
  }

  return li;
}

function renderDirTree() {
  dirList.innerHTML = '';

  const rootLi = document.createElement('li');
  rootLi.className = 'dir-node dir-node--root';
  const rootRow = document.createElement('div');
  rootRow.className = 'dir-row';

  const rootBtn = document.createElement('button');
  rootBtn.type = 'button';
  rootBtn.className = 'dir-item dir-item--root' + (state.folderId === null ? ' is-active' : '');
  rootBtn.title = 'ROOT — level super folder';
  rootBtn.innerHTML =
    '<svg class="icon dir-icon" aria-hidden="true"><use href="#i-root"/></svg>' +
    '<span class="dir-name">ROOT</span>' +
    '<span class="dir-tier">ALL</span>';
  rootBtn.addEventListener('click', () => goToFolder(null));
  makeDropTarget(rootBtn, null);
  rootRow.appendChild(rootBtn);
  rootLi.appendChild(rootRow);
  dirList.appendChild(rootLi);

  folders
    .filter((f) => f.parent === null)
    .forEach((f) => dirList.appendChild(buildDirNode(f)));
}

/* ---------- Breadcrumb ---------- */
function renderCrumbs() {
  crumbs.innerHTML = '';
  const path = folderPath(state.folderId);

  if (!path.length) {
    const span = document.createElement('span');
    span.className = 'current';
    span.textContent = 'ROOT';
    crumbs.appendChild(span);
    return;
  }

  const rootBtn = document.createElement('button');
  rootBtn.type = 'button';
  rootBtn.textContent = 'ROOT';
  rootBtn.addEventListener('click', () => goToFolder(null));
  makeDropTarget(rootBtn, null);
  crumbs.appendChild(rootBtn);

  path.forEach((f, i) => {
    const sep = document.createElement('span');
    sep.className = 'sep';
    sep.textContent = '/';
    crumbs.appendChild(sep);

    if (i === path.length - 1) {
      const span = document.createElement('span');
      span.className = 'current';
      span.textContent = f.name;
      crumbs.appendChild(span);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = f.name;
      btn.addEventListener('click', () => goToFolder(f.id));
      makeDropTarget(btn, f.id);
      crumbs.appendChild(btn);
    }
  });
}

/* ---------- Content ---------- */
function currentFiles() {
  const q = state.query.trim().toLowerCase();
  return files.filter((f) => f.folder === state.folderId && f.name.toLowerCase().includes(q));
}

function renderContent() {
  const q = state.query.trim().toLowerCase();
  const childFolders = folders.filter(
    (f) => f.parent === state.folderId && f.name.toLowerCase().includes(q)
  );
  const childFiles = currentFiles();

  fileGrid.innerHTML = '';
  fileGrid.classList.toggle('is-selecting', state.selectionMode);
  const isEmpty = childFolders.length + childFiles.length === 0;
  emptyState.hidden = !isEmpty;
  emptyState.textContent = q
    ? 'Tidak ada hasil untuk pencarian itu.'
    : state.folderId === null
      ? 'Belum ada super folder.'
      : 'Folder ini kosong. Tarik file ke sini atau klik Upload File.';

  childFolders.forEach((f) => {
    const tier = f.parent === null ? 'Super folder' : 'Family folder';
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'file-tile file-tile--folder';
    tile.title = f.name + ' — ' + tier;
    tile.innerHTML =
      `<svg class="icon" aria-hidden="true"><use href="#${f.parent === null ? 'i-crown' : 'i-folder'}"/></svg>` +
      '<span class="file-tile__name"></span>' +
      `<span class="file-tile__meta">${tier}</span>`;
    tile.querySelector('.file-tile__name').textContent = f.name;
    tile.addEventListener('click', () => goToFolder(f.id));
    makeDraggable(tile, { kind: 'folder', id: f.id });
    makeDropTarget(tile, f.id);
    fileGrid.appendChild(tile);
  });

  childFiles.forEach((f) => {
    const active = state.selectionMode ? state.selection.has(f.id) : state.selectedId === f.id;
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'file-tile' +
      (active ? ' is-selected' : '') +
      (state.selectionMode ? ' is-selecting' : '');
    tile.title = f.name;
    tile.innerHTML =
      `<svg class="icon ${CATS[f.type].cls}" aria-hidden="true"><use href="#i-file"/></svg>` +
      '<span class="file-tile__name"></span>' +
      `<span class="file-tile__meta">${fmtSize(f.size)}</span>`;
    tile.querySelector('.file-tile__name').textContent = f.name;

    if (state.selectionMode) {
      const check = document.createElement('span');
      check.className = 'file-tile__check';
      check.setAttribute('aria-hidden', 'true');
      check.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>';
      tile.appendChild(check);
    }

    tile.addEventListener('click', (e) => {
      if (state.selectionMode) {
        toggleFileSelection(f.id, e.shiftKey);
        return;
      }
      state.selectedId = f.id;
      renderContent();
      renderInspector();
    });
    makeDraggable(tile, { kind: 'file', id: f.id });
    fileGrid.appendChild(tile);
  });
}

/* ---------- Seleksi lanjutan ---------- */
function toggleFileSelection(id, shift) {
  const list = currentFiles();
  if (shift && state.lastPicked && state.lastPicked !== id) {
    const from = list.findIndex((f) => f.id === state.lastPicked);
    const to = list.findIndex((f) => f.id === id);
    if (from !== -1 && to !== -1) {
      const add = !state.selection.has(id);
      const start = Math.min(from, to);
      const end = Math.max(from, to);
      for (let i = start; i <= end; i += 1) {
        if (add) state.selection.add(list[i].id);
        else state.selection.delete(list[i].id);
      }
      state.lastPicked = id;
      state.selectedId = id;
      renderContent();
      renderInspector();
      renderSelectionBar();
      return;
    }
  }

  if (state.selection.has(id)) state.selection.delete(id);
  else state.selection.add(id);
  state.lastPicked = id;
  state.selectedId = id;
  renderContent();
  renderInspector();
  renderSelectionBar();
}

function setSelectionMode(on) {
  state.selectionMode = !!on;
  if (!state.selectionMode) {
    state.selection.clear();
    state.lastPicked = null;
  }
  const btn = $('#selectBtn');
  btn.classList.toggle('is-active', state.selectionMode);
  btn.setAttribute('aria-pressed', String(state.selectionMode));
  btn.querySelector('span').textContent = state.selectionMode ? 'Selesai' : 'Pilih';
  renderContent();
  renderInspector();
  renderSelectionBar();
}

function renderSelectionBar() {
  const bar = $('#selectionBar');
  bar.hidden = !state.selectionMode;

  const ids = new Set(files.map((f) => f.id));
  [...state.selection].forEach((id) => { if (!ids.has(id)) state.selection.delete(id); });

  const chosen = files.filter((f) => state.selection.has(f.id));
  const total = chosen.reduce((sum, f) => sum + (Number(f.size) || 0), 0);

  $('#selectionCount').textContent = state.selection.size + ' dipilih';
  $('#selectionSize').textContent = fmtSize(total);
  $('#zipBtn').disabled = state.selection.size === 0;
  $('#clearSelectionBtn').disabled = state.selection.size === 0;
  $('#selectAllBtn').disabled = currentFiles().length === 0;
  const deleteLabel = $('#deleteBtn').querySelector('span');
  if (deleteLabel) {
    deleteLabel.textContent = state.selectionMode && state.selection.size
      ? 'Hapus (' + state.selection.size + ')'
      : 'Hapus';
  }
}

function selectAllVisible() {
  currentFiles().forEach((f) => state.selection.add(f.id));
  state.lastPicked = null;
  renderContent();
  renderSelectionBar();
}

function clearSelection() {
  state.selection.clear();
  state.lastPicked = null;
  renderContent();
  renderSelectionBar();
}

/* ---------- Unduhan ---------- */
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'unduhan';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function requestBlob(url, options) {
  const res = await fetch(url, Object.assign({ credentials: 'same-origin' }, options || {}));
  if (!res.ok) {
    let message = 'Unduhan gagal (' + res.status + ')';
    try {
      const data = await res.json();
      if (data && data.error) message = data.error;
    } catch (e) { /* respons bukan JSON */ }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.blob();
}

async function downloadFile(file) {
  if (!file) return;
  try {
    toast('Menyiapkan "' + file.name + '"...');
    const blob = await requestBlob('/api/files/' + encodeURIComponent(file.id) + '/download');
    saveBlob(blob, file.name);
    toast('"' + file.name + '" diunduh');
  } catch (err) {
    handleApiError(err);
  }
}

async function downloadZip(ids) {
  if (!ids.length) {
    toast('Pilih file dulu');
    return;
  }
  if (ids.length > 200) {
    toast('Maksimal 200 file per ZIP');
    return;
  }
  try {
    toast('Menyiapkan ZIP ' + ids.length + ' file...');
    const blob = await requestBlob('/api/download-zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    saveBlob(blob, 'arsip-cloud.zip');
    toast('ZIP berisi ' + ids.length + ' file diunduh');
  } catch (err) {
    handleApiError(err);
  }
}

/* ---------- Inspector ---------- */
function renderInspector() {
  const preview = $('#preview');
  const info = $('#info');
  const downloadBtn = $('#downloadBtn');
  const downloadNote = $('#downloadNote');
  const f = files.find((x) => x.id === state.selectedId);

  if (!f) {
    preview.innerHTML =
      '<svg class="icon icon--xl" aria-hidden="true"><use href="#i-file"/></svg>' +
      '<p class="preview__hint">Pilih file untuk melihat preview</p>';
    info.innerHTML = `
      <div class="info__row"><dt>Nama</dt><dd>—</dd></div>
      <div class="info__row"><dt>Jenis</dt><dd>—</dd></div>
      <div class="info__row"><dt>Ukuran</dt><dd>—</dd></div>
      <div class="info__row"><dt>Diubah</dt><dd>—</dd></div>
      <div class="info__row"><dt>Lokasi</dt><dd>—</dd></div>`;
    downloadBtn.disabled = true;
    downloadBtn.title = '';
    downloadNote.hidden = true;
    downloadNote.textContent = '';
    return;
  }

  const cat = CATS[f.type] || CATS.doc;
  preview.innerHTML =
    `<svg class="icon icon--xl ${cat.cls}" aria-hidden="true"><use href="#i-file"/></svg>` +
    `<p class="preview__hint">${cat.label} — ${escapeHtml(f.name)}</p>`;

  const rows = [
    ['Nama', f.name],
    ['Jenis', cat.label],
    ['Ukuran', fmtSize(f.size)],
    ['Diubah', f.modified || '—'],
    ['Lokasi', folderLabel(f.folder)],
  ];
  info.innerHTML = rows
    .map(([k]) => `<div class="info__row"><dt>${k}</dt><dd></dd></div>`)
    .join('');
  info.querySelectorAll('.info__row dd').forEach((dd, i) => {
    dd.textContent = rows[i][1];
  });

  const stored = f.stored === true;
  downloadBtn.disabled = false;
  downloadBtn.title = stored ? 'Unduh "' + f.name + '" ke perangkat' : 'File contoh bawaan belum punya isi biner';
  downloadNote.hidden = stored;
  downloadNote.textContent = stored ? '' : 'File contoh bawaan hanya metadata. Upload file baru untuk bisa mengunduhnya.';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---------- Categorized ---------- */
function renderCategorized() {
  const totals = { doc: 0, zip: 0, video: 0, image: 0 };
  const counts = { doc: 0, zip: 0, video: 0, image: 0 };
  files.forEach((f) => {
    if (totals[f.type] === undefined) return;
    totals[f.type] += f.size;
    counts[f.type] += 1;
  });
  const used = Object.values(totals).reduce((a, b) => a + b, 0);
  const limit = quota.limit || DEFAULT_QUOTA;

  const catGrid = $('#catGrid');
  catGrid.innerHTML = '';
  CAT_ORDER.forEach((key) => {
    const cat = CATS[key];
    const active = state.catFilter === key;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'cat-card' + (active ? ' is-active' : '');
    card.setAttribute('aria-pressed', String(active));
    card.innerHTML = `
      <span class="cat-card__top">
        <svg class="icon ${cat.cls}" aria-hidden="true"><use href="#i-file"/></svg>
        <span>${cat.label}</span>
      </span>
      <span class="cat-card__size">${fmtSize(totals[key])}</span>
      <span class="cat-card__count">${counts[key]} file</span>
      <span class="cat-card__hint">${active ? 'Tutup daftar' : 'Lihat file'}</span>`;
    card.addEventListener('click', () => {
      state.catFilter = state.catFilter === key ? null : key;
      renderCategorized();
    });
    catGrid.appendChild(card);
  });

  renderCatPanel();
  const active = state.catFilter;
  $('#catSplit').classList.toggle('is-split', !!active);

  const donut = $('#donut');
  const freeColor = cssVar('--free', '#DCE7F8');
  const legend = $('#legend');
  legend.innerHTML = '';
  let freePct = 0;

  if (active && CATS[active]) {
    const cat = CATS[active];
    const activePct = limit > 0 ? (totals[active] / limit) * 100 : 0;
    freePct = limit > 0 ? Math.max(0, ((limit - used) / limit) * 100) : 0;
    donut.style.background = `conic-gradient(${catColor(active)} 0% 100%)`;
    donut.setAttribute('aria-label', `Diagram kategori ${cat.label}: ${fmtSize(totals[active])}, ${activePct.toFixed(1)}% dari kuota ${fmtSize(limit)}`);
    $('#usedLabel').textContent = fmtSize(totals[active]);
    $('#chartLabel').textContent = cat.label;
    $('#chartNote').textContent = (activePct > 0 && activePct < 0.1 ? '<0,1%' : activePct.toFixed(1) + '%') + ' dari kuota';

    const li = document.createElement('li');
    li.innerHTML = `
      <span class="swatch" style="background:${catColor(active)}"></span>
      <span class="legend__label">${cat.label}</span>
      <span class="legend__dots" aria-hidden="true"></span>
      <span class="val">${fmtSize(totals[active])} · ${activePct.toFixed(1)}%</span>`;
    legend.appendChild(li);
  } else {
    const stops = [];
    let cursor = 0;
    CAT_ORDER.forEach((key) => {
      const pct = limit > 0 ? (totals[key] / limit) * 100 : 0;
      if (pct > 0) {
        stops.push(`${catColor(key)} ${cursor}% ${cursor + pct}%`);
        cursor += pct;
      }
    });
    stops.push(`${freeColor} ${cursor}% 100%`);
    donut.style.background = `conic-gradient(${stops.join(', ')})`;
    donut.setAttribute('aria-label', 'Diagram penggunaan storage per kategori');
    $('#usedLabel').textContent = fmtSize(used);
    $('#chartLabel').textContent = 'terpakai';
    $('#chartNote').textContent = 'dari kuota ' + fmtSize(limit);
    freePct = Math.max(0, 100 - cursor);

    CAT_ORDER.forEach((key) => {
      const pct = limit > 0 ? (totals[key] / limit) * 100 : 0;
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="swatch" style="background:${catColor(key)}"></span>
        <span class="legend__label">${CATS[key].label}</span>
        <span class="legend__dots" aria-hidden="true"></span>
        <span class="val">${fmtSize(totals[key])} · ${pct.toFixed(1)}%</span>`;
      legend.appendChild(li);
    });
  }

  const freeLi = document.createElement('li');
  freeLi.innerHTML = `
    <span class="swatch" style="background:${freeColor}"></span>
    <span class="legend__label">Ruang kosong</span>
    <span class="legend__dots" aria-hidden="true"></span>
    <span class="val">${fmtSize(Math.max(0, limit - used))} · ${freePct.toFixed(1)}%</span>`;
  legend.appendChild(freeLi);
}

function renderCatPanel() {
  const panel = $('#catPanel');
  const key = state.catFilter;
  if (!key || !CATS[key]) {
    panel.hidden = true;
    return;
  }

  const cat = CATS[key];
  const list = files
    .filter((f) => f.type === key)
    .sort((a, b) => b.size - a.size);

  $('#catPanelTitle').textContent = cat.label + ' — ' + list.length + ' file';
  const totalSize = list.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
  $('#catPanelSub').textContent = fmtSize(totalSize) + ' · ' + list.length + ' file · preview kategori ' + cat.label;
  const ul = $('#catList');
  ul.innerHTML = '';

  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'cat-empty';
    li.textContent = 'Belum ada file ' + cat.label + '.';
    ul.appendChild(li);
    panel.hidden = false;
    return;
  }

  list.forEach((f) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cat-row';
    btn.innerHTML =
      `<span class="cat-row__dot" style="background:${catColor(f.type)}"></span>` +
      '<span class="cat-row__name"></span>' +
      `<span class="cat-row__size">${fmtSize(f.size)}</span>` +
      '<span class="cat-row__loc"></span>';
    btn.querySelector('.cat-row__name').textContent = f.name;
    btn.querySelector('.cat-row__loc').textContent = folderLabel(f.folder);
    btn.title = 'Buka di Dashboard';
    btn.addEventListener('click', () => jumpToFile(f.id));
    li.appendChild(btn);
    ul.appendChild(li);
  });

  panel.hidden = false;
}

function jumpToFile(fileId) {
  const f = files.find((x) => x.id === fileId);
  if (!f) return;
  state.folderId = f.folder;
  state.selectedId = f.id;
  state.query = '';
  state.selection.clear();
  state.lastPicked = null;
  searchInput.value = '';
  searchInput.placeholder = 'Cari file di folder ini...';
  expandAncestors(f.folder);
  if (location.hash !== '#/dashboard') location.hash = '#/dashboard';
  renderDashboard();
}

/* ---------- Folder modal ---------- */
const modal = $('#modal');
const folderName = $('#folderName');

function openModal() {
  const rootMode = state.folderId === null;
  $('#modalTitle').textContent = rootMode ? 'Super Folder Baru' : 'Family Folder Baru';
  $('#folderHint').textContent = rootMode
    ? 'Dibuat di level teratas (super folder).'
    : 'Dibuat di dalam: ' + folderLabel(state.folderId);
  folderName.placeholder = rootMode ? 'mis. Arsip Keluarga' : 'mis. Dokumen';
  modal.hidden = false;
  folderName.value = '';
  folderName.focus();
}

function closeModal() {
  modal.hidden = true;
}

async function createFolder() {
  const name = folderName.value.trim();
  const parent = state.folderId;
  const tierLabel = parent === null ? 'Super folder' : 'Family folder';

  if (!name) {
    toast('Nama folder tidak boleh kosong');
    return;
  }

  try {
    await api('/api/folders', { method: 'POST', body: { name, parent } });
    await loadData();
    if (parent) state.collapsed.delete(parent);
    closeModal();
    renderDashboard();
    toast(`${tierLabel} "${name}" dibuat`);
  } catch (err) {
    handleApiError(err);
  }
}

/* ---------- Konfirmasi krusial ---------- */
const confirmModal = $('#confirmModal');
let confirmResolve = null;

function askConfirm(options) {
  const opts = options || {};
  if (confirmResolve) settleConfirm(false);

  $('#confirmTitle').textContent = opts.title || 'Konfirmasi';
  $('#confirmMessage').textContent = opts.message || 'Lanjutkan tindakan ini?';
  const ok = $('#confirmOk');
  const cancel = $('#confirmCancel');
  ok.textContent = opts.confirmLabel || 'Lanjut';
  cancel.textContent = opts.cancelLabel || 'Batal';
  ok.classList.toggle('btn--danger', !!opts.danger);
  ok.classList.toggle('btn--peach', !opts.danger);

  confirmModal.hidden = false;
  setTimeout(() => ok.focus(), 30);
  return new Promise((resolve) => { confirmResolve = resolve; });
}

function settleConfirm(value) {
  if (!confirmResolve) return;
  const resolve = confirmResolve;
  confirmResolve = null;
  confirmModal.hidden = true;
  resolve(value);
}

async function deleteSelected() {
  const fromSelection = state.selectionMode && state.selection.size > 0;
  const targets = fromSelection
    ? files.filter((f) => state.selection.has(f.id))
    : files.filter((f) => f.id === state.selectedId);

  if (!targets.length) {
    toast('Pilih file dulu sebelum menghapus');
    return;
  }

  const single = targets.length === 1;
  const ok = await askConfirm({
    title: single ? 'Hapus file?' : 'Hapus ' + targets.length + ' file?',
    message: single
      ? '"' + targets[0].name + '" akan dihapus permanen dari cloud. Tindakan ini tidak bisa dibatalkan.'
      : targets.length + ' file terpilih akan dihapus permanen dari cloud. Tindakan ini tidak bisa dibatalkan.',
    confirmLabel: 'Hapus',
    danger: true,
  });
  if (!ok) return;

  try {
    for (const file of targets) {
      await api('/api/files/' + encodeURIComponent(file.id), { method: 'DELETE' });
    }
    state.selection.clear();
    state.selectedId = null;
    await loadData();
    renderDashboard();
    toast(single ? '"' + targets[0].name + '" dihapus' : targets.length + ' file dihapus');
  } catch (err) {
    handleApiError(err);
    try { await loadData(); renderDashboard(); } catch (e) { /* abaikan */ }
  }
}

/* ---------- Upload file dari perangkat ---------- */
const fileModal = $('#fileModal');
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
let uploadItems = [];

function populateFolderSelect(select, preferred) {
  select.innerHTML = '';
  const sorted = folders
    .slice()
    .sort((a, b) => folderLabel(a.id).localeCompare(folderLabel(b.id), 'id'));

  sorted.forEach((f) => {
    const option = document.createElement('option');
    option.value = f.id;
    option.textContent = folderLabel(f.id);
    select.appendChild(option);
  });

  const fallback = (folders.find((f) => f.parent === null) || folders[0] || {}).id;
  const target = preferred && folders.some((f) => f.id === preferred) ? preferred : fallback;
  if (target) select.value = target;
}

function uploadTotal() {
  return uploadItems.reduce((sum, item) => sum + (Number(item.file.size) || 0), 0);
}

function updateUploadQuota() {
  const total = uploadTotal();
  const limit = quota.limit || DEFAULT_QUOTA;
  const used = quota.used || 0;
  const left = Math.max(0, limit - used);
  const over = total > left;

  const line = $('#uploadQuota');
  line.textContent =
    'Antrean: ' + uploadItems.length + ' file · ' + fmtSize(total) +
    ' · sisa kuota ' + fmtSize(left) +
    (over ? ' · melebihi kuota!' : '');
  line.classList.toggle('is-over', over);

  const ok = $('#fileOk');
  if (ok) ok.disabled = uploadItems.length === 0 || over;
}

function renderUploadQueue() {
  const queue = $('#uploadQueue');
  queue.hidden = uploadItems.length === 0;
  queue.innerHTML = '';

  uploadItems.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'upload-item';
    li.innerHTML =
      '<svg class="icon upload-item__icon" aria-hidden="true"><use href="#i-file"/></svg>' +
      '<span class="upload-item__name"></span>' +
      `<span class="upload-item__size">${fmtSize(item.file.size)}</span>` +
      '<button class="upload-item__remove" type="button" aria-label="Hapus dari antrean">' +
        '<svg class="icon" aria-hidden="true"><use href="#i-minus"/></svg>' +
      '</button>';
    li.querySelector('.upload-item__name').textContent = item.file.name;
    li.querySelector('.upload-item__remove').addEventListener('click', () => {
      uploadItems.splice(index, 1);
      renderUploadQueue();
    });
    queue.appendChild(li);
  });

  updateUploadQuota();
}

function addUploadFiles(list) {
  const incoming = Array.from(list || []);
  let skipped = 0;

  incoming.forEach((file) => {
    if (!file || !file.name) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      skipped += 1;
      return;
    }
    const duplicate = uploadItems.some((item) =>
      item.file.name === file.name &&
      item.file.size === file.size &&
      item.file.lastModified === file.lastModified
    );
    if (!duplicate) uploadItems.push({ file });
  });

  if (skipped) toast(skipped + ' file dilewati (maks. 2 GB per file)');
  $('#uploadError').hidden = true;
  renderUploadQueue();
}

function openFileModal() {
  if (!session.user) {
    state.pendingView = 'dashboard';
    openLogin('dashboard');
    return;
  }
  if (!folders.length) {
    toast('Buat folder dulu sebelum mengunggah file');
    return;
  }

  uploadItems = [];
  renderUploadQueue();
  populateFolderSelect($('#uploadFolder'), state.folderId);
  $('#uploadError').hidden = true;
  $('#uploadError').textContent = '';
  $('#uploadProgress').hidden = true;
  $('#uploadProgressFill').style.width = '0%';
  $('#uploadProgressText').textContent = '—';
  fileModal.hidden = false;
  setTimeout(() => $('#dropzone').focus(), 30);
}

function closeFileModal() {
  if (fileModal.hidden) return;
  fileModal.hidden = true;
  uploadItems = [];
  $('#uploadInput').value = '';
  renderUploadQueue();
}

async function uploadOne(item, folder) {
  const res = await fetch(
    '/api/upload?name=' + encodeURIComponent(item.file.name) + '&folder=' + encodeURIComponent(folder),
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': item.file.type || 'application/octet-stream' },
      body: item.file,
    }
  );

  let data = null;
  try { data = await res.json(); } catch (e) { /* respons tanpa JSON */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Upload gagal (' + res.status + ')');
    err.status = res.status;
    throw err;
  }
  return data;
}

async function startUpload() {
  if (!uploadItems.length) {
    toast('Pilih file dulu sebelum upload');
    return;
  }

  const folder = $('#uploadFolder').value;
  if (!folder) {
    toast('Pilih folder tujuan');
    return;
  }

  const total = uploadTotal();
  const left = Math.max(0, (quota.limit || DEFAULT_QUOTA) - (quota.used || 0));
  if (total > left) {
    toast('Total file melebihi sisa kuota');
    return;
  }

  const count = uploadItems.length;
  const ok = await askConfirm({
    title: 'Upload file?',
    message: count + ' file (' + fmtSize(total) + ') akan diunggah ke ' + folderLabel(folder) + '.',
    confirmLabel: 'Upload',
  });
  if (!ok) return;

  const btn = $('#fileOk');
  const cancel = $('#fileCancel');
  btn.disabled = true;
  cancel.disabled = true;
  $('#uploadError').hidden = true;
  $('#uploadProgress').hidden = false;
  $('#uploadProgressFill').style.width = '0%';

  let last = null;
  try {
    for (let i = 0; i < uploadItems.length; i += 1) {
      const item = uploadItems[i];
      $('#uploadProgressText').textContent =
        'Mengunggah ' + (i + 1) + '/' + uploadItems.length + ': ' + item.file.name;
      last = await uploadOne(item, folder);
      $('#uploadProgressFill').style.width =
        Math.round(((i + 1) / uploadItems.length) * 100) + '%';
    }

    closeFileModal();
    if (state.folderId !== folder) {
      state.folderId = folder;
      expandAncestors(folder);
    }
    state.query = '';
    searchInput.value = '';
    searchInput.placeholder = 'Cari file di folder ini...';
    await loadData();
    state.selectedId = (last && last.file && last.file.id) || null;
    renderDashboard();
    toast(count + ' file diunggah ke ' + folderLabel(folder));
  } catch (err) {
    const box = $('#uploadError');
    box.textContent = err.message || 'Upload gagal';
    box.hidden = false;
    $('#uploadProgressText').textContent = 'Upload berhenti. Periksa pesan di atas.';
    if (err.status === 401) handleApiError(err);
  } finally {
    btn.disabled = false;
    cancel.disabled = false;
    updateUploadQuota();
  }
}

/* ---------- Settings ---------- */
const settingsModal = $('#settings');
let settingsReturnFocus = null;

function renderSettings() {
  const grid = $('#themeGrid');
  grid.innerHTML = '';

  THEMES.forEach((t) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'theme-card' + (settings.theme === t.id ? ' is-active' : '');
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', String(settings.theme === t.id));
    card.innerHTML = `
      <span class="theme-card__swatches" aria-hidden="true">
        <span class="theme-swatch" style="background:${t.bg}"></span>
        <span class="theme-swatch" style="background:${t.header}"></span>
        <span class="theme-swatch" style="background:${t.accent}"></span>
      </span>
      <span class="theme-card__name">${t.name}</span>`;
    card.addEventListener('click', () => {
      settings.theme = t.id;
      saveSetting('theme', t.id);
      applySettings();
      renderSettings();
      if (currentView() === 'categorized') renderCategorized();
    });
    grid.appendChild(card);
  });

  $('#modeToggle').setAttribute('aria-checked', String(settings.dark));
  $('#cursorToggle').setAttribute('aria-checked', String(settings.cursor));
  $('#motionToggle').setAttribute('aria-checked', String(settings.motion));
}

function setMode(dark) {
  settings.dark = !!dark;
  saveSetting('mode', settings.dark ? 'dark' : 'light');
  applySettings();
  renderSettings();
  if (currentView() === 'categorized') renderCategorized();
}

function openSettings() {
  settingsReturnFocus = document.activeElement;
  renderSettings();
  settingsModal.hidden = false;
  $('#settingsClose').focus();
}

function closeSettings() {
  settingsModal.hidden = true;
  if (settingsReturnFocus && settingsReturnFocus.focus) settingsReturnFocus.focus();
}

/* ---------- Pixel clock ---------- */
function renderClock() {
  const now = new Date();
  const seconds = now.getSeconds();
  const minutes = now.getMinutes();
  const hours = now.getHours() % 12;

  const setHand = (selector, degrees) => {
    const hand = $(selector);
    if (hand) hand.style.setProperty('--deg', degrees + 'deg');
  };

  setHand('#clockSecond', seconds * 6);
  setHand('#clockMinute', (minutes + seconds / 60) * 6);
  setHand('#clockHour', (hours + minutes / 60) * 30);
}

/* ---------- Landing interactions ---------- */
function splitTitle() {
  const el = document.getElementById('landingTitle');
  if (!el || el.dataset.split === 'true') return;

  const lines = el.innerHTML.split(/<br\s*\/?>/i);
  el.setAttribute('aria-label', lines.map((line) => line.trim()).join(' '));
  el.innerHTML = lines
    .map((line) => {
      const letters = Array.from(line.trim())
        .map((ch) => `<span class="title-letter">${ch === ' ' ? '&nbsp;' : ch}</span>`)
        .join('');
      return `<span class="title-line" aria-hidden="true">${letters}</span>`;
    })
    .join('');
  el.dataset.split = 'true';
}

const landingState = {
  tiles: new Map(),
  cols: 0,
  rows: 0,
  active: new Set(),
  hot: null,
};

function canExtrude() {
  return settings.motion
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function buildLandingGrid() {
  const landing = document.querySelector('#view-landing .landing');
  const grid = landing && landing.querySelector('.landing__grid');
  if (!landing || !grid) return;

  const width = landing.clientWidth || window.innerWidth;
  const height = landing.clientHeight || (window.innerHeight - 84);
  const cols = Math.max(1, Math.ceil(width / GRID));
  const rows = Math.max(1, Math.ceil(height / GRID));

  const frag = document.createDocumentFragment();
  landingState.tiles.clear();
  landingState.active.clear();
  landingState.hot = null;

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const tile = document.createElement('span');
      tile.className = 'landing-tile' + ((x + y) % 2 ? ' landing-tile--alt' : '');
      tile.style.setProperty('--tx', x);
      tile.style.setProperty('--ty', y);

      const face = document.createElement('span');
      face.className = 'landing-tile__face';
      tile.appendChild(face);

      frag.appendChild(tile);
      landingState.tiles.set(x + ',' + y, tile);
    }
  }

  grid.replaceChildren(frag);
  landingState.cols = cols;
  landingState.rows = rows;
}

function ensureLandingGrid() {
  const landing = document.querySelector('#view-landing .landing');
  if (!landing) return;
  const cols = Math.max(1, Math.ceil(landing.clientWidth / GRID));
  const rows = Math.max(1, Math.ceil(landing.clientHeight / GRID));
  if (cols !== landingState.cols || rows !== landingState.rows) buildLandingGrid();
}

function clearLandingHover() {
  landingState.active.forEach((tile) => {
    tile.classList.remove('is-hot', 'is-near-1', 'is-near-2', 'is-near-3', 'is-pop');
  });
  landingState.active.clear();
  landingState.hot = null;
}

function setLandingHover(cx, cy) {
  clearLandingHover();
  if (!canExtrude()) return;

  for (let dy = -3; dy <= 3; dy += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      const distance = Math.abs(dx) + Math.abs(dy);
      if (distance > 3) continue;

      const tile = landingState.tiles.get((cx + dx) + ',' + (cy + dy));
      if (!tile) continue;

      if (distance === 0) {
        tile.classList.add('is-hot');
        landingState.hot = tile;
      } else if (distance === 1) {
        tile.classList.add('is-near-1');
      } else if (distance === 2) {
        tile.classList.add('is-near-2');
      } else {
        tile.classList.add('is-near-3');
      }
      landingState.active.add(tile);
    }
  }
}

function setupLanding() {
  const landing = document.querySelector('#view-landing .landing');
  if (!landing) return;

  buildLandingGrid();
  let cellX = null;
  let cellY = null;

  landing.addEventListener('pointermove', (e) => {
    const rect = landing.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    landing.style.setProperty('--mx', x + 'px');
    landing.style.setProperty('--my', y + 'px');

    if (!canExtrude()) return;

    const cx = Math.floor(x / GRID);
    const cy = Math.floor(y / GRID);
    if (cx === cellX && cy === cellY) return;
    cellX = cx;
    cellY = cy;
    setLandingHover(cx, cy);
  });

  landing.addEventListener('pointerleave', () => {
    cellX = null;
    cellY = null;
    clearLandingHover();
    landing.style.setProperty('--mx', '50%');
    landing.style.setProperty('--my', '50%');
  });

  landing.addEventListener('pointerdown', (e) => {
    if (!canExtrude() || !landingState.hot) return;
    if (e.target.closest('a, button')) return;

    const tile = landingState.hot;
    tile.classList.remove('is-pop');
    void tile.offsetWidth;
    tile.classList.add('is-pop');
  });

  landing.addEventListener('animationend', (e) => {
    if (e.animationName !== 'tilePop') return;
    const tile = e.target.closest('.landing-tile');
    if (tile) tile.classList.remove('is-pop');
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentView() === 'landing') {
        buildLandingGrid();
        cellX = null;
        cellY = null;
      }
    }, 160);
  });
}

/* ---------- Events ---------- */
$('#newFolderBtn').addEventListener('click', openModal);
$('#addFileBtn').addEventListener('click', openFileModal);
$('#deleteBtn').addEventListener('click', deleteSelected);
$('#modalCancel').addEventListener('click', closeModal);
$('#modalOk').addEventListener('click', createFolder);

modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

folderName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') createFolder();
  if (e.key === 'Escape') closeModal();
});

/* Mode seleksi & unduhan */
$('#selectBtn').addEventListener('click', () => setSelectionMode(!state.selectionMode));
$('#selectAllBtn').addEventListener('click', selectAllVisible);
$('#clearSelectionBtn').addEventListener('click', clearSelection);
$('#zipBtn').addEventListener('click', () => downloadZip([...state.selection]));
$('#downloadBtn').addEventListener('click', () => {
  const f = files.find((x) => x.id === state.selectedId);
  downloadFile(f);
});

/* Upload modal */
$('#fileCancel').addEventListener('click', closeFileModal);
$('#fileClose').addEventListener('click', closeFileModal);
$('#fileOk').addEventListener('click', startUpload);

const dropzone = $('#dropzone');
const uploadInput = $('#uploadInput');
dropzone.addEventListener('click', () => uploadInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    uploadInput.click();
  }
});
['dragenter', 'dragover'].forEach((type) => {
  dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.add('is-drop');
  });
});
['dragleave', 'drop'].forEach((type) => {
  dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-drop');
  });
});
dropzone.addEventListener('drop', (e) => addUploadFiles(e.dataTransfer.files));
uploadInput.addEventListener('change', () => {
  addUploadFiles(uploadInput.files);
  uploadInput.value = '';
});
fileModal.addEventListener('click', (e) => {
  if (e.target === fileModal) closeFileModal();
});

/* Konfirmasi */
$('#confirmOk').addEventListener('click', () => settleConfirm(true));
$('#confirmCancel').addEventListener('click', () => settleConfirm(false));
confirmModal.addEventListener('click', (e) => {
  if (e.target === confirmModal) settleConfirm(false);
});

/* Categorized */
$('#catClear').addEventListener('click', () => {
  state.catFilter = null;
  renderCategorized();
});

/* Auth modal */
$('#loginForm').addEventListener('submit', submitLogin);
$('#quickLoginBtn').addEventListener('click', () => {
  $('#loginUser').value = QUICK_LOGIN.username;
  $('#loginPass').value = QUICK_LOGIN.password;
  $('#loginSubmit').focus();
  toast('Login cepat terisi: ' + QUICK_LOGIN.username);
});
$('#registerForm').addEventListener('submit', submitRegister);
$('#loginCancel').addEventListener('click', () => closeLogin());
$('#registerCancel').addEventListener('click', () => closeLogin());
$('#loginClose').addEventListener('click', () => closeLogin());
$('#tabLogin').addEventListener('click', () => setAuthTab('login'));
$('#tabRegister').addEventListener('click', () => setAuthTab('register'));
loginModal.addEventListener('click', (e) => {
  if (e.target === loginModal) closeLogin();
});

/* Search */
searchInput.addEventListener('input', () => {
  state.query = searchInput.value;
  state.lastPicked = null;
  renderContent();
  renderSelectionBar();
});

/* Burger */
$('#burger').addEventListener('click', () => {
  const open = $('#topnav').classList.toggle('is-open');
  $('#burger').setAttribute('aria-expanded', String(open));
});

/* Navigation gating */
document.querySelectorAll('[data-view]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const view = a.dataset.view;
    if (view && view !== 'landing' && !session.user) {
      e.preventDefault();
      state.pendingView = view;
      openLogin(view);
    }
  });
});

/* Settings events */
$('#settingsBtn').addEventListener('click', openSettings);
$('#settingsClose').addEventListener('click', closeSettings);
$('#settingsDone').addEventListener('click', closeSettings);

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeSettings();
});

/* Mode terang/gelap: clock di header + switch di Pengaturan */
const modeClock = $('#modeClock');

modeClock.addEventListener('click', () => {
  setMode(!settings.dark);
  modeClock.classList.remove('is-toggling');
  void modeClock.offsetWidth;
  modeClock.classList.add('is-toggling');
});

modeClock.addEventListener('animationend', (e) => {
  if (e.animationName === 'clockSpin') modeClock.classList.remove('is-toggling');
});

/* Matahari/bulan di home: ikon yang tampil mengembalikan mode sebaliknya */
const sunBtn = $('#sunBtn');
const moonBtn = $('#moonBtn');

if (sunBtn) sunBtn.addEventListener('click', () => setMode(true));
if (moonBtn) moonBtn.addEventListener('click', () => setMode(false));

$('#modeToggle').addEventListener('click', () => {
  setMode(!settings.dark);
});

$('#cursorToggle').addEventListener('click', () => {
  settings.cursor = !settings.cursor;
  saveSetting('cursor', settings.cursor ? 'on' : 'off');
  applySettings();
  renderSettings();
});

$('#motionToggle').addEventListener('click', () => {
  settings.motion = !settings.motion;
  saveSetting('motion', settings.motion ? 'on' : 'off');
  applySettings();
  renderSettings();
  if (!settings.motion) clearLandingHover();
});

$('#settingsReset').addEventListener('click', () => {
  settings.theme = 'sky';
  settings.dark = false;
  settings.cursor = true;
  settings.motion = true;
  try {
    ['theme', 'mode', 'cursor', 'motion'].forEach((key) => localStorage.removeItem('cloud.' + key));
  } catch (e) { /* localStorage tidak tersedia */ }
  applySettings();
  renderSettings();
  if (currentView() === 'categorized') renderCategorized();
  toast('Pengaturan dikembalikan ke default');
});

/* Escape closes modals */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!confirmModal.hidden) settleConfirm(false);
  else if (!loginModal.hidden) closeLogin();
  else if (!fileModal.hidden) closeFileModal();
  else if (!settingsModal.hidden) closeSettings();
  else if (!modal.hidden) closeModal();
});

window.addEventListener('hashchange', renderView);

/* ---------- Boot ---------- */
async function boot() {
  applySettings();
  splitTitle();
  setupLanding();
  renderClock();
  setInterval(renderClock, 1000);
  renderSettings();
  renderAuth();
  refreshCapacity();

  try {
    const data = await api('/api/session');
    session.user = data.user;
  } catch (e) {
    session.user = null;
  }

  if (session.user) {
    try {
      await loadData();
    } catch (err) {
      if (err.status === 401) session.user = null;
      else toast(err.message || 'Gagal memuat data');
    }
  }

  renderAuth();
  renderView();
  $('#year').textContent = new Date().getFullYear();
}

boot();
