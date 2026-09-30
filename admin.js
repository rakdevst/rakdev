(function () {
  try {
    const p = window.location.pathname;
    if (p.endsWith('admin.html') || p.endsWith('/admin.html')) {
      const cleanPath = p.replace(/\/?admin\.html$/, '') + '/admin';
      window.history.replaceState(null, '', (cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath) + window.location.search + window.location.hash);
    }
  } catch (e) {}
})();

const SUPABASE_URL = 'https://ymnshvqbucjelhzqxpsz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hrrKVBWFgVQNDQxy1ei-IA_WTRRLbuW';
const T = { slots: 'endorser_slots', bookings: 'endorser_bookings', conv: 'conversations', msgs: 'messages', res: 'resources' };
const LOGO_BUCKET = 'endorser-logos';
const FILES_BUCKET = 'resource-files';
const THUMB_BUCKET = 'resource-thumbnails';
const STATUSES = ['available', 'pending', 'approved', 'rejected', 'cancelled', 'in_production', 'completed'];
const BOOKING_STATUSES = STATUSES.filter(s => s !== 'available');
const LABEL = { available: 'TERSEDIA', pending: 'MENUNGGU', approved: 'DISETUJUI', rejected: 'DITOLAK', cancelled: 'DIBATALKAN', in_production: 'DIKERJAKAN', completed: 'SELESAI' };
const PHASES = ['Waiting Approval', 'Planning', 'Recording', 'Editing', 'Review', 'Revision', 'Finalization', 'Published'];
const IMG_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const NOTIF = { table: 'notifications', pushTable: 'push_subscriptions', limit: 50 };
const PUSH_CONFIG = { swUrl: 'sw.js', vapidPublicKey: '' };
const NOTIF_TYPES = {
  booking_new: { label: 'Booking baru', badge: 'pending' },
  chat_message: { label: 'Chat', badge: 'in_production' },
  booking_status: { label: 'Status', badge: 'approved' },
  booking_progress: { label: 'Progres', badge: 'completed' },
  booking_approved: { label: 'Disetujui', badge: 'available' },
  booking_rejected: { label: 'Ditolak', badge: 'rejected' }
};
const newNotifState = () => ({ items: [], unread: 0, status: 'idle', error: '', channel: null, connected: false, open: false, marking: false, opener: null });

const client = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (id) => document.getElementById(id);
const S = { user: null, name: '', view: 'dashboard', slots: [], bookings: [], resources: [], filter: { q: '', status: '', date: '' }, chat: null, tagsAsText: false, notif: newNotifState(), push: { status: 'checking', busy: false }, rechecking: false };

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const badge = (s) => `<span class="badge badge-${STATUSES.includes(s) ? s : 'cancelled'}">${esc(LABEL[s] || String(s || '-').toUpperCase())}</span>`;
const fmtDate = (d) => d ? new Date(d + (String(d).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
const fmtTime = (d) => new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function toast(msg, err) {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : '');
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
function errText(e) {
  const m = e && e.message ? String(e.message) : 'Terjadi kesalahan';
  if (/row-level security|permission denied/i.test(m)) return 'Akses ditolak oleh kebijakan database.';
  return m;
}
function publicUrl(bucket, path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
function validateImage(file) {
  if (!file) return null;
  if (!IMG_TYPES.includes(file.type)) return 'Format gambar harus PNG, JPG, WEBP, atau GIF.';
  if (file.size > 2 * 1024 * 1024) return 'Ukuran gambar maksimal 2 MB.';
  return null;
}
function safeName(n) { return String(n).replace(/[^a-zA-Z0-9._-]/g, '_'); }

const pandaEl = $('panda'), formCard = $('formCard'), alertBox = $('alertBox');
const idIn = $('identity'), pwIn = $('password'), btnLogin = $('btnLogin'), btnText = $('btnText');
let submitting = false;
function showAlert(m, t) { alertBox.textContent = m; alertBox.className = 'alert alert-' + t + ' show'; }
function panda(cls, on) { pandaEl.classList.toggle(cls, on); }
pwIn.addEventListener('focus', () => panda('covering', pwIn.type === 'password'));
pwIn.addEventListener('blur', () => panda('covering', false));
$('togglePassword').addEventListener('click', () => {
  const hidden = pwIn.type === 'password';
  pwIn.type = hidden ? 'text' : 'password';
  $('togglePassword').setAttribute('aria-label', hidden ? 'Sembunyikan password' : 'Tampilkan password');
  $('eyeIcon').innerHTML = hidden
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
  pwIn.focus();
});

function authError(e) {
  const m = e && e.message ? String(e.message) : '';
  if (e && e.code === 'invalid_credentials' || /invalid login credentials/i.test(m)) return 'Email atau password salah.';
  if (/email not confirmed/i.test(m)) return 'Email belum diverifikasi.';
  if (e && e.status === 429) return 'Terlalu banyak percobaan login. Tunggu beberapa saat.';
  if (/failed to fetch|network/i.test(m)) return 'Tidak dapat terhubung ke server.';
  return m || 'Login gagal. Coba lagi nanti.';
}
function restoreForm() {
  submitting = false;
  btnLogin.classList.remove('loading');
  btnLogin.disabled = false; idIn.disabled = false; pwIn.disabled = false;
  btnLogin.style.background = '';
  btnText.textContent = 'LOGIN';
}
function failLogin(msg) {
  restoreForm();
  formCard.classList.add('shake');
  panda('sad', true);
  showAlert(msg, 'error');
  setTimeout(() => { formCard.classList.remove('shake'); panda('sad', false); }, 1400);
}

async function verifyAdmin(user) {
  const { data, error } = await client.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error) return false;
  return !!data;
}
async function loadProfileName(user) {
  let { data, error } = await client.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle();
  if (error) ({ data } = await client.from('profiles').select('full_name').eq('id', user.id).maybeSingle());
  const meta = user.user_metadata || {};
  return (data && data.full_name) || meta.full_name || meta.name || (user.email || '').split('@')[0];
}
async function enterPanel(user) {
  S.user = user;
  S.name = await loadProfileName(user);
  $('whoName').textContent = S.name;
  $('whoEmail').textContent = user.email || '-';
  $('loginView').hidden = true;
  $('panelView').hidden = false;
  document.body.classList.add('panel-mode');
  go(S.view);
  startRealtime();
  initNotifications();
}
function leavePanel() {
  stopRealtime();
  stopNotifications();
  closeAllModals();
  S.user = null;
  $('panelView').hidden = true;
  $('loginView').hidden = false;
  document.body.classList.remove('panel-mode');
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!client) { showAlert('Library Supabase gagal dimuat.', 'error'); btnLogin.disabled = true; return; }
  const { data } = await client.auth.getSession();
  if (data && data.session) {
    const { data: u, error } = await client.auth.getUser();
    if (!error && u && u.user && await verifyAdmin(u.user)) { await enterPanel(u.user); return; }
    await client.auth.signOut({ scope: 'local' });
  }
});

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (submitting) return;
  alertBox.classList.remove('show');
  const email = idIn.value.trim(), password = pwIn.value;
  if (!email || !password) { failLogin('Email dan password tidak boleh kosong.'); return; }
  submitting = true;
  btnLogin.disabled = true; idIn.disabled = true; pwIn.disabled = true;
  btnLogin.classList.add('loading');
  btnText.textContent = 'Checking...';
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data || !data.session) { failLogin(authError(error)); return; }
    const ok = await verifyAdmin(data.user);
    if (!ok) {
      await client.auth.signOut();
      failLogin('Akun ini tidak memiliki akses admin.');
      return;
    }
    btnLogin.classList.remove('loading');
    btnLogin.style.background = 'var(--success-text)';
    btnText.textContent = 'Success';
    panda('covering', false); panda('happy', true);
    showAlert('Login berhasil. Membuka panel admin...', 'success');
    setTimeout(async () => {
      restoreForm(); panda('happy', false);
      idIn.value = ''; pwIn.value = '';
      alertBox.classList.remove('show');
      await enterPanel(data.user);
    }, 800);
  } catch (err) {
    failLogin(authError(err));
  }
});

