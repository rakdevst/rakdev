import { 
  supabase, 
  ADMIN_EMAIL, 
  isCurrentUserAdmin, 
  getCurrentUser, 
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  uploadFileToStorage
} from '/shared/supabaseClient.js';

const $ = (id) => document.getElementById(id);

const S = {
  user: null,
  view: 'dashboard',
  slots: [],
  bookings: [],
  resources: [],
  tutorials: [],
  dbHealth: { ready: false, tables: {} }
};

function toast(msg, isErr = false) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = isErr ? 'toast err' : 'toast';
  t.hidden = false;
  setTimeout(() => { t.hidden = true; }, 3200);
}

function esc(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(d) {
  if (!d) return '-';
  try {
    return new Date(d + (String(d).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  } catch (e) {
    return d;
  }
}

// Sidebar view switcher
document.querySelectorAll('.nav-btn[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    go(btn.getAttribute('data-view'));
  });
});

$('btnMenu')?.addEventListener('click', () => {
  $('sidebar').classList.toggle('open');
});

function go(view) {
  S.view = view;
  document.querySelectorAll('.nav-btn[data-view]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-view') === view);
  });
  if (window.innerWidth <= 768) {
    $('sidebar').classList.remove('open');
  }

  const views = {
    dashboard: viewDashboard,
    endorser: viewEndorser,
    bookings: viewBookings,
    resources: viewResources,
    tutorials: viewTutorials,
    database: viewDatabase
  };

  if (views[view]) views[view]();
}

