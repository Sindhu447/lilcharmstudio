const express = require('express');
const router = express.Router();
const { isSupabaseConfigured, supabase, dbAll, dbGet, dbRun } = require('../database');
const { verifyAdmin } = require('../middleware/auth');
const crypto = require('crypto');

// POST: Create Customer Order (with Stock Validation & Line Items)
router.post('/', async (req, res) => {
  try {
    const {
      customer_name, email, phone, address,
      city, state, pincode, total_amount, items
    } = req.body;

    const custName = customer_name || req.body.custName;
    const custEmail = email || req.body.customer_email || req.body.custEmail;
    const custPhone = phone || req.body.customer_phone || req.body.custPhone;
    const custAddress = address ? `${address}${city ? ', ' + city : ''}${state ? ', ' + state : ''}${pincode ? ' - ' + pincode : ''}` : req.body.custAddress;

    if (!custName || !custPhone || !custAddress || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer name, phone, shipping address, and non-empty cart items are required.'
      });
    }

    // 1. Double check stock for all cart items against products table
    for (const item of items) {
      const prodId = item.product_id || item.id;
      const requestedQty = parseInt(item.quantity || 1, 10);
      let prod = null;

      if (isSupabaseConfigured && supabase) {
        const { data } = await supabase.from('products').select('*').eq('id', prodId).single();
        if (data) prod = data;
      }

      if (!prod) {
        prod = await dbGet('products', 'id', prodId);
      }

      if (!prod) {
        return res.status(400).json({
          success: false,
          message: `Product "${item.name || item.title || 'Selected product'}" is no longer available.`
        });
      }

      if (!prod.is_available || prod.stock < requestedQty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${prod.name || prod.title}". Available stock: ${prod.stock}`
        });
      }
    }

    const orderId = crypto.randomUUID();
    const parsedTotal = parseFloat(total_amount || 0);

    const orderRecord = {
      id: orderId,
      customer_name: custName,
      email: custEmail || 'customer@example.com',
      phone: custPhone,
      address: custAddress,
      total_amount: parsedTotal,
      payment_status: 'Pending',
      razorpay_order_id: req.body.razorpay_order_id || null,
      razorpay_payment_id: req.body.razorpay_payment_id || null,
      order_status: 'Pending',
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      // Insert into orders table
      const { data: createdOrder, error: orderError } = await supabase
        .from('orders')
        .insert([orderRecord])
        .select();

      if (orderError) throw orderError;

      // Insert line items into order_items table
      const orderItemsToInsert = items.map(item => ({
        id: crypto.randomUUID(),
        order_id: orderId,
        product_id: item.product_id || item.id,
        quantity: parseInt(item.quantity || 1, 10),
        price: parseFloat(item.price || 0)
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItemsToInsert);
      if (itemsError) console.warn('Order items insert warning:', itemsError.message);

      return res.json({
        success: true,
        message: 'Order created successfully! 🎀',
        order: {
          ...createdOrder[0],
          order_items: orderItemsToInsert
        }
      });
    }

    // Fallback store
    await dbRun('insert_order', orderRecord);
    const orderItemsToInsert = items.map(item => {
      const oi = {
        id: crypto.randomUUID(),
        order_id: orderId,
        product_id: item.product_id || item.id,
        quantity: parseInt(item.quantity || 1, 10),
        price: parseFloat(item.price || 0)
      };
      dbRun('insert_order_item', oi);
      return oi;
    });

    return res.json({
      success: true,
      message: 'Order created successfully! 🎀',
      order: {
        ...orderRecord,
        order_items: orderItemsToInsert
      }
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to place order.' });
  }
});

// ADMIN: Get all orders (with line items)
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const { status, search } = req.query;
    let orders = [];

    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from('orders')
        .select('*, order_items(*, products(name, image_url))')
        .order('created_at', { ascending: false });

      if (status) query = query.eq('order_status', status);
      if (search) query = query.ilike('customer_name', `%${search}%`);

      const { data, error } = await query;
      if (!error && data) {
        orders = data;
      }
    }

    if (!orders.length) {
      let allOrders = await dbAll('orders');
      const allItems = await dbAll('order_items');
      const allProds = await dbAll('products');

      if (status) allOrders = allOrders.filter(o => o.order_status === status);
      if (search) {
        const q = search.toLowerCase();
        allOrders = allOrders.filter(o => (o.customer_name || '').toLowerCase().includes(q) || (o.phone || '').includes(q));
      }

      orders = allOrders.map(o => {
        const itemsForOrder = allItems.filter(i => i.order_id === o.id).map(i => {
          const p = allProds.find(pr => pr.id === i.product_id);
          return {
            ...i,
            products: p ? { name: p.name || p.title, image_url: p.image_url } : null
          };
        });
        return {
          ...o,
          order_items: itemsForOrder
        };
      });
    }

    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    console.error('Fetch orders error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

// ADMIN: Update order status
router.put('/:id/status', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { order_status, payment_status } = req.body;

    const validOrderStatuses = ['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (order_status && !validOrderStatuses.includes(order_status)) {
      return res.status(400).json({ success: false, message: `Invalid order status. Allowed values: ${validOrderStatuses.join(', ')}` });
    }

    const updates = {};
    if (order_status) updates.order_status = order_status;
    if (payment_status) updates.payment_status = payment_status;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('orders').update(updates).eq('id', id).select();
      if (error) throw error;
      return res.json({ success: true, message: 'Order status updated successfully! 🎀', order: data[0] });
    }

    await dbRun('update_order', { id, ...updates });
    const order = await dbGet('orders', 'id', id);
    res.json({ success: true, message: 'Order status updated successfully! 🎀', order });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to update order status' });
  }
});

module.exports = router;
