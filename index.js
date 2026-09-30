const SUPABASE_URL = 'https://ymnshvqbucjelhzqxpsz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hrrKVBWFgVQNDQxy1ei-IA_WTRRLbuW';
const LOGIN_URL = 'login.html';

const isConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 40;
const client = window.supabase && isConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

document.addEventListener('DOMContentLoaded', async () => {
  const body = document.body;
  const gate = document.getElementById('gate');
  const gateText = document.getElementById('gateText');
  const gateRetry = document.getElementById('gateRetry');
  const menuBtn = document.getElementById('menuBtn');
  const menu = document.getElementById('menu');
  const scrim = document.getElementById('scrim');
  const menuClose = document.getElementById('menuClose');
  const menuDashboard = document.getElementById('menuDashboard');
  const logoutBtn = document.getElementById('logoutBtn');
  const logoutLabel = document.getElementById('logoutLabel');
  const userNameEl = document.getElementById('userName');
  const menuNameEl = document.getElementById('menuName');
  const menuEmailEl = document.getElementById('menuEmail');
  const menuAvatarEl = document.getElementById('menuAvatar');
  const yearEl = document.getElementById('year');

  let isLoggingOut = false;

  yearEl.textContent = new Date().getFullYear();

  const showGateError = (message) => {
    gateText.textContent = message;
    gate.classList.add('error');
  };

  const openMenu = () => {
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    scrim.classList.add('show');
    body.classList.add('menu-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    menuBtn.setAttribute('aria-label', 'Tutup menu');
    menuClose.focus();
  };

  const closeMenu = (returnFocus) => {
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    scrim.classList.remove('show');
    body.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', 'Buka menu');
    if (returnFocus) menuBtn.focus();
  };

  menuBtn.addEventListener('click', () => {
    if (menu.classList.contains('open')) {
      closeMenu(true);
    } else {
      openMenu();
    }
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

  menuDashboard.addEventListener('click', (e) => {
    e.preventDefault();
    closeMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  menu.querySelectorAll('a.menu-item').forEach((link) => {
    if (link === menuDashboard) return;
    link.addEventListener('click', () => closeMenu(false));
  });

  logoutBtn.addEventListener('click', async () => {
    if (isLoggingOut || !client) return;

    isLoggingOut = true;
    logoutBtn.disabled = true;
    logoutLabel.textContent = 'Keluar...';

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

  gateRetry.addEventListener('click', () => window.location.reload());

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

  const metadata = user.user_metadata || {};
  const emailName = user.email ? user.email.split('@')[0] : 'Pengguna';

  const renderName = (name) => {
    userNameEl.textContent = name;
    menuNameEl.textContent = name;
    menuAvatarEl.innerHTML = '<img src="https://i.ibb.co.com/M5hFGd0t/file-00000000f1fc82308aa606d6a1e12263.png" alt="Profile">';
  };

  renderName(String(metadata.full_name || metadata.name || emailName).trim() || emailName);
  menuEmailEl.textContent = user.email || '';

  body.classList.add('ready');

  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      window.location.replace(LOGIN_URL);
    }
  });

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
});
