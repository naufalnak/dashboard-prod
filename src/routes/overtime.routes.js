const express = require('express');
const { requireAuth } = require('../lib/auth');
const { parsePagination } = require('../lib/apiHelpers');
const { validateBody, validateId } = require('../middlewares/validate');
const {
  createOvertimeEntry,
  listOvertimeEntries,
  updateOvertimeEntry,
  deleteOvertimeEntry,
  getOvertimeBreakdown,
  getOvertimeTrend,
} = require('../services/overtime.service');

const router = express.Router();

// Public — submit satu baris Input Overtime dari /lhp (tab "Overtime",
// tanpa login), mirip pola /rejection-entry.
router.post('/overtime-entry', validateBody(['tanggal'], 'tanggal wajib diisi'), async (req, res, next) => {
  try {
    const result = await createOvertimeEntry(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// Login-gated — daftar Input Overtime untuk menu Data Overtime, dipaging.
router.get('/overtime-entries', requireAuth, async (req, res, next) => {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const result = await listOvertimeEntries({
      period: req.query.period, date: req.query.date, start: req.query.start, end: req.query.end,
      page, pageSize, skip, take,
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/overtime-entry-update', requireAuth, validateId(), async (req, res, next) => {
  try {
    const result = await updateOvertimeEntry(req.body.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/overtime-entry-delete', requireAuth, validateId(), async (req, res, next) => {
  try {
    await deleteOvertimeEntry(req.body.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Gabungan /overtime-by-cluster + /overtime-by-manpower +
// /overtime-by-group-head, diturunkan dari satu query di service.
router.get('/overtime-breakdown', requireAuth, async (req, res, next) => {
  try {
    const result = await getOvertimeBreakdown({
      period: req.query.period, date: req.query.date, start: req.query.start, end: req.query.end,
      cluster: req.query.cluster,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// Tren total jam lembur. Harian = per tanggal dalam bulan, Mingguan = per
// minggu (Week 1..5) dalam bulan, Bulanan = per bulan dalam tahun, Tahunan
// = per tahun.
router.get('/overtime-trend', requireAuth, async (req, res, next) => {
  try {
    const result = await getOvertimeTrend({ period: req.query.period, date: req.query.date, cluster: req.query.cluster });
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
