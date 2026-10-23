const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['pending', 'done'];

function validateTask(body) {
  const errors = [];
  const title = (body.title || '').trim();
  if (!title) errors.push('Title is required');
  if (title.length > 120) errors.push('Title must be at most 120 characters');
  const priority = body.priority || 'medium';
  if (!PRIORITIES.includes(priority)) errors.push('Priority must be low, medium or high');
  const status = body.status || 'pending';
  if (!STATUSES.includes(status)) errors.push('Status must be pending or done');
  const dueDate = body.dueDate || null;
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) errors.push('Due date must be YYYY-MM-DD');
  return {
    errors,
    task: {
      title,
      description: (body.description || '').trim().slice(0, 1000),
      priority,
      status,
      category: (body.category || 'General').trim().slice(0, 40) || 'General',
      dueDate,
    },
  };
}

// GET /api/tasks?search=&status=&priority=&category=&sort=due|priority|created
router.get('/', async (req, res, next) => {
  try {
    const where = ['user_id = ?'];
    const params = [req.user.id];
    const { search, status, priority, category, sort } = req.query;

    if (search) {
      where.push('(title LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status === 'overdue') {
      where.push("status = 'pending' AND due_date < CURDATE()");
    } else if (STATUSES.includes(status)) {
      where.push('status = ?');
      params.push(status);
    }
    if (PRIORITIES.includes(priority)) {
      where.push('priority = ?');
      params.push(priority);
    }
    if (category) {
      where.push('category = ?');
      params.push(category);
    }

    const orderBy = {
      due: 'due_date IS NULL, due_date ASC',
      priority: "FIELD(priority, 'high', 'medium', 'low'), due_date ASC",
      created: 'created_at DESC',
    }[sort] || 'created_at DESC';

    const [rows] = await pool.query(
      `SELECT id, title, description, priority, status, category,
              due_date AS dueDate, created_at AS createdAt, updated_at AS updatedAt,
              (status = 'pending' AND due_date < CURDATE()) AS overdue
         FROM tasks WHERE ${where.join(' AND ')} ORDER BY ${orderBy}`,
      params
    );
    res.json(rows.map((r) => ({ ...r, overdue: Boolean(r.overdue) })));
  } catch (err) {
    next(err);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT category FROM tasks WHERE user_id = ? ORDER BY category',
      [req.user.id]
    );
    res.json(rows.map((r) => r.category));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { errors, task } = validateTask(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });
    const [result] = await pool.query(
      `INSERT INTO tasks (user_id, title, description, priority, status, category, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, task.title, task.description, task.priority, task.status, task.category, task.dueDate]
    );
    res.status(201).json({ id: result.insertId, ...task });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { errors, task } = validateTask(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });
    const [result] = await pool.query(
      `UPDATE tasks SET title = ?, description = ?, priority = ?, status = ?, category = ?, due_date = ?
        WHERE id = ? AND user_id = ?`,
      [task.title, task.description, task.priority, task.status, task.category, task.dueDate,
        req.params.id, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Task not found' });
    res.json({ id: Number(req.params.id), ...task });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Status must be pending or done' });
    const [result] = await pool.query(
      'UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?',
      [status, req.params.id, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Task not found' });
    res.json({ id: Number(req.params.id), status });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM tasks WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