// 1. View Dashboard
async function viewDashboard() {
  $('main').innerHTML = '<h2 class="page-title">Dashboard Studio</h2><div style="color:var(--text-muted)">Memuat data...</div>';
  await Promise.all([fetchSlots(), fetchBookings(), fetchResources(), fetchTutorials()]);

  const totalSlots = S.slots.length;
  const availSlots = S.slots.filter(s => s.status === 'available').length;
  const pendingBookings = S.bookings.filter(b => b.status === 'pending').length;
  const inProd = S.bookings.filter(b => b.status === 'in_production').length;
  const totalRes = S.resources.length;
  const totalTut = S.tutorials.length;

  $('main').innerHTML = `
    <h2 class="page-title">Dashboard Studio</h2>
    <div class="stats">
      <div class="stat"><b>${totalSlots}</b><span>Total Slot</span></div>
      <div class="stat"><b style="color:#16a34a">${availSlots}</b><span>Slot Available</span></div>
      <div class="stat"><b style="color:#2563eb">${pendingBookings}</b><span>Booking Menunggu</span></div>
      <div class="stat"><b style="color:#7c3aed">${inProd}</b><span>Sedang Dikerjakan</span></div>
      <div class="stat"><b>${totalRes}</b><span>Total Resources</span></div>
      <div class="stat"><b>${totalTut}</b><span>Total Tutorial</span></div>
    </div>

    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:1.25rem;margin-top:1.5rem">
      <h3 style="font-size:1.05rem;font-weight:800;margin-bottom:0.75rem">Pesanan Terbaru</h3>
      <div class="table-wrap" style="margin-top:0">
        ${S.bookings.length ? `
          <table class="cards">
            <thead>
              <tr>
                <th>Server</th>
                <th>Pemesan</th>
                <th>Status</th>
                <th>Tanggal Order</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${S.bookings.slice(0, 5).map(b => `
                <tr>
                  <td><b>${esc(b.server_name)}</b><br><small class="mono" style="color:var(--text-muted)">${esc(b.server_ip)}</small></td>
                  <td>${esc(b.username || b.email || '-')}</td>
                  <td><span class="badge badge-${b.status}">${b.status}</span></td>
                  <td>${fmtDate(b.created_at)}</td>
                  <td><button class="btn sm" data-view-booking="${b.id}">Kelola &rarr;</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<div style="padding:1.5rem;text-align:center;color:var(--text-muted)">Belum ada pesanan masuk.</div>'}
      </div>
    </div>
  `;

  document.querySelectorAll('[data-view-booking]').forEach(btn => {
    btn.addEventListener('click', () => {
      go('bookings');
    });
  });
}

// 2. View Endorser Slots
async function viewEndorser() {
  $('main').innerHTML = '<h2 class="page-title">Kelola Slot Endorser</h2><div>Memuat slot...</div>';
  await fetchSlots();

  $('main').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;flex-wrap:wrap;gap:8px">
      <h2 class="page-title" style="margin-bottom:0">Kelola Slot Endorser</h2>
      <button class="btn primary" id="btnAddSlot">+ Tambah Slot Baru</button>
    </div>

    <div class="table-wrap">
      ${S.slots.length ? `
        <table class="cards">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Platform</th>
              <th>Jam</th>
              <th>Harga</th>
              <th>Status</th>
              <th>Server Terisi</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${S.slots.map(s => `
              <tr>
                <td><b>${fmtDate(s.scheduled_date)}</b></td>
                <td><span class="mono">${esc(s.platform)}</span> &bull; <small>${esc(s.content_type || 'Shorts')}</small></td>
                <td>${esc(s.time_slot || '-')}</td>
                <td class="mono">Rp${Number(s.price_idr || 0).toLocaleString('id-ID')}</td>
                <td><span class="badge badge-${s.status}">${s.status}</span></td>
                <td>${s.server_name ? `<b>${esc(s.server_name)}</b>` : '<span style="color:var(--text-muted)">-</span>'}</td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn sm" data-edit-slot="${s.id}">Edit</button>
                    <button class="btn sm danger" data-del-slot="${s.id}">Hapus</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Belum ada slot endorser. Klik tombol "+ Tambah Slot Baru" di atas.</div>'}
    </div>
  `;

  $('btnAddSlot').addEventListener('click', () => openSlotModal());

  document.querySelectorAll('[data-edit-slot]').forEach(b => {
    b.addEventListener('click', () => {
      const slot = S.slots.find(x => x.id === b.getAttribute('data-edit-slot'));
      if (slot) openSlotModal(slot);
    });
  });

  document.querySelectorAll('[data-del-slot]').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('Hapus slot ini?')) return;
      const id = b.getAttribute('data-del-slot');
      try {
        await supabase.from('endorser_slots').delete().eq('id', id);
        toast('Slot berhasil dihapus');
        viewEndorser();
      } catch (err) {
        toast('Gagal menghapus slot', true);
      }
    });
  });
}

function openSlotModal(slot = null) {
  const isEdit = !!slot;
  const m = openModal(isEdit ? 'Edit Slot Endorser' : 'Tambah Slot Baru');

  m.body.innerHTML = `
    <form id="fmSlot">
      <div class="grid2">
        <div class="form-group">
          <label>Tanggal Upload *</label>
          <input type="date" class="form-control" name="scheduled_date" value="${slot ? slot.scheduled_date : ''}" required>
        </div>
        <div class="form-group">
          <label>Platform *</label>
          <select class="form-control" name="platform">
            <option value="TikTok" ${slot && slot.platform === 'TikTok' ? 'selected' : ''}>TikTok</option>
            <option value="YouTube" ${slot && slot.platform === 'YouTube' ? 'selected' : ''}>YouTube</option>
            <option value="Instagram" ${slot && slot.platform === 'Instagram' ? 'selected' : ''}>Instagram</option>
          </select>
        </div>
      </div>
      <div class="grid2">
        <div class="form-group">
          <label>Jam Upload</label>
          <input type="text" class="form-control" name="time_slot" value="${slot ? esc(slot.time_slot || '') : 'Malam (19:00 - 21:00 WIB)'}">
        </div>
        <div class="form-group">
          <label>Tarif (IDR)</label>
          <input type="number" class="form-control" name="price_idr" value="${slot ? slot.price_idr || 0 : 0}">
        </div>
      </div>
      <div class="grid2">
        <div class="form-group">
          <label>Status Slot</label>
          <select class="form-control" name="status">
            <option value="available" ${slot && slot.status === 'available' ? 'selected' : ''}>Available (Tersedia)</option>
            <option value="pending" ${slot && slot.status === 'pending' ? 'selected' : ''}>Pending (Menunggu)</option>
            <option value="in_production" ${slot && slot.status === 'in_production' ? 'selected' : ''}>In Production (Dikerjakan)</option>
            <option value="completed" ${slot && slot.status === 'completed' ? 'selected' : ''}>Completed (Selesai)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Tipe Konten</label>
          <input type="text" class="form-control" name="content_type" value="${slot ? esc(slot.content_type || '') : 'Shorts / Video Pendek'}">
        </div>
      </div>
      <div class="form-group">
        <label>Nama Server Terisi (Opsional)</label>
        <input type="text" class="form-control" name="server_name" value="${slot ? esc(slot.server_name || '') : ''}">
      </div>
      <div class="modal-foot">
        <button type="button" class="btn sm" id="btnCancelModal">Batal</button>
        <button type="submit" class="btn sm primary">Simpan Slot</button>
      </div>
    </form>
  `;

  $('btnCancelModal').addEventListener('click', () => closeModal(m));
  $('fmSlot').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const payload = {
      scheduled_date: f.get('scheduled_date'),
      platform: f.get('platform'),
      time_slot: f.get('time_slot') || 'Malam (19:00 - 21:00 WIB)',
      price_idr: Number(f.get('price_idr')) || 0,
      status: f.get('status') || 'available',
      content_type: f.get('content_type') || 'Shorts / Video Pendek',
      server_name: f.get('server_name')?.toString().trim() || null,
      updated_at: new Date().toISOString()
    };

    try {
      if (isEdit) {
        await supabase.from('endorser_slots').update(payload).eq('id', slot.id);
        toast('Slot berhasil diperbarui');
      } else {
        await supabase.from('endorser_slots').insert(payload);
        toast('Slot baru berhasil ditambahkan');
      }
      closeModal(m);
      viewEndorser();
    } catch (err) {
      toast('Gagal menyimpan slot', true);
    }
  });
}

// 3. View Bookings & Pesanan
async function viewBookings() {
  $('main').innerHTML = '<h2 class="page-title">Booking & Pesanan Masuk</h2><div>Memuat booking...</div>';
  await fetchBookings();

  $('main').innerHTML = `
    <h2 class="page-title">Booking & Pesanan Masuk</h2>
    <div class="table-wrap">
      ${S.bookings.length ? `
        <table class="cards">
          <thead>
            <tr>
              <th>Server</th>
              <th>Kontak & User</th>
              <th>IP & Port</th>
              <th>Status</th>
              <th>Tanggal</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${S.bookings.map(b => `
              <tr>
                <td><b>${esc(b.server_name)}</b><br><small style="color:var(--text-muted)">Sosmed: ${esc(b.social_media || '-')}</small></td>
                <td>${esc(b.username || '-')}<br><small style="color:var(--text-muted)">${esc(b.email || '-')}</small></td>
                <td class="mono">${esc(b.server_ip)}:${esc(b.server_port || '25565')}</td>
                <td><span class="badge badge-${b.status}">${b.status}</span></td>
                <td>${fmtDate(b.created_at)}</td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn sm primary" data-manage-booking="${b.id}">Kelola</button>
                    ${b.status === 'pending' ? `<button class="btn sm" data-approve-booking="${b.id}" style="color:#16a34a">Setujui</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Belum ada pesanan booking masuk.</div>'}
    </div>
  `;

  document.querySelectorAll('[data-approve-booking]').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.getAttribute('data-approve-booking');
      try {
        await supabase.from('endorser_bookings').update({ status: 'approved' }).eq('id', id);
        toast('Booking disetujui');
        viewBookings();
      } catch (e) {
        toast('Gagal menyetujui booking', true);
      }
    });
  });

  document.querySelectorAll('[data-manage-booking]').forEach(b => {
    b.addEventListener('click', () => {
      const booking = S.bookings.find(x => x.id === b.getAttribute('data-manage-booking'));
      if (booking) openBookingManager(booking);
    });
  });
}

async function openBookingManager(b) {
  const m = openModal(`Kelola Pesanan: ${b.server_name}`);
  let conv = null;
  let chatChannel = null;

  m.body.innerHTML = `
    <div style="font-size:0.84rem;line-height:1.6;margin-bottom:1rem;background:#f8fafc;padding:12px;border-radius:8px;border:1px solid var(--border)">
      <div><b>Nama Server:</b> ${esc(b.server_name)}</div>
      <div><b>IP & Port:</b> <span class="mono">${esc(b.server_ip)}:${esc(b.server_port || '25565')}</span></div>
      <div><b>Pemesan:</b> ${esc(b.username || b.email)} (<span style="color:var(--text-muted)">${esc(b.email || '-')}</span>)</div>
      <div><b>Sosial Media:</b> ${b.social_media ? `<a href="${esc(b.social_media)}" target="_blank" rel="noopener">${esc(b.social_media)}</a>` : '-'}</div>
      ${b.features ? `<div style="margin-top:6px"><b>Fitur/Catatan Pemesan:</b><br>${esc(b.features)}</div>` : ''}
    </div>

    <form id="fmBookingPhase" style="margin-bottom:1.5rem">
      <div class="form-group">
        <label>Ubah Status Pesanan</label>
        <select class="form-control" name="status">
          <option value="pending" ${b.status === 'pending' ? 'selected' : ''}>Pending (Menunggu)</option>
          <option value="approved" ${b.status === 'approved' ? 'selected' : ''}>Approved (Disetujui)</option>
          <option value="in_production" ${b.status === 'in_production' ? 'selected' : ''}>In Production (Dikerjakan)</option>
          <option value="completed" ${b.status === 'completed' ? 'selected' : ''}>Completed (Selesai)</option>
          <option value="rejected" ${b.status === 'rejected' ? 'selected' : ''}>Rejected (Ditolak)</option>
        </select>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button type="submit" class="btn sm primary">Perbarui Status</button>
      </div>
    </form>

    <div style="border-top:1px solid var(--border);padding-top:1rem">
      <h4 style="font-size:0.92rem;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:6px">
        <span>💬 Live Chat Koordinasi dengan Klien</span>
      </h4>
      <div id="adminChatList" style="max-height:220px;overflow-y:auto;background:#fff;border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px;display:flex;flex-direction:column;gap:8px">
        <div style="font-size:0.75rem;color:var(--text-muted);text-align:center">Memuat riwayat chat...</div>
      </div>
      <form id="adminChatFm" style="display:flex;gap:6px">
        <input type="text" id="adminChatInput" class="form-control" placeholder="Ketik balasan untuk klien..." style="font-size:0.8125rem" required>
        <button type="submit" class="btn sm primary" style="white-space:nowrap">Kirim</button>
      </form>
    </div>

    <div class="modal-foot" style="margin-top:1rem">
      <button type="button" class="btn sm" id="btnCancelBookMgt">Tutup</button>
    </div>
  `;

  $('btnCancelBookMgt').addEventListener('click', () => {
    if (chatChannel) supabase.removeChannel(chatChannel);
    closeModal(m);
  });

  $('fmBookingPhase').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const newStatus = f.get('status');

    try {
      const { error: bErr } = await supabase.from('endorser_bookings').update({ status: newStatus }).eq('id', b.id);
      if (bErr) throw bErr;

      if (b.slot_id) {
        await supabase.from('endorser_slots').update({ 
          status: newStatus === 'approved' ? 'in_production' : (newStatus === 'completed' ? 'completed' : (newStatus === 'rejected' ? 'available' : 'pending'))
        }).eq('id', b.slot_id);
      }
      toast('Status pesanan berhasil diperbarui');
      b.status = newStatus;
      viewBookings();
    } catch (err) {
      toast(`Gagal: ${err.message || 'Gagal update status'}`, true);
    }
  });

  // Chat logic
  const chatListEl = $('adminChatList');
  const chatFmEl = $('adminChatFm');
  const chatInEl = $('adminChatInput');

  function renderAdminChat(messages) {
    if (!messages || messages.length === 0) {
      chatListEl.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted);text-align:center">Belum ada percakapan. Kirim pesan pembuka di bawah.</div>';
      return;
    }
    chatListEl.innerHTML = messages.map(msg => {
      const isAdmin = msg.sender_role === 'admin';
      return `
        <div style="align-self:${isAdmin ? 'flex-end' : 'flex-start'};max-width:85%;background:${isAdmin ? '#0f172a' : '#f1f5f9'};color:${isAdmin ? '#fff' : '#1e293b'};padding:6px 10px;border-radius:8px;font-size:0.8125rem">
          <div style="font-size:0.65rem;opacity:0.75;margin-bottom:2px">${isAdmin ? 'Admin rakDEV' : (esc(b.username || 'Klien'))}</div>
          <div>${esc(msg.body)}</div>
        </div>
      `;
    }).join('');
    chatListEl.scrollTop = chatListEl.scrollHeight;
  }

  try {
    const { data: convData } = await supabase.from('conversations').select('*').eq('booking_id', b.id).maybeSingle();
    conv = convData;
    if (conv) {
      const { data: msgs } = await supabase.from('messages').select('*').eq('conversation_id', conv.id).order('created_at', { ascending: true });
      renderAdminChat(msgs || []);

      // Realtime listener
      chatChannel = supabase
        .channel(`admin_chat_${conv.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conv.id}` }, (payload) => {
          const div = document.createElement('div');
          const isAdmin = payload.new.sender_role === 'admin';
          div.style.cssText = `align-self:${isAdmin ? 'flex-end' : 'flex-start'};max-width:85%;background:${isAdmin ? '#0f172a' : '#f1f5f9'};color:${isAdmin ? '#fff' : '#1e293b'};padding:6px 10px;border-radius:8px;font-size:0.8125rem`;
          div.innerHTML = `
            <div style="font-size:0.65rem;opacity:0.75;margin-bottom:2px">${isAdmin ? 'Admin rakDEV' : (esc(b.username || 'Klien'))}</div>
            <div>${esc(payload.new.body)}</div>
          `;
          chatListEl.appendChild(div);
          chatListEl.scrollTop = chatListEl.scrollHeight;
        })
        .subscribe();
    } else {
      chatListEl.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted);text-align:center">Room chat belum dibuat untuk booking ini.</div>';
    }
  } catch (ce) {
    chatListEl.innerHTML = '<div style="font-size:0.75rem;color:var(--text-muted)">Gagal memuat chat.</div>';
  }

  chatFmEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInEl.value.trim();
    if (!text || !conv) return;
    chatInEl.value = '';

    try {
      const { error: sendErr } = await supabase.from('messages').insert({
        conversation_id: conv.id,
        sender_id: S.user?.id || null,
        sender_role: 'admin',
        body: text
      });
      if (sendErr) throw sendErr;
    } catch (err) {
      toast(`Gagal mengirim chat: ${err.message}`, true);
    }
  });
}

