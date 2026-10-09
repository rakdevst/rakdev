import { 
  supabase, 
  rakDb,
  initSmartNavbar, 
  bindLogoutButton, 
  showToast, 
  getCurrentUser,
  renderSlotSkeletons,
  renderErrorCard
} from '/shared/supabaseClient.js';

// DOM Elements
const gate = document.getElementById('gate');
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
const scrim = document.getElementById('scrim');
const menuClose = document.getElementById('menuClose');

// Views
const slotListView = document.getElementById('slotListView');
const detailView = document.getElementById('detailView');
const btnBackToCalendar = document.getElementById('btnBackToCalendar');

// Metrics
const metricTotalSlots = document.getElementById('metricTotalSlots');
const metricAvailable = document.getElementById('metricAvailable');
const metricTotalBooked = document.getElementById('metricTotalBooked');
const metricInProduction = document.getElementById('metricInProduction');

// Counts
const countAll = document.getElementById('countAll');
const countAvail = document.getElementById('countAvail');
const countBooked = document.getElementById('countBooked');
const countMine = document.getElementById('countMine');

// Slot Container
const slotListContainer = document.getElementById('slotListContainer');
const slotNotice = document.getElementById('slotNotice');
const myBookings = document.getElementById('myBookings');
const myBookingsList = document.getElementById('myBookingsList');

// Filter Buttons
const filterAllBtn = document.getElementById('filterAllBtn');
const filterAvailBtn = document.getElementById('filterAvailBtn');
const filterBookedBtn = document.getElementById('filterBookedBtn');
const filterMineBtn = document.getElementById('filterMineBtn');

// Booking Modal
const bookingModal = document.getElementById('bookingModal');
const btnCloseBookingModal = document.getElementById('btnCloseBookingModal');
const btnCancelBookingModal = document.getElementById('btnCancelBookingModal');
const bookingForm = document.getElementById('bookingForm');
const btnSubmitBooking = document.getElementById('btnSubmitBooking');

// Detail elements
const detailHeaderBadge = document.getElementById('detailHeaderBadge');
const detailServerName = document.getElementById('detailServerName');
const detailScheduledDate = document.getElementById('detailScheduledDate');
const detailTimeSlot = document.getElementById('detailTimeSlot');
const detailContentType = document.getElementById('detailContentType');
const detailDescription = document.getElementById('detailDescription');
const progressCard = document.getElementById('progressCard');
const detailPhaseBadge = document.getElementById('detailPhaseBadge');
const detailCurrentPhaseName = document.getElementById('detailCurrentPhaseName');
const detailProgressPercent = document.getElementById('detailProgressPercent');
const detailProgressFill = document.getElementById('detailProgressFill');
const bookingDetailsContainer = document.getElementById('bookingDetailsContainer');
const bookingActionContainer = document.getElementById('bookingActionContainer');

// Chat
const chatCard = document.getElementById('chatCard');
const chatList = document.getElementById('chatList');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

// State
let allSlots = [];
let userBookings = [];
let currentFilter = 'all';
let selectedSlot = null;
let currentChatConversationId = null;
let chatChannel = null;
let currentUser = null;

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

// Filter logic
function setFilter(filter) {
  currentFilter = filter;
  [filterAllBtn, filterAvailBtn, filterBookedBtn, filterMineBtn].forEach(b => b.classList.remove('active'));
  
  if (filter === 'all') filterAllBtn.classList.add('active');
  if (filter === 'available') filterAvailBtn.classList.add('active');
  if (filter === 'booked') filterBookedBtn.classList.add('active');
  if (filter === 'mine') filterMineBtn.classList.add('active');

  renderSlots();
}

filterAllBtn.addEventListener('click', () => setFilter('all'));
filterAvailBtn.addEventListener('click', () => setFilter('available'));
filterBookedBtn.addEventListener('click', () => setFilter('booked'));
filterMineBtn.addEventListener('click', () => setFilter('mine'));