client && client.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' && S.user) leavePanel();
});

$('btnLogout').addEventListener('click', async () => {
  if (S.push.status === 'on') {
    try {
      await disablePush(true);
    } catch (err) {
      console.error('Push cleanup failed:', err && err.message ? err.message : 'unknown error');
    }
  }
  await client.auth.signOut();
  leavePanel();
});
$('btnMenu').addEventListener('click', () => $('sidebar').classList.toggle('open'));
document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.addEventListener('click', () => {
  $('sidebar').classList.remove('open');
  go(b.dataset.view);
}));

function go(view) {
  rtPending = false;
  S.view = view;
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  ({ dashboard: viewDashboard, endorser: viewEndorser, bookings: viewBookings, resources: viewResources })[view]();
}

async function fetchSlots() {
  const { data, error } = await client.from(T.slots).select('*').order('scheduled_date', { ascending: true });
  if (error) throw error;
  S.slots = data || [];
}
async function fetchBookings() {
  const { data, error } = await client.from(T.bookings).select('*, slot:' + T.slots + '(*)').order('created_at', { ascending: false });
  if (error) throw error;
  S.bookings = data || [];
}
async function fetchResources() {
  const { data, error } = await client.from(T.res).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  S.resources = data || [];
  S.tagsAsText = S.resources.some(r => typeof r.tags === 'string' || typeof r.dependencies === 'string');
}

let rtChannel = null, rtTimer = null, rtPending = false;
function startRealtime() {
  stopRealtime();
  const refresh = () => {
    clearTimeout(rtTimer);
    rtTimer = setTimeout(() => {
      if (!S.user) return;
      if (document.querySelector('.modal-scrim')) { rtPending = true; return; }
      go(S.view);
    }, 400);
  };
  rtChannel = client.channel('admin-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: T.slots }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: T.bookings }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: T.res }, refresh)
    .subscribe();
}
function stopRealtime() {
  clearTimeout(rtTimer);
  rtPending = false;
  if (rtChannel) { client.removeChannel(rtChannel); rtChannel = null; }
  closeChat();
}

async function viewDashboard() {
  $('main').innerHTML = '<h2 class="page-title">Dashboard</h2><div class="empty">Memuat...</div>';
  try {
    await Promise.all([fetchSlots(), fetchBookings(), fetchResources()]);
  } catch (e) { $('main').innerHTML = `<h2 class="page-title">Dashboard</h2><div class="empty">${esc(errText(e))}</div>`; return; }
  const cnt = (arr, s) => arr.filter(x => x.status === s).length;
  const recent = S.bookings.slice(0, 5);
  $('main').innerHTML = `<h2 class="page-title">Dashboard</h2>
  <div class="stats">
    <div class="stat"><b>${S.slots.length}</b><span>Total slot</span></div>
    <div class="stat"><b>${cnt(S.slots, 'available')}</b><span>Slot tersedia</span></div>
    <div class="stat"><b>${cnt(S.bookings, 'pending')}</b><span>Booking menunggu</span></div>
    <div class="stat"><b>${cnt(S.bookings, 'in_production')}</b><span>Dikerjakan</span></div>
    <div class="stat"><b>${S.resources.length}</b><span>Resources</span></div>
  </div>
  <div class="section" style="border:none;margin-top:0"><h4>Booking terbaru</h4>
  <div class="table-wrap">${recent.length ? `<table class="cards"><thead><tr><th>Server</th><th>User</th><th>Tanggal</th><th>Status</th><th></th></tr></thead><tbody>${recent.map(b => `<tr><td data-l="Server">${esc(b.server_name)}</td><td data-l="User">${esc(b.username || b.email || '-')}</td><td data-l="Tanggal">${fmtDate(b.slot && b.slot.scheduled_date)}</td><td data-l="Status">${badge(b.status)}</td><td class="act"><button class="btn sm" data-open="${esc(b.id)}">Detail</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Belum ada booking.</div>'}</div></div>`;
  document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openBooking(b.dataset.open)));
}

async function viewEndorser() {
  $('main').innerHTML = '<h2 class="page-title">Endorser</h2><div class="empty">Memuat...</div>';
  try { await Promise.all([fetchSlots(), fetchBookings()]); }
  catch (e) { $('main').innerHTML = `<h2 class="page-title">Endorser</h2><div class="empty">${esc(errText(e))}</div>`; return; }
  const active = (slotId) => S.bookings.find(b => b.slot_id === slotId && !['rejected', 'cancelled'].includes(b.status));
  $('main').innerHTML = `<h2 class="page-title">Endorser</h2>
  <div class="toolbar"><button class="btn primary" id="btnNewSlot">Buat Slot</button></div>
  <div class="table-wrap">${S.slots.length ? `<table class="cards"><thead><tr><th>Tanggal</th><th>Jam</th><th>Status</th><th>Booking</th><th>Fase</th><th>Progress</th><th></th></tr></thead><tbody>${S.slots.map(s => {
    const b = active(s.id);
    return `<tr><td data-l="Tanggal">${fmtDate(s.scheduled_date)}</td><td data-l="Jam">${esc(s.time_slot || '-')}</td><td data-l="Status">${badge(s.status)}</td><td data-l="Booking">${b ? esc(b.server_name) : (s.status === 'available' ? 'Belum dibooking' : '-')}</td><td data-l="Fase">${esc(s.current_phase || '-')}</td><td data-l="Progress">${Number(s.progress) || 0}%</td><td class="act"><div class="actions">${b ? `<button class="btn sm" data-open="${esc(b.id)}">Booking</button>` : ''}<button class="btn sm data-edit="${esc(s.id)}">Edit</button><button class="btn sm danger" data-del="${esc(s.id)}">Hapus</button></div></td></tr>`;
  }).join('')}</tbody></table>` : '<div class="empty">Belum ada slot. Buat slot pertama.</div>'}</div>`;
  $('btnNewSlot').addEventListener('click', () => slotModal(null));
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => slotModal(S.slots.find(s => s.id === b.dataset.edit))));
  document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openBooking(b.dataset.open)));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Hapus slot ini? Booking terkait bisa ikut terhapus atau ditolak oleh database.')) return;
    const { error } = await client.from(T.slots).delete().eq('id', b.dataset.del);
    if (error) return toast(errText(error), true);
    toast('Slot dihapus');
    viewEndorser();
  }));
}

