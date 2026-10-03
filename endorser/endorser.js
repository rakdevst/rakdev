(function () {
  try {
    const p = window.location.pathname;
    if (/(?:ENDORSER|endorser)\.html$/i.test(p) || p.endsWith('/endorser/')) {
      window.history.replaceState(null, '', '/endorser' + window.location.search + window.location.hash);
    }
  } catch (e) {}
})();

const SUPABASE_URL = 'https://ymnshvqbucjelhzqxpsz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hrrKVBWFgVQNDQxy1ei-IA_WTRRLbuW';
const LOGIN_URL = '/login';

const TABLES = {
  slots: 'endorser_slots',
  bookings: 'endorser_bookings',
  conversations: 'conversations',
  messages: 'messages'
};

const PHASES = ["Planning", "Recording", "Editing", "Review", "Revision", "Finalization", "Published"];
const ACTIVE_STATUSES = ['pending', 'approved', 'in_production', 'completed'];
const CANCELLABLE_STATUSES = ['pending', 'approved'];
const PROGRESS_STATUSES = ['approved', 'in_production', 'completed'];
const PORT_PATTERN = /^[0-9]{1,5}(\s*[\/,]\s*[0-9]{1,5})*$/;
const MIN_BOOKING_LEAD_DAYS = 3;

const isConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 40;
const client = window.supabase && isConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const monthNamesUpper = ["JANUARI","FEBRUARI","MARET","APRIL","MEI","JUNI","JULI","AGUSTUS","SEPTEMBER","OKTOBER","NOVEMBER","DESEMBER"];
const monthShort = ["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"];
const dayNamesShort = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];

const STATUS_LABEL = {
  available: 'Available',
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  in_production: 'Produksi',
  completed: 'Published',
  cancelled: 'Dibatalkan'
};

const now = new Date();
const state = {
  user: null,
  slots: [],
  bookings: [],
  conversations: {},
  viewYear: now.getFullYear(),
  viewMonth: now.getMonth(),
  activeFilter: 'all', // 'all' | 'available' | 'booked' | 'mine'
  loadError: null,
  detail: { slotId: null, bookingId: null },
  bookingSlotId: null,
  isBooking: false,
  chat: { conversationId: null, messages: [], channel: null },
  liveChannel: null
};

// DOM Elements
const gate = document.getElementById('gate');
const gateText = document.getElementById('gateText');
const gateRetry = document.getElementById('gateRetry');

const slotListView = document.getElementById('slotListView');
const detailView = document.getElementById('detailView');

const monthHeroTitle = document.getElementById('monthHeroTitle');
const monthSelect = document.getElementById('monthSelect');

const metricTotalSlots = document.getElementById('metricTotalSlots');
const metricAvailable = document.getElementById('metricAvailable');
const metricTotalBooked = document.getElementById('metricTotalBooked');
const metricInProduction = document.getElementById('metricInProduction');

const filterAllBtn = document.getElementById('filterAllBtn');
const filterAvailBtn = document.getElementById('filterAvailBtn');
const filterBookedBtn = document.getElementById('filterBookedBtn');
const filterMineBtn = document.getElementById('filterMineBtn');

const countAll = document.getElementById('countAll');
const countAvail = document.getElementById('countAvail');
const countBooked = document.getElementById('countBooked');
const countMine = document.getElementById('countMine');

const slotListContainer = document.getElementById('slotListContainer');
const slotNotice = document.getElementById('slotNotice');

const myBookings = document.getElementById('myBookings');
const myBookingsList = document.getElementById('myBookingsList');

const btnBackToCalendar = document.getElementById('btnBackToCalendar');
const detailHeaderBadge = document.getElementById('detailHeaderBadge');
const detailServerName = document.getElementById('detailServerName');
const detailCategory = document.getElementById('detailCategory');
const detailScheduledDate = document.getElementById('detailScheduledDate');
const detailTimeSlot = document.getElementById('detailTimeSlot');
const detailContentType = document.getElementById('detailContentType');
const detailDescription = document.getElementById('detailDescription');
const progressCard = document.getElementById('progressCard');
const detailPhaseBadge = document.getElementById('detailPhaseBadge');
const detailCurrentPhaseName = document.getElementById('detailCurrentPhaseName');
const detailProgressPercent = document.getElementById('detailProgressPercent');
const detailProgressFill = document.getElementById('detailProgressFill');
const detailAsciiText = document.getElementById('detailAsciiText');
const detailTimeline = document.getElementById('detailTimeline');
const bookingDetailsContainer = document.getElementById('bookingDetailsContainer');
const bookingActionContainer = document.getElementById('bookingActionContainer');