// 4. View Resources
async function viewResources() {
  $('main').innerHTML = '<h2 class="page-title">Kelola Resources</h2><div>Memuat file...</div>';
  await fetchResources();

  $('main').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;flex-wrap:wrap;gap:8px">
      <h2 class="page-title" style="margin-bottom:0">Kelola Resources</h2>
      <button class="btn primary" id="btnAddRes">+ Upload Resource Baru</button>
    </div>

    <div class="table-wrap">
      ${S.resources.length ? `
        <table class="cards">
          <thead>
            <tr>
              <th>Judul</th>
              <th>Kategori</th>
              <th>Versi</th>
              <th>Ukuran</th>
              <th>Unduhan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${S.resources.map(r => `
              <tr>
                <td><b>${esc(r.title)}</b><br><small style="color:var(--text-muted)">${esc(r.file_name || '-')}</small></td>
                <td><span class="badge" style="background:#f1f5f9">${esc(r.category || 'Plugin')}</span></td>
                <td class="mono">v${esc(r.version || '1.0.0')}</td>
                <td class="mono">${esc(r.file_size || '-')}</td>
                <td class="mono">${r.downloads_count || 0}</td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn sm" data-edit-res="${r.id}">Edit</button>
                    <button class="btn sm danger" data-del-res="${r.id}">Hapus</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Belum ada resource file. Klik "+ Upload Resource Baru" di atas.</div>'}
    </div>
  `;

  $('btnAddRes').addEventListener('click', () => openResourceModal());

  document.querySelectorAll('[data-edit-res]').forEach(b => {
    b.addEventListener('click', () => {
      const res = S.resources.find(x => x.id === b.getAttribute('data-edit-res'));
      if (res) openResourceModal(res);
    });
  });

  document.querySelectorAll('[data-del-res]').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('Hapus resource ini?')) return;
      const id = b.getAttribute('data-del-res');
      try {
        await supabase.from('resources').delete().eq('id', id);
        toast('Resource berhasil dihapus');
        viewResources();
      } catch (e) {
        toast('Gagal menghapus resource', true);
      }
    });
  });
}

function openResourceModal(res = null) {
  const isEdit = !!res;
  const m = openModal(isEdit ? 'Edit Resource' : 'Upload Resource Baru');

  m.body.innerHTML = `
    <form id="fmRes">
      <div class="form-group">
        <label>Judul Resource *</label>
        <input type="text" class="form-control" name="title" value="${res ? esc(res.title) : ''}" required>
      </div>
      <div class="grid2">
        <div class="form-group">
          <label>Kategori *</label>
          <select class="form-control" name="category">
            <option value="Plugin" ${res && res.category === 'Plugin' ? 'selected' : ''}>Plugin</option>
            <option value="Skript" ${res && res.category === 'Skript' ? 'selected' : ''}>Skript</option>
            <option value="Config" ${res && res.category === 'Config' ? 'selected' : ''}>Config</option>
            <option value="Maps" ${res && res.category === 'Maps' ? 'selected' : ''}>Maps</option>
            <option value="Tools" ${res && res.category === 'Tools' ? 'selected' : ''}>Tools</option>
          </select>
        </div>
        <div class="form-group">
          <label>Versi</label>
          <input type="text" class="form-control" name="version" value="${res ? esc(res.version || '1.0.0') : '1.0.0'}">
        </div>
      </div>
      <div class="form-group">
        <label>File Resource (Upload ke Supabase Storage atau masukkan URL) *</label>
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <input type="file" id="resFileUpload" class="form-control" style="font-size:0.8125rem">
          <button type="button" class="btn sm" id="btnUploadResFile" style="white-space:nowrap">Upload File</button>
        </div>
        <input type="url" class="form-control" id="resDownloadUrl" name="download_url" value="${res ? esc(res.download_url || '') : ''}" placeholder="https://..." required>
      </div>
      <div class="grid2">
        <div class="form-group">
          <label>Ukuran File</label>
          <input type="text" class="form-control" id="resFileSize" name="file_size" value="${res ? esc(res.file_size || '') : '1.2 MB'}">
        </div>
        <div class="form-group">
          <label>Gambar Thumbnail (Upload atau Masukkan URL)</label>
          <div style="display:flex;gap:6px;margin-bottom:6px">
            <input type="file" id="resThumbUpload" accept="image/*" class="form-control" style="font-size:0.8125rem">
            <button type="button" class="btn sm" id="btnUploadResThumb" style="white-space:nowrap">Upload Gambar</button>
          </div>
          <input type="url" class="form-control" id="resThumbUrl" name="thumbnail_url" value="${res ? esc(res.thumbnail_url || '') : ''}" placeholder="https://...">
        </div>
      </div>
      <div class="form-group">
        <label>Deskripsi Singkat</label>
        <textarea class="form-control" name="description" rows="2">${res ? esc(res.description || '') : ''}</textarea>
      </div>
      <div class="form-group">
        <label>Tags / Kata Kunci (Dipisah koma)</label>
        <input type="text" class="form-control" name="tags" value="${res ? esc(res.tags || '') : ''}" placeholder="luckperms, economy, pvp">
      </div>
      <div class="modal-foot">
        <button type="button" class="btn sm" id="btnCancelResModal">Batal</button>
        <button type="submit" class="btn sm primary">Simpan Resource</button>
      </div>
    </form>
  `;

  $('btnUploadResFile').addEventListener('click', async () => {
    const file = $('resFileUpload').files?.[0];
    if (!file) { toast('Pilih file terlebih dahulu', true); return; }
    $('btnUploadResFile').disabled = true;
    $('btnUploadResFile').textContent = 'Mengupload...';
    try {
      const up = await uploadFileToStorage('resource-files', file);
      $('resDownloadUrl').value = up.publicUrl;
      $('resFileSize').value = up.fileSize;
      toast('File berhasil diupload ke Supabase Storage!');
    } catch (err) {
      toast(`Gagal upload: ${err.message}`, true);
    } finally {
      $('btnUploadResFile').disabled = false;
      $('btnUploadResFile').textContent = 'Upload File';
    }
  });

  $('btnUploadResThumb').addEventListener('click', async () => {
    const file = $('resThumbUpload').files?.[0];
    if (!file) { toast('Pilih gambar terlebih dahulu', true); return; }
    $('btnUploadResThumb').disabled = true;
    $('btnUploadResThumb').textContent = 'Mengupload...';
    try {
      const up = await uploadFileToStorage('resource-thumbnails', file);
      $('resThumbUrl').value = up.publicUrl;
      toast('Thumbnail berhasil diupload!');
    } catch (err) {
      toast(`Gagal upload: ${err.message}`, true);
    } finally {
      $('btnUploadResThumb').disabled = false;
      $('btnUploadResThumb').textContent = 'Upload Gambar';
    }
  });

  $('btnCancelResModal').addEventListener('click', () => closeModal(m));
  $('fmRes').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const payload = {
      title: f.get('title'),
      category: f.get('category'),
      version: f.get('version'),
      download_url: f.get('download_url'),
      file_size: f.get('file_size'),
      thumbnail_url: f.get('thumbnail_url') || null,
      description: f.get('description'),
      tags: f.get('tags'),
      updated_at: new Date().toISOString()
    };

    try {
      if (isEdit) {
        const { error } = await supabase.from('resources').update(payload).eq('id', res.id);
        if (error) throw error;
        toast('Resource diperbarui');
      } else {
        const { error } = await supabase.from('resources').insert(payload);
        if (error) throw error;
        toast('Resource baru ditambahkan');
      }
      closeModal(m);
      viewResources();
    } catch (err) {
      toast(`Gagal: ${err.message || 'Gagal menyimpan resource'}`, true);
    }
  });
}

// 5. View Tutorials
async function viewTutorials() {
  $('main').innerHTML = '<h2 class="page-title">Kelola Video Tutorial</h2><div>Memuat tutorial...</div>';
  await fetchTutorials();

  $('main').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem;flex-wrap:wrap;gap:8px">
      <h2 class="page-title" style="margin-bottom:0">Kelola Video Tutorial</h2>
      <button class="btn primary" id="btnAddTut">+ Tambah Tutorial Baru</button>
    </div>

    <div class="table-wrap">
      ${S.tutorials.length ? `
        <table class="cards">
          <thead>
            <tr>
              <th>Judul</th>
              <th>Platform</th>
              <th>Kategori</th>
              <th>Tautan Video</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${S.tutorials.map(t => `
              <tr>
                <td><b>${esc(t.title)}</b></td>
                <td><span class="badge" style="background:#fee2e2;color:#dc2626">${esc(t.platform || 'YouTube')}</span></td>
                <td>${esc(t.category || 'General')}</td>
                <td><a href="${esc(t.video_url || t.youtube_url)}" target="_blank" style="font-size:0.75rem">${esc(t.video_url || t.youtube_url)}</a></td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn sm" data-edit-tut="${t.id}">Edit</button>
                    <button class="btn sm danger" data-del-tut="${t.id}">Hapus</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Belum ada tutorial. Klik "+ Tambah Tutorial Baru" di atas.</div>'}
    </div>
  `;

  $('btnAddTut').addEventListener('click', () => openTutorialModal());

  document.querySelectorAll('[data-edit-tut]').forEach(b => {
    b.addEventListener('click', () => {
      const tut = S.tutorials.find(x => x.id === b.getAttribute('data-edit-tut'));
      if (tut) openTutorialModal(tut);
    });
  });

  document.querySelectorAll('[data-del-tut]').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('Hapus tutorial ini?')) return;
      const id = b.getAttribute('data-del-tut');
      try {
        const { error } = await supabase.from('tutorials').delete().eq('id', id);
        if (error) throw error;
        toast('Tutorial dihapus');
        viewTutorials();
      } catch (e) {
        toast(`Gagal: ${e.message || 'Gagal menghapus tutorial'}`, true);
      }
    });
  });
}