function modal(html, wide) {
  const scrim = document.createElement('div');
  scrim.className = 'modal-scrim';
  scrim.innerHTML = `<div class="modal" role="dialog" aria-modal="true" style="${wide ? 'max-width:760px' : ''}">${html}</div>`;
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) closeModal(scrim); });
  document.body.appendChild(scrim);
  scrim.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(scrim)));
  return scrim;
}
function closeModal(scrim) {
  if (scrim && scrim.__onClose) scrim.__onClose();
  scrim.remove();
  if (rtPending && S.user && !document.querySelector('.modal-scrim')) {
    rtPending = false;
    setTimeout(() => { if (S.user && !document.querySelector('.modal-scrim')) go(S.view); }, 0);
  }
}
const statusOptions = (list, cur) => list.map(s => `<option value="${s}" ${s === cur ? 'selected' : ''}>${LABEL[s]}</option>`).join('');
const phaseOptions = (cur) => [''].concat(PHASES).concat(cur && !PHASES.includes(cur) ? [cur] : []).map(p => `<option value="${esc(p)}" ${p === (cur || '') ? 'selected' : ''}>${esc(p) || '-'}</option>`).join('');

function slotModal(slot) {
  const isNew = !slot;
  const s = slot || { status: 'available', progress: 0 };
  const m = modal(`<h3>${isNew ? 'Buat Slot' : 'Edit Slot'}<button class="btn sm" data-close>Tutup</button></h3>
  <form id="slotForm">
    <div class="grid2">
      <div class="form-group"><label>Tanggal</label><input class="form-control" type="date" name="scheduled_date" value="${esc(s.scheduled_date || '')}" required></div>
      <div class="form-group"><label>Jam / Label</label><input class="form-control" name="time_slot" value="${esc(s.time_slot || '')}" maxlength="60"></div>
      <div class="form-group"><label>Status</label><select class="form-control" name="status">${statusOptions(STATUSES, s.status)}</select></div>
      <div class="form-group"><label>Progress (%)</label><input class="form-control" type="number" name="progress" min="0" max="100" value="${Number(s.progress) || 0}"></div>
      <div class="form-group"><label>Fase</label><select class="form-control" name="current_phase">${phaseOptions(s.current_phase)}</select></div>
      <div class="form-group"><label>Nama Server</label><input class="form-control" name="server_name" value="${esc(s.server_name || '')}" maxlength="100"></div>
    </div>
    <div class="form-group"><label>Deskripsi</label><textarea class="form-control" name="description">${esc(s.description || '')}</textarea></div>
    <div class="modal-foot"><button type="button" class="btn" data-close>Batal</button><button class="btn primary" type="submit">Simpan</button></div>
  </form>`);
  m.querySelector('#slotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const payload = {
      scheduled_date: f.get('scheduled_date'),
      time_slot: f.get('time_slot').trim() || null,
      status: f.get('status'),
      progress: Math.max(0, Math.min(100, parseInt(f.get('progress'), 10) || 0)),
      current_phase: f.get('current_phase') || null,
      server_name: f.get('server_name').trim() || null,
      description: f.get('description').trim() || null
    };
    if (!payload.scheduled_date) return toast('Tanggal wajib diisi', true);
    const q = isNew ? client.from(T.slots).insert(payload) : client.from(T.slots).update(payload).eq('id', slot.id);
    const { error } = await q;
    if (error) return toast(errText(error), true);
    toast(isNew ? 'Slot dibuat' : 'Slot diperbarui');
    closeModal(m);
    viewEndorser();
  });
}

async function viewBookings() {
  $('main').innerHTML = '<h2 class="page-title">Booking / Pesanan</h2><div class="empty">Memuat...</div>';
  try { await fetchBookings(); }
  catch (e) { $('main').innerHTML = `<h2 class="page-title">Booking / Pesanan</h2><div class="empty">${esc(errText(e))}</div>`; return; }
  const f = S.filter;
  $('main').innerHTML = `<h2 class="page-title">Booking / Pesanan</h2>
  <div class="toolbar">
    <input class="form-control" id="fQ" placeholder="Cari server, user, email, IP" value="${esc(f.q)}">
    <select class="form-control" id="fStatus"><option value="">Semua status</option>${statusOptions(BOOKING_STATUSES, f.status)}</select>
    <input class="form-control" id="fDate" type="date" value="${esc(f.date)}">
    <button class="btn" id="fReset">Reset</button>
  </div>
  <div class="table-wrap" id="bookTable"></div>`;
  const draw = () => {
    const q = S.filter.q.toLowerCase();
    const rows = S.bookings.filter(b =>
      (!S.filter.status || b.status === S.filter.status) &&
      (!S.filter.date || (b.slot && b.slot.scheduled_date === S.filter.date)) &&
      (!q || [b.server_name, b.username, b.email, b.ip, b.social_media].some(v => String(v || '').toLowerCase().includes(q))));
    $('bookTable').innerHTML = rows.length ? `<table class="cards"><thead><tr><th>Server</th><th>User</th><th>Tanggal</th><th>Status</th><th>Progress</th><th>Fase</th><th></th></tr></thead><tbody>${rows.map(b => `<tr><td data-l="Server">${esc(b.server_name)}</td><td data-l="User">${esc(b.username || b.email || '-')}</td><td data-l="Tanggal">${fmtDate(b.slot && b.slot.scheduled_date)}</td><td data-l="Status">${badge(b.status)}</td><td data-l="Progress">${Number(b.slot && b.slot.progress) || 0}%</td><td data-l="Fase">${esc((b.slot && b.slot.current_phase) || 'Waiting Approval')}</td><td class="act"><button class="btn sm" data-open="${esc(b.id)}">Detail</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Tidak ada booking yang cocok.</div>';
    document.querySelectorAll('#bookTable [data-open]').forEach(x => x.addEventListener('click', () => openBooking(x.dataset.open)));
  };
  $('fQ').addEventListener('input', (e) => { S.filter.q = e.target.value; draw(); });
  $('fStatus').addEventListener('change', (e) => { S.filter.status = e.target.value; draw(); });
  $('fDate').addEventListener('change', (e) => { S.filter.date = e.target.value; draw(); });
  $('fReset').addEventListener('click', () => { S.filter = { q: '', status: '', date: '' }; viewBookings(); });
  draw();
}

