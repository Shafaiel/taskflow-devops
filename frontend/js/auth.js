const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');

function showTab(which) {
  const isLogin = which === 'login';
  loginForm.hidden = !isLogin;
  registerForm.hidden = isLogin;
  tabLogin.classList.toggle('active', isLogin);
  tabRegister.classList.toggle('active', !isLogin);
}

tabLogin.addEventListener('click', () => showTab('login'));
tabRegister.addEventListener('click', () => showTab('register'));

// Already logged in? Go straight to tasks.
api('/auth/me').then(() => { window.location.href = '/tasks.html'; }).catch(() => {});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  try {
    await api('/auth/login', {
      method: 'POST',
      body: {
        username: document.getElementById('login-username').value,
        password: document.getElementById('login-password').value,
      },
    });
    window.location.href = '/tasks.html';
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('register-error');
  errorEl.textContent = '';
  try {
    await api('/auth/register', {
      method: 'POST',
      body: {
        fullName: document.getElementById('reg-fullname').value,
        username: document.getElementById('reg-username').value,
        password: document.getElementById('reg-password').value,
      },
    });
    window.location.href = '/tasks.html';
  } catch (err) {
    errorEl.textContent = err.message;
  }
});