function openTutorialModal(tut = null) {
  const isEdit = !!tut;
  const m = openModal(isEdit ? 'Edit Tutorial' : 'Tambah Tutorial Baru');

  m.body.innerHTML = `
    <form id="fmTut">
      <div class="form-group">
        <label>Judul Tutorial *</label>
        <input type="text" class="form-control" name="title" value="${tut ? esc(tut.title) : ''}" required>
      </div>
      <div class="grid2">
        <div class="form-group">
          <label>Platform *</label>
          <select class="form-control" name="platform">
            <option value="YouTube" ${tut && tut.platform === 'YouTube' ? 'selected' : ''}>YouTube</option>
            <option value="TikTok" ${tut && tut.platform === 'TikTok' ? 'selected' : ''}>TikTok</option>
            <option value="Instagram" ${tut && tut.platform === 'Instagram' ? 'selected' : ''}>Instagram</option>
          </select>
        </div>
        <div class="form-group">
          <label>Kategori</label>
          <select class="form-control" name="category">
            <option value="Setup" ${tut && tut.category === 'Setup' ? 'selected' : ''}>Setup</option>
            <option value="Optimasi" ${tut && tut.category === 'Optimasi' ? 'selected' : ''}>Optimasi</option>
            <option value="Plugin" ${tut && tut.category === 'Plugin' ? 'selected' : ''}>Plugin</option>
            <option value="Skript" ${tut && tut.category === 'Skript' ? 'selected' : ''}>Skript</option>
            <option value="General" ${tut && tut.category === 'General' ? 'selected' : ''}>General</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>URL Video (YouTube / Link Video) *</label>
        <input type="url" class="form-control" name="video_url" value="${tut ? esc(tut.video_url || tut.youtube_url || '') : ''}" placeholder="https://youtube.com/watch?v=..." required>
      </div>
      <div class="form-group">
        <label>Gambar Thumbnail (Upload atau Masukkan URL)</label>
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <input type="file" id="tutThumbUpload" accept="image/*" class="form-control" style="font-size:0.8125rem">
          <button type="button" class="btn sm" id="btnUploadTutThumb" style="white-space:nowrap">Upload Gambar</button>
        </div>
        <input type="url" class="form-control" id="tutThumbUrl" name="thumbnail_url" value="${tut ? esc(tut.thumbnail_url || '') : ''}" placeholder="https://...">
      </div>
      <div class="form-group">
        <label>Deskripsi Tutorial</label>
        <textarea class="form-control" name="description" rows="2">${tut ? esc(tut.description || '') : ''}</textarea>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn sm" id="btnCancelTutModal">Batal</button>
        <button type="submit" class="btn sm primary">Simpan Tutorial</button>
      </div>
    </form>
  `;

  $('btnUploadTutThumb').addEventListener('click', async () => {
    const file = $('tutThumbUpload').files?.[0];
    if (!file) { toast('Pilih gambar terlebih dahulu', true); return; }
    $('btnUploadTutThumb').disabled = true;
    $('btnUploadTutThumb').textContent = 'Mengupload...';
    try {
      const up = await uploadFileToStorage('tutorial-thumbnails', file);
      $('tutThumbUrl').value = up.publicUrl;
      toast('Thumbnail berhasil diupload!');
    } catch (err) {
      toast(`Gagal upload: ${err.message}`, true);
    } finally {
      $('btnUploadTutThumb').disabled = false;
      $('btnUploadTutThumb').textContent = 'Upload Gambar';
    }
  });

  $('btnCancelTutModal').addEventListener('click', () => closeModal(m));
  $('fmTut').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const videoUrl = f.get('video_url');
    const payload = {
      title: f.get('title'),
      platform: f.get('platform'),
      category: f.get('category'),
      video_url: videoUrl,
      youtube_url: videoUrl,
      thumbnail_url: f.get('thumbnail_url') || null,
      description: f.get('description'),
      updated_at: new Date().toISOString()
    };

    try {
      if (isEdit) {
        const { error } = await supabase.from('tutorials').update(payload).eq('id', tut.id);
        if (error) throw error;
        toast('Tutorial diperbarui');
      } else {
        const { error } = await supabase.from('tutorials').insert(payload);
        if (error) throw error;
        toast('Tutorial baru ditambahkan');
      }
      closeModal(m);
      viewTutorials();
    } catch (err) {
      toast(`Gagal: ${err.message || 'Gagal menyimpan tutorial'}`, true);
    }
  });
}

