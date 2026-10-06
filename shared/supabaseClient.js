// ==============================================================================
// rakDEV STUDIO - SHARED SUPABASE CLIENT & REAL BACKEND CONNECTOR
// ==============================================================================

export const SUPABASE_URL = 'https://shkxmedtmkbmykzogery.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_3hDUbJHHVocYsa4hC0045A_17Lyo0zU';
export const ADMIN_EMAIL = 'akunrakaaja35@gmail.com';

export const isConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(SUPABASE_URL) &&
  SUPABASE_ANON_KEY.length > 30;

export const supabase = (typeof window !== 'undefined' && window.supabase && isConfigured)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/**
 * Toast notification universal
 */
export function showToast(message, isError = false, duration = 3500) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = isError ? 'toast toast-error' : 'toast';
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
    t.style.transition = 'all 0.2s ease';
    setTimeout(() => t.remove(), 200);
  }, duration);
}

/**
 * Mendapatkan user yang sedang login saat ini dari Supabase Auth
 */
export async function getCurrentUser() {
  if (!supabase) return null;
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch (e) {
    return null;
  }
}

/**
 * Cek apakah user saat ini memiliki akses Admin
 * Diverifikasi dari email administrator dan database public.profiles
 */
export async function isCurrentUserAdmin(user = null) {
  if (!user) user = await getCurrentUser();
  if (!user) return false;
  if (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;

  if (supabase) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile && (profile.role === 'admin' || profile.role === 'owner')) return true;
    } catch (e) {}
  }
  return false;
}

/**
 * Sinkronisasi Navbar & Drawer di seluruh halaman secara otomatis
 */
export async function initSmartNavbar(activePage = '') {
  const user = await getCurrentUser();
  const isAdmin = user ? await isCurrentUserAdmin(user) : false;

  const menuNameEl = document.getElementById('menuName');
  const menuEmailEl = document.getElementById('menuEmail');
  const logoutBtn = document.getElementById('logoutBtn');
  const logoutLabel = document.getElementById('logoutLabel');

  if (user) {
    const meta = user.user_metadata || {};
    const name = String(meta.full_name || meta.name || user.email?.split('@')[0] || 'Pengguna').trim();

    if (menuNameEl) menuNameEl.textContent = name;
    if (menuEmailEl) menuEmailEl.textContent = user.email || '';
    if (logoutLabel) logoutLabel.textContent = 'Logout';

    if (supabase) {
      try {
        const { data: prof } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle();
        if (prof && prof.full_name && menuNameEl) {
          menuNameEl.textContent = prof.full_name;
        }
      } catch (e) {}
    }
  } else {
    if (menuNameEl) menuNameEl.textContent = 'Tamu';
    if (menuEmailEl) menuEmailEl.textContent = 'Belum login';
    if (logoutLabel) logoutLabel.textContent = 'Login';
  }

  if (isAdmin) {
    const headerInner = document.querySelector('.header-inner');
    if (headerInner && !document.getElementById('smartAdminBtn')) {
      const adminBtn = document.createElement('a');
      adminBtn.id = 'smartAdminBtn';
      adminBtn.href = '/admin.html';
      adminBtn.className = 'smart-admin-badge';
      adminBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 2l7 4v6c0 5-3.5 9.5-7 10-3.5-.5-7-5-7-10V6l7-4z"/>
        </svg>
        <span>Admin</span>
      `;
      adminBtn.setAttribute('title', 'Akses Panel Pengelolaan rakDEV');

      const actions = headerInner.querySelector('.header-actions');
      if (actions) {
        headerInner.insertBefore(adminBtn, actions);
      } else {
        headerInner.appendChild(adminBtn);
      }
    }

    const menuNav = document.querySelector('.menu-nav');
    if (menuNav && !document.getElementById('menuAdminLink')) {
      const adminItem = document.createElement('a');
      adminItem.id = 'menuAdminLink';
      adminItem.href = '/admin.html';
      adminItem.className = 'menu-item admin-menu-highlight';
      adminItem.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24"><path d="M12 2l7 4v6c0 5-3.5 9.5-7 10-3.5-.5-7-5-7-10V6l7-4z"/></svg>
        <span>Admin Panel</span>
        <span class="badge" style="background:#0f172a;color:#fff;margin-left:auto">ADMIN</span>
      `;
      menuNav.insertBefore(adminItem, menuNav.firstChild);
    }
  }

  return { user, isAdmin };
}

/**
 * Upload file ke Supabase Storage secara nyata
 */
