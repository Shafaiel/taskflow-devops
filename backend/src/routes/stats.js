const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const [[totals]] = await pool.query(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(status = 'done'), 0) AS done,
              COALESCE(SUM(status = 'pending'), 0) AS pending,
              COALESCE(SUM(status = 'pending' AND due_date < CURDATE()), 0) AS overdue,
              COALESCE(SUM(status = 'pending' AND priority = 'high'), 0) AS highPending
         FROM tasks WHERE user_id = ?`,
      [req.user.id]
    );
    const [byCategory] = await pool.query(
      `SELECT category, COUNT(*) AS total, COALESCE(SUM(status = 'done'), 0) AS done
         FROM tasks WHERE user_id = ? GROUP BY category ORDER BY total DESC`,
      [req.user.id]
    );
    const [byPriority] = await pool.query(
      `SELECT priority, COUNT(*) AS total FROM tasks WHERE user_id = ?
        GROUP BY priority ORDER BY FIELD(priority, 'high', 'medium', 'low')`,
      [req.user.id]
    );
    const [upcoming] = await pool.query(
      `SELECT id, title, priority, due_date AS dueDate FROM tasks
        WHERE user_id = ? AND status = 'pending' AND due_date >= CURDATE()
        ORDER BY due_date ASC LIMIT 5`,
      [req.user.id]
    );

    const num = (v) => Number(v);
    const total = num(totals.total);
    res.json({
      total,
      done: num(totals.done),
      pending: num(totals.pending),
      overdue: num(totals.overdue),
      highPending: num(totals.highPending),
      completionRate: total ? Math.round((num(totals.done) / total) * 100) : 0,
      byCategory: byCategory.map((c) => ({ category: c.category, total: num(c.total), done: num(c.done) })),
      byPriority: byPriority.map((p) => ({ priority: p.priority, total: num(p.total) })),
      upcoming,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
