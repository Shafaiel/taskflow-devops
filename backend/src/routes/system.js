const express = require('express');
const os = require('os');
const { pool, isDbUp } = require('../db');

const router = express.Router();
const startedAt = new Date();

// Used by Docker HEALTHCHECK and the AWS ALB target group health check.
router.get('/health', async (req, res) => {
  const dbUp = await isDbUp();
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down' });
});

// Shows which server/container answered - refresh through the ALB to see it change.
router.get('/info', async (req, res) => {
  const dbUp = await isDbUp();
  let dbVersion = null;
  let counts = null;
  if (dbUp) {
    const [[v]] = await pool.query('SELECT VERSION() AS version');
    const [[c]] = await pool.query(
      'SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM tasks) AS tasks'
    );
    dbVersion = v.version;
    counts = { users: Number(c.users), tasks: Number(c.tasks) };
  }
  res.json({
    app: 'TaskFlow',
    version: process.env.APP_VERSION || '1.0.0',
    // SERVER_NAME / AVAILABILITY_ZONE are injected by aws/user-data.sh from EC2 instance metadata
    serverName: process.env.SERVER_NAME || os.hostname(),
    availabilityZone: process.env.AVAILABILITY_ZONE || 'local',
    containerId: os.hostname(),
    platform: `${os.type()} ${os.release()} (${os.arch()})`,
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: startedAt.toISOString(),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    database: { status: dbUp ? 'connected' : 'disconnected', host: process.env.DB_HOST || 'db', version: dbVersion, counts },
    servedAt: new Date().toISOString(),
  });
});

module.exports = router;
