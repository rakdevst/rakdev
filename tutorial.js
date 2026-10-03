(function () {
  try {
    const p = window.location.pathname;
    if (p.endsWith('tutorial.html') || p.endsWith('/tutorial.html')) {
      const cleanPath = p.replace(/\/?tutorial\.html$/, '') + '/tutorial';
      window.history.replaceState(null, '', (cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath) + window.location.search + window.location.hash);
    }
  } catch (e) {}
})();

const SUPABASE_URL = 'https://ymnshvqbucjelhzqxpsz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hrrKVBWFgVQNDQxy1ei-IA_WTRRLbuW';
const LOGIN_URL = '/login';
const THUMB_BUCKET = 'tutorial-thumbnails';
const FALLBACK_THUMB_BUCKET = 'resource-thumbnails';

const isConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 40;
const client = window.supabase && isConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Application State
const state = {
  user: null,
  tutorials: [],
  categories: [],
  activeCategory: 'all',
  searchQuery: '',
  loading: true,
  error: null,
  realtimeChannel: null
};

// DOM Elements
const gate = document.getElementById('gate');
const gateText = document.getElementById('gateText');
const gateRetry = document.getElementById('gateRetry');
const menuBtn = document.getElementById('menuBtn');
const menuClose = document.getElementById('menuClose');
const menu = document.getElementById('menu');
const scrim = document.getElementById('scrim');
const menuName = document.getElementById('menuName');
const menuEmail = document.getElementById('menuEmail');
const logoutBtn = document.getElementById('logoutBtn');
const logoutLabel = document.getElementById('logoutLabel');
const yearEl = document.getElementById('year');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const categoryPills = document.getElementById('categoryPills');
const countAll = document.getElementById('countAll');
const resultsStat = document.getElementById('resultsStat');
const tutorialGrid = document.getElementById('tutorialGrid');
const emptyState = document.getElementById('emptyState');
const emptyTitle = document.getElementById('emptyTitle');
const emptyDesc = document.getElementById('emptyDesc');
const errorState = document.getElementById('errorState');
const errorDesc = document.getElementById('errorDesc');
const btnRetry = document.getElementById('btnRetry');
const toastContainer = document.getElementById('toastContainer');

if (yearEl) yearEl.textContent = new Date().getFullYear();

// Toast Helper
function showToast(message, isError = false) {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

// Security & URL Helpers
function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function resolveThumbnailUrl(thumb) {
  if (!thumb) return '';
  if (/^https?:\/\//i.test(thumb)) return thumb;
  if (!client) return '';
  // Try tutorial-thumbnails first, or get public URL
  const { data } = client.storage.from(THUMB_BUCKET).getPublicUrl(thumb);
  return data ? data.publicUrl : '';
}

// Off-canvas Menu
function openMenu() {
  if (!menu || !scrim) return;
  menu.classList.add('open');
  scrim.classList.add('show');
  document.body.classList.add('menu-open');
  if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
}

function closeMenu() {
  if (!menu || !scrim) return;
  menu.classList.remove('open');
  scrim.classList.remove('show');
  document.body.classList.remove('menu-open');
  if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
}

if (menuBtn) menuBtn.addEventListener('click', openMenu);
if (menuClose) menuClose.addEventListener('click', closeMenu);
if (scrim) scrim.addEventListener('click', closeMenu);

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    if (!state.user) {
      window.location.href = LOGIN_URL;
      return;
    }
    if (client) await client.auth.signOut();
    window.location.href = LOGIN_URL;
  });
}