function closeChat() {
  if (S.chat && S.chat.channel) client.removeChannel(S.chat.channel);
  S.chat = null;
}

async function openBooking(id) {
  const b = S.bookings.find(x => x.id === id);
  if (!b) return toast('Booking tidak ditemukan', true);
  const slot = b.slot || {};
  const logoUrl = publicUrl(LOGO_BUCKET, b.logo_path);
  const m = modal(`<h3>${esc(b.server_name)} ${badge(b.status)}<button class="btn sm" data-close>Tutup</button></h3>
  <dl class="kv">
    <dt>User</dt><dd>${esc(b.username || '-')}</dd>
    <dt>Email</dt><dd>${esc(b.email || '-')}</dd>
    <dt>Slot</dt><dd>${fmtDate(slot.scheduled_date)} ${esc(slot.time_slot || '')}</dd>
    <dt>Dibuat</dt><dd>${b.created_at ? fmtTime(b.created_at) : '-'}</dd>
  </dl>
  <div class="section"><h4>Data Server</h4>
    <form id="srvForm">
      <div class="grid2">
        <div class="form-group"><label>Nama Server</label><input class="form-control" name="server_name" value="${esc(b.server_name)}" maxlength="100" required></div>
        <div class="form-group"><label>IP Server</label><input class="form-control" name="ip" value="${esc(b.ip)}" required></div>
        <div class="form-group"><label>Port</label><input class="form-control" name="port" value="${esc(b.port)}" required></div>
        <div class="form-group"><label>Link Media Sosial</label><input class="form-control" name="social_media" value="${esc(b.social_media)}"></div>
      </div>
      <div class="form-group"><label>Fitur yang Dibahas</label><textarea class="form-control" name="features">${esc(b.features)}</textarea></div>
      <button class="btn sm primary" type="submit">Simpan Data Server</button>
    </form>
  </div>
  <div class="section"><h4>Logo Server</h4>
    <div class="logo-box">
      ${logoUrl ? `<img src="${esc(logoUrl)}" alt="Logo server">` : '<span class="hint">Belum ada logo.</span>'}
      <input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
      <button class="btn sm" id="logoPick">${logoUrl ? 'Ganti Logo' : 'Upload Logo'}</button>
      ${logoUrl ? '<button class="btn sm danger" id="logoDel">Hapus Logo</button>' : ''}
    </div>
  </div>
  <div class="section"><h4>Status &amp; Progres</h4>
    <div class="grid2">
      <div class="form-group"><label>Status</label><select class="form-control" id="stSel">${statusOptions(BOOKING_STATUSES, b.status)}</select></div>
      <div class="form-group"><label>Progress (%)</label><input class="form-control" id="stProg" type="number" min="0" max="100" value="${Number(slot.progress) || 0}"></div>
      <div class="form-group"><label>Fase</label><select class="form-control" id="stPhase">${phaseOptions(slot.current_phase || (b.status === 'pending' ? 'Waiting Approval' : ''))}</select></div>
    </div>
    <div class="actions">
      <button class="btn sm primary" id="stSave">Simpan Perubahan</button>
      <button class="btn sm ok" data-quick="approved">Approve</button>
      <button class="btn sm danger" data-quick="rejected">Reject</button>
      <button class="btn sm danger" data-quick="cancelled">Batalkan</button>
      <button class="btn sm danger" id="bkDel">Hapus Booking</button>
    </div>
  </div>
  <div class="section"><h4>Chat dengan User</h4>
    <div class="chat-log" id="chatLog"><span class="hint">Memuat...</span></div>
    <form class="chat-form" id="chatForm"><input class="form-control" id="chatInput" placeholder="Tulis pesan" maxlength="2000" autocomplete="off"><button class="btn primary" type="submit">Kirim</button></form>
  </div>`, true);
  m.__onClose = closeChat;

  m.querySelector('#srvForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const payload = { server_name: f.get('server_name').trim(), ip: f.get('ip').trim(), port: f.get('port').trim(), social_media: f.get('social_media').trim(), features: f.get('features').trim() };
    const { error } = await client.from(T.bookings).update(payload).eq('id', id);
    if (error) return toast(errText(error), true);
    toast('Data server disimpan');
    afterBookingChange(m);
  });

  let statusBusy = false;
  const setStatusBusy = (on) => {
    statusBusy = on;
    m.querySelectorAll('#stSave, [data-quick]').forEach(btn => { btn.disabled = on; });
  };
  const applyStatus = async (status) => {
    if (statusBusy) return;
    const phaseEl = $('stPhase'), progEl = $('stProg');
    const phaseUnset = !phaseEl.value || phaseEl.value === 'Waiting Approval';
    if ((status === 'approved' || status === 'in_production') && phaseUnset) phaseEl.value = 'Planning';
    if (status === 'completed' && phaseUnset) { phaseEl.value = 'Published'; progEl.value = 100; }
    const progress = Math.max(0, Math.min(100, parseInt(progEl.value, 10) || 0));
    const phase = phaseEl.value;
    setStatusBusy(true);
    const { error } = await client.rpc('admin_update_booking', { p_booking_id: id, p_status: status, p_progress: progress, p_phase: phase });
    if (error) { setStatusBusy(false); return toast(errText(error), true); }
    toast('Status diperbarui');
    afterBookingChange(m);
  };
  m.querySelector('#stSave').addEventListener('click', () => applyStatus($('stSel').value));
  m.querySelectorAll('[data-quick]').forEach(btn => btn.addEventListener('click', () => {
    const st = btn.dataset.quick;
    if (st !== 'approved' && !confirm(`Ubah status booking menjadi ${LABEL[st]}?`)) return;
    applyStatus(st);
  }));
  m.querySelector('#bkDel').addEventListener('click', async () => {
    if (!confirm('Hapus booking ini permanen?')) return;
    const slotId = b.slot_id;
    if (b.logo_path && !/^https?:/i.test(b.logo_path)) await client.storage.from(LOGO_BUCKET).remove([b.logo_path]);
    const { error } = await client.from(T.bookings).delete().eq('id', id);
    if (error) return toast(errText(error), true);
    await client.from(T.slots).update({ status: 'available', progress: 0, current_phase: null, server_name: null }).eq('id', slotId);
    toast('Booking dihapus');
    closeModal(m);
    go(S.view);
  });

  const fileIn = m.querySelector('#logoFile');
  m.querySelector('#logoPick').addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', async () => {
    const file = fileIn.files[0];
    const bad = validateImage(file);
    if (bad) return toast(bad, true);
    if (!file) return;
    const path = `${b.user_id}/${Date.now()}_${safeName(file.name)}`;
    const up = await client.storage.from(LOGO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) return toast(errText(up.error), true);
    const { error } = await client.from(T.bookings).update({ logo_path: path }).eq('id', id);
    if (error) { await client.storage.from(LOGO_BUCKET).remove([path]); return toast(errText(error), true); }
    if (b.logo_path && !/^https?:/i.test(b.logo_path)) await client.storage.from(LOGO_BUCKET).remove([b.logo_path]);
    toast('Logo diperbarui');
    afterBookingChange(m);
  });
  const del = m.querySelector('#logoDel');
  if (del) del.addEventListener('click', async () => {
    if (!confirm('Hapus logo server?')) return;
    const { error } = await client.from(T.bookings).update({ logo_path: null }).eq('id', id);
    if (error) return toast(errText(error), true);
    if (b.logo_path && !/^https?:/i.test(b.logo_path)) await client.storage.from(LOGO_BUCKET).remove([b.logo_path]);
    toast('Logo dihapus');
    afterBookingChange(m);
  });

  initChat(m, id);
}
async function afterBookingChange(m) {
  closeModal(m);
  await fetchBookings().catch(() => {});
  go(S.view);
}

