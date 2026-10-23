const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { waitForDb } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(morgan(':date[iso] :method :url :status :response-time ms'));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.use('/api', require('./routes/system'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/stats', require('./routes/stats'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  res.status(500).json({ error: 'Internal server error' });
});

waitForDb()
  .then(() => {
    app.listen(PORT, () => console.log(`[api] TaskFlow API listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('[api] startup failed:', err.message);
    process.exit(1);
  });
