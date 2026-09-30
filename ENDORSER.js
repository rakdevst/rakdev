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

const NOTIF = {
  table: 'notifications',
  pushTable: 'push_subscriptions',
  columns: 'id, user_id, type, title, body, booking_id, conversation_id, is_read, created_at',
  limit: 50
};
const PUSH_CONFIG = { swUrl: 'sw.js', vapidPublicKey: '' };
const NOTIF_TYPES = {
  chat_message: { label: 'Chat', badge: 'in_production' },
  booking_approved: { label: 'Disetujui', badge: 'available' },
  booking_rejected: { label: 'Ditolak', badge: 'rejected' },
  booking_status: { label: 'Status', badge: 'pending' },
  booking_progress: { label: 'Progres', badge: 'completed' }
};

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
  liveChannel: null,
  notif: { items: [], unread: 0, status: 'idle', error: '', channel: null, connected: false, open: false, marking: false },
  push: { status: 'checking', busy: false }
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
  closeNotifPanel(false);
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
    if (state.notif.status !== 'unavailable') scheduleNotifSync();
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

const bellBtn = document.getElementById('bellBtn');
const bellCount = document.getElementById('bellCount');
const notifPanel = document.getElementById('notifPanel');
const notifBackdrop = document.getElementById('notifBackdrop');
const notifList = document.getElementById('notifList');
const notifMarkAll = document.getElementById('notifMarkAll');
const notifClose = document.getElementById('notifClose');
const pushTitle = document.getElementById('pushTitle');
const pushDesc = document.getElementById('pushDesc');
const pushBtn = document.getElementById('pushBtn');

function isMissingTable(err) {
  const message = err && err.message ? String(err.message) : '';
  const code = err && err.code ? String(err.code) : '';
  return code === '42P01' || code === 'PGRST205' || /does not exist|schema cache/i.test(message);
}