// Fetch Tutorials from Supabase
async function loadTutorials(silent = false) {
  if (!client) {
    state.error = 'Supabase client belum dikonfigurasi.';
    renderTutorials();
    return;
  }

  if (!silent) {
    state.loading = true;
    state.error = null;
  }

  try {
    // Select all available columns
    const { data, error } = await client
      .from('tutorials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Normalize items
    state.tutorials = (data || []).map(item => {
      const vidUrl = item.video_url || item.youtube_url || '';
      let platform = item.platform;
      if (!platform) {
        if (/youtube\.com|youtu\.be/i.test(vidUrl)) platform = 'YouTube';
        else if (/tiktok\.com/i.test(vidUrl)) platform = 'TikTok';
        else if (/instagram\.com/i.test(vidUrl)) platform = 'Instagram';
        else platform = 'YouTube';
      }

      return {
        id: item.id,
        title: item.title || 'Tutorial Tanpa Judul',
        description: item.description || '',
        thumbnail_url: item.thumbnail_url || '',
        video_url: vidUrl,
        platform: platform,
        category: item.category || 'General',
        created_at: item.created_at,
        updated_at: item.updated_at
      };
    });

    // Extract unique categories
    const catSet = new Set();
    state.tutorials.forEach(t => {
      if (t.category && t.category.trim()) catSet.add(t.category.trim());
    });
    state.categories = Array.from(catSet).sort();

    state.error = null;
  } catch (err) {
    console.error('Error fetching tutorials:', err);
    state.error = err && err.message ? err.message : 'Gagal memuat tutorial dari database.';
  } finally {
    state.loading = false;
    renderCategories();
    renderTutorials();
  }
}

// Render Category Pills
function renderCategories() {
  if (!categoryPills) return;

  const currentCategory = state.activeCategory;
  categoryPills.innerHTML = '';

  // "Semua" pill
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'pill' + (currentCategory === 'all' ? ' active' : '');
  allBtn.setAttribute('data-category', 'all');
  allBtn.setAttribute('role', 'tab');
  allBtn.setAttribute('aria-selected', currentCategory === 'all' ? 'true' : 'false');
  allBtn.innerHTML = `Semua <span class="pill-count mono">${state.tutorials.length}</span>`;
  allBtn.addEventListener('click', () => {
    state.activeCategory = 'all';
    renderCategories();
    renderTutorials();
  });
  categoryPills.appendChild(allBtn);

  // Category pills
  state.categories.forEach(cat => {
    const count = state.tutorials.filter(t => t.category.toLowerCase() === cat.toLowerCase()).length;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pill' + (currentCategory.toLowerCase() === cat.toLowerCase() ? ' active' : '');
    btn.setAttribute('data-category', cat);
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', currentCategory.toLowerCase() === cat.toLowerCase() ? 'true' : 'false');
    btn.innerHTML = `${escapeHtml(cat)} <span class="pill-count mono">${count}</span>`;
    btn.addEventListener('click', () => {
      state.activeCategory = cat;
      renderCategories();
      renderTutorials();
    });
    categoryPills.appendChild(btn);
  });
}

// Platform SVG Icons
function getPlatformIcon(platform) {
  const p = (platform || '').toLowerCase();
  if (p === 'youtube') {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`;
  }
  if (p === 'tiktok') {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.49 6.27 6.27 0 0 0 1.86-4.49V8.75a8.28 8.28 0 0 0 4.91 1.6V6.9a4.85 4.85 0 0 1-1-.21z"/></svg>`;
  }
  if (p === 'instagram') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
}

// Build a Tutorial Card
function buildTutorialCard(item) {
  const card = document.createElement('a');
  card.className = 'tutorial-card';
  card.href = item.video_url || '#';
  card.target = '_blank';
  card.rel = 'noopener noreferrer';
  card.setAttribute('aria-label', `Tonton tutorial: ${item.title}`);

  // Thumbnail Container
  const media = document.createElement('div');
  media.className = 'card-media';

  const thumbUrl = resolveThumbnailUrl(item.thumbnail_url);

  if (thumbUrl) {
    const img = document.createElement('img');
    img.className = 'card-thumb';
    img.src = thumbUrl;
    img.alt = item.title;
    img.loading = 'lazy';
    img.onerror = () => {
      // Replace with fallback if image fails
      media.innerHTML = `
        <div class="thumb-fallback">
          <div class="thumb-fallback-icon">
            <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
        ${item.category ? `<span class="card-category-tag">${escapeHtml(item.category)}</span>` : ''}
      `;
    };
    media.appendChild(img);
  } else {
    const fallback = document.createElement('div');
    fallback.className = 'thumb-fallback';
    fallback.innerHTML = `
      <div class="thumb-fallback-icon">
        <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </div>
    `;
    media.appendChild(fallback);
  }

  // Floating Category Tag
  if (item.category && item.category !== 'General') {
    const catTag = document.createElement('span');
    catTag.className = 'card-category-tag';
    catTag.textContent = item.category;
    media.appendChild(catTag);
  }

  // Body
  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = item.title;

  const desc = document.createElement('p');
  desc.className = 'card-desc';
  desc.textContent = item.description || 'Klik untuk menonton tutorial video lengkap...';

  // Footer (Platform Badge + Open Arrow)
  const foot = document.createElement('div');
  foot.className = 'card-footer';

  const platformClass = (item.platform || 'youtube').toLowerCase();
  const badge = document.createElement('span');
  badge.className = `platform-badge ${platformClass}`;
  badge.innerHTML = `${getPlatformIcon(item.platform)} <span>${escapeHtml(item.platform || 'Video')}</span>`;

  const action = document.createElement('span');
  action.className = 'card-action';
  action.innerHTML = `<span>Buka</span> <svg class="icon" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;

  foot.appendChild(badge);
  foot.appendChild(action);

  body.appendChild(title);
  body.appendChild(desc);
  body.appendChild(foot);

  card.appendChild(media);
  card.appendChild(body);

  return card;
}

// Render Tutorial Grid
function renderTutorials() {
  if (!tutorialGrid) return;
  tutorialGrid.innerHTML = '';

  // Handle Error
  if (state.error) {
    if (emptyState) emptyState.hidden = true;
    if (errorState) {
      errorState.hidden = false;
      if (errorDesc) errorDesc.textContent = state.error;
    }
    if (resultsStat) resultsStat.textContent = 'Gagal memuat';
    return;
  }
  if (errorState) errorState.hidden = true;

  // Filter tutorials
  let filtered = state.tutorials.slice();

  if (state.activeCategory !== 'all') {
    filtered = filtered.filter(t => (t.category || '').toLowerCase() === state.activeCategory.toLowerCase());
  }

  const query = state.searchQuery.trim().toLowerCase();
  if (query) {
    filtered = filtered.filter(t =>
      (t.title || '').toLowerCase().includes(query) ||
      (t.description || '').toLowerCase().includes(query) ||
      (t.category || '').toLowerCase().includes(query) ||
      (t.platform || '').toLowerCase().includes(query)
    );
  }

  // Update Stat Text
  if (resultsStat) {
    resultsStat.textContent = `Menampilkan ${filtered.length} tutorial`;
  }

  // Empty State
  if (!filtered.length) {
    if (emptyState) {
      emptyState.hidden = false;
      if (query) {
        if (emptyTitle) emptyTitle.textContent = 'Tidak Ada Hasil';
        if (emptyDesc) emptyDesc.textContent = `Tidak ditemukan tutorial yang cocok dengan "${state.searchQuery}". Coba kata kunci lain.`;
      } else if (state.activeCategory !== 'all') {
        if (emptyTitle) emptyTitle.textContent = `Kategori "${state.activeCategory}" Kosong`;
        if (emptyDesc) emptyDesc.textContent = 'Belum ada tutorial yang diunggah untuk kategori ini.';
      } else {
        if (emptyTitle) emptyTitle.textContent = 'Belum Ada Tutorial';
        if (emptyDesc) emptyDesc.textContent = 'Tutorial video akan segera ditambahkan oleh tim rakDEV.';
      }
    }
    return;
  }

  if (emptyState) emptyState.hidden = true;

  // Render cards (STRICT: 2 columns in CSS Grid)
  const fragment = document.createDocumentFragment();
  filtered.forEach(item => {
    fragment.appendChild(buildTutorialCard(item));
  });
  tutorialGrid.appendChild(fragment);
}

// Search Inputs Handlers
if (searchInput) {
  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value;
    if (searchClear) searchClear.hidden = !searchInput.value;
    renderTutorials();
  });
}

if (searchClear) {
  searchClear.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    state.searchQuery = '';
    searchClear.hidden = true;
    renderTutorials();
    if (searchInput) searchInput.focus();
  });
}

if (btnRetry) {
  btnRetry.addEventListener('click', () => loadTutorials(false));
}

if (gateRetry) {
  gateRetry.addEventListener('click', () => window.location.reload());
}

// Realtime Subscriptions
function subscribeRealtime() {
  if (state.realtimeChannel || !client) return;

  state.realtimeChannel = client
    .channel('tutorials-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tutorials' }, () => {
      loadTutorials(true);
    })
    .subscribe();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadTutorials(true);
    }
  });
}

// Boot Application
async function boot() {
  if (!client) {
    if (gateText) gateText.textContent = 'Supabase client belum dikonfigurasi.';
    if (gate) gate.classList.add('error');
    return;
  }

  let user = null;

  try {
    const { data: sessionData } = await client.auth.getSession();
    if (sessionData && sessionData.session) {
      const { data: userData, error: userError } = await client.auth.getUser();
      if (!userError && userData && userData.user) {
        user = userData.user;
      }
    }
  } catch (err) {
    console.warn('Session verification skipped, continuing as guest:', err);
  }

  state.user = user;

  if (user) {
    const metadata = user.user_metadata || {};
    const emailName = user.email ? user.email.split('@')[0] : 'Pengguna';
    const displayName = String(metadata.full_name || metadata.name || emailName).trim() || emailName;

    if (menuName) menuName.textContent = displayName;
    if (menuEmail) menuEmail.textContent = user.email || '';
    if (logoutLabel) logoutLabel.textContent = 'Logout';

    try {
      const { data: profile } = await client
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile && profile.full_name && profile.full_name.trim()) {
        if (menuName) menuName.textContent = profile.full_name.trim();
      }
    } catch (err) {
      console.error('Profile fetch failed:', err);
    }
  } else {
    if (menuName) menuName.textContent = 'Tamu';
    if (menuEmail) menuEmail.textContent = 'Belum login';
    if (logoutLabel) logoutLabel.textContent = 'Login';
  }

  await loadTutorials(false);

  // App ready
  document.body.classList.add('ready');
  subscribeRealtime();
}

boot();
