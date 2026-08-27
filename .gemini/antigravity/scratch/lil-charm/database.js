const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Determine if Supabase credentials are validly configured
const isSupabaseConfigured = Boolean(
  process.env.SUPABASE_URL && 
  process.env.SUPABASE_ANON_KEY && 
  !process.env.SUPABASE_URL.includes('your-supabase-project') &&
  process.env.SUPABASE_URL.trim() !== ''
);

let supabase = null;
if (isSupabaseConfigured) {
  try {
    const keyToUse = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    supabase = createClient(process.env.SUPABASE_URL, keyToUse, {
      auth: { persistSession: false }
    });
    console.log('⚡ Connected to Supabase Database System');
  } catch (err) {
    console.error('⚠️ Supabase initialization notice:', err.message);
  }
}

// Persistent JSON Storage Fallback for local testing without active Supabase credentials
const jsonDbPath = path.resolve(__dirname, 'lilcharm_store.json');

function loadJsonDb() {
  if (!fs.existsSync(jsonDbPath)) {
    const initialData = {
      admin_users: [
        { id: 'adm_1', email: 'admin@lilcharm.com', password: '$2a$10$eE0m1aQf.u2z4dZ6yN6Fve3Gf7X.NfW8HqR3kG.00A7c2fP1c1S2', role: 'admin', created_at: new Date().toISOString() }
      ],
      categories: [
        { id: 'cat_1', name: 'Keychains', slug: 'keychains' },
        { id: 'cat_2', name: 'Couple Charms', slug: 'couple-charms' },
        { id: 'cat_3', name: 'Bag Charms', slug: 'bag-charms' }
      ],
      products: [
        {
          id: 'prod_booba_1',
          name: 'booba bear keychain',
          description: 'Handcrafted cute booba bear charm keychain.',
          price: 60,
          image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
          category: 'Keychains',
          stock: 2,
          is_available: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      orders: [],
      order_items: []
    };
    fs.writeFileSync(jsonDbPath, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    return JSON.parse(fs.readFileSync(jsonDbPath, 'utf-8'));
  } catch (e) {
    return { admin_users: [], categories: [], products: [], orders: [], order_items: [] };
  }
}

function saveJsonDb(data) {
  fs.writeFileSync(jsonDbPath, JSON.stringify(data, null, 2));
}

// Emulate database operations for local fallback mode
async function dbRun(action, params = {}) {
  const data = loadJsonDb();
  if (action === 'insert_product') {
    data.products.push(params);
  } else if (action === 'update_product') {
    const idx = data.products.findIndex(p => p.id === params.id);
    if (idx !== -1) data.products[idx] = { ...data.products[idx], ...params, updated_at: new Date().toISOString() };
  } else if (action === 'delete_product') {
    data.products = data.products.filter(p => p.id !== params.id);
  } else if (action === 'insert_order') {
    data.orders.push(params);
  } else if (action === 'insert_order_item') {
    data.order_items.push(params);
  } else if (action === 'update_order') {
    const idx = data.orders.findIndex(o => o.id === params.id);
    if (idx !== -1) data.orders[idx] = { ...data.orders[idx], ...params };
  } else if (action === 'decrement_stock') {
    const prod = data.products.find(p => p.id === params.product_id);
    if (prod) {
      prod.stock = Math.max(0, prod.stock - params.quantity);
      if (prod.stock === 0) prod.is_available = false;
    }
  }
  saveJsonDb(data);
  return { success: true };
}

async function dbAll(entity) {
  const data = loadJsonDb();
  return data[entity] || [];
}

async function dbGet(entity, field, value) {
  const data = loadJsonDb();
  const list = data[entity] || [];
  return list.find(item => item[field] === value) || null;
}

loadJsonDb();

module.exports = {
  isSupabaseConfigured,
  supabase,
  loadJsonDb,
  saveJsonDb,
  dbRun,
  dbAll,
  dbGet
};