function notifTimeText(iso) {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  let rel;
  if (s < 60) rel = 'Baru saja';
  else if (s < 3600) rel = `${Math.floor(s / 60)} menit lalu`;
  else if (s < 86400) rel = `${Math.floor(s / 3600)} jam lalu`;
  else rel = `${Math.floor(s / 86400)} hari lalu`;
  const abs = new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${rel} · ${abs}`;
}

function renderNotifBadge() {
  const n = state.notif.unread;
  bellCount.hidden = n < 1;
  bellCount.textContent = n > 99 ? '99+' : String(n);
  bellBtn.setAttribute('aria-label', n > 0 ? `Notifikasi, ${n} belum dibaca` : 'Notifikasi');
  notifMarkAll.disabled = n < 1;
}

function notifStateBox(text, isError) {
  notifList.innerHTML = '';
  const box = document.createElement('div');
  box.className = `notif-state${isError ? ' error' : ''}`;
  box.textContent = text;
  notifList.appendChild(box);
}

function buildNotifItem(n) {
  const meta = NOTIF_TYPES[n.type] || { label: 'Info', badge: 'cancelled' };

  const item = document.createElement('button');
  item.type = 'button';
  item.className = `notif-item${n.is_read ? '' : ' unread'}`;

  const dot = document.createElement('span');
  dot.className = 'notif-dot';
  dot.setAttribute('aria-hidden', 'true');

  const body = document.createElement('div');
  body.className = 'notif-body';

  const line = document.createElement('div');
  line.className = 'notif-line';
  const type = document.createElement('span');
  type.className = `badge badge-${meta.badge}`;
  type.textContent = meta.label;
  const title = document.createElement('span');
  title.className = 'notif-item-title';
  title.textContent = n.title || meta.label;
  line.appendChild(type);
  line.appendChild(title);
  body.appendChild(line);

  if (n.body) {
    const text = document.createElement('div');
    text.className = 'notif-text';
    text.textContent = n.body;
    body.appendChild(text);
  }

  const time = document.createElement('div');
  time.className = 'notif-time';
  time.textContent = notifTimeText(n.created_at);
  body.appendChild(time);

  item.appendChild(dot);
  item.appendChild(body);
  item.addEventListener('click', () => openNotification(n.id));
  return item;
}

function renderNotifList() {
  const ns = state.notif;
  if (ns.status === 'unavailable') {
    notifStateBox('Notifikasi belum aktif di database. Hubungi admin.', false);
    return;
  }
  if (ns.status === 'loading' && !ns.items.length) {
    notifStateBox('Memuat notifikasi...', false);
    return;
  }
  if (ns.status === 'error' && !ns.items.length) {
    notifStateBox(ns.error || 'Gagal memuat notifikasi.', true);
    return;
  }
  if (!ns.items.length) {
    notifStateBox('Belum ada notifikasi.', false);
    return;
  }
  notifList.innerHTML = '';
  ns.items.forEach(n => notifList.appendChild(buildNotifItem(n)));
}

let notifLoadSeq = 0;

async function loadUnreadCount() {
  const { count, error } = await client
    .from(NOTIF.table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', state.user.id)
    .eq('is_read', false);
  if (!error && typeof count === 'number') state.notif.unread = count;
  else state.notif.unread = state.notif.items.filter(n => !n.is_read).length;
  renderNotifBadge();
}

async function loadNotifications() {
  const ns = state.notif;
  const seq = ++notifLoadSeq;
  if (!ns.items.length) ns.status = 'loading';
  if (ns.open) renderNotifList();

  const { data, error } = await client
    .from(NOTIF.table)
    .select(NOTIF.columns)
    .eq('user_id', state.user.id)
    .order('created_at', { ascending: false })
    .limit(NOTIF.limit);

  if (seq !== notifLoadSeq) return;

  if (error) {
    if (isMissingTable(error)) {
      ns.status = 'unavailable';
      ns.items = [];
      ns.unread = 0;
    } else {
      ns.status = 'error';
      ns.error = translateError(error);
      console.error('Notification fetch failed:', error.message);
    }
    renderNotifBadge();
    renderNotifList();
    return;
  }

  ns.items = data || [];
  ns.status = 'ready';
  ns.error = '';
  await loadUnreadCount();
  if (seq !== notifLoadSeq) return;
  renderNotifList();
}

let notifSyncTimer = null;
function scheduleNotifSync() {
  clearTimeout(notifSyncTimer);
  notifSyncTimer = setTimeout(() => loadNotifications(), 500);
}

let notifCountTimer = null;
function scheduleNotifCount() {
  clearTimeout(notifCountTimer);
  notifCountTimer = setTimeout(() => {
    if (state.notif.status === 'ready') loadUnreadCount();
  }, 450);
}

function upsertNotif(n) {
  const ns = state.notif;
  const index = ns.items.findIndex(x => x.id === n.id);
  if (index >= 0) {
    ns.items[index] = { ...ns.items[index], ...n };
    return false;
  }
  ns.items.push(n);
  ns.items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (ns.items.length > NOTIF.limit) ns.items.length = NOTIF.limit;
  return true;
}

function isViewingConversation(conversationId) {
  return !!conversationId
    && state.chat.conversationId === conversationId
    && !detailView.classList.contains('hidden')
    && document.visibilityState === 'visible';
}

async function markNotifRead(ids, silent) {
  const ns = state.notif;
  const targets = ns.items.filter(n => ids.includes(n.id) && !n.is_read).map(n => n.id);
  if (!targets.length) return true;

  const { error } = await client
    .from(NOTIF.table)
    .update({ is_read: true })
    .in('id', targets)
    .eq('user_id', state.user.id);

  if (error) {
    if (!silent) showToast(translateError(error));
    return false;
  }

  ns.items.forEach(n => { if (targets.includes(n.id)) n.is_read = true; });
  ns.unread = Math.max(0, ns.unread - targets.length);
  renderNotifBadge();
  renderNotifList();
  scheduleNotifCount();
  return true;
}

async function markAllNotifRead() {
  const ns = state.notif;
  if (ns.unread < 1 || ns.marking) return;

  ns.marking = true;
  notifMarkAll.disabled = true;
  const { error } = await client
    .from(NOTIF.table)
    .update({ is_read: true })
    .eq('user_id', state.user.id)
    .eq('is_read', false);
  ns.marking = false;

  if (error) {
    showToast(translateError(error));
    renderNotifBadge();
    return;
  }

  ns.items.forEach(n => { n.is_read = true; });
  ns.unread = 0;
  renderNotifBadge();
  renderNotifList();
  scheduleNotifCount();
}

function onNotifInsert(payload) {
  const n = payload && payload.new;
  const ns = state.notif;
  if (!n || !n.id || n.user_id !== state.user.id) return;
  if (n.type === 'chat_message' && n.sender_id && n.sender_id === state.user.id) return;

  const isNew = upsertNotif(n);
  if (!isNew) {
    renderNotifList();
    return;
  }

  if (!n.is_read) {
    ns.unread += 1;
    if (n.type === 'chat_message' && isViewingConversation(n.conversation_id)) {
      markNotifRead([n.id], true);
    } else {
      const meta = NOTIF_TYPES[n.type];
      showToast(n.title || (meta ? meta.label : 'Notifikasi baru'));
    }
  }

  renderNotifBadge();
  renderNotifList();
  scheduleNotifCount();
}

function onNotifUpdate(payload) {
  const n = payload && payload.new;
  if (!n || !n.id || n.user_id !== state.user.id) return;
  if (state.notif.items.some(x => x.id === n.id)) upsertNotif(n);
  renderNotifList();
  scheduleNotifCount();
}

function subscribeNotifRealtime() {
  const ns = state.notif;
  if (ns.channel) {
    client.removeChannel(ns.channel);
    ns.channel = null;
  }

  const uid = state.user.id;
  const filter = `user_id=eq.${uid}`;
  ns.channel = client
    .channel(`endorser-notif-${uid}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: NOTIF.table, filter }, onNotifInsert)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: NOTIF.table, filter }, onNotifUpdate)
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      if (ns.connected) scheduleNotifSync();
      ns.connected = true;
    });
}

