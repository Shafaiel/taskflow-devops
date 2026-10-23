const requestLog = [];

function kv(pairs) {
  return pairs.map(([k, v]) => `<div>${k}</div><div>${escapeHtml(v ?? '-')}</div>`).join('');
}

function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m ${sec % 60}s`;
}

async function loadInfo() {
  try {
    const i = await api('/info');
    document.getElementById('server-name').textContent = i.serverName;
    document.getElementById('db-dot').classList.toggle('down', i.database.status !== 'connected');
    document.getElementById('app-info').innerHTML = kv([
      ['Server / instance', i.serverName],
      ['Availability zone', i.availabilityZone],
      ['Container ID', i.containerId],
      ['App version', i.version],
      ['Node.js', i.nodeVersion],
      ['Platform', i.platform],
      ['Uptime', formatUptime(i.uptimeSeconds)],
      ['Memory (RSS)', `${i.memoryMB} MB`],
    ]);
    document.getElementById('db-info').innerHTML = kv([
      ['Status', i.database.status],
      ['Host', i.database.host],
      ['MySQL version', i.database.version],
      ['Users', i.database.counts ? i.database.counts.users : '-'],
      ['Tasks', i.database.counts ? i.database.counts.tasks : '-'],
    ]);
    requestLog.unshift(`${new Date().toLocaleTimeString()}  →  ${i.serverName}  (${i.availabilityZone})`);
    document.getElementById('history').innerHTML = requestLog.map((h) => `<div>${escapeHtml(h)}</div>`).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

document.getElementById('refresh-btn').addEventListener('click', loadInfo);

(async () => {
  const user = await requireLogin();
  if (!user) return;
  renderNavbar('info', user);
  await loadInfo();
})();
