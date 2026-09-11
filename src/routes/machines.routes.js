const express = require('express');
const { requireAuth } = require('../lib/auth');
// Dipindah dari masterData.routes.js -- delegasi ke masterDataService
// yang sama (Machine tetap salah satu tabel Master Data, shared dengan
// Dashboard-MTN), tapi route-nya sendiri dipisah supaya sejalan dengan
// domain routing lain (produksi/rejection/overtime/dst -- satu file
// route per konsep, bukan per tabel).
const masterDataService = require('../services/masterData.service');

const router = express.Router();

// ── GET /api/machines ────────────────────────────────────
// Login-gated — daftar mesin dari tabel Machine (shared dengan
// Dashboard-MTN) buat dropdown Mesin di Master Data -> Part Name & Proses.
router.get('/machines', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.getMachines());
  } catch (err) { next(err); }
});

module.exports = router;