function findBookingForNotif(n) {
  if (n.booking_id) {
    const byBooking = state.bookings.find(b => b.id === n.booking_id);
    if (byBooking) return byBooking;
  }
  if (n.conversation_id) {
    const bookingId = Object.keys(state.conversations).find(k => state.conversations[k] === n.conversation_id);
    if (bookingId) return state.bookings.find(b => b.id === bookingId) || null;
  }
  return null;
}

async function openNotifTarget(n) {
  if (!n.booking_id && !n.conversation_id) return;

  let booking = findBookingForNotif(n);
  if (!booking) {
    await refreshAll(true);
    booking = findBookingForNotif(n);
  }
  if (!booking) {
    showToast('Booking terkait tidak ditemukan atau sudah dihapus.');
    return;
  }

  openDetailView(booking.slot_id, booking.id);
  if (n.type === 'chat_message') {
    setTimeout(() => { if (!chatCard.hidden) chatCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 60);
  }
}

async function openNotification(id) {
  const n = state.notif.items.find(x => x.id === id);
  if (!n) return;
  if (!n.is_read) markNotifRead([id], true);
  closeNotifPanel(false);
  await openNotifTarget(n);
}

function openNotifPanel() {
  closeMenu(false);
  state.notif.open = true;
  notifPanel.classList.add('open');
  notifPanel.setAttribute('aria-hidden', 'false');
  notifBackdrop.classList.add('show');
  document.body.classList.add('notif-open');
  bellBtn.setAttribute('aria-expanded', 'true');
  renderNotifList();
  loadNotifications();
  refreshPushState();
  notifClose.focus();
}

function closeNotifPanel(returnFocus) {
  if (!state.notif.open) return;
  state.notif.open = false;
  notifPanel.classList.remove('open');
  notifPanel.setAttribute('aria-hidden', 'true');
  notifBackdrop.classList.remove('show');
  document.body.classList.remove('notif-open');
  bellBtn.setAttribute('aria-expanded', 'false');
  if (returnFocus) bellBtn.focus();
}

bellBtn.addEventListener('click', () => {
  if (state.notif.open) closeNotifPanel(true);
  else openNotifPanel();
});
notifClose.addEventListener('click', () => closeNotifPanel(true));
notifBackdrop.addEventListener('click', () => closeNotifPanel(false));
notifMarkAll.addEventListener('click', markAllNotifRead);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.notif.open) closeNotifPanel(true);
});

function pushSupported() {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

function withTimeout(promise, ms, code) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(code)), ms))]);
}

const PUSH_COPY = {
  checking: ['Push notification', 'Memeriksa perangkat...'],
  unsupported: ['Push tidak tersedia', 'Browser ini tidak mendukung push. Di iPhone atau iPad, push hanya bisa dipakai setelah situs ditambahkan ke Layar Utama.'],
  denied: ['Push diblokir', 'Izin notifikasi diblokir. Ubah izin situs di pengaturan browser.'],
  unconfigured: ['Push belum tersedia', 'Layanan push di server belum disiapkan.'],
  off: ['Push nonaktif', 'Aktifkan untuk mendaftarkan perangkat ini menerima push.'],
  on: ['Push aktif', 'Perangkat ini terdaftar. Pengiriman push bergantung pada layanan di server.']
};

function renderPushBox() {
  const p = state.push;
  const copy = PUSH_COPY[p.status] || PUSH_COPY.checking;
  pushTitle.textContent = copy[0];
  pushDesc.textContent = copy[1];
  pushBtn.textContent = p.busy ? 'Memproses...' : (p.status === 'on' ? 'Nonaktifkan' : 'Aktifkan');
  pushBtn.disabled = p.busy || !(p.status === 'on' || p.status === 'off');
}

