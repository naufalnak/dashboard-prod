const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../lib/auth');
const masterDataService = require('../services/masterData.service');

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// ══════════════════════════════════════════════════════════════════════
// Master data gabungan & lookup baca-saja
// ══════════════════════════════════════════════════════════════════════

// ── GET /api/master ────────────────────────────────────
// Public — master data relasional lengkap untuk dropdown bertingkat di
// form /rmo: Group Head → Cluster → Part Name → Proses (+Cycle Time,
// Line Produksi, Mesin, Man Power).
router.get('/master', async (req, res, next) => {
  try {
    res.json(await masterDataService.getMasterData());
  } catch (err) { next(err); }
});

// ── GET /api/legacy-lookups ─────────────────────────────
// Login-gated — daftar nama mentah dari tabel lama "MP", "Mesin", "Proses",
// "Nama Parts" (lihat catatan lengkap di masterData.service.js).
router.get('/legacy-lookups', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.getLegacyLookups());
  } catch (err) { next(err); }
});

// NOTE: GET /machines dipindah sepenuhnya ke machines.routes.js -- tidak
// lagi didefinisikan di sini. (Sebelumnya sempat ada 2 definisi, yang di
// sini "menang" karena masterData.routes.js di-mount duluan di
// routes/index.js, jadi versi machines.routes.js jadi dead code tanpa
// disadari -- lihat commit message untuk detail.)

// ══════════════════════════════════════════════════════════════════════
// Analisis silang Data Produksi ↔ Master Data (panel "perlu perhatian")
// ══════════════════════════════════════════════════════════════════════

// ── GET /api/produksi-partname-counts ──────────────────
router.get('/produksi-partname-counts', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.getProduksiPartnameCounts());
  } catch (err) { next(err); }
});

// ── GET /api/produksi-orphan-partnames ──────────────────
router.get('/produksi-orphan-partnames', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.getProduksiOrphanPartnames());
  } catch (err) { next(err); }
});

// ── GET /api/master-partname-missing-finish ─────────────
router.get('/master-partname-missing-finish', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.getPartnameMissingFinish());
  } catch (err) { next(err); }
});

// ── GET /api/master-partname-unused ──────────────────────
router.get('/master-partname-unused', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.getPartnameUnused());
  } catch (err) { next(err); }
});

// ── GET /api/master-proses-mesin-mismatch ────────────────
router.get('/master-proses-mesin-mismatch', requireAuth, async (req, res, next) => {
  try {
    res.json(await masterDataService.getProsesMesinMismatch());
  } catch (err) { next(err); }
});

