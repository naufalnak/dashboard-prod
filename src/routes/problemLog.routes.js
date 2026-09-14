// HTTP layer untuk domain Problem Produksi (ProblemLog) + Notifikasi --
// tipis, cuma parse request & panggil services/problemLog.service.js.
const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const problemLogService = require('../services/problemLog.service');

const router = express.Router();

// ── GET /api/problem-log ───────────────────────────────
router.get('/problem-log', requireAuth, async (req, res, next) => {
  try {
    res.json(await problemLogService.listProblemLog(req.query));
  } catch (err) { next(err); }
});

// ── POST /api/problem-log ──────────────────────────────
router.post('/problem-log', async (req, res, next) => {
  try {
    res.status(201).json(await problemLogService.createProblemLog(req.body));
  } catch (err) { next(err); }
});

// ── POST /api/problem-log-update ───────────────────────
// Flat path — id di body (Vercel edge routing 404 untuk nested path
// /problem-log/:id).
router.post('/problem-log-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    res.json(await problemLogService.updateProblemLog(id, req.body));
  } catch (err) { next(err); }
});

// ── GET /api/notifications ──────────────────────────────
router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    res.json(await problemLogService.listNotifications(req.query.username));
  } catch (err) { next(err); }
});

router.post('/notifications-read', requireAuth, async (req, res, next) => {
  try {
    await problemLogService.markNotificationRead(Number(req.body.id), String(req.body.username || '').trim());
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/notifications-read-all', requireAuth, async (req, res, next) => {
  try {
    await problemLogService.markAllNotificationsRead(String(req.body.username || '').trim());
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST /api/problem-log-delete ───────────────────────
router.post('/problem-log-delete', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    await problemLogService.deleteProblemLog(id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
