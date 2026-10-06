import { supabase } from '/shared/supabaseClient.js';

const form = document.getElementById('registerForm');
const nameInput = document.getElementById('regFullName');
const emailInput = document.getElementById('regEmail');
const passwordInput = document.getElementById('regPassword');
const btnSubmit = document.getElementById('btnRegisterSubmit');
const btnSubmitText = document.getElementById('btnSubmitText');
const alertBox = document.getElementById('authAlert');
const successBox = document.getElementById('authSuccess');
const btnTogglePw = document.getElementById('btnTogglePassword');

function showAlert(message) {
  alertBox.textContent = message;
  alertBox.hidden = false;
  successBox.hidden = true;
}

function showSuccess(message) {
  successBox.textContent = message;
  successBox.hidden = false;
  alertBox.hidden = true;
}

function hideMessages() {
  alertBox.hidden = true;
  successBox.hidden = true;
}

btnTogglePw.addEventListener('click', () => {
  const isPw = passwordInput.type === 'password';
  passwordInput.type = isPw ? 'text' : 'password';
  btnTogglePw.style.color = isPw ? 'var(--primary)' : 'var(--ink-faint)';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessages();

  const fullName = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!fullName) {
    showAlert('Silakan masukkan nama lengkap.');
    return;
  }
  if (!email) {
    showAlert('Silakan masukkan email.');
    return;
  }
  if (!password || password.length < 6) {
    showAlert('Password minimal 6 karakter.');
    return;
  }

  btnSubmit.disabled = true;
  btnSubmitText.textContent = 'Mendaftarkan...';

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          name: fullName
        }
      }
    });

    if (error) {
      let msg = error.message;
      if (msg.includes('already registered')) {
        msg = 'Email ini sudah terdaftar. Silakan login.';
      }
      showAlert(msg);
      btnSubmit.disabled = false;
      btnSubmitText.textContent = 'Buat Akun';
      return;
    }

    if (data && data.user) {
      // Buat / update record di tabel profiles jika belum
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          user_id: data.user.id,
          full_name: fullName,
          email: email
        });
      } catch (pe) {}

      // Jika user session langsung aktif (tanpa email confirmation)
      if (data.session) {
        showSuccess('Pendaftaran berhasil! Mengalihkan ke Dashboard...');
        setTimeout(() => {
          window.location.replace('/dashboard');
        }, 1200);
      } else {
        showSuccess('Pendaftaran berhasil! Silakan cek email Anda untuk konfirmasi akun, lalu login.');
        form.reset();
        btnSubmit.disabled = false;
        btnSubmitText.textContent = 'Buat Akun';
      }
    }
  } catch (err) {
    showAlert(err.message || 'Terjadi kesalahan saat pendaftaran.');
    btnSubmit.disabled = false;
    btnSubmitText.textContent = 'Buat Akun';
  }
});