const chatCard = document.getElementById('chatCard');
const chatList = document.getElementById('chatList');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');

const bookingModal = document.getElementById('bookingModal');
const bookingForm = document.getElementById('bookingForm');
const modalBookingTitle = document.getElementById('modalBookingTitle');
const btnCloseBookingModal = document.getElementById('btnCloseBookingModal');
const btnCancelBookingModal = document.getElementById('btnCancelBookingModal');
const btnSubmitBooking = document.getElementById('btnSubmitBooking');
const toastContainer = document.getElementById('toastContainer');

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
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Drawer Menu handlers
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
  if (isLoggingOut || !client) return;

  isLoggingOut = true;
  logoutBtn.disabled = true;
  logoutLabel.textContent = 'Keluar...';

  try {
    await client.auth.signOut();
  } catch (err) {
    try {
      await client.auth.signOut({ scope: 'local' });
    } catch (e) {}
  }

  window.location.replace(LOGIN_URL);
});

// Utilities
function formatDateToLocalISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function minBookableDate() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const [y, m, d] = today.split('-').map(Number);
  return formatDateToLocalISO(new Date(y, m - 1, d + MIN_BOOKING_LEAD_DAYS));
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 240);
  }, 2600);
}

function translateError(err) {
  const message = err && err.message ? String(err.message) : '';
  const code = err && err.code ? String(err.code) : '';

  if (/slot_unavailable/.test(message) || code === '23505') return 'Slot ini sudah dipesan pengguna lain.';
  if (/slot_expired/.test(message)) return 'Tanggal slot ini sudah lewat.';
  if (/slot_not_found/.test(message)) return 'Slot tidak ditemukan.';
  if (/booking_not_cancellable/.test(message)) return 'Booking ini tidak dapat dibatalkan lagi.';
  if (/booking_not_found/.test(message)) return 'Booking tidak ditemukan.';
  if (/not_authenticated/.test(message)) return 'Sesi Anda berakhir. Silakan login ulang.';
  if (/Tanggal booking minimal H\+3/i.test(message)) return 'Booking hanya bisa dilakukan minimal H+3 dari hari ini.';
  if (/Akses ditolak/i.test(message)) return 'Anda tidak memiliki izin untuk aksi ini.';
  if (code === '42501' || /row-level security|permission denied/i.test(message)) return 'Anda tidak memiliki izin untuk aksi ini.';
  if (code === '23514' || code === '22P02') return 'Data tidak valid. Periksa kembali isian Anda.';
  if (/failed to fetch|network|load failed/i.test(message)) return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
  return message || 'Terjadi kesalahan. Coba lagi nanti.';
}

function badgeClass(status) {
  return `badge badge-${status || 'cancelled'}`;
}

function statusLabel(status) {
  return STATUS_LABEL[status] || String(status || '-').toUpperCase();
}

function clampProgress(slot) {
  return Math.max(0, Math.min(100, Math.round(Number(slot && slot.progress) || 0)));
}

function generateAsciiBlocks(pct) {
  const total = 24;
  const filled = Math.round((pct / 100) * total);
  return '█'.repeat(filled) + '░'.repeat(total - filled);
}

function findSlot(slotId) {
  const inMonth = state.slots.find(s => s.id === slotId);
  if (inMonth) return inMonth;
  const viaBooking = state.bookings.find(b => b.slot_id === slotId && b.slot);
  return viaBooking ? viaBooking.slot : null;
}

function ownBookingForSlot(slotId) {
  return state.bookings.find(b => b.slot_id === slotId && ACTIVE_STATUSES.includes(b.status)) || null;
}

function slotTitle(slot, booking) {
  if (booking && booking.server_name) return booking.server_name;
  if (slot.server_name) return slot.server_name;
  return slot.status === 'available' ? 'Slot Tersedia' : 'Slot Dipesan';
}

