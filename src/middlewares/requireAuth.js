const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { isReadOnlyUsername } = require('../lib/auth');

// Login-gate + role enforcement dipakai di hampir semua route -- dipindah
// keluar dari lib/auth.js (yang sekarang cuma isi util: signToken,
// isPrivilegedUsername, isReadOnlyUsername) supaya middleware Express-nya
// sendiri (butuh req/res/next) terpisah dari util auth yang murni logic.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login required' });

  try {
    req.admin = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }

  // Read-only accounts boleh lewat untuk GET (lihat data) dan untuk
  // menandai notifikasi mereka sendiri terbaca (bukan mutasi data
  // produksi/master, cuma state baca-tidaknya sendiri) -- selain itu
  // (semua endpoint mutasi, yang semuanya POST) ditolak di sini.
  const isOwnNotificationRead = req.path === '/notifications-read' || req.path === '/notifications-read-all';
  if (req.method !== 'GET' && !isOwnNotificationRead && isReadOnlyUsername(req.admin.username)) {
    return res.status(403).json({ error: 'Akun ini read-only, tidak bisa mengubah data' });
  }

  next();
}

module.exports = requireAuth;