async function getPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function refreshPushState() {
  const p = state.push;
  if (!pushSupported()) {
    p.status = 'unsupported';
  } else if (Notification.permission === 'denied') {
    p.status = 'denied';
  } else if (!PUSH_CONFIG.vapidPublicKey) {
    p.status = 'unconfigured';
  } else {
    p.status = 'off';
    try {
      const sub = await getPushSubscription();
      if (sub) {
        const { data, error } = await client
          .from(NOTIF.pushTable)
          .select('endpoint')
          .eq('user_id', state.user.id)
          .eq('endpoint', sub.endpoint)
          .limit(1);
        if (!error && data && data.length) p.status = 'on';
      }
    } catch (err) {
      console.error('Push state check failed:', err && err.message ? err.message : 'unknown error');
    }
  }
  renderPushBox();
}

function pushErrorText(err) {
  const message = err && err.message ? String(err.message) : '';
  if (message === 'push_not_configured') return 'Push belum dikonfigurasi di server.';
  if (message === 'sw_missing') return 'File Service Worker belum tersedia di server.';
  if (message === 'sw_timeout') return 'Service Worker belum aktif. Coba lagi nanti.';
  if (err && err.name === 'NotAllowedError') return 'Izin notifikasi ditolak.';
  if (isMissingTable(err)) return 'Tabel langganan push belum tersedia di database.';
  return translateError(err);
}

async function enablePush() {
  const p = state.push;
  if (p.busy || p.status !== 'off') return;

  p.busy = true;
  renderPushBox();
  let sub = null;

  try {
    if (!PUSH_CONFIG.vapidPublicKey) throw new Error('push_not_configured');

    const probe = await fetch(PUSH_CONFIG.swUrl, { method: 'HEAD', cache: 'no-store' });
    if (!probe.ok) throw new Error('sw_missing');

    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast(permission === 'denied' ? 'Izin notifikasi diblokir di browser.' : 'Izin notifikasi belum diberikan.');
      return;
    }

    const reg = await navigator.serviceWorker.register(PUSH_CONFIG.swUrl);
    await withTimeout(navigator.serviceWorker.ready, 8000, 'sw_timeout');

    sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUSH_CONFIG.vapidPublicKey)
      });
    }

    const json = sub.toJSON();
    const { error } = await client.from(NOTIF.pushTable).upsert({
      user_id: state.user.id,
      endpoint: json.endpoint,
      p256dh: json.keys && json.keys.p256dh,
      auth: json.keys && json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 250)
    }, { onConflict: 'endpoint' });
    if (error) throw error;

    showToast('Perangkat ini terdaftar untuk push notification.');
  } catch (err) {
    if (sub) {
      try { await sub.unsubscribe(); } catch (e) { console.error('Unsubscribe failed:', e && e.message ? e.message : 'unknown error'); }
    }
    showToast(pushErrorText(err));
  } finally {
    p.busy = false;
    await refreshPushState();
  }
}

async function disablePush(silent) {
  const p = state.push;
  if (p.busy) return;

  p.busy = true;
  if (!silent) renderPushBox();

  try {
    const sub = await getPushSubscription();
    if (sub) {
      const { error } = await client
        .from(NOTIF.pushTable)
        .delete()
        .eq('user_id', state.user.id)
        .eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
      if (!silent) {
        showToast(error
          ? 'Push dimatikan di perangkat ini, tetapi catatan di server belum terhapus.'
          : 'Push notification dinonaktifkan.');
      }
    }
  } catch (err) {
    if (!silent) showToast(pushErrorText(err));
  } finally {
    p.busy = false;
    if (!silent) await refreshPushState();
  }
}

pushBtn.addEventListener('click', () => {
  if (state.push.status === 'on') disablePush(false);
  else enablePush();
});

function handleHashRoute() {
  const match = /^#booking=([0-9a-f-]{36})$/i.exec(window.location.hash);
  if (!match) return;
  history.replaceState(null, '', window.location.pathname + window.location.search);
  openNotifTarget({ booking_id: match[1] });
}

async function initNotifications() {
  renderNotifBadge();
  renderPushBox();
  await loadNotifications();
  if (state.notif.status !== 'unavailable') subscribeNotifRealtime();
  refreshPushState();
  window.addEventListener('hashchange', handleHashRoute);
  handleHashRoute();
}

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
  await initNotifications();
}

boot();
