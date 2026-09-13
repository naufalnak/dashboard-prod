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

// Middleware requireAuth (butuh req/res/next) sekarang di
// src/middlewares/requireAuth.js -- file ini isinya cuma util auth murni
// (sign/cek username), dipakai middleware itu & route handlers.
module.exports = { signToken, isReadOnlyUsername, isPrivilegedUsername };
