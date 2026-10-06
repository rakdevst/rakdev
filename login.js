import { supabase, isCurrentUserAdmin } from '/shared/supabaseClient.js';

const form = document.getElementById('loginForm');
const emailInput = document.getElementById('loginEmail');
const passwordInput = document.getElementById('loginPassword');
const btnSubmit = document.getElementById('btnLoginSubmit');
const btnSubmitText = document.getElementById('btnSubmitText');
const alertBox = document.getElementById('authAlert');
const btnTogglePw = document.getElementById('btnTogglePassword');

// Cek parameter redirect
const urlParams = new URLSearchParams(window.location.search);
const redirectTarget = urlParams.get('redirect') || '/dashboard';

function showAlert(message) {
  alertBox.textContent = message;
  alertBox.hidden = false;
}

function hideAlert() {
  alertBox.hidden = true;
  alertBox.textContent = '';
}

// Toggle password visibility
btnTogglePw.addEventListener('click', () => {
  const isPw = passwordInput.type === 'password';
  passwordInput.type = isPw ? 'text' : 'password';
  btnTogglePw.style.color = isPw ? 'var(--primary)' : 'var(--ink-faint)';
});

// Auto redirect jika user sudah login
async function checkCurrentSession() {
  if (!supabase) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      window.location.replace(redirectTarget);
    }
  } catch (e) {}
}

checkCurrentSession();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showAlert('Silakan masukkan email dan password.');
    return;
  }

  btnSubmit.disabled = true;
  btnSubmitText.textContent = 'Memverifikasi...';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      let msg = error.message;
      if (msg.includes('Invalid login credentials')) {
        msg = 'Email atau password salah. Silakan periksa kembali.';
      } else if (msg.includes('Email not confirmed')) {
        msg = 'Email belum dikonfirmasi. Silakan cek inbox email Anda.';
      }
      showAlert(msg);
      btnSubmit.disabled = false;
      btnSubmitText.textContent = 'Masuk Sekarang';
      return;
    }

    if (data && data.user) {
      window.location.replace(redirectTarget);
    }
  } catch (err) {
    showAlert(err.message || 'Gagal masuk. Silakan coba lagi.');
    btnSubmit.disabled = false;
    btnSubmitText.textContent = 'Masuk Sekarang';
  }
});
