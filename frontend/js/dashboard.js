function barRow(label, value, max, text) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return `
    <div class="bar-row">
      <span style="text-transform:capitalize">${escapeHtml(label)}</span>
      <div class="progress"><div style="width:${pct}%"></div></div>
      <span style="text-align:right;color:var(--muted)">${text}</span>
    </div>`;
}

(async () => {
  const user = await requireLogin();
  if (!user) return;
  renderNavbar('dashboard', user);

  try {
    const s = await api('/stats');
    document.getElementById('stat-total').textContent = s.total;
    document.getElementById('stat-done').textContent = s.done;
    document.getElementById('stat-pending').textContent = s.pending;
    document.getElementById('stat-overdue').textContent = s.overdue;
    document.getElementById('stat-rate').textContent = `${s.completionRate}%`;
    document.getElementById('rate-bar').style.width = `${s.completionRate}%`;
    document.getElementById('high-pending-text').textContent =
      `${s.highPending} high-priority task(s) still pending.`;

    document.getElementById('category-bars').innerHTML = s.byCategory.length
      ? s.byCategory.map((c) => barRow(c.category, c.done, c.total, `${c.done}/${c.total}`)).join('')
      : '<p class="empty">No tasks yet</p>';

    const maxP = Math.max(1, ...s.byPriority.map((p) => p.total));
    document.getElementById('priority-bars').innerHTML = s.byPriority.length
      ? s.byPriority.map((p) => barRow(p.priority, p.total, maxP, p.total)).join('')
      : '<p class="empty">No tasks yet</p>';

    document.getElementById('upcoming-list').innerHTML = s.upcoming.length
      ? s.upcoming.map((t) => `
          <li><span>${escapeHtml(t.title)} <span class="pill ${t.priority}">${t.priority}</span></span>
              <span style="color:var(--muted)">${formatDate(t.dueDate)}</span></li>`).join('')
      : '<li style="color:var(--muted)">Nothing due soon 🎉</li>';
  } catch (err) {
    toast(err.message, 'error');
  }
})();
