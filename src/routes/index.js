const express = require('express');
const { apiLimiter } = require('../lib/rateLimit');

const router = express.Router();

// Limiter umum berlaku ke semua /api/* -- lihat src/lib/rateLimit.js untuk
// alasannya (endpoint publik tanpa login butuh ini paling banyak).
router.use(apiLimiter);

// Setiap domain punya file route sendiri (dipecah dari satu file
// routes/api.js ~2700 baris) -- lihat masing-masing file untuk endpoint
// & komentar detailnya. Semua tetap flat di bawah /api (lihat catatan di
// CLAUDE.md soal keterbatasan routing Vercel), pemisahan ini murni soal
// struktur source code, bukan URL.
router.use(require('./auth.routes'));
router.use(require('./machines.routes'));
router.use(require('./masterData.routes'));
router.use(require('./produksi.routes'));
router.use(require('./rejection.routes'));
router.use(require('./overtime.routes'));
router.use(require('./rework.routes'));
router.use(require('./problemLog.routes'));

module.exports = router;
