const express = require('express');
const router = express.Router();
const { isSupabaseConfigured, supabase, dbAll, dbGet, dbRun } = require('../database');
const { verifyAdmin } = require('../middleware/auth');

// GET all site settings
router.get('/', async (req, res) => {
  try {
    let settings = {};

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('site_settings').select('*');
      if (!error && data) {
        data.forEach(item => {
          settings[item.key] = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
        });
      }
    }

    if (Object.keys(settings).length === 0) {
      const rows = await dbAll('SELECT * FROM site_settings');
      rows.forEach(item => {
        try {
          settings[item.key] = JSON.parse(item.value);
        } catch (e) {
          settings[item.key] = item.value;
        }
      });
    }

    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load site settings' });
  }
});

// Admin: Update site settings
router.put('/', verifyAdmin, async (req, res) => {
  try {
    const settingsObject = req.body;
    if (!settingsObject || typeof settingsObject !== 'object') {
      return res.status(400).json({ success: false, message: 'Settings object required' });
    }

    for (const [key, val] of Object.entries(settingsObject)) {
      const jsonValue = JSON.stringify(val);

      if (isSupabaseConfigured && supabase) {
        await supabase.from('site_settings').upsert({
          key,
          value: val,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      } else {
        const existing = await dbGet('SELECT * FROM site_settings WHERE key = ?', [key]);
        if (existing) {
          await dbRun('UPDATE site_settings SET value = ? WHERE key = ?', [jsonValue, key]);
        } else {
          await dbRun('INSERT INTO site_settings (key, value) VALUES (?, ?)', [key, jsonValue]);
        }
      }
    }

    res.json({ success: true, message: 'Site settings updated successfully ✨' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update site settings' });
  }
});

module.exports = router;
