(function () {
  try {
    const p = window.location.pathname;
    if (/(?:ENDORSER|endorser)\.html$/i.test(p)) {
      const cleanPath = p.replace(/\/?(?:ENDORSER|endorser)\.html$/i, '') + '/endorser';
      window.history.replaceState(null, '', (cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath) + window.location.search + window.location.hash);
    }
  } catch (e) {}
})();

const SUPABASE_URL = 'https://ymnshvqbucjelhzqxpsz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hrrKVBWFgVQNDQxy1ei-IA_WTRRLbuW';
const LOGIN_URL = 'login.html';

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
const dayNamesShort = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];

const STATUS_LABEL = {
  available: 'AVAILABLE',
  pending: 'MENUNGGU',
  approved: 'DISETUJUI',
  rejected: 'DITOLAK',
  in_production: 'PRODUKSI',
  completed: 'PUBLISHED',
  cancelled: 'DIBATALKAN'
};

const now = new Date();
const state = {
  user: null,
  slots: [],
  bookings: [],
  conversations: {},
  viewYear: now.getFullYear(),
  viewMonth: now.getMonth(),
  loadError: null,
  detail: { slotId: null, bookingId: null },
  bookingSlotId: null,
  isBooking: false,
  chat: { conversationId: null, messages: [], channel: null },
  liveChannel: null
};

const gate = document.getElementById('gate');
const gateText = document.getElementById('gateText');
const gateRetry = document.getElementById('gateRetry');
const calendarView = document.getElementById('calendarView');
const detailView = document.getElementById('detailView');
const calendarGridBody = document.getElementById('calendarGridBody');
const calendarMonthTitle = document.getElementById('calendarMonthTitle');
const calendarWorkload = document.getElementById('calendarWorkload');
const calendarNotice = document.getElementById('calendarNotice');
const btnPrevMonth = document.getElementById('btnPrevMonth');
const btnNextMonth = document.getElementById('btnNextMonth');
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

yearEl.textContent = new Date().getFullYear();

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

  if (state.push.status === 'on') {
    try {
      await disablePush(true);
    } catch (err) {
      console.error('Push cleanup failed:', err && err.message ? err.message : 'unknown error');
    }
  }

  let result;
  try {
    result = await client.auth.signOut();
  } catch (err) {
    result = { error: err };
  }

  if (result && result.error) {
    try {
      await client.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('Logout failed:', err && err.message ? err.message : 'unknown error');
    }
  }

  window.location.replace(LOGIN_URL);
});

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
  return `badge badge-${STATUS_LABEL[status] ? status : 'cancelled'}`;
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

function animateMetric(el, value) {
  if (el.textContent === String(value)) return;
  el.textContent = value;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function updateMetrics(total, booked, inProd) {
  const occ = total > 0 ? Math.round((booked / total) * 100) : 0;
  animateMetric(document.getElementById('metricTotalBooked'), booked);
  animateMetric(document.getElementById('metricOccupancy'), `${occ}%`);
  animateMetric(document.getElementById('metricInProduction'), inProd);
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

function cardFootInfo(slot, status) {
  if (status === 'available') return { left: slot.time_slot || '', right: '', showBar: false };
  if (status === 'pending') return { left: 'Menunggu konfirmasi', right: '', showBar: false };
  if (PROGRESS_STATUSES.includes(status)) {
    return { left: slot.current_phase || '-', right: `${clampProgress(slot)}%`, showBar: true };
  }
  return { left: statusLabel(status), right: '', showBar: false };
}

function buildSlotCard(slot) {
  const booking = ownBookingForSlot(slot.id);
  const status = booking ? booking.status : slot.status;
  const info = cardFootInfo(slot, status);

  const card = document.createElement('div');
  card.className = 'slot-card';
  card.setAttribute('role', 'button');
  card.tabIndex = 0;

  const top = document.createElement('div');
  const badge = document.createElement('span');
  badge.className = badgeClass(status);
  badge.textContent = statusLabel(status);
  const name = document.createElement('div');
  name.className = 'slot-name';
  name.style.marginTop = '.3rem';
  name.textContent = slotTitle(slot, booking);
  top.appendChild(badge);
  top.appendChild(name);

  const bottom = document.createElement('div');
  const foot = document.createElement('div');
  foot.className = 'slot-foot';
  const leftSpan = document.createElement('span');
  leftSpan.textContent = info.left;
  const rightSpan = document.createElement('span');
  rightSpan.className = 'mono';
  rightSpan.textContent = info.right;
  foot.appendChild(leftSpan);
  foot.appendChild(rightSpan);
  bottom.appendChild(foot);

  if (info.showBar) {
    const bar = document.createElement('div');
    bar.className = 'slot-bar';
    const fill = document.createElement('div');
    fill.className = 'slot-bar-fill';
    fill.style.width = `${clampProgress(slot)}%`;
    bar.appendChild(fill);
    bottom.appendChild(bar);
  }

  card.appendChild(top);
  card.appendChild(bottom);

  const open = () => openDetailView(slot.id, booking ? booking.id : null);
  card.addEventListener('click', open);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });
  return card;
}