async function initChat(m, bookingId) {
  const log = m.querySelector('#chatLog');
  const alive = () => document.body.contains(m);
  const lookup = () => client.from(T.conv).select('id').eq('booking_id', bookingId).maybeSingle();
  let { data: conv, error } = await lookup();
  if (!alive()) return;
  if (error) {
    log.innerHTML = `<span class="hint">${error.code === 'PGRST116' ? 'Ditemukan lebih dari satu percakapan untuk booking ini.' : 'Gagal memuat chat.'}</span>`;
    return;
  }
  if (!conv) {
    const ins = await client.from(T.conv).insert({ booking_id: bookingId }).select('id').single();
    if (!alive()) return;
    if (!ins.error) conv = ins.data;
    else if (ins.error.code === '23505') {
      const again = await lookup();
      if (!alive()) return;
      conv = again.data || null;
    }
    if (!conv) { log.innerHTML = '<span class="hint">Gagal membuat percakapan.</span>'; return; }
  }
  const seen = new Set();
  const add = (msg) => {
    if (seen.has(msg.id)) return;
    seen.add(msg.id);
    const el = document.createElement('div');
    el.className = 'msg' + (msg.sender_id === S.user.id ? ' me' : '');
    el.innerHTML = `${esc(msg.body)}<small>${fmtTime(msg.created_at)}</small>`;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  };
  const { data: msgs, error: me } = await client.from(T.msgs).select('id, sender_id, body, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: true }).limit(300);
  if (!alive()) return;
  log.innerHTML = '';
  if (me) { log.innerHTML = '<span class="hint">Gagal memuat pesan.</span>'; return; }
  if (!msgs.length) log.innerHTML = '<span class="hint">Belum ada pesan.</span>';
  else msgs.forEach(add);
  closeChat();
  const channel = client.channel('admin-chat-' + conv.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: T.msgs, filter: `conversation_id=eq.${conv.id}` }, (p) => {
      const hint = log.querySelector('.hint'); if (hint) hint.remove();
      add(p.new);
    }).subscribe();
  S.chat = { channel, conversationId: conv.id, bookingId };
  markConversationNotifsRead(conv.id);
  let sending = false;
  m.querySelector('#chatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const input = m.querySelector('#chatInput');
    const sendBtn = m.querySelector('#chatForm button');
    const text = input.value.trim();
    if (!text) return;
    sending = true;
    input.disabled = true;
    sendBtn.disabled = true;
    const { data, error: se } = await client.from(T.msgs).insert({ conversation_id: conv.id, sender_id: S.user.id, body: text }).select('id, sender_id, body, created_at').single();
    sending = false;
    input.disabled = false;
    sendBtn.disabled = false;
    if (se) return toast(errText(se), true);
    input.value = '';
    const hint = log.querySelector('.hint'); if (hint) hint.remove();
    add(data);
    input.focus();
  });
}

const notifPanel = $('notifPanel');
const notifBackdrop = $('notifBackdrop');
const notifList = $('notifList');
const notifMarkAll = $('notifMarkAll');
const notifClose = $('notifClose');
const pushTitle = $('pushTitle');
const pushDesc = $('pushDesc');
const pushBtn = $('pushBtn');
const bellBtns = () => Array.from(document.querySelectorAll('[data-bell]'));

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
  return `${rel} · ${fmtTime(t)}`;
}

