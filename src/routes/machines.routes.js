const express = require('express');
const prisma = require('../lib/prisma');
const requireAuth = require('../middlewares/requireAuth');

const router = express.Router();

// ── GET /api/machines ────────────────────────────────────
// Login-gated — daftar mesin dari tabel Machine (shared dengan
// Dashboard-MTN, lihat model Machine di schema.prisma) buat dropdown Mesin
// di Master Data -> Part Name & Proses. Cluster & Line ikut disertakan
// supaya frontend bisa filter per Cluster & auto-isi Line Produksi begitu
// Mesin dipilih (lihat /master-proses & /master-proses-update).
router.get('/machines', requireAuth, async (req, res, next) => {
  try {
    const machines = await prisma.machine.findMany({
      orderBy: [{ cluster: 'asc' }, { machine: 'asc' }],
    });
    res.json(machines);
  } catch (err) { next(err); }
});

module.exports = router;
