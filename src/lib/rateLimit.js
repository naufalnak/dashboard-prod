const rateLimit = require('express-rate-limit');

// Limiter umum untuk semua /api/* -- cukup longgar buat pemakaian normal
// dashboard (polling widget, dst), tapi tetap membatasi abuse/scraping dari
// satu IP. Endpoint publik tanpa login (/produksi-harian, /rejection-entry,
// dst -- form kiosk di /lhp) paling butuh ini karena tidak ada proteksi
// login sama sekali di baliknya.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan, coba lagi beberapa saat lagi' },
});

// Limiter lebih ketat khusus /login -- mencegah brute-force nebak password.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan login, coba lagi dalam 15 menit' },
});

module.exports = { apiLimiter, loginLimiter };
