require('dotenv').config();

const express = require('express');
const cors = require('cors');
const scoresRouter = require('./routes/scores');
const { supabaseAdmin } = require('./lib/supabase');

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

app.use(
  cors({
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map((o) => o.trim()),
  })
);
app.use(express.json({ limit: '16kb' }));

app.get('/api/health', async (_req, res) => {
  let database = 'disconnected';
  let databaseError = null;

  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.from('scores').select('id', { head: true, count: 'exact' });
    if (error) {
      database = 'error';
      databaseError = error.message;
      console.error('Health check database error:', error);
    } else {
      database = 'connected';
    }
  }

  const payload = {
    status: 'ok',
    service: 'zama-reef-escape-api',
    database,
    auth: 'supabase',
  };

  if (databaseError) {
    payload.databaseError = databaseError;
  }

  res.json(payload);
});

app.use('/api/scores', scoresRouter);

app.listen(PORT, () => {
  console.log(`Zama Reef Escape API listening on port ${PORT}`);
});