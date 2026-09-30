const SUPABASE_URL = 'https://ymnshvqbucjelhzqxpsz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hrrKVBWFgVQNDQxy1ei-IA_WTRRLbuW';
const LOGIN_URL = 'login.html';
const RESOURCE_TABLE = 'resources';
const FILES_BUCKET = 'resource-files';
const THUMBNAILS_BUCKET = 'resource-thumbnails';
const LIST_COLUMNS = 'id,name,category,short_description,is_free,thumbnail_path,created_at';
const REALTIME_DEBOUNCE_MS = 300;

const isConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 40;
const db = window.supabase && isConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const state = {
  user: null,
  category: 'ALL',
  resources: [],
  categories: [],
  currentResource: null,
  loaded: false,
  error: false,
  downloading: false,
  detailToken: 0
};

let realtimeChannel = null;
let refreshTimer = null;

const gate = document.getElementById('gate');
const gateText = document.getElementById('gateText');
const gateRetry = document.getElementById('gateRetry');
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
const scrim = document.getElementById('scrim');
const menuClose = document.getElementById('menuClose');
const logoutBtn = document.getElementById('logoutBtn');
const logoutLabel = document.getElementById('logoutLabel');
const menuNameEl = document.getElementById('menuName');
const menuEmailEl = document.getElementById('menuEmail');
const menuAvatarEl = document.getElementById('menuAvatar');
const yearEl = document.getElementById('year');

let isLoggingOut = false;

yearEl.textContent = new Date().getFullYear();

const dom = {
  viewHome: document.getElementById('view-home'),
  viewDetail: document.getElementById('view-detail'),
  resourceGrid: document.getElementById('resourceGrid'),
  emptyState: document.getElementById('emptyState'),
  emptyTitle: document.getElementById('emptyTitle'),
  emptyDesc: document.getElementById('emptyDesc'),
  btnRetry: document.getElementById('btnRetry'),
  filterContainer: document.getElementById('filterContainer'),
  btnBack: document.getElementById('btnBack'),
  toastContainer: document.getElementById('toastContainer'),
  detail: {
    imgWrap: document.getElementById('detailImgWrap'),
    cat: document.getElementById('detailCat'),
    free: document.getElementById('detailFree'),
    title: document.getElementById('detailTitle'),
    desc: document.getElementById('detailDesc'),
    info: document.getElementById('detailInfo'),
    codeSection: document.getElementById('codeSection'),
    code: document.getElementById('detailCode'),
    btnDownload: document.getElementById('btnDownload'),
    btnShare: document.getElementById('btnShare'),
    recommendedSection: document.getElementById('recommendedSection'),
    recommendedGrid: document.getElementById('recommendedGrid')
  }
};

const showGateError = (message) => {
  gateText.textContent = message;
  gate.classList.add('error');
};

const openMenu = () => {
  menu.classList.add('open');
  menu.setAttribute('aria-hidden', 'false');
  scrim.classList.add('show');
  document.body.classList.add('menu-open');
  menuBtn.setAttribute('aria-expanded', 'true');
  menuBtn.setAttribute('aria-label', 'Tutup menu');
  menuClose.focus();
};

const closeMenu = (returnFocus) => {
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
  scrim.classList.remove('show');
  document.body.classList.remove('menu-open');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('aria-label', 'Buka menu');
  if (returnFocus) menuBtn.focus();
};

menuBtn.addEventListener('click', () => {
  if (menu.classList.contains('open')) closeMenu(true);
  else openMenu();
});

menuClose.addEventListener('click', () => closeMenu(true));
scrim.addEventListener('click', () => closeMenu(true));