// Populate Month Select Dropdown (if present)
function initMonthSelector() {
  if (!monthSelect) return;
  monthSelect.innerHTML = '';
  const currentY = now.getFullYear();
  const currentM = now.getMonth();

  for (let offset = 0; offset < 6; offset++) {
    const d = new Date(currentY, currentM + offset, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const opt = document.createElement('option');
    opt.value = `${y}-${m}`;
    opt.textContent = `${monthNames[m]} ${y}`;
    if (y === state.viewYear && m === state.viewMonth) {
      opt.selected = true;
    }
    monthSelect.appendChild(opt);
  }

  monthSelect.addEventListener('change', async (e) => {
    const [y, m] = e.target.value.split('-').map(Number);
    state.viewYear = y;
    state.viewMonth = m;
    try {
      await loadSlots();
      state.loadError = null;
    } catch (err) {
      state.slots = [];
      state.loadError = translateError(err);
    }
    renderAll();
  });
}

// Setup Filter Buttons
function setupFilterTabs() {
  const tabs = [
    { btn: filterAllBtn, key: 'all' },
    { btn: filterAvailBtn, key: 'available' },
    { btn: filterBookedBtn, key: 'booked' },
    { btn: filterMineBtn, key: 'mine' }
  ];

  tabs.forEach(({ btn, key }) => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => {
        t.btn.classList.toggle('active', t.key === key);
        t.btn.setAttribute('aria-selected', t.key === key ? 'true' : 'false');
      });
      state.activeFilter = key;
      renderSlotList();
    });
  });
}

// Build Slot Item Card (Matching user mock visual: 01 OCT / Available / Belum ada booking / DETAIL →)
function buildSlotItem(slot) {
  const booking = ownBookingForSlot(slot.id);
  const status = booking ? booking.status : slot.status;
  const isAvailable = status === 'available';
  const isBooked = !isAvailable;
  const progress = clampProgress(slot);
  const showProgress = PROGRESS_STATUSES.includes(status);

  // Parse date
  const [y, m, d] = (slot.scheduled_date || '').split('-').map(Number);
  const dateObj = new Date(y, (m || 1) - 1, d || 1);
  const dayNum = String(d || 1).padStart(2, '0');
  const monthAbbr = monthShort[(m || 1) - 1] || 'SLOT';
  const weekday = dayNamesShort[dateObj.getDay()] || '';

  const card = document.createElement('article');
  card.className = 'slot-item';
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  card.setAttribute('aria-label', `Slot ${dayNum} ${monthAbbr} - ${statusLabel(status)}`);

  // Top Row: Date lockup & Status
  const top = document.createElement('div');
  top.className = 'slot-item-top';

  const dateGroup = document.createElement('div');
  dateGroup.className = 'slot-date-group';

  const daySpan = document.createElement('span');
  daySpan.className = 'slot-date-day mono';
  daySpan.textContent = dayNum;

  const monthSpan = document.createElement('span');
  monthSpan.className = 'slot-date-month';
  monthSpan.textContent = monthAbbr;

  const weekdaySpan = document.createElement('span');
  weekdaySpan.className = 'slot-date-weekday';
  weekdaySpan.textContent = `· ${weekday}`;

  dateGroup.appendChild(daySpan);
  dateGroup.appendChild(monthSpan);
  dateGroup.appendChild(weekdaySpan);

  const badge = document.createElement('span');
  badge.className = badgeClass(status);
  badge.textContent = statusLabel(status);

  top.appendChild(dateGroup);
  top.appendChild(badge);

  // Content Row: Title, Subtitle, Progress
  const content = document.createElement('div');
  content.className = 'slot-item-content';

  const title = document.createElement('h2');
  title.className = 'slot-title';
  title.textContent = slotTitle(slot, booking);

  const sub = document.createElement('p');
  sub.className = 'slot-subtitle';
  if (isAvailable) {
    sub.textContent = slot.time_slot ? `Slot masih kosong · Jam Upload ${slot.time_slot}` : 'Belum ada booking';
  } else if (booking) {
    sub.textContent = `Booking Anda · ${booking.ip || 'Minecraft Server'}`;
  } else {
    sub.textContent = slot.current_phase ? `Fase: ${slot.current_phase}` : 'Slot telah dibooking';
  }

  content.appendChild(title);
  content.appendChild(sub);

  if (showProgress) {
    const progBlock = document.createElement('div');
    progBlock.className = 'slot-progress-block';

    const progInfo = document.createElement('div');
    progInfo.className = 'slot-progress-info';
    progInfo.innerHTML = `<span>${slot.current_phase || 'Pengerjaan'}</span><span class="mono">${progress}%</span>`;

    const progBar = document.createElement('div');
    progBar.className = 'slot-progress-bar';
    const progFill = document.createElement('div');
    progFill.className = 'slot-progress-fill';
    progFill.style.width = `${progress}%`;
    progBar.appendChild(progFill);

    progBlock.appendChild(progInfo);
    progBlock.appendChild(progBar);
    content.appendChild(progBlock);
  }

  // Footer Row: Tags & Action
  const foot = document.createElement('div');
  foot.className = 'slot-item-footer';

  const metaTags = document.createElement('div');
  metaTags.className = 'slot-meta-tags';
  const tagContent = slot.content_type || 'Video Endorse';
  const timeText = slot.time_slot ? ` · ${slot.time_slot}` : '';
  metaTags.textContent = `${tagContent}${timeText}`;

  const action = document.createElement('div');
  const isPast = !!slot.scheduled_date && slot.scheduled_date < formatDateToLocalISO(new Date());
  const tooSoon = !isPast && !!slot.scheduled_date && slot.scheduled_date < minBookableDate();
  const canBook = isAvailable && !isPast && !tooSoon;

  if (canBook) {
    action.className = 'slot-action-btn book-btn';
    action.textContent = 'BOOK →';
  } else {
    action.className = 'slot-action-btn';
    action.textContent = 'DETAIL →';
  }

  foot.appendChild(metaTags);
  foot.appendChild(action);

  card.appendChild(top);
  card.appendChild(content);
  card.appendChild(foot);

  // Interaction handlers
  const handleOpen = (e) => {
    // If clicking action directly and can book, directly open booking modal
    if (canBook && e && e.target && e.target.closest('.book-btn')) {
      e.stopPropagation();
      openBookingModal(slot);
      return;
    }
    openDetailView(slot.id, booking ? booking.id : null);
  };

  card.addEventListener('click', handleOpen);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen(e);
    }
  });

  return card;
}

