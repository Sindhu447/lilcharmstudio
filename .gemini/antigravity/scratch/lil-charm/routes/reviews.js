const express = require('express');
const router = express.Router();
const { isSupabaseConfigured, supabase, dbAll, dbGet, dbRun } = require('../database');
const { verifyAdmin } = require('../middleware/auth');
const crypto = require('crypto');

// GET reviews for a product or all approved reviews
router.get('/', async (req, res) => {
  try {
    const { product_id, admin } = req.query;
    let reviews = [];

    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('reviews').select('*').order('created_at', { ascending: false });
      if (product_id) query = query.eq('product_id', product_id);
      if (admin !== 'true') query = query.eq('is_approved', true);

      const { data, error } = await query;
      if (!error) reviews = data;
    }

    if (!reviews.length) {
      let sql = 'SELECT * FROM reviews WHERE 1=1';
      const params = [];
      if (product_id) {
        sql += ' AND product_id = ?';
        params.push(product_id);
      }
      if (admin !== 'true') {
        sql += ' AND is_approved = 1';
      }
      sql += ' ORDER BY created_at DESC';

      reviews = await dbAll(sql, params);
    }

    res.json({ success: true, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
});

// POST submit a review
router.post('/', async (req, res) => {
  try {
    const { product_id, customer_name, rating, comment } = req.body;
    if (!customer_name || !rating || !comment) {
      return res.status(400).json({ success: false, message: 'Name, rating, and comment are required.' });
    }

    const id = crypto.randomUUID();
    const numRating = parseInt(rating);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('reviews').insert([{
        id, product_id: product_id || null, customer_name, rating: numRating, comment, is_approved: true
      }]).select();
      if (error) throw error;
      return res.json({ success: true, message: 'Review submitted! Thank you 💕', review: data[0] });
    }

    await dbRun(
      'INSERT INTO reviews (id, product_id, customer_name, rating, comment, is_approved) VALUES (?, ?, ?, ?, ?, 1)',
      [id, product_id || null, customer_name, numRating, comment]
    );

    const review = await dbGet('SELECT * FROM reviews WHERE id = ?', [id]);
    res.json({ success: true, message: 'Review submitted! Thank you 💕', review });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit review' });
  }
});

// Admin: Moderate review (approve/hide/delete)
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_approved } = req.body;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('reviews').update({ is_approved }).eq('id', id).select();
      if (error) throw error;
      return res.json({ success: true, message: 'Review status updated', review: data[0] });
    }

    await dbRun('UPDATE reviews SET is_approved = ? WHERE id = ?', [is_approved ? 1 : 0, id]);
    const review = await dbGet('SELECT * FROM reviews WHERE id = ?', [id]);
    res.json({ success: true, message: 'Review status updated', review });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update review status' });
  }
});

// Admin: Delete review
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('reviews').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true, message: 'Review deleted' });
    }

    await dbRun('DELETE FROM reviews WHERE id = ?', [id]);
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete review' });
  }
});

module.exports = router;
