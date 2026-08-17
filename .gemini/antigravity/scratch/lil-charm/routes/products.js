const express = require('express');
const router = express.Router();
const { isSupabaseConfigured, supabase, dbAll, dbGet, dbRun } = require('../database');
const { verifyAdmin } = require('../middleware/auth');
const crypto = require('crypto');

// Normalize product item output format
function parseProduct(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name || p.title || 'Untitled Charm',
    description: p.description || '',
    price: parseFloat(p.price || 0),
    image_url: p.image_url || (Array.isArray(p.images) ? p.images[0] : null) || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    category: p.category || p.category_name || 'General',
    stock: parseInt(p.stock !== undefined ? p.stock : 0, 10),
    is_available: p.is_available !== undefined ? Boolean(p.is_available) : (p.is_active !== undefined ? Boolean(p.is_active) : true),
    created_at: p.created_at || new Date().toISOString(),
    updated_at: p.updated_at || new Date().toISOString()
  };
}

// GET all products with optional filters (search, category, admin view)
router.get('/', async (req, res) => {
  try {
    const { category, search, admin } = req.query;
    let products = [];

    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('products').select('*').order('created_at', { ascending: false });

      if (admin !== 'true') {
        query = query.eq('is_available', true);
      }
      if (category) {
        query = query.eq('category', category);
      }
      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, error } = await query;
      if (!error && data) {
        products = data.map(parseProduct);
      }
    }

    // Fallback if Supabase not configured or returns empty list
    if (!products.length) {
      let list = await dbAll('products');
      if (admin !== 'true') {
        list = list.filter(p => p.is_available !== false);
      }
      if (category) {
        list = list.filter(p => (p.category || '').toLowerCase() === category.toLowerCase());
      }
      if (search) {
        const q = search.toLowerCase();
        list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
      }
      products = list.map(parseProduct);
    }

    res.json({ success: true, count: products.length, products });
  } catch (err) {
    console.error('Fetch products error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

// GET single product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let product = null;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (!error && data) product = parseProduct(data);
    }

    if (!product) {
      const row = await dbGet('products', 'id', id);
      if (row) product = parseProduct(row);
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error retrieving product' });
  }
});

// ADMIN: Add new product
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const {
      name, title, description, price, image_url, images,
      category, category_name, stock, is_available
    } = req.body;

    const prodName = (name || title || '').trim();
    if (!prodName || price === undefined) {
      return res.status(400).json({ success: false, message: 'Product name and price are required.' });
    }

    const id = crypto.randomUUID();
    const parsedPrice = parseFloat(price);
    const parsedStock = stock !== undefined ? parseInt(stock, 10) : 10;
    const finalImageUrl = image_url || (Array.isArray(images) && images.length > 0 ? images[0] : null) || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80';
    const finalCategory = category || category_name || 'General';
    const finalAvailable = is_available !== undefined ? Boolean(is_available) : (parsedStock > 0);

    const newProduct = {
      id,
      name: prodName,
      description: description || '',
      price: parsedPrice,
      image_url: finalImageUrl,
      category: finalCategory,
      stock: parsedStock,
      is_available: finalAvailable,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('products').insert([newProduct]).select();
      if (error) throw error;
      return res.json({ success: true, message: 'Product added successfully to Supabase! 🎀', product: parseProduct(data[0]) });
    }

    await dbRun('insert_product', newProduct);
    res.json({ success: true, message: 'Product added successfully! 🎀', product: parseProduct(newProduct) });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to create product' });
  }
});

// ADMIN: Edit existing product
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, title, description, price, image_url, images,
      category, category_name, stock, is_available
    } = req.body;

    const prodName = name || title;
    const updatedData = {
      updated_at: new Date().toISOString()
    };

    if (prodName !== undefined) updatedData.name = prodName.trim();
    if (description !== undefined) updatedData.description = description;
    if (price !== undefined) updatedData.price = parseFloat(price);
    if (image_url !== undefined) updatedData.image_url = image_url;
    else if (Array.isArray(images) && images.length > 0) updatedData.image_url = images[0];
    if (category || category_name) updatedData.category = category || category_name;
    if (stock !== undefined) updatedData.stock = parseInt(stock, 10);
    if (is_available !== undefined) updatedData.is_available = Boolean(is_available);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('products').update(updatedData).eq('id', id).select();
      if (error) throw error;
      return res.json({ success: true, message: 'Product updated in Supabase! 🎀', product: parseProduct(data[0]) });
    }

    await dbRun('update_product', { id, ...updatedData });
    const row = await dbGet('products', 'id', id);
    res.json({ success: true, message: 'Product updated successfully! 🎀', product: parseProduct(row) });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to update product' });
  }
});

// ADMIN: Delete product
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true, message: 'Product deleted from Supabase successfully!' });
    }

    await dbRun('delete_product', { id });
    res.json({ success: true, message: 'Product deleted successfully!' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to delete product' });
  }
});

module.exports = router;
