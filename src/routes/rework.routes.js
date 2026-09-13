// HTTP layer untuk domain Data Pengerjaan Part Rework -- tipis, cuma
// parse request & panggil services/rework.service.js.
const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const reworkService = require('../services/rework.service');

const router = express.Router();

router.post('/part-rework', async (req, res, next) => {
  try {
    res.status(201).json(await reworkService.createPartRework(req.body));
  } catch (err) { next(err); }
});

// Login-gated — daftar semua Data Pengerjaan Part Rework untuk menu Data
// Rework, difilter periode sama pola dengan /overtime-entries.
router.get('/part-rework-entries', requireAuth, async (req, res, next) => {
  try {
    res.json(await reworkService.listPartRework(req.query));
  } catch (err) { next(err); }
});

router.post('/part-rework-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    res.json(await reworkService.updatePartRework(id, req.body));
  } catch (err) { next(err); }
});

router.post('/part-rework-delete', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    await reworkService.deletePartRework(id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
