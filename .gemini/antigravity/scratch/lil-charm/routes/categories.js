const express = require('express');
const router = express.Router();
const { isSupabaseConfigured, supabase, dbAll, dbGet, dbRun } = require('../database');
const { verifyAdmin } = require('../middleware/auth');
const crypto = require('crypto');

// GET all active categories
router.get('/', async (req, res) => {
  try {
    let categories = [];
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('categories').select('*').order('created_at', { ascending: true });
      if (!error) categories = data;
    }

    if (!categories.length) {
      categories = await dbAll('SELECT * FROM categories ORDER BY created_at ASC');
    }

    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

// Admin: Create Category
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { name, slug, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });

    const categorySlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const id = crypto.randomUUID();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('categories').insert([{
        id, name, slug: categorySlug, description, is_active: true
      }]).select();

      if (error) throw error;
      return res.json({ success: true, message: 'Category created in Supabase', category: data[0] });
    }

    await dbRun(
      'INSERT INTO categories (id, name, slug, description, is_active) VALUES (?, ?, ?, ?, 1)',
      [id, name, categorySlug, description || '']
    );

    const category = await dbGet('SELECT * FROM categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Category created', category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create category' });
  }
});

// Admin: Edit Category
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('categories')
        .update({ name, description, is_active })
        .eq('id', id)
        .select();

      if (error) throw error;
      return res.json({ success: true, message: 'Category updated in Supabase', category: data[0] });
    }

    await dbRun(
      'UPDATE categories SET name = ?, description = ?, is_active = ? WHERE id = ?',
      [name, description, is_active ? 1 : 0, id]
    );

    const category = await dbGet('SELECT * FROM categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Category updated', category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update category' });
  }
});

// Admin: Delete Category
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true, message: 'Category deleted from Supabase' });
    }

    await dbRun('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete category' });
  }
});

module.exports = router;
