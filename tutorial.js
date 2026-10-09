import { 
  supabase, 
  initSmartNavbar, 
  bindLogoutButton, 
  showToast,
  getRelatedResources,
  renderTutorialSkeletons,
  renderErrorCard
} from '/shared/supabaseClient.js';

const gate = document.getElementById('gate');
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
const scrim = document.getElementById('scrim');
const menuClose = document.getElementById('menuClose');

const tutorialsGrid = document.getElementById('tutorialsGrid');
const emptyState = document.getElementById('emptyState');
const emptyStateText = document.getElementById('emptyStateText');
const searchInput = document.getElementById('tutSearchInput');
const catTabs = document.querySelectorAll('#catTabs .cat-tab');

// Modal Elements
const videoModal = document.getElementById('videoModal');
const btnCloseVideoModal = document.getElementById('btnCloseVideoModal');
const modalVideoTitle = document.getElementById('modalVideoTitle');
const videoPlayerFrame = document.getElementById('videoPlayerFrame');
const modalVideoDesc = document.getElementById('modalVideoDesc');
const modalVideoFooter = document.getElementById('modalVideoFooter');

let allTutorials = [];
let activeCat = 'all';

// Drawer
function openMenu() {
  menu.classList.add('open');
  menu.setAttribute('aria-hidden', 'false');
  scrim.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
  scrim.classList.remove('show');
  document.body.style.overflow = '';
}

menuBtn.addEventListener('click', openMenu);
menuClose.addEventListener('click', closeMenu);
scrim.addEventListener('click', closeMenu);

bindLogoutButton('logoutBtn', 'logoutLabel');

// Cek parameter search dari URL (misal dari halaman Resources atau Dashboard)
const urlParams = new URLSearchParams(window.location.search);
const initialQuery = urlParams.get('q') || '';
if (initialQuery) {
  searchInput.value = initialQuery;
}

catTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    catTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeCat = tab.getAttribute('data-cat');
    renderTutorials();
  });
});

searchInput.addEventListener('input', () => {
  renderTutorials();
});

function getYouTubeEmbedUrl(url) {
  if (!url) return '';
  // Convert standard watch or short URLs to embed
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}?autoplay=1&rel=0`;
  }
  return url;
}

function renderTutorials() {
  const query = searchInput.value.trim().toLowerCase();

  let filtered = allTutorials;

  if (activeCat !== 'all') {
    filtered = filtered.filter(t => (t.category || '').toLowerCase() === activeCat.toLowerCase());
  }

  if (query) {
    filtered = filtered.filter(t => 
      (t.title && t.title.toLowerCase().includes(query)) ||
      (t.description && t.description.toLowerCase().includes(query)) ||
      (t.category && t.category.toLowerCase().includes(query))
    );
  }

  if (filtered.length === 0) {
    tutorialsGrid.innerHTML = '';
    emptyStateText.textContent = query
      ? `Tidak ada video tutorial yang cocok dengan "${escapeHtml(query)}".`
      : 'Belum ada video tutorial pada kategori ini.';
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  tutorialsGrid.innerHTML = filtered.map(t => {
    const thumb = t.thumbnail_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80';
    return `
      <div class="tutorial-card" data-tut-id="${t.id}">
        <div class="card-thumb-wrap">
          <img src="${escapeHtml(thumb)}" alt="${escapeHtml(t.title)}" class="card-thumb" loading="lazy">
          <div class="play-overlay-icon">
            <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
          <span class="card-platform-badge">${escapeHtml(t.platform || 'YouTube')}</span>
          <span class="card-cat-badge">${escapeHtml(t.category || 'General')}</span>
        </div>
        <div class="card-body">
          <h2 class="card-tut-title">${escapeHtml(t.title)}</h2>
          <p class="card-tut-desc">${escapeHtml(t.description || 'Panduan konfigurasi dan setup server Minecraft dari rakDEV Studio.')}</p>
          <div class="card-footer">
            <span>Tonton Video</span>
            <span>&rarr;</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.tutorial-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-tut-id');
      const item = allTutorials.find(x => x.id === id);
      if (item) openVideoModal(item);
    });
  });
}

