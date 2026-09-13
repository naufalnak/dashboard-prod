// HTTP layer untuk domain Master Data -- tipis, cuma parse request &
// panggil services/masterData.service.js. Business logic & query Prisma
// ada di sana (lihat komentar di file itu).
const express = require('express');
const multer = require('multer');
const requireAuth = require('../middlewares/requireAuth');
const { requireFields, requireId } = require('../middlewares/validate');
const masterDataService = require('../services/masterData.service');

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// ── GET /api/master ────────────────────────────────────
router.get('/master', async (req, res, next) => {
  try {
    res.json(await masterDataService.getMaster());
  } catch (err) { next(err); }
});

// ── GET /api/legacy-lookups ─────────────────────────────
router.get('/legacy-lookups', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.getLegacyLookups());
  } catch (err) { next(err); }
});

// ── GET /api/produksi-partname-counts ──────────────────
router.get('/produksi-partname-counts', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.getProduksiPartNameCounts());
  } catch (err) { next(err); }
});

// ── GET /api/produksi-orphan-partnames ──────────────────
router.get('/produksi-orphan-partnames', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.getOrphanPartNames());
  } catch (err) { next(err); }
});

// ── GET /api/master-partname-missing-finish ─────────────
router.get('/master-partname-missing-finish', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.getMissingFinishPartNames());
  } catch (err) { next(err); }
});

// ── GET /api/master-partname-unused ──────────────────────
router.get('/master-partname-unused', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.getUnusedPartNames());
  } catch (err) { next(err); }
});

// ── POST /api/master-part-name-delete ────────────────────
router.post('/master-part-name-delete', requireAuth, requireId(), async (req, res, next) => {
  try {
    await masterDataService.deletePartName(req.validatedId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /api/master-proses-mesin-mismatch ────────────────
router.get('/master-proses-mesin-mismatch', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.getMesinMismatch());
  } catch (err) { next(err); }
});

// ── POST /api/produksi-rename-partname ─────────────────
router.post('/produksi-rename-partname', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.renameProduksiPartName(req.body.from, req.body.to));
  } catch (err) { next(err); }
});

router.post('/master-group-head', requireAuth, async (req, res, next) => {
  try {
    res.status(201).json(await masterDataService.createGroupHead(req.body.name, req.body.cluster));
  } catch (err) { next(err); }
});

router.post('/master-group-head-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    res.json(await masterDataService.updateGroupHead(id, req.body));
  } catch (err) { next(err); }
});

router.post('/master-group-head-delete', requireAuth, requireId(), async (req, res, next) => {
  try {
    await masterDataService.deleteGroupHead(req.validatedId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/master-man-power', requireAuth, async (req, res, next) => {
  try {
    res.status(201).json(await masterDataService.createManPower(req.body.name, req.body.group_head));
  } catch (err) { next(err); }
});

router.post('/master-man-power-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    res.json(await masterDataService.updateManPower(id, req.body));
  } catch (err) { next(err); }
});

router.post('/master-man-power-delete', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    await masterDataService.deleteManPower(id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/master-part-name', requireAuth, async (req, res, next) => {
  try {
    res.status(201).json(await masterDataService.createPartName(req.body));
  } catch (err) { next(err); }
});

router.post('/master-part-name-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    res.json(await masterDataService.updatePartName(id, req.body));
  } catch (err) { next(err); }
});

router.post('/master-proses', requireAuth, async (req, res, next) => {
  try {
    res.status(201).json(await masterDataService.createProses(req.body));
  } catch (err) { next(err); }
});

router.post('/master-proses-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    res.json(await masterDataService.updateProses(id, req.body));
  } catch (err) { next(err); }
});

router.post('/master-proses-delete', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    await masterDataService.deleteProses(id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST /api/master-proses-import ──────────────────────
// Import massal Part Name + Proses dari file Excel (di-parse di
// FRONTEND, lihat web/src/importXlsx.js), dikirim sebagai array biasa
// lewat JSON (bukan multipart).
router.post('/master-proses-import', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.importProses(req.body.rows));
  } catch (err) { next(err); }
});

router.post('/master-proses-set-finish', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const value = req.body.value !== false;
    res.json(await masterDataService.setFinishProses(id, value));
  } catch (err) { next(err); }
});

router.post('/master-part-name-merge', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.mergePartName(req.body.from, req.body.to));
  } catch (err) { next(err); }
});

router.post('/master-proses-merge', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.mergeProses(req.body.from_ids, req.body.to_part_name, req.body.to_proses));
  } catch (err) { next(err); }
});

// Daftar Kriteria NG (jenis cacat) -- dipilih saat input Rejection.
router.post('/master-kriteria-ng', requireAuth, requireFields(['nama']), async (req, res, next) => {
  try {
    res.status(201).json(await masterDataService.createKriteriaNg(req.body.nama));
  } catch (err) { next(err); }
});

router.post('/master-kriteria-ng-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    res.json(await masterDataService.updateKriteriaNg(id, req.body.nama));
  } catch (err) { next(err); }
});

router.post('/master-kriteria-ng-delete', requireAuth, requireId(), async (req, res, next) => {
  try {
    await masterDataService.deleteKriteriaNg(req.validatedId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/master-overtime-target', requireAuth, async (req, res, next) => {
  try {
    res.status(201).json(await masterDataService.createOvertimeTarget(req.body));
  } catch (err) { next(err); }
});

router.post('/master-overtime-target-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    res.json(await masterDataService.updateOvertimeTarget(id, req.body.target_hours));
  } catch (err) { next(err); }
});

router.post('/master-overtime-target-delete', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    await masterDataService.deleteOvertimeTarget(id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/master-shift-hours', requireAuth, async (req, res, next) => {
  try {
    res.status(201).json(await masterDataService.createShiftHours(req.body.shift, req.body.default_hours));
  } catch (err) { next(err); }
});

router.post('/master-shift-hours-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    res.json(await masterDataService.updateShiftHours(id, req.body));
  } catch (err) { next(err); }
});

router.post('/master-shift-hours-delete', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    await masterDataService.deleteShiftHours(id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── POST /api/master/import ────────────────────────────
// Login-gated — import CSV massal: Group Head, Cluster, Part Name, Cycle
// Time, Proses, Line Produksi, Mesin, Man Power.
router.post('/master-import', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json(await masterDataService.importMasterCsv(req.file.buffer));
  } catch (err) { next(err); }
});

module.exports = router;
