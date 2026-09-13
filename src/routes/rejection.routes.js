// HTTP layer untuk domain Input Rejection / Material NG -- tipis, cuma
// parse request & panggil services/rejection.service.js.
const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const rejectionService = require('../services/rejection.service');

const router = express.Router();

router.post('/rejection-entry', async (req, res, next) => {
  try {
    res.status(201).json(await rejectionService.createRejection(req.body));
  } catch (err) { next(err); }
});

// Login-gated — daftar semua Input Rejection untuk menu Data Rejection.
router.get('/rejection-entries', requireAuth, async (req, res, next) => {
  try {
    res.json(await rejectionService.listRejection(req.query));
  } catch (err) { next(err); }
});

router.post('/rejection-entry-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    res.json(await rejectionService.updateRejection(id, req.body));
  } catch (err) { next(err); }
});

router.post('/rejection-entry-delete', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    await rejectionService.deleteRejection(id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian/rejection-by-cluster ──────
// Reject Ratio rata-rata (Total LMR ÷ Total OK) per Cluster dalam periode
// terpilih -- untuk halaman detail Rejection. Sumber data RejectionEntry
// (menu Input Rejection), bukan lagi kolom Reject di ProduksiHarian.
router.get('/rejection-by-cluster', requireAuth, async (req, res, next) => {
  try {
    res.json(await rejectionService.getRejectionByCluster(req.query));
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian/rejection-by-partname ─────
// Reject Ratio per Part Name dalam periode terpilih -- untuk ranking 5
// Part Name Reject tertinggi/terendah di halaman detail Rejection
// (RejectionEntry tidak punya dimensi Line, jadi ranking-nya per Part
// Name, bukan per Line seperti di Detail AR).
router.get('/rejection-by-partname', requireAuth, async (req, res, next) => {
  try {
    res.json(await rejectionService.getRejectionByPartName(req.query));
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian/kriteria-ng-stats ─────────
// Persentase Kriteria NG (jenis cacat) yang diakumulasi dari RejectionEntry
// dalam periode terpilih -- dipakai untuk donut chart di Detail Rejection.
router.get('/kriteria-ng-stats', requireAuth, async (req, res, next) => {
  try {
    res.json(await rejectionService.getKriteriaNgStats(req.query));
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian/rejection-trend ───────────
// Tren Reject Ratio. Harian = per tanggal dalam bulan, Mingguan = per
// minggu (Week 1..5) dalam bulan, Bulanan = per bulan dalam tahun,
// Tahunan = per tahun.
router.get('/rejection-trend', requireAuth, async (req, res, next) => {
  try {
    res.json(await rejectionService.getRejectionTrend(req.query));
  } catch (err) { next(err); }
});

module.exports = router;
