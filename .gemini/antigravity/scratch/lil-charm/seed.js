const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { isSupabaseConfigured, supabase, dbRun, dbGet } = require('./database');
require('dotenv').config();

async function seedData() {
  console.log('🌱 Starting Lil Charm database seeding process...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@lilcharm.com';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'AdminPass123!';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // 1. Seed Admin User
  if (isSupabaseConfigured && supabase) {
    const { data: existing } = await supabase.from('users').select('*').eq('email', adminEmail).single();
    if (!existing) {
      await supabase.from('users').insert([{
        id: crypto.randomUUID(),
        email: adminEmail,
        password: hashedPassword,
        name: 'Lil Charm Admin',
        role: 'admin'
      }]);
      console.log(`✅ Supabase Admin created: ${adminEmail}`);
    }
  } else {
    const existing = await dbGet('SELECT * FROM users WHERE email = ?', [adminEmail]);
    if (!existing) {
      await dbRun(
        'INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)',
        [crypto.randomUUID(), adminEmail, hashedPassword, 'Lil Charm Admin', 'admin']
      );
      console.log(`✅ Local Admin created: ${adminEmail} (Password: ${adminPassword})`);
    }
  }

  // 2. Seed Categories
  const defaultCategories = [
    { name: 'Name Keychains', slug: 'name-keychains', description: 'Personalized clay keychains with custom name letter beads' },
    { name: 'Custom Keychains', slug: 'custom-keychains', description: 'Handcrafted custom keychains made to your exact theme and colors' },
    { name: 'Couple/Friendship Charms', slug: 'couple-friendship-charms', description: 'Matching split charms for besties and couples' },
    { name: 'Mini Charms', slug: 'mini-charms', description: 'Adorable miniature clay figures for bags, zippers, and phones' },
    { name: 'Bag Charms', slug: 'bag-charms', description: 'Statement bag charms and aesthetic backpack clip-ons' },
    { name: 'Gift Sets', slug: 'gift-sets', description: 'Curated gift boxes with aesthetic packaging and greeting cards' }
  ];

  const categoryMap = {};

  for (const cat of defaultCategories) {
    const id = crypto.randomUUID();
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('categories').select('*').eq('slug', cat.slug).single();
      if (!data) {
        const { data: inserted } = await supabase.from('categories').insert([{ id, ...cat, is_active: true }]).select();
        categoryMap[cat.name] = inserted ? inserted[0].id : id;
      } else {
        categoryMap[cat.name] = data.id;
      }
    } else {
      const data = await dbGet('SELECT * FROM categories WHERE slug = ?', [cat.slug]);
      if (!data) {
        await dbRun('INSERT INTO categories (id, name, slug, description, is_active) VALUES (?, ?, ?, ?, 1)',
          [id, cat.name, cat.slug, cat.description]
        );
        categoryMap[cat.name] = id;
      } else {
        categoryMap[cat.name] = data.id;
      }
    }
  }

  console.log('✅ Categories seeded successfully.');

  // 3. Seed Sample Products
  const defaultProducts = [
    {
      title: 'Pastel Strawberry Name Keychain 🍓',
      description: 'Hand-sculpted sweet strawberry charm with pastel letter beads and soft tassel. Customized with your name!',
      price: 299,
      discount_price: 249,
      stock: 25,
      category_name: 'Name Keychains',
      images: [
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80'
      ],
      is_featured: true,
      is_bestseller: true,
      is_new_arrival: true,
      customization_fields: [
        { name: 'Engraved Name / Word', type: 'text', required: true, placeholder: 'e.g. Lily' },
        { name: 'Color Theme', type: 'select', required: true, options: ['Pastel Pink', 'Lilac Violet', 'Mint Green', 'Soft Peach'] },
        { name: 'Tassel Accent', type: 'select', required: false, options: ['Rose Gold Star', 'Pearl Bead', 'Cute Ribbon'] },
        { name: 'Special Instructions', type: 'textarea', required: false, placeholder: 'Any specific request?' }
      ],
      tags: ['Popular', 'Custom Name', 'Best Seller']
    },
    {
      title: 'Matchy Pink Matcha & Donut Couple Charms 🍩',
      description: 'Split pair of adorable matcha cup & glazed donut clay charms. Perfect for couples or best friends!',
      price: 499,
      discount_price: 399,
      stock: 15,
      category_name: 'Couple/Friendship Charms',
      images: [
        'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=800&q=80'
      ],
      is_featured: true,
      is_bestseller: true,
      is_new_arrival: true,
      customization_fields: [
        { name: 'Initials for Charm #1', type: 'text', required: true, placeholder: 'e.g. A' },
        { name: 'Initials for Charm #2', type: 'text', required: true, placeholder: 'e.g. K' },
        { name: 'Clasp Color', type: 'select', required: true, options: ['Silver Heart', 'Gold Star', 'Rose Gold Clip'] }
      ],
      tags: ['Couple Gift', 'Matching']
    },
    {
      title: 'Aesthetic Boba Bear Bag Charm 🧋',
      description: 'Cute miniature boba tea cup with a sleepy teddy bear topper. Clip it onto your tote bag or backpack!',
      price: 349,
      discount_price: 299,
      stock: 30,
      category_name: 'Bag Charms',
      images: [
        'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80'
      ],
      is_featured: true,
      is_bestseller: false,
      is_new_arrival: true,
      customization_fields: [
        { name: 'Boba Flavor Color', type: 'select', required: true, options: ['Taro Purple', 'Matcha Green', 'Classic Milk Tea', 'Strawberry Milk'] },
        { name: 'Reference Image Upload', type: 'file', required: false }
      ],
      tags: ['Boba', 'Aesthetic']
    },
    {
      title: 'Cozy Cloud & Rainbow Mini Charm ☁️🌈',
      description: 'Dreamy soft cloud with pastel rainbow drops. Light and compact charm for keys or phone cases.',
      price: 199,
      discount_price: null,
      stock: 40,
      category_name: 'Mini Charms',
      images: [
        'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80'
      ],
      is_featured: false,
      is_bestseller: false,
      is_new_arrival: true,
      customization_fields: [
        { name: 'Custom Text on Cloud', type: 'text', required: false, placeholder: 'Short text (max 6 letters)' }
      ],
      tags: ['Mini', 'Pastel']
    },
    {
      title: 'Ultimate Handmade Happiness Gift Box 🎁',
      description: 'Includes 1 Custom Name Keychain, 1 Mini Bag Charm, Aesthetic Sticker Pack, and a handwritten personalized gift note.',
      price: 899,
      discount_price: 749,
      stock: 10,
      category_name: 'Gift Sets',
      images: [
        'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80'
      ],
      is_featured: true,
      is_bestseller: true,
      is_new_arrival: true,
      customization_fields: [
        { name: 'Recipient Name for Keychain', type: 'text', required: true },
        { name: 'Gift Card Message', type: 'textarea', required: true, placeholder: 'Write your heart out...' }
      ],
      tags: ['Gift Set', 'Luxury Box']
    }
  ];

  for (const prod of defaultProducts) {
    const catId = categoryMap[prod.category_name] || null;
    const prodId = crypto.randomUUID();

    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('products').select('*').eq('title', prod.title).single();
      if (!data) {
        await supabase.from('products').insert([{
          id: prodId,
          ...prod,
          category_id: catId,
          is_active: true
        }]);
      }
    } else {
      const data = await dbGet('SELECT * FROM products WHERE title = ?', [prod.title]);
      if (!data) {
        await dbRun(`
          INSERT INTO products (
            id, title, description, price, discount_price, stock, category_id, category_name,
            images, is_featured, is_bestseller, is_new_arrival, is_active, customization_fields, tags
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `, [
          prodId, prod.title, prod.description, prod.price, prod.discount_price, prod.stock,
          catId, prod.category_name, JSON.stringify(prod.images), prod.is_featured ? 1 : 0,
          prod.is_bestseller ? 1 : 0, prod.is_new_arrival ? 1 : 0,
          JSON.stringify(prod.customization_fields), JSON.stringify(prod.tags)
        ]);
      }
    }
  }

  console.log('✅ Default products seeded successfully.');
  console.log('✨ Seed process complete! System is ready to run.');
}

seedData().catch(console.error);
