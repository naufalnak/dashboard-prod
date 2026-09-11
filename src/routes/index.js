const express = require('express');
const { apiLimiter } = require('../lib/rateLimit');

const router = express.Router();

// Limiter umum berlaku ke semua /api/* -- lihat src/lib/rateLimit.js untuk
// alasannya (endpoint publik tanpa login butuh ini paling banyak).
router.use(apiLimiter);

// File ini sekarang cuma aggregator -- tiap domain punya file routes
// sendiri di folder ini (lihat masing-masing untuk detail & komentar
// per endpoint). loginLimiter khusus /login ada di dalam auth.routes.js
// sendiri, tidak di sini. (Sebelumnya bernama routes/api.js -- diganti
// jadi index.js supaya konsisten dengan konvensi "file aggregator sebuah
// folder bernama index.js".)
router.use(require('./auth.routes'));
router.use(require('./masterData.routes'));
router.use(require('./machines.routes'));
router.use(require('./produksi.routes'));
router.use(require('./rejection.routes'));
router.use(require('./overtime.routes'));
router.use(require('./rework.routes'));
router.use(require('./problemLog.routes'));

module.exports = router;