// 6. View Database Status & Setup Guide
async function viewDatabase() {
  $('main').innerHTML = '<h2 class="page-title">Status Database Supabase</h2><div>Memeriksa koneksi...</div>';

  let slotOk = false, resOk = false, tutOk = false, bookOk = false;

  try {
    const { error: e1 } = await supabase.from('endorser_slots').select('id').limit(1);
    slotOk = !e1;
  } catch (e) {}

  try {
    const { error: e2 } = await supabase.from('resources').select('id').limit(1);
    resOk = !e2;
  } catch (e) {}

  try {
    const { error: e3 } = await supabase.from('tutorials').select('id').limit(1);
    tutOk = !e3;
  } catch (e) {}

  try {
    const { error: e4 } = await supabase.from('endorser_bookings').select('id').limit(1);
    bookOk = !e4;
  } catch (e) {}

  const allReady = slotOk && resOk && tutOk && bookOk;

  $('main').innerHTML = `
    <h2 class="page-title">Status Database Supabase</h2>
    
    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:1.25rem;margin-bottom:1.5rem">
      <h3 style="font-size:1rem;font-weight:800;margin-bottom:0.75rem">Koneksi Database Aktif</h3>
      <div style="font-size:0.8125rem;line-height:1.7">
        <div><b>Project URL:</b> <span class="mono">${SUPABASE_URL}</span></div>
        <div><b>API Key:</b> <span class="mono">${SUPABASE_ANON_KEY.slice(0, 16)}...</span></div>
        <div><b>Status Tabel:</b> ${allReady ? '<span class="badge badge-available">Semua Tabel Siap</span>' : '<span class="badge badge-pending">Belum Semua Tabel Dibuat</span>'}</div>
      </div>
    </div>

    <div style="background:#fff;border:1px solid var(--border);border-radius:var(--r);padding:1.25rem">
      <h3 style="font-size:1rem;font-weight:800;margin-bottom:0.5rem">Panduan Setup Database Baru</h3>
      <p style="font-size:0.8125rem;color:var(--text-muted);line-height:1.6;margin-bottom:1rem">
        Jika project Supabase ini baru dibuat, Anda hanya perlu membuka <b>Supabase Dashboard &rarr; SQL Editor</b>, lalu jalankan file skrip <b>supabase_schema.sql</b> yang sudah disediakan di root folder proyek ini.
      </p>
      
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a href="https://supabase.com/dashboard/project/shkxmedtmkbmykzogery/sql" target="_blank" rel="noopener noreferrer" class="btn primary sm">
          Buka Supabase SQL Editor &rarr;
        </a>
        <button type="button" class="btn sm" id="btnCopySql">
          📋 Salin Skrip SQL Schema
        </button>
      </div>
    </div>
  `;

  $('btnCopySql')?.addEventListener('click', async () => {
    try {
      const res = await fetch('/supabase_schema.sql');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      toast('Skrip SQL berhasil disalin ke clipboard!');
    } catch (e) {
      toast('Gagal menyalin SQL. Buka file supabase_schema.sql di project.', true);
    }
  });
}