document.addEventListener('keydown', (e) => {
  if (!menu.classList.contains('open')) return;

  if (e.key === 'Escape') {
    closeMenu(true);
    return;
  }

  if (e.key === 'Tab') {
    const focusable = Array.from(menu.querySelectorAll('a[href], button:not([disabled])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

menu.querySelectorAll('a.menu-item').forEach((link) => {
  link.addEventListener('click', () => closeMenu(false));
});

logoutBtn.addEventListener('click', async () => {
  if (isLoggingOut || !db) return;

  isLoggingOut = true;
  logoutBtn.disabled = true;
  logoutLabel.textContent = 'Keluar...';

  let result;
  try {
    result = await db.auth.signOut();
  } catch (err) {
    result = { error: err };
  }

  if (result && result.error) {
    try {
      await db.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('Logout failed:', err && err.message ? err.message : 'unknown error');
    }
  }

  window.location.replace(LOGIN_URL);
});

gateRetry.addEventListener('click', () => window.location.reload());

function setupEventListeners() {
  window.addEventListener('hashchange', handleRouting);
  window.addEventListener('pagehide', unsubscribeRealtime);

  dom.filterContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    state.category = btn.getAttribute('data-filter');
    renderFilters();
    renderGrid();
  });

  dom.btnBack.addEventListener('click', () => {
    window.location.hash = '';
  });

  dom.btnRetry.addEventListener('click', async () => {
    state.loaded = false;
    state.error = false;
    renderGrid();
    await loadResources();
    handleRouting();
  });

  dom.detail.btnDownload.addEventListener('click', () => {
    if (state.currentResource) downloadResource(state.currentResource);
  });

  dom.detail.btnShare.addEventListener('click', () => {
    if (state.currentResource) shareResource(state.currentResource.id);
  });
}

function toList(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(v => v.trim()).filter(Boolean);
  return [];
}

function thumbnailUrl(path) {
  if (!path || !db) return '';
  const { data } = db.storage.from(THUMBNAILS_BUCKET).getPublicUrl(path);
  return data ? data.publicUrl : '';
}

function buildMedia(path, name, emptyText) {
  const url = thumbnailUrl(path);
  const showEmpty = () => {
    const span = document.createElement('span');
    span.className = 'card-empty-img';
    span.textContent = emptyText;
    return span;
  };
  if (!url) return showEmpty();
  const img = document.createElement('img');
  img.className = 'card-img';
  img.alt = name;
  img.loading = 'lazy';
  img.addEventListener('error', () => {
    img.replaceWith(showEmpty());
  });
  img.src = url;
  return img;
}

async function loadResources() {
  if (!db) return false;
  const { data, error } = await db
    .from(RESOURCE_TABLE)
    .select(LIST_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) {
    if (!state.loaded) {
      state.error = true;
      renderHome();
    }
    return false;
  }

  state.resources = data || [];
  state.loaded = true;
  state.error = false;
  syncCategories();
  renderHome();
  return true;
}

function syncCategories() {
  const set = new Set();
  state.resources.forEach(r => {
    if (r.category) set.add(r.category);
  });
  state.categories = Array.from(set).sort((a, b) => a.localeCompare(b));
  if (state.category !== 'ALL' && !set.has(state.category)) state.category = 'ALL';
}

function renderHome() {
  renderFilters();
  renderGrid();
}

function renderFilters() {
  dom.filterContainer.innerHTML = '';
  const make = (label, value) => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (state.category === value ? ' active' : '');
    btn.setAttribute('data-filter', value);
    btn.textContent = label;
    dom.filterContainer.appendChild(btn);
  };
  make('All', 'ALL');
  state.categories.forEach(c => make(c, c));
}

function showEmpty(title, desc, retry) {
  dom.resourceGrid.style.display = 'none';
  dom.emptyState.style.display = 'block';
  dom.emptyTitle.textContent = title;
  dom.emptyDesc.textContent = desc;
  dom.btnRetry.style.display = retry ? 'inline-flex' : 'none';
}

function renderGrid() {
  dom.resourceGrid.innerHTML = '';

  if (state.error) {
    showEmpty('Gagal memuat resource', 'Terjadi kendala saat mengambil data. Silakan coba lagi.', true);
    return;
  }

  if (!state.loaded) {
    showEmpty('Memuat resource', 'Mohon tunggu sebentar.', false);
    return;
  }

  const filtered = state.resources.filter(r => state.category === 'ALL' || r.category === state.category);

  if (filtered.length === 0) {
    showEmpty('Belum ada resource', 'Belum ada konten yang tersedia pada kategori ini.', false);
    return;
  }

  dom.resourceGrid.style.display = 'grid';
  dom.emptyState.style.display = 'none';
  filtered.forEach(r => dom.resourceGrid.appendChild(createCard(r)));
}

function createCard(data) {
  const card = document.createElement('div');
  card.className = 'card';
  card.onclick = () => {
    window.location.hash = '#resource/' + encodeURIComponent(data.id);
  };

  const imgWrap = document.createElement('div');
  imgWrap.className = 'card-img-wrap';
  imgWrap.appendChild(buildMedia(data.thumbnail_path, data.name || '', 'No preview'));

  const body = document.createElement('div');
  body.className = 'card-body';

  const meta = document.createElement('div');
  meta.className = 'card-meta';

  const cat = document.createElement('span');
  cat.className = 'badge-cat';
  cat.textContent = data.category || '';
  meta.appendChild(cat);

  if (data.is_free) {
    const free = document.createElement('span');
    free.className = 'badge-free';
    free.textContent = 'FREE';
    meta.appendChild(free);
  }

  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = data.name || '';

  const desc = document.createElement('p');
  desc.className = 'card-desc';
  desc.textContent = data.short_description || '';

  body.appendChild(meta);
  body.appendChild(title);
  body.appendChild(desc);

  card.appendChild(imgWrap);
  card.appendChild(body);

  return card;
}

function handleRouting() {
  if (!state.loaded && !state.error) return;
  const hash = window.location.hash;
  if (hash.startsWith('#resource/')) {
    const id = decodeURIComponent(hash.replace('#resource/', ''));
    openDetailView(id);
  } else {
    openHomeView();
  }
}

function openHomeView() {
  state.detailToken++;
  state.currentResource = null;
  dom.viewDetail.classList.remove('active');
  dom.viewHome.classList.add('active');
  window.scrollTo(0, 0);
  renderGrid();
}

async function fetchResource(id) {
  if (!db) return { data: null, error: true, missing: false };
  const { data, error } = await db
    .from(RESOURCE_TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return { data, error, missing: !error && !data };
}

async function fetchRecommended(resource) {
  if (!db) return [];
  const { data, error } = await db
    .from(RESOURCE_TABLE)
    .select(LIST_COLUMNS)
    .eq('category', resource.category)
    .neq('id', resource.id)
    .order('created_at', { ascending: false })
    .limit(3);
  return error ? [] : (data || []);
}

async function openDetailView(id) {
  const token = ++state.detailToken;
  const result = await fetchResource(id);
  if (token !== state.detailToken) return;

  if (result.error || result.missing) {
    showToast(result.missing ? 'Resource tidak ditemukan' : 'Gagal memuat resource');
    window.location.hash = '';
    return;
  }

  state.currentResource = result.data;
  dom.viewHome.classList.remove('active');
  dom.viewDetail.classList.add('active');
  window.scrollTo(0, 0);

  populateDetail(result.data);
  await renderRecommended(result.data, token);
}

function populateDetail(data) {
  dom.detail.imgWrap.innerHTML = '';
  dom.detail.imgWrap.appendChild(buildMedia(data.thumbnail_path, data.name || '', 'No image available'));

  dom.detail.cat.textContent = data.category || '';
  dom.detail.free.style.display = data.is_free ? 'inline-block' : 'none';
  dom.detail.title.textContent = data.name || '';
  dom.detail.desc.textContent = data.description || '';

  if (data.code_preview) {
    dom.detail.code.textContent = data.code_preview;
    dom.detail.codeSection.style.display = 'block';
  } else {
    dom.detail.code.textContent = '';
    dom.detail.codeSection.style.display = 'none';
  }

  dom.detail.info.innerHTML = '';

  const addInfo = (label, value) => {
    const text = Array.isArray(value) ? value.join(', ') : value;
    if (!text) return;
    const block = document.createElement('div');
    block.className = 'info-block';
    const l = document.createElement('div');
    l.className = 'info-label';
    l.textContent = label;
    const v = document.createElement('div');
    v.className = 'info-value';
    v.textContent = text;
    block.appendChild(l);
    block.appendChild(v);
    dom.detail.info.appendChild(block);
  };

  addInfo('Versi', data.version);
  addInfo('File', data.file_name);
  addInfo('Dependencies', toList(data.dependencies));
  addInfo('Tags', toList(data.tags));

  dom.detail.info.style.display = dom.detail.info.children.length ? 'flex' : 'none';
}

async function renderRecommended(currentResource, token) {
  const recs = await fetchRecommended(currentResource);
  if (token !== state.detailToken) return;

  dom.detail.recommendedGrid.innerHTML = '';

  if (recs.length === 0) {
    dom.detail.recommendedSection.style.display = 'none';
    return;
  }

  dom.detail.recommendedSection.style.display = 'block';
  recs.forEach(r => dom.detail.recommendedGrid.appendChild(createCard(r)));
}

async function downloadResource(data) {
  if (!data.file_path) {
    showToast('File resource belum tersedia');
    return;
  }
  if (state.downloading || !db) return;

  state.downloading = true;
  dom.detail.btnDownload.disabled = true;

  const { data: signed, error } = await db.storage
    .from(FILES_BUCKET)
    .createSignedUrl(data.file_path, 60, { download: data.file_name || true });

  state.downloading = false;
  dom.detail.btnDownload.disabled = false;

  if (error || !signed || !signed.signedUrl) {
    showToast('Gagal mengunduh file');
    return;
  }

  const a = document.createElement('a');
  a.href = signed.signedUrl;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Download dimulai');
}

function shareResource(id) {
  const url = window.location.origin + window.location.pathname + '#resource/' + encodeURIComponent(id);
  if (navigator.share) {
    navigator.share({
      title: 'rakDEV Resources',
      url: url
    }).catch(() => {
      copyToClipboard(url);
    });
  } else {
    copyToClipboard(url);
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Link berhasil disalin');
  }).catch(() => {
    showToast('Gagal menyalin link');
  });
}

function subscribeRealtime() {
  if (!db) return;
  unsubscribeRealtime();
  realtimeChannel = db
    .channel('resources-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: RESOURCE_TABLE }, onResourceChange)
    .subscribe();
}

function unsubscribeRealtime() {
  if (realtimeChannel && db) {
    db.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

function onResourceChange() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refreshAll, REALTIME_DEBOUNCE_MS);
}

async function refreshAll() {
  await loadResources();
  const current = state.currentResource;
  if (!current) return;

  const token = state.detailToken;
  const result = await fetchResource(current.id);
  if (token !== state.detailToken || !state.currentResource) return;

  if (result.missing) {
    showToast('Resource ini sudah tidak tersedia');
    window.location.hash = '';
    return;
  }
  if (result.error) return;

  state.currentResource = result.data;
  populateDetail(result.data);
  await renderRecommended(result.data, token);
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 2500);
}

async function init() {
  setupEventListeners();

  if (!db) {
    showGateError('Konfigurasi Supabase belum lengkap. Isi SUPABASE_URL dan SUPABASE_ANON_KEY dengan benar.');
    return;
  }

  let user = null;

  try {
    const { data: sessionData } = await db.auth.getSession();

    if (sessionData && sessionData.session) {
      const { data: userData, error: userError } = await db.auth.getUser();

      if (!userError && userData && userData.user) {
        user = userData.user;
      } else if (userError && userError.status >= 400 && userError.status < 500) {
        await db.auth.signOut({ scope: 'local' });
      } else {
        showGateError('Tidak dapat memverifikasi sesi. Periksa koneksi internet Anda lalu coba lagi.');
        return;
      }
    }
  } catch (err) {
    showGateError('Tidak dapat memverifikasi sesi. Periksa koneksi internet Anda lalu coba lagi.');
    return;
  }

  if (!user) {
    window.location.replace(LOGIN_URL);
    return;
  }

  state.user = user;

  const metadata = user.user_metadata || {};
  const emailName = user.email ? user.email.split('@')[0] : 'Pengguna';

  const renderName = (name) => {
    menuNameEl.textContent = name;
    menuAvatarEl.innerHTML = '<img src="https://i.ibb.co.com/M5hFGd0t/file-00000000f1fc82308aa606d6a1e12263.png" alt="Profile">';
  };

  renderName(String(metadata.full_name || metadata.name || emailName).trim() || emailName);
  menuEmailEl.textContent = user.email || '';

  try {
    const { data: profile } = await db
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profile && profile.full_name && profile.full_name.trim()) {
      renderName(profile.full_name.trim());
    }
  } catch (err) {
    console.error('Profile fetch failed:', err && err.message ? err.message : 'unknown error');
  }

  db.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.replace(LOGIN_URL);
  });

  renderHome();
  await loadResources();
  document.body.classList.add('ready');
  subscribeRealtime();
  handleRouting();
}

init();