function renderNotifBadge() {
  const n = S.notif.unread;
  const text = n > 99 ? '99+' : String(n);
  bellBtns().forEach(btn => {
    const c = btn.querySelector('.bell-count');
    c.hidden = n < 1;
    c.textContent = text;
    btn.setAttribute('aria-label', n > 0 ? `Notifikasi, ${n} belum dibaca` : 'Notifikasi');
  });
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
  item.dataset.notifId = n.id;

  const dot = document.createElement('span');
  dot.className = 'notif-dot';
  dot.setAttribute('aria-hidden', 'true');

  const body = document.createElement('div');
  body.className = 'notif-body';

  const line = document.createElement('div');
  line.className = 'notif-line';
  const typeEl = document.createElement('span');
  typeEl.className = `badge badge-${meta.badge}`;
  typeEl.textContent = meta.label;
  const titleEl = document.createElement('span');
  titleEl.className = 'notif-item-title';
  titleEl.textContent = n.title || meta.label;
  line.appendChild(typeEl);
  line.appendChild(titleEl);
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
  const ns = S.notif;
  if (ns.status === 'unavailable') {
    notifStateBox('Notifikasi belum aktif di database. Tabel notifications belum dibuat.', false);
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

async function loadUnreadCount(uid, ns) {
  const { count, error } = await client
    .from(NOTIF.table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)
    .eq('is_read', false);
  if (S.notif !== ns) return;
  if (!error && typeof count === 'number') ns.unread = count;
  else ns.unread = ns.items.filter(n => !n.is_read).length;
  renderNotifBadge();
}

async function loadNotifications() {
  if (!S.user) return;
  const uid = S.user.id;
  const ns = S.notif;
  const seq = ++notifLoadSeq;
  if (!ns.items.length) ns.status = 'loading';
  if (ns.open) renderNotifList();

  const { data, error } = await client
    .from(NOTIF.table)
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(NOTIF.limit);

  if (seq !== notifLoadSeq || !S.user || S.user.id !== uid || S.notif !== ns) return;

  if (error) {
    if (isMissingTable(error)) {
      ns.status = 'unavailable';
      ns.items = [];
      ns.unread = 0;
    } else {
      ns.status = 'error';
      ns.error = errText(error);
      console.error('Notification fetch failed:', error.message);
    }
    renderNotifBadge();
    renderNotifList();
    return;
  }

  ns.items = data || [];
  ns.status = 'ready';
  ns.error = '';
  await loadUnreadCount(uid, ns);
  if (seq !== notifLoadSeq || S.notif !== ns) return;
  if (!ns.channel) subscribeNotifRealtime();
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
  const ns = S.notif;
  notifCountTimer = setTimeout(() => {
    if (S.user && S.notif === ns && ns.status === 'ready') loadUnreadCount(S.user.id, ns);
  }, 450);
}

function upsertNotif(n) {
  const ns = S.notif;
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
    && !!S.chat
    && S.chat.conversationId === conversationId
    && document.visibilityState === 'visible'
    && !!document.querySelector('.modal-scrim');
}

async function markNotifRead(ids, silent) {
  const ns = S.notif;
  if (!S.user) return false;
  const targets = ns.items.filter(n => ids.includes(n.id) && !n.is_read).map(n => n.id);
  if (!targets.length) return true;

  const { error } = await client
    .from(NOTIF.table)
    .update({ is_read: true })
    .in('id', targets)
    .eq('user_id', S.user.id);

  if (S.notif !== ns) return false;
  if (error) {
    if (!silent) toast(errText(error), true);
    return false;
  }

  ns.items.forEach(n => { if (targets.includes(n.id)) n.is_read = true; });
  ns.unread = Math.max(0, ns.unread - targets.length);
  renderNotifBadge();
  renderNotifList();
  scheduleNotifCount();
  return true;
}

function markConversationNotifsRead(conversationId) {
  if (!conversationId) return;
  const ids = S.notif.items
    .filter(n => n.type === 'chat_message' && n.conversation_id === conversationId && !n.is_read)
    .map(n => n.id);
  if (ids.length) markNotifRead(ids, true);
}

async function markAllNotifRead() {
  const ns = S.notif;
  if (!S.user || ns.unread < 1 || ns.marking) return;

  ns.marking = true;
  notifMarkAll.disabled = true;
  const { error } = await client
    .from(NOTIF.table)
    .update({ is_read: true })
    .eq('user_id', S.user.id)
    .eq('is_read', false);
  ns.marking = false;

  if (S.notif !== ns) return;
  if (error) {
    toast(errText(error), true);
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
  const ns = S.notif;
  if (!n || !n.id || !S.user || n.user_id !== S.user.id) return;
  if (n.type === 'chat_message' && n.sender_id && n.sender_id === S.user.id) return;

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
      toast(n.title || (meta ? meta.label : 'Notifikasi baru'));
    }
  }

  renderNotifBadge();
  renderNotifList();
  scheduleNotifCount();
}

function onNotifUpdate(payload) {
  const n = payload && payload.new;
  if (!n || !n.id || !S.user || n.user_id !== S.user.id) return;
  if (S.notif.items.some(x => x.id === n.id)) upsertNotif(n);
  renderNotifList();
  scheduleNotifCount();
}

function subscribeNotifRealtime() {
  const ns = S.notif;
  if (!S.user) return;
  if (ns.channel) {
    client.removeChannel(ns.channel);
    ns.channel = null;
  }

  const uid = S.user.id;
  const filter = `user_id=eq.${uid}`;
  ns.channel = client
    .channel(`admin-notif-${uid}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: NOTIF.table, filter }, onNotifInsert)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: NOTIF.table, filter }, onNotifUpdate)
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED' || S.notif !== ns) return;
      if (ns.connected) scheduleNotifSync();
      ns.connected = true;
    });
}

function closeAllModals() {
  document.querySelectorAll('.modal-scrim').forEach(el => closeModal(el));
}

async function openNotifTarget(n) {
  let bookingId = n.booking_id || null;
  if (!bookingId && n.conversation_id) {
    const { data, error } = await client.from(T.conv).select('booking_id').eq('id', n.conversation_id).maybeSingle();
    if (!error && data) bookingId = data.booking_id;
  }
  if (!bookingId) {
    toast('Notifikasi ini tidak memiliki tautan ke booking.', true);
    return;
  }

  try {
    await fetchBookings();
  } catch (err) {
    toast(errText(err), true);
    return;
  }
  if (!S.user) return;
  if (!S.bookings.some(b => b.id === bookingId)) {
    toast('Booking terkait tidak ditemukan atau sudah dihapus.', true);
    return;
  }

  closeAllModals();
  openBooking(bookingId);
  if (n.type === 'chat_message') {
    setTimeout(() => {
      const log = $('chatLog');
      if (log) log.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 80);
  }
}

async function openNotification(id) {
  const n = S.notif.items.find(x => x.id === id);
  if (!n) return;
  if (!n.is_read) markNotifRead([id], true);
  closeNotifPanel(false);
  await openNotifTarget(n);
}

function openNotifPanel(opener) {
  if (!S.user) return;
  $('sidebar').classList.remove('open');
  const ns = S.notif;
  ns.open = true;
  ns.opener = opener || null;
  notifPanel.classList.add('open');
  notifPanel.setAttribute('aria-hidden', 'false');
  notifBackdrop.classList.add('show');
  bellBtns().forEach(b => b.setAttribute('aria-expanded', 'true'));
  renderNotifList();
  loadNotifications();
  refreshPushState();
  notifClose.focus();
}

function closeNotifPanel(returnFocus) {
  const ns = S.notif;
  if (!ns.open) return;
  ns.open = false;
  notifPanel.classList.remove('open');
  notifPanel.setAttribute('aria-hidden', 'true');
  notifBackdrop.classList.remove('show');
  bellBtns().forEach(b => b.setAttribute('aria-expanded', 'false'));
  if (returnFocus && ns.opener && document.body.contains(ns.opener)) ns.opener.focus();
}

bellBtns().forEach(btn => btn.addEventListener('click', () => {
  if (S.notif.open) closeNotifPanel(true);
  else openNotifPanel(btn);
}));
notifClose.addEventListener('click', () => closeNotifPanel(true));
notifBackdrop.addEventListener('click', () => closeNotifPanel(false));
notifMarkAll.addEventListener('click', markAllNotifRead);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.notif.open) closeNotifPanel(true);
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
  off: ['Push nonaktif', 'Aktifkan untuk mendaftarkan perangkat ini menerima push admin.'],
  on: ['Push aktif', 'Perangkat ini terdaftar. Pengiriman push bergantung pada layanan di server.']
};

function renderPushBox() {
  const p = S.push;
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
  const p = S.push;
  if (!S.user) return;
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
      if (sub && S.user) {
        const { data, error } = await client
          .from(NOTIF.pushTable)
          .select('endpoint')
          .eq('user_id', S.user.id)
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
  return errText(err);
}

async function enablePush() {
  const p = S.push;
  if (p.busy || p.status !== 'off' || !S.user) return;

  p.busy = true;
  renderPushBox();
  let sub = null;

  try {
    if (!PUSH_CONFIG.vapidPublicKey) throw new Error('push_not_configured');

    const probe = await fetch(PUSH_CONFIG.swUrl, { method: 'HEAD', cache: 'no-store' });
    if (!probe.ok) throw new Error('sw_missing');

    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') {
      toast(permission === 'denied' ? 'Izin notifikasi diblokir di browser.' : 'Izin notifikasi belum diberikan.', true);
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
      user_id: S.user.id,
      endpoint: json.endpoint,
      p256dh: json.keys && json.keys.p256dh,
      auth: json.keys && json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 250)
    }, { onConflict: 'endpoint' });
    if (error) throw error;

    toast('Perangkat ini terdaftar untuk push notification admin.');
  } catch (err) {
    if (sub) {
      try { await sub.unsubscribe(); } catch (e) { console.error('Unsubscribe failed:', e && e.message ? e.message : 'unknown error'); }
    }
    toast(pushErrorText(err), true);
  } finally {
    p.busy = false;
    await refreshPushState();
  }
}

async function disablePush(silent) {
  const p = S.push;
  if (p.busy || !S.user) return;

  p.busy = true;
  if (!silent) renderPushBox();

  try {
    const sub = await getPushSubscription();
    if (sub) {
      const { error } = await client
        .from(NOTIF.pushTable)
        .delete()
        .eq('user_id', S.user.id)
        .eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
      if (!silent) {
        if (error) toast('Push dimatikan di perangkat ini, tetapi catatan di server belum terhapus.', true);
        else toast('Push notification dinonaktifkan.');
      }
    }
  } catch (err) {
    if (!silent) toast(pushErrorText(err), true);
  } finally {
    p.busy = false;
    if (!silent) await refreshPushState();
  }
}

pushBtn.addEventListener('click', () => {
  if (S.push.status === 'on') disablePush(false);
  else enablePush();
});

function handleHashRoute() {
  if (!S.user) return;
  const match = /^#booking=([0-9a-f-]{36})$/i.exec(window.location.hash);
  if (!match) return;
  history.replaceState(null, '', window.location.pathname + window.location.search);
  openNotifTarget({ booking_id: match[1], type: 'booking_status' });
}

async function recheckAdmin() {
  if (!S.user || S.rechecking) return;
  S.rechecking = true;
  const uid = S.user.id;
  try {
    const { data, error } = await client.from('admin_users').select('user_id').eq('user_id', uid).maybeSingle();
    if (!error && !data && S.user && S.user.id === uid) {
      await client.auth.signOut();
      leavePanel();
      showAlert('Akses admin untuk akun ini sudah dicabut.', 'error');
    }
  } catch (err) {
    console.error('Admin recheck failed:', err && err.message ? err.message : 'unknown error');
  } finally {
    S.rechecking = false;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !S.user) return;
  recheckAdmin();
  scheduleNotifSync();
});
window.addEventListener('hashchange', handleHashRoute);

async function initNotifications() {
  renderNotifBadge();
  renderPushBox();
  await loadNotifications();
  refreshPushState();
  handleHashRoute();
}

function stopNotifications() {
  const ns = S.notif;
  clearTimeout(notifSyncTimer);
  clearTimeout(notifCountTimer);
  notifLoadSeq++;
  if (ns.channel) client.removeChannel(ns.channel);
  closeNotifPanel(false);
  S.notif = newNotifState();
  S.push = { status: 'checking', busy: false };
  renderNotifBadge();
  renderNotifList();
  renderPushBox();
}

const toArr = (v) => Array.isArray(v) ? v : (v ? String(v).split(',').map(x => x.trim()).filter(Boolean) : []);
const fromCsv = (s) => s.split(',').map(x => x.trim()).filter(Boolean);

async function viewResources() {
  $('main').innerHTML = '<h2 class="page-title">Resources</h2><div class="empty">Memuat...</div>';
  try { await fetchResources(); }
  catch (e) { $('main').innerHTML = `<h2 class="page-title">Resources</h2><div class="empty">${esc(errText(e))}</div>`; return; }
  $('main').innerHTML = `<h2 class="page-title">Resources</h2>
  <div class="toolbar"><button class="btn primary" id="btnNewRes">Upload Resource</button></div>
  <div class="table-wrap">${S.resources.length ? `<table class="cards"><thead><tr><th></th><th>Nama</th><th>Kategori</th><th>Versi</th><th>Akses</th><th>File</th><th></th></tr></thead><tbody>${S.resources.map(r => `<tr><td data-l="Thumb">${r.thumbnail_path ? `<img class="thumb" src="${esc(publicUrl(THUMB_BUCKET, r.thumbnail_path))}" alt="">` : ''}</td><td data-l="Nama">${esc(r.name)}</td><td data-l="Kategori">${esc(r.category || '-')}</td><td data-l="Versi">${esc(r.version || '-')}</td><td data-l="Akses">${r.is_free ? 'Gratis' : 'Terbatas'}</td><td data-l="File">${esc(r.file_name || (r.file_path ? 'Ada' : '-'))}</td><td class="act"><div class="actions"><button class="btn sm" data-edit="${esc(r.id)}">Edit</button><button class="btn sm danger" data-del="${esc(r.id)}">Hapus</button></div></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Belum ada resource.</div>'}</div>`;
  $('btnNewRes').addEventListener('click', () => resModal(null));
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => resModal(S.resources.find(r => r.id === b.dataset.edit))));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    const r = S.resources.find(x => x.id === b.dataset.del);
    if (!confirm(`Hapus resource "${r.name}" beserta file dan thumbnail?`)) return;
    const { error } = await client.from(T.res).delete().eq('id', r.id);
    if (error) return toast(errText(error), true);
    if (r.file_path) await client.storage.from(FILES_BUCKET).remove([r.file_path]);
    if (r.thumbnail_path && !/^https?:/i.test(r.thumbnail_path)) await client.storage.from(THUMB_BUCKET).remove([r.thumbnail_path]);
    toast('Resource dihapus');
    viewResources();
  }));
}

