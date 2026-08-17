const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { isSupabaseConfigured, supabase, dbGet, dbRun, dbAll } = require('../database');
require('dotenv').config();

const razorpayKeyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_lilcharm_demo';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || 'demo_razorpay_secret_12345';

let instance = null;
if (razorpayKeyId && razorpayKeySecret && !razorpayKeyId.includes('rzp_test_your_key_id')) {
  try {
    instance = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });
  } catch (e) {
    console.warn('Razorpay initialization notice:', e.message);
  }
}

// POST: Create Razorpay Payment Order
router.post('/create-order', async (req, res) => {
  try {
    const { amount, receipt, items } = req.body;
    if (!amount) {
      return res.status(400).json({ success: false, message: 'Payment amount is required.' });
    }

    // 1. Stock verification prior to payment initiation
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const prodId = item.product_id || item.id;
        const requestedQty = parseInt(item.quantity || 1, 10);
        let prod = null;

        if (isSupabaseConfigured && supabase) {
          const { data } = await supabase.from('products').select('*').eq('id', prodId).single();
          if (data) prod = data;
        }
        if (!prod) prod = await dbGet('products', 'id', prodId);

        if (!prod || !prod.is_available || prod.stock < requestedQty) {
          return res.status(400).json({
            success: false,
            message: `Cannot initiate payment. "${item.name || item.title || 'Product'}" is out of stock.`
          });
        }
      }
    }

    const amountInPaise = Math.round(parseFloat(amount) * 100);

    if (instance) {
      const options = {
        amount: amountInPaise,
        currency: 'INR',
        receipt: receipt || `rcpt_${Date.now()}`
      };

      const rzpOrder = await instance.orders.create(options);
      return res.json({
        success: true,
        key: razorpayKeyId,
        order_id: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency
      });
    }

    // Test mode fallback order ID for development
    const dummyOrderId = 'order_rzp_test_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    return res.json({
      success: true,
      is_test_mode: true,
      key: razorpayKeyId,
      order_id: dummyOrderId,
      amount: amountInPaise,
      currency: 'INR',
      message: 'Razorpay Test credentials active. Real transactions active when live credentials are set in .env'
    });
  } catch (err) {
    console.error('Razorpay order creation error:', err);
    res.status(500).json({ success: false, message: 'Failed to initiate Razorpay order.' });
  }
});

// POST: Verify Razorpay Payment Signature
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id // Internal Database Order ID
    } = req.body;

    let isValid = false;

    if (instance && razorpay_signature) {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(body.toString())
        .digest('hex');

      isValid = (expectedSignature === razorpay_signature);
    } else {
      // Test mode verification approval
      isValid = true;
    }

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature verification.' });
    }

    // Update order status & payment status in Supabase / Database
    if (order_id) {
      const rzpOrdId = razorpay_order_id || 'rzp_order_demo';
      const rzpPayId = razorpay_payment_id || 'rzp_pay_demo';

      if (isSupabaseConfigured && supabase) {
        // Update order status
        await supabase.from('orders').update({
          payment_status: 'Paid',
          order_status: 'Paid',
          razorpay_order_id: rzpOrdId,
          razorpay_payment_id: rzpPayId
        }).eq('id', order_id);

        // Retrieve order items to update product stock in Supabase
        const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order_id);
        if (items && items.length > 0) {
          for (const item of items) {
            const { data: prod } = await supabase.from('products').select('*').eq('id', item.product_id).single();
            if (prod) {
              const newStock = Math.max(0, (prod.stock || 0) - item.quantity);
              await supabase.from('products').update({
                stock: newStock,
                is_available: newStock > 0
              }).eq('id', prod.id);
            }
          }
        }
      } else {
        await dbRun('update_order', {
          id: order_id,
          payment_status: 'Paid',
          order_status: 'Paid',
          razorpay_order_id: rzpOrdId,
          razorpay_payment_id: rzpPayId
        });

        // Local stock reduction
        const allItems = await dbAll('order_items');
        const items = allItems.filter(i => i.order_id === order_id);
        for (const item of items) {
          await dbRun('decrement_stock', { product_id: item.product_id, quantity: item.quantity });
        }
      }
    }

    res.json({
      success: true,
      message: 'Payment verified successfully! Your order is confirmed 🎀',
      payment_id: razorpay_payment_id || 'pay_test_' + Date.now()
    });
  } catch (err) {
    console.error('Razorpay payment verify error:', err);
    res.status(500).json({ success: false, message: 'Payment verification failed.' });
  }
});

module.exports = router;
