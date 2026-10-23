// Shared helpers used by every page: API calls, toasts, navbar, auth guard.

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function toast(message, type = 'info') {
  let box = document.getElementById('toast-container');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-container';
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(`${d.slice(0, 10)}T00:00:00`);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Redirects to the login page if not logged in; returns the current user.
async function requireLogin() {
  try {
    return await api('/auth/me');
  } catch {
    window.location.href = '/index.html';
    return null;
  }
}

function renderNavbar(active, user) {
  const nav = document.createElement('nav');
  nav.className = 'navbar';
  nav.innerHTML = `
    <a class="brand" href="/tasks.html"><span class="logo">TF</span>TaskFlow</a>
    <div class="nav-links">
      <a href="/tasks.html" id="nav-tasks" class="${active === 'tasks' ? 'active' : ''}">Tasks</a>
      <a href="/dashboard.html" id="nav-dashboard" class="${active === 'dashboard' ? 'active' : ''}">Dashboard</a>
      <a href="/info.html" id="nav-info" class="${active === 'info' ? 'active' : ''}">Server Info</a>
    </div>
    <div class="nav-user">
      <span class="server-badge" id="server-badge" title="Server that answered this request">server: …</span>
      <span id="nav-username">${escapeHtml(user ? user.fullName || user.username : '')}</span>
      <button class="btn btn-ghost btn-sm" id="logout-btn">Logout</button>
    </div>`;
  document.body.prepend(nav);

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' });
    window.location.href = '/index.html';
  });

  api('/info')
    .then((info) => {
      document.getElementById('server-badge').textContent = `server: ${info.serverName}`;
    })
    .catch(() => {});
}