// Render Slots
function renderSlots() {
  let filtered = allSlots;

  if (currentFilter === 'available') {
    filtered = allSlots.filter(s => s.status === 'available');
  } else if (currentFilter === 'booked') {
    filtered = allSlots.filter(s => s.status !== 'available');
  } else if (currentFilter === 'mine') {
    const mySlotIds = userBookings.map(b => b.slot_id);
    filtered = allSlots.filter(s => mySlotIds.includes(s.id));
  }

  if (filtered.length === 0) {
    slotListContainer.innerHTML = '';
    if (currentFilter === 'mine') {
      slotNotice.textContent = 'Anda belum memiliki booking slot.';
    } else if (allSlots.length === 0) {
      slotNotice.innerHTML = `
        <div style="padding:1rem;text-align:center">
          <p style="margin-bottom:0.5rem;font-weight:600">Belum ada slot endorser yang terdaftar di database.</p>
          <p style="font-size:0.8rem;color:var(--ink-soft)">
            Silakan periksa kembali beberapa saat lagi atau hubungi tim rakDEV Studio.
          </p>
        </div>
      `;
    } else {
      slotNotice.textContent = 'Belum ada slot pada kategori ini.';
    }
    slotNotice.hidden = false;
    return;
  }

  slotNotice.hidden = true;
  slotListContainer.innerHTML = filtered.map(slot => {
    const dateFormatted = new Date(slot.scheduled_date + 'T00:00:00').toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    let badgeClass = 'badge-available';
    let statusText = 'Available';
    if (slot.status === 'in_production') {
      badgeClass = 'badge-in_production';
      statusText = 'Dikerjakan';
    } else if (slot.status === 'completed') {
      badgeClass = 'badge-completed';
      statusText = 'Selesai';
    } else if (slot.status !== 'available') {
      badgeClass = 'badge-booked';
      statusText = 'Booked';
    }

    const priceText = slot.price_idr ? `Rp ${Number(slot.price_idr).toLocaleString('id-ID')}` : 'Gratis / Nego';

    return `
      <div class="slot-card" data-slot-id="${slot.id}">
        <div class="slot-card-header">
          <span class="slot-date">${dateFormatted}</span>
          <span class="badge ${badgeClass}">${statusText}</span>
        </div>
        <div class="slot-platform">${escapeHtml(slot.platform || 'TikTok')} &bull; ${escapeHtml(slot.content_type || 'Shorts')}</div>
        <div class="slot-time">${escapeHtml(slot.time_slot || 'Malam (19:00 - 21:00 WIB)')}</div>
        ${slot.server_name ? `<div class="slot-server-booked">Server: ${escapeHtml(slot.server_name)}</div>` : ''}
        <div style="font-size:0.78rem;font-weight:700;color:var(--ink);margin-top:auto">Tarif: ${priceText}</div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.slot-card').forEach(card => {
    card.addEventListener('click', () => {
      const slotId = card.getAttribute('data-slot-id');
      const slot = allSlots.find(s => s.id === slotId);
      if (slot) showSlotDetail(slot);
    });
  });
}

// Show Detail View
async function showSlotDetail(slot) {
  selectedSlot = slot;
  slotListView.classList.add('hidden');
  detailView.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const dateFormatted = new Date(slot.scheduled_date + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  detailServerName.textContent = slot.server_name || 'Slot Terbuka Untuk Booking';
  detailScheduledDate.textContent = dateFormatted;
  detailTimeSlot.textContent = slot.time_slot || '-';
  detailContentType.textContent = `${slot.platform || 'TikTok'} (${slot.content_type || 'Shorts'})`;
  detailDescription.textContent = slot.description || 'Slot endorser resmi dari rakDEV Studio untuk promosi server Minecraft Java Edition Anda.';

  let badgeClass = 'badge-available';
  let statusText = 'Available';
  if (slot.status === 'in_production') { badgeClass = 'badge-in_production'; statusText = 'Dikerjakan'; }
  else if (slot.status === 'completed') { badgeClass = 'badge-completed'; statusText = 'Selesai'; }
  else if (slot.status !== 'available') { badgeClass = 'badge-booked'; statusText = 'Booked'; }

  detailHeaderBadge.innerHTML = `<span class="badge ${badgeClass}">${statusText}</span>`;

  // Progress Card
  if (slot.status === 'in_production' || slot.status === 'completed') {
    progressCard.hidden = false;
    const pct = slot.progress_percent || (slot.status === 'completed' ? 100 : 50);
    detailPhaseBadge.className = `badge ${badgeClass}`;
    detailPhaseBadge.textContent = slot.current_phase || 'In Progress';
    detailCurrentPhaseName.textContent = `Fase: ${slot.current_phase || 'Pengerjaan Video'}`;
    detailProgressPercent.textContent = `${pct}%`;
    detailProgressFill.style.width = `${pct}%`;
  } else {
    progressCard.hidden = true;
  }

  // Booking Actions & Info
  bookingDetailsContainer.innerHTML = '';
  bookingActionContainer.innerHTML = '';

  const booking = userBookings.find(b => b.slot_id === slot.id);

  if (slot.status === 'available') {
    bookingDetailsContainer.innerHTML = `
      <div style="font-size:0.84rem;color:var(--ink-soft);line-height:1.5">
        Slot ini masih tersedia! Anda dapat langsung mengajukan pendaftaran server Minecraft Anda untuk slot tanggal ini.
      </div>
    `;
    bookingActionContainer.innerHTML = `
      <button type="button" class="btn btn-primary" id="btnOpenBookingModal" style="width:100%">
        Pesan / Book Slot Ini
      </button>
    `;
    document.getElementById('btnOpenBookingModal')?.addEventListener('click', openBookingModal);
    chatCard.hidden = true;
  } else {
    // Booked
    if (booking) {
      bookingDetailsContainer.innerHTML = `
        <div style="font-size:0.84rem;line-height:1.6">
          <div><b>Server Anda:</b> ${escapeHtml(booking.server_name)}</div>
          <div><b>IP:</b> <span class="mono">${escapeHtml(booking.server_ip)}:${escapeHtml(booking.server_port || '25565')}</span></div>
          <div><b>Status Booking:</b> <span class="badge ${badgeClass}">${statusText}</span></div>
        </div>
      `;
      // Buka fitur chat realtime untuk booking ini
      initRealtimeChat(booking.id);
    } else {
      bookingDetailsContainer.innerHTML = `
        <div style="font-size:0.84rem;color:var(--ink-soft)">
          Slot ini telah dipesan oleh server lain. Silakan pilih slot tanggal lain yang bertanda <b>Available</b>.
        </div>
      `;
      chatCard.hidden = true;
    }
  }
}

btnBackToCalendar.addEventListener('click', () => {
  detailView.classList.add('hidden');
  slotListView.classList.remove('hidden');
  if (chatChannel) {
    supabase.removeChannel(chatChannel);
    chatChannel = null;
  }
});

// Modal Booking
function openBookingModal() {
  if (!currentUser) {
    showToast('Silakan login terlebih dahulu untuk memesan slot.');
    const returnUrl = `/endorser?slot_id=${selectedSlot ? selectedSlot.id : ''}`;
    window.location.href = `/login.html?redirect=${encodeURIComponent(returnUrl)}`;
    return;
  }
  bookingModal.classList.add('open');
}

function closeBookingModal() {
  bookingModal.classList.remove('open');
}

btnCloseBookingModal.addEventListener('click', closeBookingModal);
btnCancelBookingModal.addEventListener('click', closeBookingModal);

bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedSlot || !currentUser) return;

  const serverName = document.getElementById('bookServerName').value.trim();
  const serverIp = document.getElementById('bookIp').value.trim();
  const serverPort = document.getElementById('bookPort').value.trim() || '25565';
  const features = document.getElementById('bookFeatures').value.trim();
  const socialMedia = document.getElementById('bookSocialMedia').value.trim();

  btnSubmitBooking.disabled = true;
  btnSubmitBooking.textContent = 'Memproses...';

  try {
    const booking = await rakDb.bookSlot({
      slot_id: selectedSlot.id,
      server_name: serverName,
      server_ip: serverIp,
      server_port: serverPort,
      features,
      social_media: socialMedia,
      user: currentUser
    });

    showToast('Booking berhasil diajukan!');
    closeBookingModal();
    bookingForm.reset();

    // Reload data
    await loadEndorserData();
    const updated = allSlots.find(s => s.id === selectedSlot.id);
    if (updated) showSlotDetail(updated);
  } catch (err) {
    showToast(err.message || 'Gagal mengajukan booking');
  } finally {
    btnSubmitBooking.disabled = false;
    btnSubmitBooking.textContent = 'Konfirmasi Booking';
  }
});

// Realtime Chat Implementation
async function initRealtimeChat(bookingId) {
  chatCard.hidden = false;
  chatList.innerHTML = '<div style="font-size:0.75rem;color:var(--ink-soft);text-align:center">Memuat chat...</div>';

  try {
    const conv = await rakDb.getConversation(bookingId);
    if (!conv) return;
    currentChatConversationId = conv.id;

    // Muat pesan sebelumnya
    const messages = await rakDb.getMessages(conv.id);
    renderChatMessages(messages || []);

    // Pasang Realtime Listener jika Supabase aktif
    if (supabase) {
      if (chatChannel) supabase.removeChannel(chatChannel);
      chatChannel = supabase
        .channel(`chat_${conv.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conv.id}`
        }, (payload) => {
          appendChatMessage(payload.new);
        })
        .subscribe();
    }
  } catch (e) {
    chatList.innerHTML = '<div style="font-size:0.75rem;color:var(--ink-soft)">Chat belum tersedia.</div>';
  }
}

function renderChatMessages(messages) {
  if (messages.length === 0) {
    chatList.innerHTML = '<div style="font-size:0.75rem;color:var(--ink-soft);text-align:center;padding:1rem">Belum ada pesan. Kirim pesan koordinasi dengan tim rakDEV di bawah.</div>';
    return;
  }
  chatList.innerHTML = messages.map(m => {
    const isMine = m.sender_role === 'client' || m.sender_id === currentUser?.id;
    return `
      <div class="chat-bubble ${isMine ? 'mine' : 'theirs'}">
        <div style="font-size:0.68rem;opacity:0.8;margin-bottom:2px">
          ${isMine ? 'Anda' : 'Tim rakDEV'}
        </div>
        <div>${escapeHtml(m.body)}</div>
      </div>
    `;
  }).join('');
  chatList.scrollTop = chatList.scrollHeight;
}

function appendChatMessage(m) {
  const isMine = m.sender_role === 'client' || m.sender_id === currentUser?.id;
  const div = document.createElement('div');
  div.className = `chat-bubble ${isMine ? 'mine' : 'theirs'}`;
  div.innerHTML = `
    <div style="font-size:0.68rem;opacity:0.8;margin-bottom:2px">
      ${isMine ? 'Anda' : 'Tim rakDEV'}
    </div>
    <div>${escapeHtml(m.body)}</div>
  `;
  chatList.appendChild(div);
  chatList.scrollTop = chatList.scrollHeight;
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text || !currentChatConversationId) return;

  chatInput.value = '';
  try {
    const newMsg = await rakDb.sendMessage({
      conversation_id: currentChatConversationId,
      sender_role: 'client',
      body: text,
      user: currentUser
    });
    appendChatMessage(newMsg);
  } catch (err) {
    showToast('Gagal mengirim pesan');
  }
});

// Load Master Data
async function loadEndorserData() {
  try {
    if (allSlots.length === 0) {
      slotNotice.hidden = true;
      renderSlotSkeletons(slotListContainer, 4);
    }

    // 1. Ambil slot dari rakDb
    allSlots = await rakDb.getSlots();

    // 2. Ambil booking user jika ada
    userBookings = await rakDb.getUserBookings(currentUser ? currentUser.id : null);

    if (userBookings.length > 0) {
      myBookings.hidden = false;
      myBookingsList.innerHTML = userBookings.map(b => `
        <div class="my-booking-card" data-my-slot="${b.slot_id}">
          <div>
            <strong>${escapeHtml(b.server_name)}</strong>
            <div style="font-size:0.75rem;color:var(--ink-soft)">IP: ${escapeHtml(b.server_ip)} &bull; Status: ${b.status}</div>
          </div>
          <span class="badge badge-booked">Buka Detail →</span>
        </div>
      `).join('');

      document.querySelectorAll('.my-booking-card').forEach(el => {
        el.addEventListener('click', () => {
          const sid = el.getAttribute('data-my-slot');
          const s = allSlots.find(x => x.id === sid);
          if (s) showSlotDetail(s);
        });
      });
    } else {
      myBookings.hidden = true;
    }

    // Hitung metrik
    const total = allSlots.length;
    const avail = allSlots.filter(s => s.status === 'available').length;
    const booked = allSlots.filter(s => s.status !== 'available').length;
    const inProd = allSlots.filter(s => s.status === 'in_production').length;
    const mineCount = userBookings.length;

    metricTotalSlots.textContent = total;
    metricAvailable.textContent = avail;
    metricTotalBooked.textContent = booked;
    metricInProduction.textContent = inProd;

    countAll.textContent = total;
    countAvail.textContent = avail;
    countBooked.textContent = booked;
    countMine.textContent = mineCount;

    renderSlots();
  } catch (err) {
    console.warn('Error loading endorser data:', err);
    slotNotice.hidden = true;
    slotListContainer.innerHTML = '';
    renderErrorCard(
      slotListContainer,
      'Gagal Memuat Jadwal Slot',
      'Terjadi kendala saat mengambil data slot dari database Supabase. Silakan periksa koneksi Anda.',
      () => loadEndorserData()
    );
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Boot
async function boot() {
  try {
    const { user } = await initSmartNavbar('endorser');
    currentUser = user;
    await loadEndorserData();

    // Cek query parameters untuk deep linking cerdas
    const params = new URLSearchParams(window.location.search);
    const slotIdParam = params.get('slot_id');
    const filterParam = params.get('filter');

    if (slotIdParam && allSlots.length > 0) {
      const targetSlot = allSlots.find(s => s.id === slotIdParam);
      if (targetSlot) {
        showSlotDetail(targetSlot);
      }
    } else if (filterParam === 'mine') {
      filterMineBtn.click();
    }
    // Realtime listener untuk perubahan slot endorser
    if (supabase) {
      supabase
        .channel('realtime_endorser_slots')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'endorser_slots' }, () => {
          loadEndorserData();
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
