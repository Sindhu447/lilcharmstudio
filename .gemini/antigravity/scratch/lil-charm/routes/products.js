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
    let productsMap = new Map();

    // 1. Fetch from local JSON store first
    let localList = await dbAll('products');
    for (const p of localList) {
      const parsed = parseProduct(p);
      if (parsed) productsMap.set(parsed.id, parsed);
    }

    // 2. Fetch from Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('products').select('*').order('created_at', { ascending: false });
        const { data, error } = await query;
        if (!error && data && data.length) {
          for (const p of data) {
            const parsed = parseProduct(p);
            if (parsed) productsMap.set(parsed.id, parsed);
          }
        }
      } catch (sbErr) {
        console.warn('Supabase fetch products warning:', sbErr.message);
      }
    }

    let products = Array.from(productsMap.values());

    // Apply filtering
    if (admin !== 'true') {
      products = products.filter(p => p.is_available !== false);
    }
    if (category) {
      products = products.filter(p => (p.category || '').toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      products = products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    }

    // Sort by newest created_at
    products.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

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
      try {
        const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
        if (!error && data) product = parseProduct(data);
      } catch (e) {}
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

    // Save to local store
    await dbRun('insert_product', newProduct);

    // Also sync to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('products').insert([newProduct]);
      } catch (sbErr) {
        console.warn('Supabase insert product warning:', sbErr.message);
      }
    }

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

    // Update local store
    await dbRun('update_product', { id, ...updatedData });
    const row = await dbGet('products', 'id', id);

    // Sync to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('products').update(updatedData).eq('id', id);
      } catch (sbErr) {
        console.warn('Supabase update product warning:', sbErr.message);
      }
    }

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

    // Delete from local store
    await dbRun('delete_product', { id });

    // Sync deletion to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('products').delete().eq('id', id);
      } catch (sbErr) {
        console.warn('Supabase delete product warning:', sbErr.message);
      }
    }

    res.json({ success: true, message: 'Product deleted successfully!' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to delete product' });
  }
});

module.exports = router;
