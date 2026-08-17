const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { isSupabaseConfigured, supabase, dbGet, dbAll } = require('../database');
const { verifyAdmin, JWT_SECRET } = require('../middleware/auth');
require('dotenv').config();

// Admin Login Endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let adminRecord = null;
    let authSuccess = false;

    // 1. Try authenticating via Supabase Auth or admin_users lookup if Supabase is connected
    if (isSupabaseConfigured && supabase) {
      // Try Supabase Auth sign-in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password
      });

      if (!authError && authData?.user) {
        // Verify user is in admin_users table
        const { data: adminData } = await supabase
          .from('admin_users')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (adminData) {
          authSuccess = true;
          adminRecord = { id: authData.user.id, email: cleanEmail, role: adminData.role || 'admin' };
        }
      }

      // If Supabase Auth failed, check if record exists in admin_users table directly
      if (!authSuccess) {
        const { data: directAdmin } = await supabase
          .from('admin_users')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (directAdmin) {
          // Allow fallback password matching or admin env password
          const envPass = process.env.ADMIN_DEFAULT_PASSWORD || 'AdminPass123!';
          if (password === envPass) {
            authSuccess = true;
            adminRecord = directAdmin;
          }
        }
      }
    }

    // 2. Fallback check for default/local admin credentials
    if (!authSuccess) {
      const defaultAdminEmail = (process.env.ADMIN_EMAIL || 'admin@lilcharm.com').toLowerCase();
      const defaultAdminPass = process.env.ADMIN_DEFAULT_PASSWORD || 'AdminPass123!';

      if (cleanEmail === defaultAdminEmail && password === defaultAdminPass) {
        authSuccess = true;
        adminRecord = { id: 'adm_1', email: defaultAdminEmail, role: 'admin' };
      }
    }

    if (!authSuccess || !adminRecord) {
      return res.status(401).json({ success: false, message: 'Invalid admin email or password.' });
    }

    // Generate JWT admin session token
    const token = jwt.sign(
      { id: adminRecord.id, email: adminRecord.email, role: adminRecord.role || 'admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Admin authentication successful!',
      token,
      user: { id: adminRecord.id, email: adminRecord.email, role: adminRecord.role || 'admin' }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during admin authentication.' });
  }
});

// Admin Profile Verification
router.get('/me', verifyAdmin, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
