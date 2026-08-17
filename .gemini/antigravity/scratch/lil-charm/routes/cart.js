const express = require('express');
const router = express.Router();
const { isSupabaseConfigured, supabase, dbGet, dbRun } = require('../database');
const crypto = require('crypto');

// Sync or save buyer cart
router.post('/sync', async (req, res) => {
  try {
    const { sessionId, items } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID required' });
    }

    const itemsPayload = Array.isArray(items) ? items : [];

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('carts').upsert({
        session_id: sessionId,
        items: itemsPayload,
        updated_at: new Date().toISOString()
      }, { onConflict: 'session_id' }).select();

      if (error) throw error;
      return res.json({ success: true, message: 'Cart synced to Supabase', cart: data[0] });
    }

    const existing = await dbGet('SELECT * FROM carts WHERE session_id = ?', [sessionId]);
    if (existing) {
      await dbRun('UPDATE carts SET items = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?', [
        JSON.stringify(itemsPayload), sessionId
      ]);
    } else {
      const id = crypto.randomUUID();
      await dbRun('INSERT INTO carts (id, session_id, items) VALUES (?, ?, ?)', [
        id, sessionId, JSON.stringify(itemsPayload)
      ]);
    }

    res.json({ success: true, message: 'Cart synced' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Cart sync failed' });
  }
});

// GET buyer cart by session ID
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('carts').select('*').eq('session_id', sessionId).single();
      if (!error && data) {
        return res.json({ success: true, items: data.items || [] });
      }
    }

    const cart = await dbGet('SELECT * FROM carts WHERE session_id = ?', [sessionId]);
    if (cart) {
      const items = typeof cart.items === 'string' ? JSON.parse(cart.items) : cart.items;
      return res.json({ success: true, items: items || [] });
    }

    res.json({ success: true, items: [] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve cart' });
  }
});

module.exports = router;