// Render Slot List according to active filter
function renderSlotList() {
  slotListContainer.innerHTML = '';

  let filtered = state.slots.slice();

  if (state.activeFilter === 'available') {
    filtered = filtered.filter(s => s.status === 'available');
  } else if (state.activeFilter === 'booked') {
    filtered = filtered.filter(s => ACTIVE_STATUSES.includes(s.status));
  } else if (state.activeFilter === 'mine') {
    const mySlotIds = new Set(state.bookings.map(b => b.slot_id));
    filtered = filtered.filter(s => mySlotIds.has(s.id));
  }

  if (state.loadError) {
    slotNotice.textContent = state.loadError;
    slotNotice.className = 'slot-notice error';
    slotNotice.hidden = false;
  } else if (!state.slots.length) {
    slotNotice.textContent = 'Belum ada jadwal slot upload yang tersedia.';
    slotNotice.className = 'slot-notice';
    slotNotice.hidden = false;
  } else if (!filtered.length) {
    slotNotice.textContent = 'Tidak ada slot yang cocok dengan filter yang dipilih.';
    slotNotice.className = 'slot-notice';
    slotNotice.hidden = false;
  } else {
    slotNotice.hidden = true;
    filtered.forEach(slot => {
      slotListContainer.appendChild(buildSlotItem(slot));
    });
  }
}

// Update Top Metrics & Filter Badges
function updateStats() {
  const total = state.slots.length;
  const avail = state.slots.filter(s => s.status === 'available').length;
  const booked = state.slots.filter(s => ACTIVE_STATUSES.includes(s.status)).length;
  const inProd = state.slots.filter(s => s.status === 'in_production').length;
  const mine = state.bookings.filter(b => ACTIVE_STATUSES.includes(b.status)).length;

  metricTotalSlots.textContent = total;
  metricAvailable.textContent = avail;
  metricTotalBooked.textContent = booked;
  metricInProduction.textContent = inProd;

  countAll.textContent = total;
  countAvail.textContent = avail;
  countBooked.textContent = booked;
  countMine.textContent = mine;

  if (monthHeroTitle) {
    monthHeroTitle.textContent = 'Jadwal Slot Upload';
  }
  if (monthSelect) {
    const selectVal = `${state.viewYear}-${state.viewMonth}`;
    if (monthSelect.value !== selectVal) {
      monthSelect.value = selectVal;
    }
  }
}

// Render "Riwayat Booking Saya" section
function renderMyBookings() {
  myBookingsList.innerHTML = '';
  myBookings.hidden = !state.bookings.length;

  state.bookings.forEach(booking => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'my-item';

    const text = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'my-name';
    name.textContent = booking.server_name;

    const sub = document.createElement('div');
    sub.className = 'my-sub mono';
    const slot = booking.slot;
    sub.textContent = slot ? [slot.scheduled_date, slot.time_slot].filter(Boolean).join(' · ') : '-';
    text.appendChild(name);
    text.appendChild(sub);

    const badge = document.createElement('span');
    badge.className = badgeClass(booking.status);
    badge.textContent = statusLabel(booking.status);

    item.appendChild(text);
    item.appendChild(badge);
    item.addEventListener('click', () => openDetailView(booking.slot_id, booking.id));
    myBookingsList.appendChild(item);
  });
}