function renderCalendar() {
  calendarGridBody.innerHTML = '';

  const todayIso = formatDateToLocalISO(new Date());
  const year = state.viewYear;
  const month = state.viewMonth;
  calendarMonthTitle.textContent = `${monthNames[month]} ${year}`;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDayOfWeek = new Date(year, month, 1).getDay();

  const slotsByDate = {};
  state.slots.forEach(slot => {
    (slotsByDate[slot.scheduled_date] = slotsByDate[slot.scheduled_date] || []).push(slot);
  });

  for (let i = 0; i < startDayOfWeek; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell empty';
    calendarGridBody.appendChild(cell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDateToLocalISO(new Date(year, month, day));
    const daySlots = slotsByDate[dateStr] || [];

    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (dateStr === todayIso) cell.classList.add('today');
    if (!daySlots.length) cell.classList.add('no-slot');

    const top = document.createElement('div');
    top.className = 'day-top';
    const num = document.createElement('span');
    num.className = 'day-num';
    num.textContent = day;
    const tag = document.createElement('span');
    tag.className = 'day-tag';
    tag.textContent = dateStr === todayIso ? 'HARI INI' : (daySlots.length ? 'EST. UPLOAD' : '');
    top.appendChild(num);
    top.appendChild(tag);
    cell.appendChild(top);

    if (daySlots.length) {
      const wrap = document.createElement('div');
      wrap.className = 'day-slots';
      daySlots.forEach(slot => wrap.appendChild(buildSlotCard(slot)));
      cell.appendChild(wrap);
    }

    calendarGridBody.appendChild(cell);
  }

  const totalSlots = state.slots.length;
  const totalBooked = state.slots.filter(s => ACTIVE_STATUSES.includes(s.status)).length;
  const totalInProd = state.slots.filter(s => s.status === 'in_production').length;

  let loadLabel = 'Normal';
  if (totalBooked > 10) loadLabel = 'Tinggi';
  else if (totalBooked > 5) loadLabel = 'Sedang';
  calendarWorkload.innerHTML = '';
  const loadText = document.createTextNode(`Beban Kerja: ${loadLabel} · `);
  const loadMono = document.createElement('span');
  loadMono.className = 'mono';
  loadMono.textContent = `${totalBooked}/${totalSlots}`;
  calendarWorkload.appendChild(loadText);
  calendarWorkload.appendChild(loadMono);

  updateMetrics(totalSlots, totalBooked, totalInProd);

  if (state.loadError) {
    calendarNotice.textContent = state.loadError;
    calendarNotice.className = 'calendar-notice error';
    calendarNotice.hidden = false;
  } else if (!totalSlots) {
    calendarNotice.textContent = 'Belum ada slot pada bulan ini.';
    calendarNotice.className = 'calendar-notice';
    calendarNotice.hidden = false;
  } else {
    calendarNotice.hidden = true;
  }
}

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

function showCalendarView() {
  detailView.classList.add('hidden');
  calendarView.classList.remove('hidden');
}

function closeDetailView() {
  state.detail = { slotId: null, bookingId: null };
  closeChat();
  showCalendarView();
}

function openDetailView(slotId, bookingId) {
  state.detail = { slotId, bookingId: bookingId || null };
  renderDetail();
  if (!state.detail.slotId) return;
  calendarView.classList.add('hidden');
  detailView.classList.remove('hidden');
  window.scrollTo(0, 0);
}

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
  hb.style.fontSize = '.68rem';
  hb.style.padding = '.28rem .6rem';
  hb.textContent = statusLabel(status);
  detailHeaderBadge.appendChild(hb);

  detailServerName.textContent = slotTitle(slot, booking);
  detailCategory.textContent = slot.category || '-';
  detailScheduledDate.textContent = slot.scheduled_date || '-';
  detailTimeSlot.textContent = slot.time_slot || '-';
  detailContentType.textContent = slot.content_type || '-';
  detailDescription.textContent = slot.description || 'Tidak ada deskripsi.';

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
      appendEmptyState('Slot ini masih tersedia.');
      appendBookButton(slot);
    } else if (slot.status === 'available' && isPast) {
      appendEmptyState('Tanggal slot ini sudah lewat.');
    } else if (slot.status === 'available') {
      appendEmptyState('Booking dibuka minimal H+3 dari hari ini.');
    } else {
      appendEmptyState('Slot ini sudah dipesan.');
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
  noteText.textContent = booking.features || 'Tidak ada catatan.';
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

function openBookingModal(slot) {
  state.bookingSlotId = slot.id;
  modalBookingTitle.textContent = `Book Slot Upload (${[slot.scheduled_date, slot.time_slot].filter(Boolean).join(' · ')})`;
  bookingForm.reset();
  bookingModal.classList.add('active');
}

function closeBookingModal() {
  bookingModal.classList.remove('active');
}

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
    else renderChatNotice('Belum ada pesan.');
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

async function loadSlots() {
  const year = state.viewYear;
  const month = state.viewMonth;
  const start = formatDateToLocalISO(new Date(year, month, 1));
  const end = formatDateToLocalISO(new Date(year, month + 1, 0));

  const { data, error } = await client
    .from(TABLES.slots)
    .select('*')
    .gte('scheduled_date', start)
    .lte('scheduled_date', end)
    .order('scheduled_date', { ascending: true })
    .order('time_slot', { ascending: true });

  if (error) throw error;
  if (year !== state.viewYear || month !== state.viewMonth) return;
  state.slots = data || [];
}

async function loadBookings() {
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
  renderCalendar();
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

async function changeMonth(delta) {
  const target = new Date(state.viewYear, state.viewMonth + delta, 1);
  state.viewYear = target.getFullYear();
  state.viewMonth = target.getMonth();
  try {
    await loadSlots();
    state.loadError = null;
  } catch (err) {
    state.slots = [];
    state.loadError = translateError(err);
  }
  renderCalendar();
}

let refreshTimer = null;
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshAll(true), 350);
}