// ── POST /api/produksi-rename-partname ─────────────────
router.post('/produksi-rename-partname', requireAuth, async (req, res, next) => {
  try {
    const from = String(req.body.from || '').trim();
    const to = String(req.body.to || '').trim();
    if (!from || !to) return res.status(400).json({ error: 'from dan to wajib diisi' });
    res.json(await masterDataService.renamePartName(from, to));
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════
// Master Group Head (CRUD)
// ══════════════════════════════════════════════════════════════════════

router.post('/master-group-head', requireAuth, async (req, res, next) => {
  try {
    const { name, cluster } = req.body;
    if (!name || !cluster) return res.status(400).json({ error: 'name dan cluster wajib diisi' });
    res.status(201).json(await masterDataService.upsertGroupHead({ name, cluster }));
  } catch (err) { next(err); }
});
router.post('/master-group-head-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const record = await masterDataService.updateGroupHead(id, req.body);
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  } catch (err) { next(err); }
});
router.post('/master-group-head-delete', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    await masterDataService.deleteGroupHead(id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════
// Master Man Power (CRUD)
// ══════════════════════════════════════════════════════════════════════

router.post('/master-man-power', requireAuth, async (req, res, next) => {
  try {
    const { name, group_head } = req.body;
    if (!name || !group_head) return res.status(400).json({ error: 'name dan group_head wajib diisi' });
    res.status(201).json(await masterDataService.upsertManPower({ name, group_head }));
  } catch (err) { next(err); }
});
router.post('/master-man-power-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const record = await masterDataService.updateManPower(id, req.body);
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
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

// ══════════════════════════════════════════════════════════════════════
// Master Part Name (CRUD + delete guard + merge)
// ══════════════════════════════════════════════════════════════════════

router.post('/master-part-name', requireAuth, async (req, res, next) => {
  try {
    const result = await masterDataService.upsertPartName(req.body);
    if (result.status === 'invalid') return res.status(400).json({ error: 'part_name dan cluster wajib diisi' });
    res.status(201).json(result.record);
  } catch (err) { next(err); }
});
router.post('/master-part-name-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const record = await masterDataService.updatePartName(id, req.body);
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  } catch (err) { next(err); }
});
// Login-gated — hapus satu Part Name Master Data. Ditolak (400) kalau
// ternyata masih punya baris Proses atau data historis apa pun.
router.post('/master-part-name-delete', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const result = await masterDataService.deletePartName(id);
    if (result.status === 'not_found') return res.status(404).json({ error: 'Not found' });
    if (result.status === 'in_use') return res.status(400).json({ error: 'Part Name ini masih punya data, tidak bisa dihapus' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
// Gabungkan dua Part Name Master Data yang sebenarnya part yang sama --
// lihat catatan lengkap di masterData.service.js#mergePartNames.
router.post('/master-part-name-merge', requireAuth, async (req, res, next) => {
  try {
    const from = String(req.body.from || '').trim();
    const to = String(req.body.to || '').trim();
    if (!from || !to) return res.status(400).json({ error: 'from dan to wajib diisi' });
    const result = await masterDataService.mergePartNames(from, to);
    if (result.status === 'not_found') return res.status(404).json({ error: `Part Name "${result.which === 'from' ? from : to}" tidak ditemukan` });
    if (result.status === 'same') return res.status(400).json({ error: 'from dan to adalah Part Name yang sama' });
    res.json(result);
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════
// Master Proses (CRUD + import massal + tandai Proses Akhir/Finish)
// ══════════════════════════════════════════════════════════════════════

router.post('/master-proses', requireAuth, async (req, res, next) => {
  try {
    const result = await masterDataService.createProses(req.body);
    if (result.status === 'invalid') return res.status(400).json({ error: 'proses, part_name, dan mesin wajib diisi' });
    res.status(201).json(result.record);
  } catch (err) { next(err); }
});
router.post('/master-proses-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const record = await masterDataService.updateProses(id, req.body);
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
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
// Import massal Part Name + Proses dari file Excel yang di-parse di
// FRONTEND -- lihat catatan lengkap di
// masterData.service.js#importProsesFromRows.
router.post('/master-proses-import', requireAuth, async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (rows.length === 0) return res.status(400).json({ error: 'Tidak ada baris untuk diimport' });
    res.json(await masterDataService.importProsesFromRows(rows));
  } catch (err) { next(err); }
});
// Tandai/lepas status "Proses Akhir/Finish" satu baris Proses.
router.post('/master-proses-set-finish', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const value = req.body.value !== false;
    const record = await masterDataService.setProsesFinish(id, value);
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  } catch (err) { next(err); }
});
// Gabungkan satu baris Proses (fromId) ke Part Name+Proses lain -- lihat
// catatan lengkap di masterData.service.js#mergeProses.
router.post('/master-proses-merge', requireAuth, async (req, res, next) => {
  try {
    const fromId = Number(req.body.from_id);
    const toPartName = String(req.body.to_part_name || '').trim();
    const toProses = String(req.body.to_proses || '').trim();
    if (!fromId) return res.status(400).json({ error: 'from_id wajib diisi' });
    if (!toPartName || !toProses) return res.status(400).json({ error: 'to_part_name dan to_proses wajib diisi' });
    const result = await masterDataService.mergeProses(fromId, toPartName, toProses);
    if (result.status === 'not_found') return res.status(404).json({ error: 'Baris Proses asal tidak ditemukan' });
    if (result.status === 'target_not_found') return res.status(404).json({ error: `Part Name "${toPartName}" belum terdaftar di Master Data` });
    if (result.status === 'same') return res.status(400).json({ error: 'Tujuan sama dengan Part Name+Proses asal' });
    res.json(result);
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════
// Master Kriteria NG (CRUD)
// ══════════════════════════════════════════════════════════════════════

router.post('/master-kriteria-ng', requireAuth, async (req, res, next) => {
  try {
    const { nama } = req.body;
    if (!nama) return res.status(400).json({ error: 'nama wajib diisi' });
    const result = await masterDataService.upsertKriteriaNg(nama);
    res.status(201).json(result.record);
  } catch (err) { next(err); }
});
router.post('/master-kriteria-ng-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    res.json(await masterDataService.updateKriteriaNg(id, req.body));
  } catch (err) { next(err); }
});
router.post('/master-kriteria-ng-delete', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    await masterDataService.deleteKriteriaNg(id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════
// Master Overtime Target (CRUD)
// ══════════════════════════════════════════════════════════════════════

router.post('/master-overtime-target', requireAuth, async (req, res, next) => {
  try {
    const result = await masterDataService.upsertOvertimeTarget(req.body);
    if (result.status === 'invalid') return res.status(400).json({ error: 'year dan month (1-12) wajib diisi' });
    res.status(201).json(result.record);
  } catch (err) { next(err); }
});
router.post('/master-overtime-target-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    res.json(await masterDataService.updateOvertimeTarget(id, req.body));
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

// ══════════════════════════════════════════════════════════════════════
// Master Shift Hours (CRUD)
// ══════════════════════════════════════════════════════════════════════

router.post('/master-shift-hours', requireAuth, async (req, res, next) => {
  try {
    const result = await masterDataService.upsertShiftHours(req.body);
    if (result.status === 'invalid') return res.status(400).json({ error: 'shift wajib diisi' });
    res.status(201).json(result.record);
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

// ══════════════════════════════════════════════════════════════════════
// Import CSV massal (Group Head + Part Name + Proses sekaligus)
// ══════════════════════════════════════════════════════════════════════

// ── POST /api/master/import ────────────────────────────
router.post('/master-import', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json(await masterDataService.importMasterCsv(req.file.buffer.toString('utf-8')));
  } catch (err) { next(err); }
});

module.exports = router;