export async function uploadFileToStorage(bucketName, file, folder = '') {
  if (!supabase) throw new Error('Koneksi Supabase belum tersedia.');
  if (!file) throw new Error('File tidak valid.');

  const ext = file.name.split('.').pop();
  const safeName = `${folder ? folder + '/' : ''}${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(safeName, file, { cacheControl: '3600', upsert: false });

  if (error) {
    throw new Error(`Upload gagal: ${error.message}`);
  }

  const { data: publicData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(data.path);

  const formattedSize = file.size > 1024 * 1024
    ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
    : (file.size / 1024).toFixed(0) + ' KB';

  return {
    path: data.path,
    publicUrl: publicData.publicUrl,
    fileName: file.name,
    fileSize: formattedSize
  };
}

// ==============================================================================
// REAL SUPABASE DATA ENGINE (rakDb) — NO MOCK, NO LOCALSTORAGE DATABASE
// ==============================================================================

export const rakDb = {
  /**
   * 1. Mengambil seluruh slot endorser dari PostgreSQL Supabase
   */
  async getSlots() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('endorser_slots')
        .select('*')
        .order('scheduled_date', { ascending: true });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('relation')) {
          console.warn('[rakDb] Tabel public.endorser_slots belum dibuat di database Supabase.');
          return [];
        }
        console.warn('[rakDb.getSlots]', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('[rakDb.getSlots]', e?.message || e);
      return [];
    }
  },

  /**
   * 2. Melakukan booking slot secara nyata di Supabase
   */
  async bookSlot({ slot_id, server_name, server_ip, server_port, features, social_media, logo_url, user }) {
    if (!supabase) throw new Error('Database Supabase tidak terhubung.');
    if (!user) throw new Error('Anda harus login terlebih dahulu untuk memesan slot.');

    // Coba via stored procedure RPC public.create_booking jika tersedia di DB
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('create_booking', {
        p_slot_id: slot_id,
        p_server_name: server_name,
        p_server_ip: server_ip,
        p_server_port: server_port || '25565',
        p_features: features || '',
        p_social_media: social_media || '',
        p_logo_url: logo_url || null
      });

      if (!rpcError && rpcData) {
        return rpcData;
      }
    } catch (e) {
      // Jika RPC belum dieksekusi di schema, lakukan query direct
    }

    // Direct insertion flow
    const username = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Client';
    const email = user.email || '';

    // 1. Simpan booking ke public.endorser_bookings
    const { data: booking, error: bookErr } = await supabase
      .from('endorser_bookings')
      .insert({
        slot_id,
        user_id: user.id,
        server_name,
        server_ip,
        server_port: server_port || '25565',
        features,
        social_media,
        logo_url: logo_url || null,
        status: 'pending',
        username,
        email
      })
      .select()
      .single();

    if (bookErr) {
      console.error('[rakDb.bookSlot error]', bookErr);
      throw new Error(`Gagal menyimpan booking: ${bookErr.message}`);
    }

    // 2. Update status slot menjadi pending
    await supabase
      .from('endorser_slots')
      .update({ status: 'pending', server_name })
      .eq('id', slot_id);

    // 3. Buat percakapan di public.conversations
    let convId = null;
    const { data: convData, error: convErr } = await supabase
      .from('conversations')
      .insert({
        booking_id: booking.id,
        user_id: user.id
      })
      .select()
      .maybeSingle();

    if (!convErr && convData) {
      convId = convData.id;
      // 4. Buat pesan selamat datang dari studio
      await supabase.from('messages').insert({
        conversation_id: convId,
        sender_role: 'admin',
        body: `Halo! Pengajuan booking untuk server "${server_name}" telah diterima. Tim rakDEV Studio akan segera meninjau detail teknis dan berkoordinasi via chat ini.`
      });
    }

    return booking;
  },

  /**
   * 3. Mengambil booking milik user yang sedang login
   */
  async getUserBookings(userId) {
    if (!supabase || !userId) return [];
    const { data, error } = await supabase
      .from('endorser_bookings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[rakDb.getUserBookings error]', error);
      return [];
    }
    return data || [];
  },

  /**
   * 4. Mengambil percakapan live chat untuk booking tertentu
   */
  async getConversation(bookingId) {
    if (!supabase || !bookingId) return null;
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (error) {
      console.warn('[rakDb.getConversation error]', error);
      return null;
    }
    return data;
  },

  /**
   * 5. Mengambil pesan percakapan realtime
   */
  async getMessages(conversationId) {
    if (!supabase || !conversationId) return [];
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[rakDb.getMessages error]', error);
      return [];
    }
    return data || [];
  },

  /**
   * 6. Mengirim pesan chat baru
   */
  async sendMessage({ conversation_id, sender_role, body, user }) {
    if (!supabase) throw new Error('Database Supabase tidak terhubung.');
    if (!conversation_id) throw new Error('ID percakapan tidak valid.');
    if (!body || !body.trim()) throw new Error('Pesan tidak boleh kosong.');

    const newMsg = {
      conversation_id,
      sender_id: user?.id || null,
      sender_role: sender_role || 'client',
      body: body.trim()
    };

    const { data, error } = await supabase
      .from('messages')
      .insert(newMsg)
      .select()
      .single();

    if (error) {
      console.error('[rakDb.sendMessage error]', error);
      throw new Error(`Gagal mengirim pesan: ${error.message}`);
    }
    return data;
  },

  /**
   * 7. Mengambil daftar file resource
   */
  async getResources() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('relation')) {
          console.warn('[rakDb] Tabel public.resources belum dibuat di database Supabase.');
          return [];
        }
        console.warn('[rakDb.getResources]', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('[rakDb.getResources]', e?.message || e);
      return [];
    }
  },

  /**
   * 8. Menambah counter unduhan resource
   */
  async trackResourceDownload(resourceId) {
    if (!supabase || !resourceId) return;
    try {
      // Gunakan RPC increment_resource_downloads jika ada
      const { error: rpcErr } = await supabase.rpc('increment_resource_downloads', {
        p_resource_id: resourceId
      });
      if (rpcErr) {
        // Fallback: update manual
        const { data: current } = await supabase.from('resources').select('downloads_count').eq('id', resourceId).single();
        if (current) {
          await supabase.from('resources').update({
            downloads_count: (current.downloads_count || 0) + 1
          }).eq('id', resourceId);
        }
      }
    } catch (e) {}
  },

  /**
   * 9. Mengambil daftar video tutorial
   */
  async getTutorials() {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('tutorials')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('relation')) {
          console.warn('[rakDb] Tabel public.tutorials belum dibuat di database Supabase.');
          return [];
        }
        console.warn('[rakDb.getTutorials]', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('[rakDb.getTutorials]', e?.message || e);
      return [];
    }
  },

  /**
   * 10. Operasi CRUD Admin Nyata di Supabase
   */
  async addSlot(slotData) {
    if (!supabase) throw new Error('Database Supabase tidak terhubung.');
    const { data, error } = await supabase.from('endorser_slots').insert(slotData).select().single();
    if (error) throw error;
    return data;
  },

  async updateSlot(id, slotData) {
    if (!supabase) throw new Error('Database Supabase tidak terhubung.');
    const { data, error } = await supabase.from('endorser_slots').update(slotData).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteSlot(id) {
    if (!supabase) throw new Error('Database Supabase tidak terhubung.');
    const { error } = await supabase.from('endorser_slots').delete().eq('id', id);
    if (error) throw error;
  },

  async addResource(resData) {
    if (!supabase) throw new Error('Database Supabase tidak terhubung.');
    const { data, error } = await supabase.from('resources').insert(resData).select().single();
    if (error) throw error;
    return data;
  },

  async updateResource(id, resData) {
    if (!supabase) throw new Error('Database Supabase tidak terhubung.');
    const { data, error } = await supabase.from('resources').update(resData).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteResource(id) {
    if (!supabase) throw new Error('Database Supabase tidak terhubung.');
    const { error } = await supabase.from('resources').delete().eq('id', id);
    if (error) throw error;
  },

  async addTutorial(tutData) {
    if (!supabase) throw new Error('Database Supabase tidak terhubung.');
    const { data, error } = await supabase.from('tutorials').insert(tutData).select().single();
    if (error) throw error;
    return data;
  },

  async updateTutorial(id, tutData) {
    if (!supabase) throw new Error('Database Supabase tidak terhubung.');
    const { data, error } = await supabase.from('tutorials').update(tutData).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteTutorial(id) {
    if (!supabase) throw new Error('Database Supabase tidak terhubung.');
    const { error } = await supabase.from('tutorials').delete().eq('id', id);
    if (error) throw error;
  },

  async updateBookingPhase(bookingId, { status, current_phase, progress_percent, slot_id }) {
    if (!supabase) throw new Error('Database Supabase tidak terhubung.');
    const { error: bErr } = await supabase.from('endorser_bookings').update({ status }).eq('id', bookingId);
    if (bErr) throw bErr;

    if (slot_id) {
      const slotUpdate = { status };
      if (current_phase !== undefined) slotUpdate.current_phase = current_phase;
      if (progress_percent !== undefined) slotUpdate.progress_percent = progress_percent;
      await supabase.from('endorser_slots').update(slotUpdate).eq('id', slot_id);
    }
  }
};

/**
 * Ringkasan data cerdas antar fitur untuk Dashboard (dibaca langsung dari Supabase)
 */
export async function getSmartHubOverview() {
  if (!supabase) {
    return {
      availableSlots: 0,
      upcomingSlot: null,
      totalResources: 0,
      totalTutorials: 0,
      userBookings: 0,
      activeBooking: null
    };
  }

  try {
    const [slotsRes, resRes, tutRes, user] = await Promise.all([
      supabase.from('endorser_slots').select('*').order('scheduled_date', { ascending: true }),
      supabase.from('resources').select('id, title, category, created_at').order('created_at', { ascending: false }),
      supabase.from('tutorials').select('id, title, category, created_at').order('created_at', { ascending: false }),
      getCurrentUser()
    ]);

    const slots = slotsRes.data || [];
    const resources = resRes.data || [];
    const tutorials = tutRes.data || [];

    const availableSlots = slots.filter(s => s.status === 'available');

    let bookings = [];
    if (user) {
      const { data: bData } = await supabase
        .from('endorser_bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      bookings = bData || [];
    }

    return {
      availableSlots: availableSlots.length,
      upcomingSlot: availableSlots[0] || null,
      totalResources: resources.length,
      totalTutorials: tutorials.length,
      userBookings: bookings.length,
      activeBooking: bookings.length > 0 ? bookings[0] : null,
      recentResources: resources.slice(0, 3),
      recentTutorials: tutorials.slice(0, 3)
    };
  } catch (err) {
    console.warn('[getSmartHubOverview error]', err);
    return {
      availableSlots: 0,
      upcomingSlot: null,
      totalResources: 0,
      totalTutorials: 0,
      userBookings: 0,
      activeBooking: null
    };
  }
}

/**
 * Mencari tutorial terkait dari database Supabase
 */
export async function getRelatedTutorials(category = '', keyword = '', limit = 2) {
  if (!supabase) return [];
  try {
    let query = supabase.from('tutorials').select('*');
    if (category && category !== 'Other' && category !== 'General') {
      query = query.ilike('category', `%${category}%`);
    } else if (keyword) {
      query = query.ilike('title', `%${keyword}%`);
    }
    const { data } = await query.limit(limit);
    if (data && data.length > 0) return data;

    // Fallback ambil video terbaru
    const { data: fallbackData } = await supabase.from('tutorials').select('*').limit(limit);
    return fallbackData || [];
  } catch (e) {
    return [];
  }
}

/**
 * Mencari resource terkait dari database Supabase
 */
export async function getRelatedResources(category = '', keyword = '', limit = 2) {
  if (!supabase) return [];
  try {
    let query = supabase.from('resources').select('*');
    if (category && category !== 'Other' && category !== 'General') {
      query = query.ilike('category', `%${category}%`);
    } else if (keyword) {
      query = query.ilike('title', `%${keyword}%`);
    }
    const { data } = await query.limit(limit);
    if (data && data.length > 0) return data;

    const { data: fallbackData } = await supabase.from('resources').select('*').limit(limit);
    return fallbackData || [];
  } catch (e) {
    return [];
  }
}

/**
 * Handler Logout universal
 */
export async function handleUniversalLogout() {
  if (supabase) {
    try { await supabase.auth.signOut(); } catch (e) {}
  }
  window.location.replace('/login.html');
}

/**
 * Hubungkan event tombol logout
 */
export function bindLogoutButton(btnId = 'logoutBtn', labelId = 'logoutLabel') {
  const btn = document.getElementById(btnId);
  const lbl = document.getElementById(labelId);
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    if (lbl) lbl.textContent = 'Keluar...';
    await handleUniversalLogout();
  });
}

// Inisialisasi styling CSS pendukung smart navbar badge & toast
if (typeof document !== 'undefined') {
  const styleId = 'smart-navbar-injected-style';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = `
      .smart-admin-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: #0f172a;
        color: #ffffff !important;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        padding: 4px 10px;
        border-radius: 999px;
        text-decoration: none;
        border: 1px solid rgba(255,255,255,0.2);
        box-shadow: 0 1px 4px rgba(15,23,42,0.15);
        transition: transform 0.15s ease, background 0.15s ease;
      }
      .smart-admin-badge:hover {
        background: #1e293b;
        transform: translateY(-1px);
        color: #ffffff !important;
      }
      .admin-menu-highlight {
        background: #f8fafc;
        border-left: 3px solid #0f172a;
        font-weight: 700;
      }
      .toast-error {
        background: #ef4444 !important;
        color: #ffffff !important;
      }
    `;
    document.head.appendChild(s);
  }
}