// Modal helper
function openModal(title) {
  const scrim = document.createElement('div');
  scrim.className = 'modal-scrim';
  scrim.innerHTML = `
    <div class="modal-card">
      <div class="modal-head">
        <h3>${esc(title)}</h3>
        <button type="button" class="btn sm" id="_closeModalBtn">&times;</button>
      </div>
      <div class="modal-body-content"></div>
    </div>
  `;
  document.body.appendChild(scrim);

  scrim.querySelector('#_closeModalBtn').addEventListener('click', () => closeModal({ scrim }));
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) closeModal({ scrim });
  });

  return {
    scrim,
    body: scrim.querySelector('.modal-body-content')
  };
}

function closeModal(m) {
  if (m && m.scrim) m.scrim.remove();
}

// Data fetchers
async function fetchSlots() {
  try {
    const { data } = await supabase.from('endorser_slots').select('*').order('scheduled_date', { ascending: true });
    S.slots = data || [];
  } catch (e) {
    S.slots = [];
  }
}

async function fetchBookings() {
  try {
    const { data } = await supabase.from('endorser_bookings').select('*').order('created_at', { ascending: false });
    S.bookings = data || [];
  } catch (e) {
    S.bookings = [];
  }
}

async function fetchResources() {
  try {
    const { data } = await supabase.from('resources').select('*').order('created_at', { ascending: false });
    S.resources = data || [];
  } catch (e) {
    S.resources = [];
  }
}

