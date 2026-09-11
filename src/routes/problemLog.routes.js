const express = require('express');
const { requireAuth } = require('../lib/auth');
const { parsePagination } = require('../lib/apiHelpers');
const { validateBody, validateId } = require('../middlewares/validate');
const {
  listProblemLog,
  createProblemLog,
  updateProblemLog,
  deleteProblemLog,
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../services/problemLog.service');

const router = express.Router();

// Public — daftar problem/root-cause log, untuk tabel di halaman detail AR.
router.get('/problem-log', requireAuth, async (req, res, next) => {
  try {
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const result = await listProblemLog({
      period: req.query.period, date: req.query.date, start: req.query.start, end: req.query.end,
      page, pageSize, skip, take,
    });
    res.json(result);
  } catch (err) { next(err); }
});

// Public — tambah baris problem/root-cause log baru.
router.post('/problem-log', validateBody(['problem'], 'problem wajib diisi'), async (req, res, next) => {
  try {
    const result = await createProblemLog(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// Edit field problem log. Flat path — id di body (Vercel edge routing 404
// untuk nested path /problem-log/:id).
router.post('/problem-log-update', requireAuth, validateId(), async (req, res, next) => {
  try {
    const record = await updateProblemLog(req.body.id, req.body);
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  } catch (err) { next(err); }
});

router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const result = await listNotificationsForUser(req.query.username);
    res.json(result);
  } catch (err) { next(err); }
});

// NOTE: sengaja TIDAK pakai validateId()/validateBody() di sini -- endpoint
// ini butuh id (numerik, seperti validateId) DAN username (string, seperti
// validateBody) sekaligus dalam SATU pesan error gabungan ('id dan username
// wajib diisi'). Kedua helper di middlewares/validate.js masing-masing cuma
// urus satu pola itu sendiri-sendiri dengan pesan errornya sendiri --
// dipaksa gabung 2 middleware di sini malah mengubah pesan/urutan error
// yang dilihat frontend dibanding perilaku lama. Pola manual di bawah ini
// paling aman buat kasus gabungan seperti ini.
router.post('/notifications-read', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    const username = String(req.body.username || '').trim();
    if (!id || !username) return res.status(400).json({ error: 'id dan username wajib diisi' });
    const result = await markNotificationRead(id, username);
    if (result.status === 'not_found') return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/notifications-read-all', requireAuth, validateBody(['username'], 'username wajib diisi'), async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    await markAllNotificationsRead(username);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/problem-log-delete', requireAuth, validateId(), async (req, res, next) => {
  try {
    await deleteProblemLog(req.body.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