// Views Navigation
function showListView() {
  detailView.classList.add('hidden');
  slotListView.classList.remove('hidden');
  window.scrollTo(0, 0);
}

function closeDetailView() {
  state.detail = { slotId: null, bookingId: null };
  closeChat();
  showListView();
}

function openDetailView(slotId, bookingId) {
  state.detail = { slotId, bookingId: bookingId || null };
  renderDetail();
  if (!state.detail.slotId) return;
  slotListView.classList.add('hidden');
  detailView.classList.remove('hidden');
  window.scrollTo(0, 0);
}

// Render Slot Detail
function renderDetail() {
  const slot = findSlot(state.detail.slotId);
  if (!slot) {
    closeDetailView();
    showToast('Slot tidak ditemukan atau sudah dihapus.');
    return;
  }

  const chosen = state.detail.bookingId ? state.bookings.find(b => b.id === state.detail.bookingId) : null;
  const booking = chosen || ownBookingForSlot(slot.id);
  const status = booking ? booking.status : slot.status;
  const progress = clampProgress(slot);

  detailHeaderBadge.innerHTML = '';
  const hb = document.createElement('span');
  hb.className = badgeClass(status);
  hb.textContent = statusLabel(status);
  detailHeaderBadge.appendChild(hb);

  detailServerName.textContent = slotTitle(slot, booking);
  detailCategory.textContent = slot.category || 'Minecraft Server';
  detailScheduledDate.textContent = slot.scheduled_date || '-';
  detailTimeSlot.textContent = slot.time_slot || '-';
  detailContentType.textContent = slot.content_type || 'Video Endorse';
  detailDescription.textContent = slot.description || 'Tidak ada deskripsi khusus.';

  const showProgress = PROGRESS_STATUSES.includes(slot.status);
  progressCard.hidden = !showProgress;
  if (showProgress) {
    detailPhaseBadge.className = badgeClass(slot.status);
    detailPhaseBadge.textContent = slot.current_phase || '-';
    detailCurrentPhaseName.textContent = `Fase: ${slot.current_phase || '-'}`;
    detailProgressPercent.textContent = `${progress}%`;
    detailProgressFill.style.width = `${progress}%`;
    detailAsciiText.textContent = `${generateAsciiBlocks(progress)}  ${progress}% selesai`;
    renderTimeline(slot, progress);
  }

  renderBookingInfoSection(slot, booking);

  const conversationId = booking ? state.conversations[booking.id] : null;
  if (conversationId) {
    openChat(conversationId);
  } else {
    closeChat();
  }
}

function renderTimeline(slot, progress) {
  detailTimeline.innerHTML = '';
  const phases = Array.isArray(slot.production_phases) && slot.production_phases.length
    ? slot.production_phases
    : PHASES;
  const currentIdx = phases.indexOf(slot.current_phase);

  phases.forEach((phase, index) => {
    const item = document.createElement('div');
    const isDone = index < currentIdx || progress === 100;
    const isActive = index === currentIdx && progress < 100;
    item.className = `timeline-item${isDone ? ' completed' : ''}${isActive ? ' active' : ''}`;

    const dot = document.createElement('div');
    dot.className = 'timeline-dot';
    dot.textContent = isDone ? '✓' : String(index + 1);

    const body = document.createElement('div');
    body.className = 'timeline-body';
    const name = document.createElement('span');
    name.className = 'timeline-name';
    name.textContent = phase;
    const stateLabel = document.createElement('span');
    stateLabel.className = 'timeline-state';
    stateLabel.textContent = isDone ? 'Selesai' : (isActive ? 'Berjalan' : 'Menunggu');
    body.appendChild(name);
    body.appendChild(stateLabel);

    item.appendChild(dot);
    item.appendChild(body);
    detailTimeline.appendChild(item);
  });
}

function appendEmptyState(text) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.textContent = text;
  bookingDetailsContainer.appendChild(empty);
}

function appendBookButton(slot) {
  const btnBook = document.createElement('button');
  btnBook.className = 'btn btn-primary btn-full';
  btnBook.textContent = 'Book Slot Ini';
  btnBook.addEventListener('click', () => openBookingModal(slot));
  bookingActionContainer.appendChild(btnBook);
}

