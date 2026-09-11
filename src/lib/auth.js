const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

const TOKEN_TTL = '8h';

// Akun-akun ini boleh login & melihat semua halaman (sama seperti akun
// privileged di web/src/roles.js PRIVILEGED_USERNAMES), tapi TIDAK boleh
// membuat/mengubah/menghapus data apa pun -- semua route mutasi di
// aplikasi ini dikirim lewat POST (lihat catatan Vercel routing), jadi
// diblokir di sini secara terpusat berdasarkan method, bukan per-route
// satu-satu. Dicocokkan case-insensitive, sama seperti PRIVILEGED_USERNAMES.
const READ_ONLY_USERNAMES = ['aris', 'supri', 'fido'];

// Sama seperti PRIVILEGED_USERNAMES di web/src/roles.js -- akun ini boleh
// mengubah/menghapus data ProduksiHarian cluster mana pun. Akun lain (Grup
// Head) dibatasi ke cluster mereka sendiri, lihat pengecekan cluster di
// route /produksi-harian-update dan /produksi-harian-delete.
const PRIVILEGED_USERNAMES = ['123', 'pradana', 'sugeng', 'djk'];

function isReadOnlyUsername(username) {
  return READ_ONLY_USERNAMES.includes(String(username || '').toLowerCase());
}

function isPrivilegedUsername(username) {
  return PRIVILEGED_USERNAMES.includes(String(username || '').toLowerCase());
}

function signToken(admin) {
  return jwt.sign({ sub: admin.id, username: admin.username, role: admin.role || 'maintenance' }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

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

module.exports = { signToken, requireAuth, JWT_SECRET, isReadOnlyUsername, isPrivilegedUsername };
