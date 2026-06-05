const express = require('express');
const { supabaseAdmin } = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function mapScore(row) {
  return {
    id: row.id,
    playerName: row.player_name,
    score: row.score,
    timeSeconds: row.time_seconds,
    pearlsCollected: row.pearls_collected,
    won: row.won,
    createdAt: row.created_at,
  };
}

router.get('/', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const { data, error } = await supabaseAdmin
      .from('scores')
      .select('id, player_name, score, time_seconds, pearls_collected, won, created_at')
      .order('won', { ascending: false })
      .order('score', { ascending: false })
      .order('time_seconds', { ascending: true })
      .limit(limit);

    if (error) throw error;
    res.json({ scores: (data || []).map(mapScore) });
  } catch (error) {
    console.error('GET /api/scores error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const { score, timeSeconds, pearlsCollected, won } = req.body;

    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({ error: 'Valid score is required' });
    }

    const displayName =
      req.user.user_metadata?.display_name ||
      req.user.email?.split('@')[0] ||
      'Octopus';

    const { data, error } = await supabaseAdmin
      .from('scores')
      .insert({
        user_id: req.user.id,
        player_name: String(displayName).slice(0, 24),
        score,
        time_seconds: typeof timeSeconds === 'number' ? timeSeconds : 0,
        pearls_collected: typeof pearlsCollected === 'number' ? pearlsCollected : 0,
        won: Boolean(won),
      })
      .select('id, player_name, score, time_seconds, pearls_collected, won, created_at')
      .single();

    if (error) throw error;
    res.status(201).json({ entry: mapScore(data) });
  } catch (error) {
    console.error('POST /api/scores error:', error);
    res.status(500).json({ error: 'Failed to save score' });
  }
});

router.get('/stats', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const { count: totalGames, error: countError } = await supabaseAdmin
      .from('scores')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    const { count: totalWins, error: winsError } = await supabaseAdmin
      .from('scores')
      .select('*', { count: 'exact', head: true })
      .eq('won', true);

    if (winsError) throw winsError;

    const { data: topRow, error: topError } = await supabaseAdmin
      .from('scores')
      .select('score, player_name')
      .order('score', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (topError) throw topError;

    res.json({
      totalGames: totalGames ?? 0,
      totalWins: totalWins ?? 0,
      topScore: topRow?.score ?? 0,
      topPlayer: topRow?.player_name ?? null,
    });
  } catch (error) {
    console.error('GET /api/scores/stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('scores')
      .select('id, player_name, score, time_seconds, pearls_collected, won, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    res.json({ scores: (data || []).map(mapScore) });
  } catch (error) {
    console.error('GET /api/scores/me error:', error);
    res.status(500).json({ error: 'Failed to fetch your scores' });
  }
});

module.exports = router;