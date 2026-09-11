const express = require('express');
const { requireAuth } = require('../lib/auth');
const { parsePagination } = require('../lib/apiHelpers');
const { validateBody, validateId } = require('../middlewares/validate');
const {
  createRejectionEntry,
  listRejectionEntries,
  updateRejectionEntry,
  deleteRejectionEntry,
  getRejectionBreakdown,
  getRejectionTrend,
} = require('../services/rejection.service');

const router = express.Router();

// Public — submit satu baris Input Rejection dari /lhp (tab "Input
// Rejection", tanpa login), mirip pola /produksi-harian.
router.post('/rejection-entry', validateBody(['tanggal', 'part_name'], 'tanggal dan part_name wajib diisi'), async (req, res, next) => {
  try {
    const result = await createRejectionEntry(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// Login-gated — daftar Input Rejection untuk menu Data Rejection, dipaging
// (bukan lagi seluruh baris periode sekaligus).
router.get('/rejection-entries', requireAuth, async (req, res, next) => {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const result = await listRejectionEntries({
      period: req.query.period, date: req.query.date, start: req.query.start, end: req.query.end,
      page, pageSize, skip, take,
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/rejection-entry-update', requireAuth, validateId(), async (req, res, next) => {
  try {
    const id = req.body.id;
    const result = await updateRejectionEntry(id, req.body);
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/rejection-entry-delete', requireAuth, validateId(), async (req, res, next) => {
  try {
    const id = req.body.id;
    await deleteRejectionEntry(id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Gabungan /rejection-by-cluster + /rejection-by-partname +
// /kriteria-ng-stats -- ketiganya dulu 3 findMany terpisah ke
// RejectionEntry dengan where (tanggal+cluster) yang PERSIS SAMA, ditembak
// bareng dari RejectionDetail.jsx. Sekarang diturunkan dari satu query di
// service.
router.get('/rejection-breakdown', requireAuth, async (req, res, next) => {
  try {
    const result = await getRejectionBreakdown({
      period: req.query.period, date: req.query.date, start: req.query.start, end: req.query.end,
      cluster: req.query.cluster,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// Tren Reject Ratio. Harian = per tanggal dalam bulan, Mingguan = per
// minggu (Week 1..5) dalam bulan, Bulanan = per bulan dalam tahun, Tahunan
// = per tahun.
router.get('/rejection-trend', requireAuth, async (req, res, next) => {
  try {
    const result = await getRejectionTrend({ period: req.query.period, date: req.query.date, cluster: req.query.cluster });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
