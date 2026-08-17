const jwt = require('jsonwebtoken');
const { isSupabaseConfigured, supabase, dbGet } = require('../database');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'lil_charm_super_secret_jwt_key_2026!';

async function verifyAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied. Authorization token required for admin access.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.email) {
      return res.status(403).json({ success: false, message: 'Forbidden. Invalid admin token payload.' });
    }

    // Verify admin role against Supabase admin_users table or fallback DB
    let isUserAdmin = false;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', decoded.email.toLowerCase())
        .maybeSingle();

      if (!error && data) {
        isUserAdmin = true;
      }
    }

    // If Supabase not configured or not matched, check decoded role or local admin email
    if (!isUserAdmin) {
      if (decoded.role === 'admin' || decoded.email.toLowerCase() === (process.env.ADMIN_EMAIL || 'admin@lilcharm.com').toLowerCase()) {
        isUserAdmin = true;
      }
    }

    if (!isUserAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden. Admin privileges required.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session token.' });
  }
}

module.exports = { verifyAdmin, JWT_SECRET };