async function fetchTutorials() {
  try {
    const { data } = await supabase.from('tutorials').select('*').order('created_at', { ascending: false });
    S.tutorials = data || [];
  } catch (e) {
    S.tutorials = [];
  }
}

// Authentication & Panel Boot
async function checkAuthAndBoot() {
  if (!supabase) {
    $('gateText').textContent = 'Koneksi database tidak tersedia.';
    return;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      $('loginView').hidden = false;
      document.body.classList.add('ready');
      setupLoginForm();
      return;
    }

    S.user = user;
    const isAdmin = await isCurrentUserAdmin(user);

    if (!isAdmin) {
      $('deniedEmail').textContent = user.email || 'Pengguna';
      $('deniedView').hidden = false;
      document.body.classList.add('ready');
      $('btnDeniedLogout').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.replace('/login.html');
      });
      return;
    }

    // User is Admin!
    $('whoName').textContent = user.user_metadata?.full_name || 'Admin rakDEV';
    $('whoEmail').textContent = user.email || '';
    $('btnLogout').addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.replace('/login.html');
    });

    $('panelView').hidden = false;
    document.body.classList.add('ready');

    // Pasang Realtime Listener untuk Bookings dan Slots agar admin terupdate otomatis
    if (supabase) {
      supabase
        .channel('admin_realtime_events')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'endorser_bookings' }, () => {
          if (S.view === 'bookings' || S.view === 'dashboard') {
            go(S.view);
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'endorser_slots' }, () => {
          if (S.view === 'endorser' || S.view === 'dashboard') {
            go(S.view);
          }
        })
        .subscribe();
    }

    go('dashboard');
  } catch (err) {
    $('gateText').textContent = 'Terjadi kesalahan saat memeriksa izin.';
  }
}

function setupLoginForm() {
  $('fmLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('inEmail').value.trim();
    const password = $('inPass').value;
    const alertBox = $('loginAlert');

    alertBox.hidden = true;
    $('btnLogin').disabled = true;
    $('btnLogin').textContent = 'Memverifikasi...';

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      alertBox.textContent = err.message || 'Login gagal';
      alertBox.hidden = false;
      $('btnLogin').disabled = false;
      $('btnLogin').textContent = 'Masuk ke Panel';
    }
  });
}

checkAuthAndBoot();
