// HTTP layer untuk domain Input Overtime -- tipis, cuma parse request &
// panggil services/overtime.service.js.
const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const overtimeService = require('../services/overtime.service');

const router = express.Router();

router.post('/overtime-entry', async (req, res, next) => {
  try {
    res.status(201).json(await overtimeService.createOvertime(req.body));
  } catch (err) { next(err); }
});

// Login-gated — daftar semua Input Overtime untuk menu Data Overtime.
router.get('/overtime-entries', requireAuth, async (req, res, next) => {
  try {
    res.json(await overtimeService.listOvertime(req.query));
  } catch (err) { next(err); }
});

router.post('/overtime-entry-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    res.json(await overtimeService.updateOvertime(id, req.body));
  } catch (err) { next(err); }
});

router.post('/overtime-entry-delete', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    await overtimeService.deleteOvertime(id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian/overtime-by-cluster ────────
// Total jam lembur per Cluster dalam periode terpilih -- untuk kartu ring
// per-Cluster di halaman Detail Overtime.
router.get('/overtime-by-cluster', requireAuth, async (req, res, next) => {
  try {
    res.json(await overtimeService.getOvertimeByCluster(req.query));
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian/overtime-by-manpower ───────
// Total jam lembur per Man Power dalam periode terpilih -- untuk ranking 5
// Man Power lembur tertinggi/terendah di halaman Detail Overtime.
router.get('/overtime-by-manpower', requireAuth, async (req, res, next) => {
  try {
    res.json(await overtimeService.getOvertimeByManPower(req.query));
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian/overtime-by-group-head ─────
// Total jam lembur per Grup Head dalam periode terpilih -- untuk donut
// breakdown di halaman Detail Overtime.
router.get('/overtime-by-group-head', requireAuth, async (req, res, next) => {
  try {
    res.json(await overtimeService.getOvertimeByGroupHead(req.query));
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian/overtime-trend ─────────────
// Tren total jam lembur. Harian = per tanggal dalam bulan, Mingguan = per
// minggu (Week 1..5) dalam bulan, Bulanan = per bulan dalam tahun,
// Tahunan = per tahun.
router.get('/overtime-trend', requireAuth, async (req, res, next) => {
  try {
    res.json(await overtimeService.getOvertimeTrend(req.query));
  } catch (err) { next(err); }
});

module.exports = router;
