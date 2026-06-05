const { supabaseAuth } = require('../lib/supabase');

async function requireAuth(req, res, next) {
  if (!supabaseAuth) {
    return res.status(503).json({ error: 'Auth service not configured' });
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = header.slice(7);
  const { data, error } = await supabaseAuth.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = data.user;
  req.accessToken = token;
  next();
}

module.exports = { requireAuth };