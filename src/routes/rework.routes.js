const express = require('express');
const { requireAuth } = require('../lib/auth');
const { parsePagination } = require('../lib/apiHelpers');
const { validateBody, validateId } = require('../middlewares/validate');
const {
  createPartRework,
  listPartReworkEntries,
  updatePartRework,
  deletePartRework,
} = require('../services/rework.service');

const router = express.Router();

// Public — submit satu baris Data Pengerjaan Part Rework dari /lhp (tab
// "Rework", tanpa login), mirip pola /overtime-entry & /rejection-entry.
router.post('/part-rework', validateBody(
  ['tanggal_ditemukan', 'tanggal_repair', 'part_name', 'grup_head'],
  'tanggal_ditemukan, tanggal_repair, part_name, dan grup_head wajib diisi',
), async (req, res, next) => {
  try {
    const { grup_head } = req.body;
    const result = await createPartRework(req.body);
    if (result.status === 'group_head_not_found') {
      return res.status(400).json({ error: `Grup Head "${grup_head}" tidak ditemukan di Master Data` });
    }
    res.status(201).json(result.record);
  } catch (err) { next(err); }
});

// Login-gated — daftar Data Pengerjaan Part Rework untuk menu Data
// Rework, difilter periode sama pola dengan /overtime-entries, dipaging.
router.get('/part-rework-entries', requireAuth, async (req, res, next) => {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const result = await listPartReworkEntries({
      period: req.query.period, date: req.query.date, start: req.query.start, end: req.query.end,
      page, pageSize, skip, take,
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/part-rework-update', requireAuth, validateId(), async (req, res, next) => {
  try {
    const id = req.body.id;
    const result = await updatePartRework(id, req.body);
    if (result.status === 'group_head_not_found') {
      return res.status(400).json({ error: `Grup Head "${req.body.grup_head}" tidak ditemukan di Master Data` });
    }
    res.json(result.record);
  } catch (err) { next(err); }
});

router.post('/part-rework-delete', requireAuth, validateId(), async (req, res, next) => {
  try {
    await deletePartRework(req.body.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
