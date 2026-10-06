import { 
  supabase, 
  initSmartNavbar, 
  bindLogoutButton, 
  getSmartHubOverview 
} from '/shared/supabaseClient.js';

const gate = document.getElementById('gate');
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
const scrim = document.getElementById('scrim');
const menuClose = document.getElementById('menuClose');

// Elements
const slotBadgeCount = document.getElementById('slotBadgeCount');
const slotNextInfo = document.getElementById('slotNextInfo');
const resBadgeCount = document.getElementById('resBadgeCount');
const tutBadgeCount = document.getElementById('tutBadgeCount');

// Smart search elements
const searchInput = document.getElementById('smartSearchInput');
const searchResults = document.getElementById('smartSearchResults');
const btnClearSearch = document.getElementById('btnClearSearch');

// User booking banner
const userBookingBanner = document.getElementById('userBookingBanner');
const userBookingTitle = document.getElementById('userBookingTitle');
const userBookingSub = document.getElementById('userBookingSub');

// Drawer control
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

// Smart Search Across Resources & Tutorials
let allResources = [];
let allTutorials = [];

async function loadSearchCache() {
  if (!supabase) return;
  try {
    const { data: res } = await supabase.from('resources').select('id, title, category');
    if (res) allResources = res;
  } catch (e) {}

  try {
    const { data: tut } = await supabase.from('tutorials').select('id, title, category');
    if (tut) allTutorials = tut;
  } catch (e) {}
}

searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    searchResults.hidden = true;
    searchResults.innerHTML = '';
    btnClearSearch.hidden = true;
    return;
  }

  btnClearSearch.hidden = false;

  const matchedRes = allResources.filter(r => r.title.toLowerCase().includes(query) || (r.category && r.category.toLowerCase().includes(query)));
  const matchedTut = allTutorials.filter(t => t.title.toLowerCase().includes(query) || (t.category && t.category.toLowerCase().includes(query)));

  if (matchedRes.length === 0 && matchedTut.length === 0) {
    searchResults.hidden = false;
    searchResults.innerHTML = `<div style="padding:0.75rem 1rem;font-size:0.8125rem;color:var(--ink-soft)">Tidak ada hasil untuk "<b>${escapeHtml(query)}</b>"</div>`;
    return;
  }

  let html = '';
  matchedRes.slice(0, 3).forEach(r => {
    html += `
      <a href="/resources?id=${r.id}" class="search-item">
        <div class="search-item-info">
          <span class="search-item-title">${escapeHtml(r.title)}</span>
          <span class="search-item-type">Resource &bull; ${escapeHtml(r.category || 'Plugin')}</span>
        </div>
        <span class="search-item-tag">Download</span>
      </a>
    `;
  });

  matchedTut.slice(0, 3).forEach(t => {
    html += `
      <a href="/tutorial?id=${t.id}" class="search-item">
        <div class="search-item-info">
          <span class="search-item-title">${escapeHtml(t.title)}</span>
          <span class="search-item-type">Tutorial &bull; ${escapeHtml(t.category || 'Video')}</span>
        </div>
        <span class="search-item-tag">Tonton</span>
      </a>
    `;
  });

  searchResults.innerHTML = html;
  searchResults.hidden = false;
});

btnClearSearch.addEventListener('click', () => {
  searchInput.value = '';
  searchResults.hidden = true;
  btnClearSearch.hidden = true;
  searchInput.focus();
});

document.addEventListener('click', (e) => {
  if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
    searchResults.hidden = true;
  }
});

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Inisialisasi Dashboard
async function initDashboard() {
  try {
    // 1. Sinkronisasi Navbar Cerdas
    const { user, isAdmin } = await initSmartNavbar('dashboard');

    // 2. Muat ringkasan antar fitur
    const overview = await getSmartHubOverview();

    // Update Endorser stats
    if (overview.availableSlots > 0) {
      slotBadgeCount.textContent = `${overview.availableSlots} Slot Available`;
      slotBadgeCount.style.background = '#dcfce7';
      slotBadgeCount.style.color = '#15803d';

      if (overview.upcomingSlot && overview.upcomingSlot.scheduled_date) {
        slotNextInfo.textContent = `Upload terdekat: ${new Date(overview.upcomingSlot.scheduled_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      }
    } else {
      slotBadgeCount.textContent = 'Slot Terjadwal';
      slotNextInfo.textContent = 'Lihat jadwal lengkap upload endorser';
    }

    // Update Resources stats
    if (overview.totalResources > 0) {
      resBadgeCount.textContent = `${overview.totalResources} File Tersedia`;
    }

    // Update Tutorials stats
    if (overview.totalTutorials > 0) {
      tutBadgeCount.textContent = `${overview.totalTutorials} Video Panduan`;
    }

    // User Booking Banner jika user memiliki pesanan
    if (user && overview.userBookings > 0) {
      const active = overview.activeBooking;
      if (active) {
        userBookingTitle.textContent = `Pesanan Server "${active.server_name || 'Minecraft'}" (${(active.status || 'Aktif').toUpperCase()})`;
        userBookingSub.textContent = 'Slot booking Anda aktif. Buka untuk memantau progres dan koordinasi via chat langsung dengan tim studio.';
        const btnChat = document.getElementById('btnUserBookingChat');
        if (btnChat && active.slot_id) {
          btnChat.href = `/endorser?slot_id=${active.slot_id}`;
        }
      } else {
        userBookingTitle.textContent = `Anda Memiliki ${overview.userBookings} Pesanan Endorser Aktif`;
        userBookingSub.textContent = 'Klik tombol di samping untuk memantau progres produksi dan chat dengan tim rakDEV.';
      }
      userBookingBanner.hidden = false;
    }

    // Muat data pencarian di latar belakang
    loadSearchCache();

    // Realtime listeners untuk Dashboard
    if (supabase) {
      supabase
        .channel('dashboard_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'endorser_slots' }, () => refreshDashboard())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'endorser_bookings' }, () => refreshDashboard())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resources' }, () => refreshDashboard())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tutorials' }, () => refreshDashboard())
        .subscribe();
    }
  } catch (err) {
    console.warn('Dashboard init notice:', err);
  } finally {
    document.body.classList.add('ready');
  }
}

async function refreshDashboard() {
  try {
    const overview = await getSmartHubOverview();
    if (overview.availableSlots > 0) {
      slotBadgeCount.textContent = `${overview.availableSlots} Slot Available`;
      slotBadgeCount.style.background = '#dcfce7';
      slotBadgeCount.style.color = '#15803d';
    }
    if (overview.totalResources > 0) {
      resBadgeCount.textContent = `${overview.totalResources} File Tersedia`;
    }
    if (overview.totalTutorials > 0) {
      tutBadgeCount.textContent = `${overview.totalTutorials} Video Panduan`;
    }
    loadSearchCache();
  } catch (e) {}
}

initDashboard();