function subscribeRealtime() {
  if (state.liveChannel) return;

  state.liveChannel = client
    .channel('endorser-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.slots }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.bookings, filter: `user_id=eq.${state.user.id}` }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLES.conversations }, scheduleRefresh)
    .subscribe();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    scheduleRefresh();
  });
}

btnPrevMonth.addEventListener('click', () => changeMonth(-1));
btnNextMonth.addEventListener('click', () => changeMonth(1));

btnBackToCalendar.addEventListener('click', () => {
  closeDetailView();
  renderAll();
});

btnCloseBookingModal.addEventListener('click', closeBookingModal);
btnCancelBookingModal.addEventListener('click', closeBookingModal);
bookingModal.addEventListener('click', (e) => { if (e.target === bookingModal) closeBookingModal(); });

bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (state.isBooking || !state.bookingSlotId) return;

  const serverName = document.getElementById('bookServerName').value.trim();
  const ip = document.getElementById('bookIp').value.trim();
  const port = document.getElementById('bookPort').value.trim();
  const features = document.getElementById('bookFeatures').value.trim();
  const socialMedia = document.getElementById('bookSocialMedia').value.trim();

  if (!serverName || !ip || !port || !features || !socialMedia) {
    showToast('Mohon lengkapi seluruh field wajib.');
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
    showToast('Booking terkirim. Menunggu konfirmasi admin.');
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

function showGateError(message) {
  gateText.textContent = message;
  gate.classList.add('error');
}

gateRetry.addEventListener('click', () => window.location.reload());

async function boot() {
  if (!client) {
    showGateError('Konfigurasi Supabase belum lengkap. Isi SUPABASE_URL dan SUPABASE_ANON_KEY dengan benar.');
    return;
  }

  let user = null;

  try {
    const { data: sessionData } = await client.auth.getSession();

    if (sessionData && sessionData.session) {
      const { data: userData, error: userError } = await client.auth.getUser();

      if (!userError && userData && userData.user) {
        user = userData.user;
      } else if (userError && userError.status >= 400 && userError.status < 500) {
        await client.auth.signOut({ scope: 'local' });
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

  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.replace(LOGIN_URL);
  });

  await refreshAll(false);
  document.body.classList.add('ready');
  subscribeRealtime();
}

boot();