function renderBookingInfoSection(slot, booking) {
  bookingDetailsContainer.innerHTML = '';
  bookingActionContainer.innerHTML = '';

  const isPast = !!slot.scheduled_date && slot.scheduled_date < formatDateToLocalISO(new Date());
  const tooSoon = !isPast && !!slot.scheduled_date && slot.scheduled_date < minBookableDate();
  const canBook = slot.status === 'available' && !isPast && !tooSoon;

  if (!booking) {
    if (canBook) {
      appendEmptyState('Slot tanggal ini masih tersedia dan dapat dipesan.');
      appendBookButton(slot);
    } else if (slot.status === 'available' && isPast) {
      appendEmptyState('Tanggal slot ini sudah lewat.');
    } else if (slot.status === 'available') {
      appendEmptyState('Booking hanya dapat dilakukan minimal H+3 dari hari ini.');
    } else {
      appendEmptyState('Slot ini sudah dipesan oleh pengguna lain.');
    }
    return;
  }

  const rows = [
    ['Nama Server', booking.server_name || '-'],
    ['IP Server', booking.ip || '-'],
    ['Port Server', booking.port || '-'],
    ['Media Sosial', booking.social_media || '-'],
    ['Tanggal Booking', booking.created_at ? new Date(booking.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'],
    ['Status Booking', null]
  ];

  rows.forEach(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'booking-row';
    const l = document.createElement('span');
    l.className = 'booking-label';
    l.textContent = label;

    const v = document.createElement('span');
    v.className = 'booking-value';
    if (label === 'Status Booking') {
      const badge = document.createElement('span');
      badge.className = badgeClass(booking.status);
      badge.textContent = statusLabel(booking.status);
      v.appendChild(badge);
    } else if (label === 'Media Sosial' && /^https?:\/\//i.test(value)) {
      const a = document.createElement('a');
      a.href = value;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.textDecoration = 'underline';
      a.textContent = value;
      v.appendChild(a);
    } else {
      v.textContent = value;
    }

    row.appendChild(l);
    row.appendChild(v);
    bookingDetailsContainer.appendChild(row);
  });

  const noteWrap = document.createElement('div');
  noteWrap.className = 'booking-note';
  const noteLabel = document.createElement('div');
  noteLabel.className = 'booking-note-label';
  noteLabel.textContent = 'Fitur yang Mau Dibahas';
  const noteText = document.createElement('div');
  noteText.className = 'booking-note-text';
  noteText.textContent = booking.features || 'Tidak ada catatan khusus.';
  noteWrap.appendChild(noteLabel);
  noteWrap.appendChild(noteText);
  bookingDetailsContainer.appendChild(noteWrap);

  if (CANCELLABLE_STATUSES.includes(booking.status)) {
    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn btn-danger btn-full';
    btnCancel.textContent = 'Batalkan Booking';
    btnCancel.addEventListener('click', () => cancelBooking(booking, btnCancel));
    bookingActionContainer.appendChild(btnCancel);
  } else if (canBook && !ACTIVE_STATUSES.includes(booking.status)) {
    appendBookButton(slot);
  }
}

async function cancelBooking(booking, button) {
  if (!confirm('Yakin ingin membatalkan booking ini? Slot tanggal akan kembali tersedia.')) return;

  button.disabled = true;
  try {
    const { error } = await client.rpc('cancel_endorser_booking', { p_booking_id: booking.id });
    if (error) throw error;
    showToast('Booking berhasil dibatalkan.');
    closeDetailView();
    await refreshAll(true);
  } catch (err) {
    button.disabled = false;
    showToast(translateError(err));
    refreshAll(true);
  }
}

// Modal Booking Handlers
function openBookingModal(slot) {
  if (!state.user) {
    showToast('Silakan login terlebih dahulu untuk melakukan booking slot.');
    setTimeout(() => {
      window.location.href = LOGIN_URL;
    }, 1200);
    return;
  }

  state.bookingSlotId = slot.id;
  modalBookingTitle.textContent = `Book Slot (${[slot.scheduled_date, slot.time_slot].filter(Boolean).join(' · ')})`;
  bookingForm.reset();
  bookingModal.classList.add('active');
  setTimeout(() => {
    const firstInput = document.getElementById('bookServerName');
    if (firstInput) firstInput.focus();
  }, 100);
}

function closeBookingModal() {
  bookingModal.classList.remove('active');
}

btnCloseBookingModal.addEventListener('click', closeBookingModal);
btnCancelBookingModal.addEventListener('click', closeBookingModal);
bookingModal.addEventListener('click', (e) => {
  if (e.target === bookingModal) closeBookingModal();
});

bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (state.isBooking || !state.bookingSlotId) return;

  const serverName = document.getElementById('bookServerName').value.trim();
  const ip = document.getElementById('bookIp').value.trim();
  const port = document.getElementById('bookPort').value.trim();
  const features = document.getElementById('bookFeatures').value.trim();
  const socialMedia = document.getElementById('bookSocialMedia').value.trim();

  if (!serverName || !ip || !port || !features || !socialMedia) {
    showToast('Mohon lengkapi seluruh isian wajib.');
    return;
  }

  if (!PORT_PATTERN.test(port)) {
    showToast('Port harus berupa angka, contoh: 25565 atau 25565 / 19132.');
    return;
  }

  if (!/^https?:\/\//i.test(socialMedia)) {
    showToast('Link media sosial harus diawali http:// atau https://.');
    return;
  }

  const targetSlot = findSlot(state.bookingSlotId);
  if (targetSlot && targetSlot.scheduled_date && targetSlot.scheduled_date < minBookableDate()) {
    showToast('Booking hanya bisa dilakukan minimal H+3 dari hari ini.');
    return;
  }

  const slotId = state.bookingSlotId;
  state.isBooking = true;
  btnSubmitBooking.disabled = true;
  btnSubmitBooking.textContent = 'Memproses...';

  try {
    const { data, error } = await client.rpc('book_endorser_slot', {
      p_slot_id: slotId,
      p_server_name: serverName,
      p_ip: ip,
      p_port: port,
      p_features: features,
      p_social_media: socialMedia
    });
    if (error) throw error;

    closeBookingModal();
    bookingForm.reset();
    showToast('Booking terkirim! Menunggu konfirmasi admin.');
    await refreshAll(true);
    openDetailView(slotId, data && data.id ? data.id : null);
  } catch (err) {
    showToast(translateError(err));
    refreshAll(true);
  } finally {
    state.isBooking = false;
    btnSubmitBooking.disabled = false;
    btnSubmitBooking.textContent = 'Konfirmasi Booking';
  }
});