function resModal(r) {
  const isNew = !r;
  const x = r || { is_free: true };
  const m = modal(`<h3>${isNew ? 'Upload Resource' : 'Edit Resource'}<button class="btn sm" data-close>Tutup</button></h3>
  <form id="resForm">
    <div class="grid2">
      <div class="form-group"><label>Nama</label><input class="form-control" name="name" value="${esc(x.name || '')}" maxlength="150" required></div>
      <div class="form-group"><label>Kategori / Tipe</label><input class="form-control" name="category" value="${esc(x.category || '')}" maxlength="60" required></div>
      <div class="form-group"><label>Versi</label><input class="form-control" name="version" value="${esc(x.version || '')}" maxlength="40"></div>
      <div class="form-group"><label>Akses</label><select class="form-control" name="is_free"><option value="1" ${x.is_free ? 'selected' : ''}>Gratis</option><option value="0" ${x.is_free ? '' : 'selected'}>Terbatas</option></select></div>
      <div class="form-group"><label>Dependencies (pisahkan koma)</label><input class="form-control" name="dependencies" value="${esc(toArr(x.dependencies).join(', '))}"></div>
      <div class="form-group"><label>Tags (pisahkan koma)</label><input class="form-control" name="tags" value="${esc(toArr(x.tags).join(', '))}"></div>
    </div>
    <div class="form-group"><label>Deskripsi Singkat</label><input class="form-control" name="short_description" value="${esc(x.short_description || '')}" maxlength="240"></div>
    <div class="form-group"><label>Deskripsi Lengkap</label><textarea class="form-control" name="description">${esc(x.description || '')}</textarea></div>
    <div class="form-group"><label>Code Preview</label><textarea class="form-control" name="code_preview" spellcheck="false" style="font-family:ui-monospace,monospace;font-size:.78rem">${esc(x.code_preview || '')}</textarea></div>
    <div class="grid2">
      <div class="form-group"><label>Thumbnail (PNG/JPG/WEBP, maks 2 MB)</label><input class="form-control" type="file" name="thumb" accept="image/png,image/jpeg,image/webp,image/gif" style="padding-top:9px">${x.thumbnail_path ? `<div class="logo-box" style="margin-top:.5rem"><img class="thumb" src="${esc(publicUrl(THUMB_BUCKET, x.thumbnail_path))}" alt=""><label style="font-weight:500;font-size:.78rem"><input type="checkbox" name="rm_thumb"> Hapus thumbnail</label></div>` : ''}</div>
      <div class="form-group"><label>File Resource (maks 50 MB)</label><input class="form-control" type="file" name="file" style="padding-top:9px">${x.file_path ? `<div class="hint">File saat ini: ${esc(x.file_name || x.file_path)}</div>` : ''}</div>
    </div>
    <div class="modal-foot"><button type="button" class="btn" data-close>Batal</button><button class="btn primary" type="submit" id="resSave">Simpan</button></div>
  </form>`, true);
  m.querySelector('#resForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target, f = new FormData(form);
    const thumb = f.get('thumb'), file = f.get('file');
    const hasThumb = thumb && thumb.size > 0, hasFile = file && file.size > 0;
    if (hasThumb) { const bad = validateImage(thumb); if (bad) return toast(bad, true); }
    if (hasFile && file.size > 50 * 1024 * 1024) return toast('Ukuran file maksimal 50 MB.', true);
    const btn = $('resSave');
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    const uploaded = [];
    try {
      const payload = {
        name: f.get('name').trim(),
        category: f.get('category').trim(),
        version: f.get('version').trim() || null,
        is_free: f.get('is_free') === '1',
        short_description: f.get('short_description').trim() || null,
        description: f.get('description').trim() || null,
        code_preview: f.get('code_preview') || null
      };
      const deps = fromCsv(f.get('dependencies')), tags = fromCsv(f.get('tags'));
      const asText = S.tagsAsText || (r && (typeof r.tags === 'string' || typeof r.dependencies === 'string'));
      payload.dependencies = asText ? (deps.join(', ') || null) : deps;
      payload.tags = asText ? (tags.join(', ') || null) : tags;
      const stamp = Date.now();
      let oldThumb = null, oldFile = null;
      if (hasThumb) {
        const path = `${stamp}_${safeName(thumb.name)}`;
        const up = await client.storage.from(THUMB_BUCKET).upload(path, thumb, { contentType: thumb.type });
        if (up.error) throw up.error;
        uploaded.push([THUMB_BUCKET, path]);
        payload.thumbnail_path = path;
        if (r && r.thumbnail_path) oldThumb = r.thumbnail_path;
      } else if (r && f.get('rm_thumb')) {
        payload.thumbnail_path = null;
        oldThumb = r.thumbnail_path;
      }
      if (hasFile) {
        const path = `${stamp}_${safeName(file.name)}`;
        const up = await client.storage.from(FILES_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream' });
        if (up.error) throw up.error;
        uploaded.push([FILES_BUCKET, path]);
        payload.file_path = path;
        payload.file_name = file.name;
        if (r && r.file_path) oldFile = r.file_path;
      }
      const q = isNew ? client.from(T.res).insert(payload) : client.from(T.res).update(payload).eq('id', r.id);
      const { error } = await q;
      if (error) throw error;
      if (oldThumb && !/^https?:/i.test(oldThumb)) await client.storage.from(THUMB_BUCKET).remove([oldThumb]);
      if (oldFile) await client.storage.from(FILES_BUCKET).remove([oldFile]);
      toast(isNew ? 'Resource ditambahkan' : 'Resource diperbarui');
      closeModal(m);
      viewResources();
    } catch (err) {
      for (const [bucket, path] of uploaded) await client.storage.from(bucket).remove([path]);
      toast(errText(err), true);
      btn.disabled = false; btn.textContent = 'Simpan';
    }
  });
}
