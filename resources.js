import { 
  supabase, 
  rakDb,
  initSmartNavbar, 
  bindLogoutButton, 
  showToast,
  getRelatedTutorials
} from '/shared/supabaseClient.js';

const gate = document.getElementById('gate');
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
const scrim = document.getElementById('scrim');
const menuClose = document.getElementById('menuClose');

const resourcesGrid = document.getElementById('resourcesGrid');
const emptyState = document.getElementById('emptyState');
const emptyStateText = document.getElementById('emptyStateText');
const searchInput = document.getElementById('resSearchInput');
const catTabs = document.querySelectorAll('.cat-tab');

// Modal Elements
const detailModal = document.getElementById('detailModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const modalResTitle = document.getElementById('modalResTitle');
const modalResBody = document.getElementById('modalResBody');
const modalResFooter = document.getElementById('modalResFooter');

let allResources = [];
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

// Category filter
catTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    catTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeCat = tab.getAttribute('data-cat');
    renderResources();
  });
});

searchInput.addEventListener('input', () => {
  renderResources();
});

function renderResources() {
  const query = searchInput.value.trim().toLowerCase();

  let filtered = allResources;

  if (activeCat !== 'all') {
    filtered = filtered.filter(r => (r.category || '').toLowerCase() === activeCat.toLowerCase());
  }

  if (query) {
    filtered = filtered.filter(r => 
      (r.title && r.title.toLowerCase().includes(query)) ||
      (r.description && r.description.toLowerCase().includes(query)) ||
      (r.tags && r.tags.toLowerCase().includes(query)) ||
      (r.category && r.category.toLowerCase().includes(query))
    );
  }

  if (filtered.length === 0) {
    resourcesGrid.innerHTML = '';
    emptyStateText.textContent = query 
      ? `Tidak ada file yang cocok dengan pencarian "${escapeHtml(query)}".`
      : 'Belum ada file resource yang tersedia pada kategori ini.';
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  resourcesGrid.innerHTML = filtered.map(r => {
    const thumb = r.thumbnail_url || 'https://images.unsplash.com/photo-1627856013091-fed6e4e30025?w=600&auto=format&fit=crop&q=80';
    return `
      <div class="resource-card" data-res-id="${r.id}">
        <div class="card-thumb-wrap">
          <img src="${escapeHtml(thumb)}" alt="${escapeHtml(r.title)}" class="card-thumb" loading="lazy">
          <span class="card-badge-top">${escapeHtml(r.category || 'Plugin')}</span>
        </div>
        <div class="card-body">
          <h2 class="card-res-title">${escapeHtml(r.title)}</h2>
          <p class="card-res-desc">${escapeHtml(r.description || 'Resource server Minecraft Java Edition pilihan rakDEV Studio.')}</p>
          <div class="card-footer">
            <span class="mono">v${escapeHtml(r.version || '1.0.0')} &bull; ${r.downloads_count || 0} unduhan</span>
            <span class="btn-card-action">Detail & Unduh &rarr;</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.resource-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-res-id');
      const item = allResources.find(x => x.id === id);
      if (item) openDetailModal(item);
    });
  });
}

async function openDetailModal(r) {
  modalResTitle.textContent = r.title;

  modalResBody.innerHTML = `
    <div style="margin-bottom:1rem">
      <div style="font-size:0.75rem;font-weight:700;color:var(--ink-faint);text-transform:uppercase">Kategori</div>
      <div style="font-weight:700;color:var(--ink);font-size:0.95rem">${escapeHtml(r.category || 'Plugin')}</div>
    </div>
    <div style="margin-bottom:1rem">
      <div style="font-size:0.75rem;font-weight:700;color:var(--ink-faint);text-transform:uppercase">Deskripsi</div>
      <div style="margin-top:4px">${escapeHtml(r.description || 'Tidak ada deskripsi.')}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;background:var(--surface-alt);padding:0.75rem;border-radius:8px;margin-bottom:1rem">
      <div>
        <span style="font-size:0.7rem;color:var(--ink-faint);display:block">Versi</span>
        <span class="mono" style="font-weight:700">v${escapeHtml(r.version || '1.0.0')}</span>
      </div>
      <div>
        <span style="font-size:0.7rem;color:var(--ink-faint);display:block">Ukuran File</span>
        <span class="mono" style="font-weight:700">${escapeHtml(r.file_size || 'N/A')}</span>
      </div>
    </div>
    ${r.dependencies ? `<div style="font-size:0.78rem;color:var(--ink-soft);margin-bottom:0.75rem"><b>Dependencies:</b> ${escapeHtml(r.dependencies)}</div>` : ''}
    ${r.tags ? `<div style="font-size:0.75rem;color:var(--ink-soft)"><b>Tags:</b> ${escapeHtml(r.tags)}</div>` : ''}
    
    <!-- Smart Related Tutorial Container -->
    <div id="modalRelatedTutWrap" style="margin-top:1rem"></div>
  `;

  modalResFooter.innerHTML = `
    ${r.download_url ? `
      <a href="${escapeHtml(r.download_url)}" target="_blank" rel="noopener noreferrer" class="btn-primary" id="btnDownloadFile">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Unduh File Sekarang
      </a>
    ` : '<span style="font-size:0.8rem;color:var(--ink-soft)">Tautan unduhan belum tersedia saat ini.</span>'}
  `;

  document.getElementById('btnDownloadFile')?.addEventListener('click', async () => {
    try {
      await rakDb.trackResourceDownload(r.id);
    } catch (e) {}
    showToast('Memulai unduhan file...');
  });

  detailModal.classList.add('open');

  // Cari tutorial terkait secara cerdas
  try {
    const tuts = await getRelatedTutorials(r.category, r.title?.split(' ')[0], 1);
    const tutWrap = document.getElementById('modalRelatedTutWrap');
    if (tutWrap && tuts && tuts.length > 0) {
      const tut = tuts[0];
      tutWrap.innerHTML = `
        <div style="background:#fef2f2;border:1px solid #fecaca;padding:0.75rem 1rem;border-radius:8px">
          <div style="font-size:0.7rem;font-weight:700;color:#b91c1c;text-transform:uppercase;letter-spacing:0.03em;margin-bottom:4px">🎬 Panduan Video Terkait</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <span style="font-size:0.8125rem;font-weight:600;color:#1e293b">${escapeHtml(tut.title)}</span>
            <a href="/tutorial?id=${tut.id}" class="btn" style="background:#dc2626;color:#fff;text-decoration:none;font-size:0.75rem;font-weight:600;padding:5px 12px;border-radius:6px;white-space:nowrap">Tonton Panduan &rarr;</a>
          </div>
        </div>
      `;
    }
  } catch (e) {}
}

btnCloseModal.addEventListener('click', () => {
  detailModal.classList.remove('open');
});

detailModal.addEventListener('click', (e) => {
  if (e.target === detailModal) detailModal.classList.remove('open');
});

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadResources() {
  if (!supabase) {
    emptyStateText.textContent = 'Konfigurasi database belum tersedia.';
    emptyState.hidden = false;
    return;
  }

  try {
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Resources fetch notice:', error);
      allResources = [];
    } else {
      allResources = data || [];
    }

    renderResources();
  } catch (err) {
    emptyStateText.textContent = 'Gagal memuat resources. Pastikan tabel telah dibuat di Supabase.';
    emptyState.hidden = false;
  }
}

async function boot() {
  try {
    await initSmartNavbar('resources');
    await loadResources();

    // Cek query parameters untuk direct deep link
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    const qParam = params.get('q');

    if (qParam) {
      searchInput.value = qParam;
      renderResources();
    }

    if (idParam && allResources.length > 0) {
      const target = allResources.find(x => x.id === idParam);
      if (target) openDetailModal(target);
    }

    // Realtime listener untuk tabel resources
    if (supabase) {
      supabase
        .channel('realtime_resources')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resources' }, () => {
          loadResources();
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
