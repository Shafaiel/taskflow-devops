const listEl = document.getElementById('task-list');
const countEl = document.getElementById('task-count');
const filters = {
  search: document.getElementById('search-input'),
  status: document.getElementById('filter-status'),
  priority: document.getElementById('filter-priority'),
  category: document.getElementById('filter-category'),
  sort: document.getElementById('sort-by'),
};
let tasksCache = [];

function taskItem(t) {
  const li = document.createElement('li');
  li.className = `task priority-${t.priority}${t.status === 'done' ? ' done' : ''}`;
  li.dataset.id = t.id;
  li.innerHTML = `
    <input type="checkbox" class="task-toggle" ${t.status === 'done' ? 'checked' : ''} title="Mark done / pending">
    <div>
      <div class="task-title">${escapeHtml(t.title)}</div>
      ${t.description ? `<div class="task-desc">${escapeHtml(t.description)}</div>` : ''}
      <div class="task-meta">
        <span class="pill ${t.priority}">${t.priority}</span>
        <span class="pill">${escapeHtml(t.category)}</span>
        <span class="pill ${t.status === 'done' ? 'done' : ''} task-status">${t.status}</span>
        ${t.dueDate ? `<span class="pill">Due ${formatDate(t.dueDate)}</span>` : ''}
        ${t.overdue ? '<span class="pill overdue">Overdue</span>' : ''}
      </div>
    </div>
    <div class="task-actions">
      <button class="btn btn-ghost btn-sm task-edit">Edit</button>
      <button class="btn btn-danger btn-sm task-delete">Delete</button>
    </div>`;
  return li;
}

async function loadCategories() {
  const cats = await api('/tasks/categories');
  const current = filters.category.value;
  filters.category.innerHTML = '<option value="">All categories</option>' +
    cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  filters.category.value = cats.includes(current) ? current : '';
  document.getElementById('category-list').innerHTML =
    cats.map((c) => `<option value="${escapeHtml(c)}">`).join('');
}

async function loadTasks() {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, el]) => { if (el.value) params.set(key, el.value); });
  tasksCache = await api(`/tasks?${params}`);
  listEl.innerHTML = '';
  if (!tasksCache.length) {
    listEl.innerHTML = '<li class="empty" id="empty-state">No tasks found. Add one on the left!</li>';
  } else {
    tasksCache.forEach((t) => listEl.appendChild(taskItem(t)));
  }
  const done = tasksCache.filter((t) => t.status === 'done').length;
  countEl.textContent = `${tasksCache.length} task(s) shown · ${done} done`;
}

async function refresh() {
  await Promise.all([loadTasks(), loadCategories()]);
}

// ---------- Create ----------
document.getElementById('task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/tasks', {
      method: 'POST',
      body: {
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-desc').value,
        priority: document.getElementById('task-priority').value,
        category: document.getElementById('task-category').value || 'General',
        dueDate: document.getElementById('task-due').value || null,
      },
    });
    e.target.reset();
    document.getElementById('task-priority').value = 'medium';
    toast('Task added', 'success');
    await refresh();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ---------- Toggle / edit / delete (event delegation) ----------
listEl.addEventListener('click', async (e) => {
  const li = e.target.closest('.task');
  if (!li) return;
  const id = li.dataset.id;
  const task = tasksCache.find((t) => String(t.id) === id);

  try {
    if (e.target.classList.contains('task-toggle')) {
      const status = e.target.checked ? 'done' : 'pending';
      await api(`/tasks/${id}/status`, { method: 'PATCH', body: { status } });
      toast(status === 'done' ? 'Task completed' : 'Task reopened', 'success');
      await loadTasks();
    } else if (e.target.classList.contains('task-delete')) {
      if (!confirm(`Delete "${task.title}"?`)) return;
      await api(`/tasks/${id}`, { method: 'DELETE' });
      toast('Task deleted', 'success');
      await refresh();
    } else if (e.target.classList.contains('task-edit')) {
      openEdit(task);
    }
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ---------- Edit modal ----------
const modal = document.getElementById('edit-modal');

function openEdit(t) {
  document.getElementById('edit-id').value = t.id;
  document.getElementById('edit-title').value = t.title;
  document.getElementById('edit-desc').value = t.description || '';
  document.getElementById('edit-priority').value = t.priority;
  document.getElementById('edit-status').value = t.status;
  document.getElementById('edit-due').value = t.dueDate ? t.dueDate.slice(0, 10) : '';
  document.getElementById('edit-category').value = t.category;
  modal.classList.add('open');
}

document.getElementById('edit-cancel').addEventListener('click', () => modal.classList.remove('open'));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

document.getElementById('edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  try {
    await api(`/tasks/${id}`, {
      method: 'PUT',
      body: {
        title: document.getElementById('edit-title').value,
        description: document.getElementById('edit-desc').value,
        priority: document.getElementById('edit-priority').value,
        status: document.getElementById('edit-status').value,
        category: document.getElementById('edit-category').value || 'General',
        dueDate: document.getElementById('edit-due').value || null,
      },
    });
    modal.classList.remove('open');
    toast('Task updated', 'success');
    await refresh();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ---------- Filters ----------
let searchTimer;
filters.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadTasks, 300);
});
['status', 'priority', 'category', 'sort'].forEach((k) => filters[k].addEventListener('change', loadTasks));

// ---------- Init ----------
(async () => {
  const user = await requireLogin();
  if (!user) return;
  renderNavbar('tasks', user);
  document.getElementById('welcome-text').textContent =
    `Welcome back, ${user.fullName || user.username}. Plan, prioritize and track your work.`;
  await refresh();
})();