// Chat handlers
function renderChat() {
  chatList.innerHTML = '';
  state.chat.messages.forEach(message => {
    const bubble = document.createElement('div');
    bubble.className = `chat-msg${message.sender_id === state.user.id ? ' mine' : ''}`;
    bubble.appendChild(document.createTextNode(message.body));
    const meta = document.createElement('span');
    meta.className = 'chat-meta';
    const sender = message.sender_id === state.user.id ? 'Anda' : 'Admin';
    const time = message.created_at ? new Date(message.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
    meta.textContent = `${sender} · ${time}`;
    bubble.appendChild(meta);
    chatList.appendChild(bubble);
  });
  chatList.scrollTop = chatList.scrollHeight;
}

function renderChatNotice(text) {
  chatList.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.textContent = text;
  chatList.appendChild(empty);
}

function addChatMessage(message) {
  if (!message || state.chat.messages.some(m => m.id === message.id)) return;
  state.chat.messages.push(message);
  renderChat();
}

function closeChat() {
  if (state.chat.channel) client.removeChannel(state.chat.channel);
  state.chat = { conversationId: null, messages: [], channel: null };
  chatCard.hidden = true;
  chatList.innerHTML = '';
}

async function openChat(conversationId) {
  if (state.chat.conversationId === conversationId) return;

  closeChat();
  state.chat.conversationId = conversationId;
  chatCard.hidden = false;
  renderChatNotice('Memuat pesan...');

  const { data, error } = await client
    .from(TABLES.messages)
    .select('id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (state.chat.conversationId !== conversationId) return;

  if (error) {
    renderChatNotice('Gagal memuat pesan.');
  } else {
    state.chat.messages = data || [];
    if (state.chat.messages.length) renderChat();
    else renderChatNotice('Belum ada pesan. Mulai diskusi mengenai persiapan video endorse.');
  }

  state.chat.channel = client
    .channel(`endorser-chat-${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: TABLES.messages,
      filter: `conversation_id=eq.${conversationId}`
    }, (payload) => addChatMessage(payload.new))
    .subscribe();
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  const conversationId = state.chat.conversationId;
  if (!text || !conversationId) return;

  chatSend.disabled = true;
  try {
    const { data, error } = await client
      .from(TABLES.messages)
      .insert({ conversation_id: conversationId, sender_id: state.user.id, body: text })
      .select('id, sender_id, body, created_at')
      .single();
    if (error) throw error;
    chatInput.value = '';
    addChatMessage(data);
  } catch (err) {
    showToast(translateError(err));
  } finally {
    chatSend.disabled = false;
    chatInput.focus();
  }
});

btnBackToCalendar.addEventListener('click', () => {
  closeDetailView();
  renderAll();
});

// Data Loading
async function loadSlots() {
  const { data, error } = await client
    .from(TABLES.slots)
    .select('*')
    .order('scheduled_date', { ascending: true })
    .order('time_slot', { ascending: true });

  if (error) throw error;
  state.slots = data || [];
}

async function loadBookings() {
  if (!state.user) {
    state.bookings = [];
    return;
  }
  const { data, error } = await client
    .from(TABLES.bookings)
    .select(`*, slot:${TABLES.slots}(*)`)
    .eq('user_id', state.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  state.bookings = data || [];
}

async function loadConversations() {
  const ids = state.bookings.map(b => b.id);
  if (!ids.length) {
    state.conversations = {};
    return;
  }

  const { data, error } = await client
    .from(TABLES.conversations)
    .select('id, booking_id')
    .in('booking_id', ids);

  if (error) {
    console.error('Conversation fetch failed:', error.message);
    state.conversations = {};
    return;
  }

  const map = {};
  (data || []).forEach(c => { map[c.booking_id] = c.id; });
  state.conversations = map;
}

function renderAll() {
  updateStats();
  renderSlotList();
  renderMyBookings();
  if (state.detail.slotId) renderDetail();
}

async function refreshAll(silent) {
  try {
    await Promise.all([loadSlots(), loadBookings()]);
    await loadConversations();
    state.loadError = null;
  } catch (err) {
    state.loadError = translateError(err);
    if (silent) console.error('Refresh failed:', err && err.message ? err.message : 'unknown error');
  }
  renderAll();
}

let refreshTimer = null;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshAll(true), 350);
}

function subscribeRealtime() {
  if (state.liveChannel || !client) return;

  const channel = client.channel('endorser-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.slots }, scheduleRefresh);

  if (state.user && state.user.id) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: TABLES.bookings, filter: `user_id=eq.${state.user.id}` }, scheduleRefresh);
  }
  channel.on('postgres_changes', { event: '*', schema: 'public', table: TABLES.conversations }, scheduleRefresh);

  state.liveChannel = channel.subscribe();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    scheduleRefresh();
  });
}

function showGateError(message) {
  gateText.textContent = message;
  gate.classList.add('error');
}

gateRetry.addEventListener('click', () => window.location.reload());

// Boot Application
async function boot() {
  if (!client) {
    showGateError('Konfigurasi Supabase belum lengkap. Isi SUPABASE_URL dan SUPABASE_ANON_KEY dengan benar.');
    return;
  }

  initMonthSelector();
  setupFilterTabs();

  let user = null;

  try {
    const { data: sessionData } = await client.auth.getSession();

    if (sessionData && sessionData.session) {
      const { data: userData, error: userError } = await client.auth.getUser();

      if (!userError && userData && userData.user) {
        user = userData.user;
      } else if (userError && userError.status >= 400 && userError.status < 500) {
        await client.auth.signOut({ scope: 'local' });
      }
    }
  } catch (err) {
    console.warn('Session verification skipped, continuing as guest:', err);
  }

  state.user = user;

  if (user) {
    const metadata = user.user_metadata || {};
    const emailName = user.email ? user.email.split('@')[0] : 'Pengguna';

    const renderName = (name) => {
      if (menuNameEl) menuNameEl.textContent = name;
    };

    renderName(String(metadata.full_name || metadata.name || emailName).trim() || emailName);
    if (menuEmailEl) menuEmailEl.textContent = user.email || '';
    if (logoutLabel) logoutLabel.textContent = 'Logout';

    try {
      const { data: profile } = await client
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
  } else {
    if (menuNameEl) menuNameEl.textContent = 'Tamu';
    if (menuEmailEl) menuEmailEl.textContent = 'Belum login';
    if (logoutLabel) logoutLabel.textContent = 'Login';
  }

  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT' && state.user) {
      window.location.replace(LOGIN_URL);
    }
  });

  await refreshAll(false);
  document.body.classList.add('ready');
  subscribeRealtime();
}

boot();
