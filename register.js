const SUPABASE_URL = 'https://ymnshvqbucjelhzqxpsz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hrrKVBWFgVQNDQxy1ei-IA_WTRRLbuW';
const LOGIN_URL = 'login.html';

const isConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 40;
const supabaseClient = window.supabase && isConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

document.addEventListener('DOMContentLoaded', () => {
  const pandaContainer = document.getElementById('pandaContainer');
  const formCard = document.getElementById('formCard');
  const eyeLeft = document.getElementById('eyeLeft');
  const eyeRight = document.getElementById('eyeRight');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const alertBox = document.getElementById('alertBox');
  const registerForm = document.getElementById('registerForm');
  const btnRegister = document.getElementById('btnRegister');
  const btnText = document.getElementById('btnText');

  let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
  let isCovered = false;
  let isSubmitting = false;

  requestAnimationFrame(() => {
    pandaContainer.classList.add('visible');
    formCard.classList.add('visible');
  });

  setInterval(() => {
    if (!isCovered && !isSubmitting) {
      eyeLeft.classList.add('blinking');
      eyeRight.classList.add('blinking');
      setTimeout(() => {
        eyeLeft.classList.remove('blinking');
        eyeRight.classList.remove('blinking');
      }, 200);
    }
  }, 4000);

  const updateEyePosition = () => {
    if (!isCovered && !isSubmitting) {
      currentX += (targetX - currentX) * 0.15;
      currentY += (targetY - currentY) * 0.15;
      const transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;
      eyeLeft.style.transform = transform;
      eyeRight.style.transform = transform;
    }
    requestAnimationFrame(updateEyePosition);
  };
  requestAnimationFrame(updateEyePosition);

  let lastMove = 0;
  window.addEventListener('pointermove', (e) => {
    const now = Date.now();
    if (now - lastMove < 30 || isCovered || isSubmitting) return;
    lastMove = now;

    const rect = pandaContainer.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 3);
    const angle = Math.atan2(dy, dx);
    const dist = Math.min(3.5, Math.hypot(dx, dy) / 30);

    targetX = Math.cos(angle) * dist;
    targetY = Math.sin(angle) * dist;
  }, { passive: true });

  const checkCoverState = () => {
    const activeEl = document.activeElement;
    const isPwdHidden = passwordInput.type === 'password';
    const isConfHidden = confirmPasswordInput.type === 'password';

    if ((activeEl === passwordInput && isPwdHidden) || (activeEl === confirmPasswordInput && isConfHidden)) {
      isCovered = true;
      pandaContainer.classList.add('covering-eyes');
    } else {
      isCovered = false;
      pandaContainer.classList.remove('covering-eyes');
    }
  };

  [passwordInput, confirmPasswordInput].forEach(el => {
    el.addEventListener('focus', checkCoverState);
    el.addEventListener('blur', checkCoverState);
  });

  const eyeOpenSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const eyeClosedSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  const bindToggle = (btnId, inputEl) => {
    const btn = document.getElementById(btnId);
    btn.addEventListener('click', () => {
      const isShow = inputEl.type === 'password';
      inputEl.type = isShow ? 'text' : 'password';
      btn.innerHTML = isShow ? eyeClosedSVG : eyeOpenSVG;
      checkCoverState();
      inputEl.focus();
    });
  };
  bindToggle('togglePassword', passwordInput);
  bindToggle('toggleConfirmPassword', confirmPasswordInput);

  const getPasswordIssues = (pwd) => {
    const issues = [];
    if (pwd.length < 6) issues.push('minimal 6 karakter');
    if (!/[A-Z]/.test(pwd)) issues.push('huruf besar');
    if (!/[a-z]/.test(pwd)) issues.push('huruf kecil');
    if (!/[0-9]/.test(pwd)) issues.push('angka');
    if (!pwd.includes('.')) issues.push('titik (.)');
    if (!pwd.includes('_')) issues.push('garis bawah (_)');
    return issues;
  };

  const validate = () => {
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const pwd = passwordInput.value;
    const conf = confirmPasswordInput.value;

    if (name.length < 2) return 'Nama lengkap wajib diisi (minimal 2 karakter).';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Format email tidak valid.';

    const issues = getPasswordIssues(pwd);
    if (issues.length) return `Password tidak memenuhi syarat. Harus memiliki: ${issues.join(', ')}.`;

    if (pwd !== conf) return 'Konfirmasi password tidak cocok dengan password.';
    return null;
  };

  const showAlert = (msg, type = 'error') => {
    alertBox.textContent = msg;
    alertBox.className = `alert alert-${type} show`;
    if (type === 'error') {
      formCard.classList.add('shake');
      pandaContainer.classList.add('sad-panda');
      setTimeout(() => formCard.classList.remove('shake'), 300);
    }
  };

  const translateSignUpError = (error) => {
    const code = error && error.code ? error.code : '';
    const status = error && error.status ? error.status : 0;
    const message = error && error.message ? String(error.message) : '';

    if (code === 'user_already_exists' || code === 'email_exists' || /already (been )?registered|already exists/i.test(message)) {
      return 'Email sudah terdaftar. Silakan login atau gunakan email lain.';
    }
    if (code === 'weak_password' || /password/i.test(message) && /(weak|short|least|characters)/i.test(message)) {
      return `Password tidak memenuhi syarat: ${message}`;
    }
    if (code === 'validation_failed' || code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(message)) {
      return 'Format email tidak valid atau tidak diterima.';
    }
    if (code === 'signup_disabled') {
      return 'Pendaftaran akun baru sedang dinonaktifkan.';
    }
    if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || status === 429) {
      return 'Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.';
    }
    if (status === 0 || /failed to fetch|network|load failed/i.test(message)) {
      return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
    }
    return message || 'Gagal mendaftar, coba lagi nanti.';
  };

  const restoreForm = () => {
    isSubmitting = false;
    btnRegister.disabled = false;
    btnText.textContent = 'DAFTAR AKUN';
  };

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    alertBox.className = 'alert';
    pandaContainer.classList.remove('sad-panda', 'happy-panda');

    const errorMsg = validate();
    if (errorMsg) {
      showAlert(errorMsg, 'error');
      return;
    }

    if (!supabaseClient) {
      showAlert('Konfigurasi Supabase belum lengkap. Isi SUPABASE_URL dan SUPABASE_ANON_KEY dengan benar.', 'error');
      return;
    }

    isSubmitting = true;
    btnRegister.disabled = true;
    btnText.textContent = 'Memproses...';

    let registered = false;

    try {
      const name = nameInput.value.trim();

      const { data, error } = await supabaseClient.auth.signUp({
        email: emailInput.value.trim().toLowerCase(),
        password: passwordInput.value,
        options: {
          data: { full_name: name, name },
          emailRedirectTo: new URL(LOGIN_URL, window.location.href).href
        }
      });

      if (error) throw error;

      const user = data && data.user;

      if (!user) {
        showAlert('Registrasi gagal diproses. Coba lagi nanti.', 'error');
        return;
      }

      if (Array.isArray(user.identities) && user.identities.length === 0) {
        showAlert('Email sudah terdaftar. Silakan login atau gunakan email lain.', 'error');
        return;
      }

      registered = true;
      pandaContainer.classList.add('happy-panda');

      if (data.session) {
        showAlert('Registrasi berhasil! Mengalihkan ke halaman login...', 'success');
        setTimeout(() => window.location.replace(LOGIN_URL), 1800);
      } else {
        showAlert('Registrasi berhasil! Kami telah mengirim tautan verifikasi ke email Anda. Verifikasi email terlebih dahulu sebelum login.', 'success');
        setTimeout(() => window.location.replace(LOGIN_URL), 4500);
      }
    } catch (err) {
      showAlert(translateSignUpError(err), 'error');
    } finally {
      if (!registered) restoreForm();
    }
  });
});