async function openVideoModal(t) {
  modalVideoTitle.textContent = t.title;

  const rawUrl = t.video_url || t.youtube_url || '';
  const embedUrl = getYouTubeEmbedUrl(rawUrl);

  if (embedUrl.includes('youtube.com/embed') || embedUrl.startsWith('http')) {
    videoPlayerFrame.innerHTML = `
      <iframe src="${escapeHtml(embedUrl)}" title="${escapeHtml(t.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    `;
  } else if (rawUrl.endsWith('.mp4') || rawUrl.endsWith('.webm')) {
    videoPlayerFrame.innerHTML = `
      <video src="${escapeHtml(rawUrl)}" controls autoplay style="width:100%;height:100%"></video>
    `;
  } else {
    videoPlayerFrame.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fff;font-size:0.875rem">
        <span>Tautan video belum disematkan.</span>
      </div>
    `;
  }

  modalVideoDesc.innerHTML = `
    <div style="font-weight:700;margin-bottom:6px;font-size:0.95rem">${escapeHtml(t.title)}</div>
    <div style="color:var(--ink-soft);font-size:0.84rem;line-height:1.55">${escapeHtml(t.description || 'Tidak ada deskripsi tambahan.')}</div>
    <div id="modalRelatedResWrap" style="margin-top:1rem"></div>
  `;

  modalVideoFooter.innerHTML = `
    <span style="font-size:0.75rem;color:var(--ink-soft)">
      Kategori: <b>${escapeHtml(t.category || 'General')}</b>
    </span>
    <a href="/endorser" class="btn-primary" style="background:#0f172a;text-decoration:none">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/></svg>
      Pesan Promosi Endorser Server
    </a>
  `;

  videoModal.classList.add('open');

  // Cari resource terkait secara cerdas
  try {
    const resList = await getRelatedResources(t.category, t.title?.split(' ')[0], 1);
    const resWrap = document.getElementById('modalRelatedResWrap');
    if (resWrap && resList && resList.length > 0) {
      const res = resList[0];
      resWrap.innerHTML = `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:0.75rem 1rem;border-radius:8px">
          <div style="font-size:0.7rem;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.03em;margin-bottom:4px">📦 File & Plugin Pendukung Tutorial Ini</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <span style="font-size:0.8125rem;font-weight:600;color:#1e293b">${escapeHtml(res.title)} (v${escapeHtml(res.version || '1.0')})</span>
            <a href="/resources?id=${res.id}" class="btn" style="background:#16a34a;color:#fff;text-decoration:none;font-size:0.75rem;font-weight:600;padding:5px 12px;border-radius:6px;white-space:nowrap">Unduh File &rarr;</a>
          </div>
        </div>
      `;
    }
  } catch (e) {}
}

function closeVideoModal() {
  videoModal.classList.remove('open');
  videoPlayerFrame.innerHTML = '';
}

btnCloseVideoModal.addEventListener('click', closeVideoModal);
videoModal.addEventListener('click', (e) => {
  if (e.target === videoModal) closeVideoModal();
});

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadTutorials() {
  if (allTutorials.length === 0) {
    emptyState.hidden = true;
    renderTutorialSkeletons(tutorialsGrid, 6);
  }

  if (!supabase) {
    tutorialsGrid.innerHTML = '';
    renderErrorCard(tutorialsGrid, 'Koneksi Belum Siap', 'Konfigurasi database belum tersedia.');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('tutorials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Tutorials fetch notice:', error);
      allTutorials = [];
    } else {
      allTutorials = data || [];
    }

    renderTutorials();
  } catch (err) {
    tutorialsGrid.innerHTML = '';
    renderErrorCard(
      tutorialsGrid,
      'Gagal Memuat Video Tutorial',
      'Terjadi kendala saat mengambil data tutorial dari Supabase. Silakan periksa jaringan Anda.',
      () => loadTutorials()
    );
  }
}

async function boot() {
  try {
    await initSmartNavbar('tutorial');
    await loadTutorials();

    // Cek query parameters untuk direct deep link
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    const qParam = params.get('q');

    if (qParam) {
      searchInput.value = qParam;
      renderTutorials();
    }

    if (idParam && allTutorials.length > 0) {
      const target = allTutorials.find(x => x.id === idParam);
      if (target) openVideoModal(target);
    }

    // Realtime listener untuk tabel tutorials
    if (supabase) {
      supabase
        .channel('realtime_tutorials')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tutorials' }, () => {
          loadTutorials();
        })
        .subscribe();
    }
  } catch (e) {
    console.warn('Boot notice:', e);
  } finally {
    document.body.classList.add('ready');
  }
}

boot();
