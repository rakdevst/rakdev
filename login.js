const SUPABASE_URL = 'https://ymnshvqbucjelhzqxpsz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hrrKVBWFgVQNDQxy1ei-IA_WTRRLbuW';
const DASHBOARD_URL = 'index.html';

const isConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 40;
const client = window.supabase && isConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

document.addEventListener('DOMContentLoaded', () => {
  const pandaContainer = document.getElementById('pandaContainer');
  const pandaHead = document.getElementById('pandaHead');
  const eyeLeft = document.getElementById('eyeLeft');
  const eyeRight = document.getElementById('eyeRight');
  const identityInput = document.getElementById('identity');
  const passwordInput = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('togglePassword');
  const eyeIcon = document.getElementById('eyeIcon');
  const loginForm = document.getElementById('loginForm');
  const btnLogin = document.getElementById('btnLogin');
  const btnText = document.getElementById('btnText');
  const alertBox = document.getElementById('alertBox');
  const formCard = document.getElementById('formCard');
  const stickman = document.getElementById('stickman');
  const leftWidget = document.getElementById('leftWidget');
  const rightWidget = document.getElementById('rightWidget');

  const iconEyeOpen = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
  const iconEyeOff = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
  const iconCheck = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let isUsernameFocused = false;
  let isPasswordCovered = false;
  let isSubmitting = false;

  const showAlert = (message, type) => {
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    void alertBox.offsetWidth;
    alertBox.classList.add('show');
  };

  const hideAlert = () => {
    alertBox.classList.remove('show');
  };

  const startEntrance = () => {
    requestAnimationFrame(() => {
      pandaContainer.classList.add('visible');
      setTimeout(() => {
        formCard.classList.add('visible');
      }, 120);
    });
  };

  const revealPage = () => {
    document.body.classList.add('ready');
    startEntrance();
  };

  const initialize = async () => {
    if (!client) {
      revealPage();
      showAlert('Konfigurasi Supabase belum lengkap. Isi SUPABASE_URL dan SUPABASE_ANON_KEY dengan benar.', 'error');
      btnLogin.disabled = true;
      return;
    }

    try {
      const params = new URLSearchParams(window.location.search);

      if (params.get('logout') === '1') {
        await client.auth.signOut();
        window.history.replaceState(null, '', window.location.pathname);
      } else {
        const { data: sessionData } = await client.auth.getSession();

        if (sessionData && sessionData.session) {
          const { data: userData, error: userError } = await client.auth.getUser();

          if (!userError && userData && userData.user) {
            window.location.replace(DASHBOARD_URL);
            return;
          }

          await client.auth.signOut({ scope: 'local' });
        }
      }
    } catch (err) {
      console.error('Session check failed:', err && err.message ? err.message : 'unknown error');
    }

    revealPage();
  };

  if (!prefersReducedMotion) {
    let cardTiltFrame;
    formCard.addEventListener('mousemove', (e) => {
      const rect = formCard.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -2.5;
      const rotateY = ((x - centerX) / centerX) * 2.5;

      if (cardTiltFrame) cancelAnimationFrame(cardTiltFrame);
      cardTiltFrame = requestAnimationFrame(() => {
        formCard.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-2px)`;
      });
    });

    formCard.addEventListener('mouseleave', () => {
      if (cardTiltFrame) cancelAnimationFrame(cardTiltFrame);
      requestAnimationFrame(() => {
        formCard.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)`;
      });
    });
  }

  const lerp = (start, end, factor) => start + (end - start) * factor;

  const updateEyePosition = () => {
    if (!prefersReducedMotion && !isPasswordCovered) {
      currentX = lerp(currentX, targetX, 0.12);
      currentY = lerp(currentY, targetY, 0.12);

      const transformStr = `translate(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px)`;
      eyeLeft.style.transform = transformStr;
      eyeRight.style.transform = transformStr;
    }
    requestAnimationFrame(updateEyePosition);
  };
  requestAnimationFrame(updateEyePosition);

  const setTargetFromPointer = (clientX, clientY) => {
    if (isPasswordCovered || isUsernameFocused || isSubmitting) return;

    const rect = pandaContainer.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 3;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const angle = Math.atan2(dy, dx);
    const dist = Math.min(3.5, Math.hypot(dx, dy) / 25);

    targetX = Math.cos(angle) * dist;
    targetY = Math.sin(angle) * dist;
  };

  window.addEventListener('pointermove', (e) => {
    setTargetFromPointer(e.clientX, e.clientY);
  }, { passive: true });

  const triggerBlink = () => {
    if (!isPasswordCovered && !isSubmitting && !prefersReducedMotion) {
      eyeLeft.classList.add('blinking');
      eyeRight.classList.add('blinking');

      setTimeout(() => {
        eyeLeft.classList.remove('blinking');
        eyeRight.classList.remove('blinking');
      }, 150);
    }
    setTimeout(triggerBlink, Math.random() * 3500 + 2500);
  };
  setTimeout(triggerBlink, 3000);

  const updatePandaEyeState = () => {
    const isPasswordHidden = passwordInput.getAttribute('type') === 'password';
    const isPasswordActive = document.activeElement === passwordInput;

    if (isPasswordHidden && isPasswordActive) {
      isPasswordCovered = true;
      pandaContainer.classList.add('covering-eyes');
      pandaHead.classList.remove('idle-bounce');
    } else {
      isPasswordCovered = false;
      pandaContainer.classList.remove('covering-eyes');
      if (!pandaContainer.classList.contains('happy-panda')) {
        pandaHead.classList.add('idle-bounce');
      }
    }
  };

  identityInput.addEventListener('focus', () => {
    isUsernameFocused = true;
    leftWidget.classList.add('active');
    if (!isPasswordCovered) {
      targetX = 0;
      targetY = 3.5;
    }
  });

  identityInput.addEventListener('blur', () => {
    isUsernameFocused = false;
    leftWidget.classList.remove('active');
    targetX = 0;
    targetY = 0;
  });

  passwordInput.addEventListener('focus', () => {
    rightWidget.classList.add('active');
    updatePandaEyeState();
  });

  passwordInput.addEventListener('blur', () => {
    rightWidget.classList.remove('active');
    updatePandaEyeState();
  });

  togglePasswordBtn.addEventListener('click', () => {
    const isCurrentlyHidden = passwordInput.getAttribute('type') === 'password';

    if (isCurrentlyHidden) {
      passwordInput.setAttribute('type', 'text');
      eyeIcon.innerHTML = iconEyeOff;
      togglePasswordBtn.setAttribute('aria-label', 'Sembunyikan password');
    } else {
      passwordInput.setAttribute('type', 'password');
      eyeIcon.innerHTML = iconEyeOpen;
      togglePasswordBtn.setAttribute('aria-label', 'Tampilkan password');
    }

    passwordInput.focus();
    updatePandaEyeState();
  });

  const resetPandaState = () => {
    pandaContainer.classList.remove('happy-panda', 'sad-panda');
    updatePandaEyeState();
  };

  const translateAuthError = (error) => {
    const code = error && error.code ? error.code : '';
    const status = error && error.status ? error.status : 0;
    const message = error && error.message ? String(error.message) : '';

    if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
      return 'Email atau password salah.';
    }
    if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
      return 'Email belum diverifikasi. Cek kotak masuk email Anda terlebih dahulu.';
    }
    if (code === 'user_banned') {
      return 'Akun ini sedang diblokir. Hubungi administrator.';
    }
    if (code === 'over_request_rate_limit' || status === 429) {
      return 'Terlalu banyak percobaan login. Tunggu beberapa saat lalu coba lagi.';
    }
    if (code === 'validation_failed' || /valid email/i.test(message)) {
      return 'Format email tidak valid.';
    }
    if (status === 0 || /failed to fetch|network|load failed/i.test(message)) {
      return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
    }
    return message || 'Login gagal. Coba lagi nanti.';
  };

  const restoreForm = () => {
    btnLogin.classList.remove('loading');
    btnText.textContent = 'LOGIN';
    btnLogin.style.backgroundColor = '';
    btnLogin.disabled = false;
    identityInput.disabled = false;
    passwordInput.disabled = false;
    isSubmitting = false;
  };

  const showFailure = (message) => {
    restoreForm();
    formCard.classList.add('shake');
    pandaContainer.classList.add('sad-panda');
    showAlert(message, 'error');

    setTimeout(() => {
      formCard.classList.remove('shake');
      resetPandaState();
    }, 1500);
  };

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    hideAlert();
    resetPandaState();

    const email = identityInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showAlert('Email dan password tidak boleh kosong.', 'error');
      formCard.classList.add('shake');
      pandaContainer.classList.add('sad-panda');

      setTimeout(() => {
        formCard.classList.remove('shake');
        resetPandaState();
      }, 1000);
      return;
    }

    if (!client) {
      showAlert('Konfigurasi Supabase belum lengkap. Hubungi administrator.', 'error');
      return;
    }

    isSubmitting = true;
    btnLogin.disabled = true;
    identityInput.disabled = true;
    passwordInput.disabled = true;
    btnLogin.classList.add('loading');
    btnText.textContent = 'Checking...';

    stickman.classList.remove('stickman-walking');
    void stickman.offsetWidth;
    stickman.classList.add('stickman-walking');

    const animationDelay = new Promise((resolve) => setTimeout(resolve, 1600));

    try {
      const [result] = await Promise.all([
        client.auth.signInWithPassword({ email, password }),
        animationDelay
      ]);

      const { data, error } = result;

      if (error || !data || !data.session) {
        showFailure(translateAuthError(error));
        return;
      }

      btnLogin.classList.remove('loading');
      btnLogin.style.backgroundColor = 'var(--success-text)';
      btnText.innerHTML = `${iconCheck} <span>Success</span>`;

      pandaContainer.classList.remove('covering-eyes');
      pandaContainer.classList.add('happy-panda');
      showAlert('Login berhasil. Mengalihkan ke dashboard...', 'success');

      setTimeout(() => {
        window.location.replace(DASHBOARD_URL);
      }, 900);
    } catch (err) {
      showFailure(translateAuthError(err));
    }
  });

  initialize();
});
