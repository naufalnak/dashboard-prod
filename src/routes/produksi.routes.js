// HTTP layer untuk domain Resume Control Harian Produksi -- tipis, cuma
// parse request & panggil services/produksi.service.js. Business logic &
// query Prisma ada di sana (lihat komentar di file itu).
const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const produksiService = require('../services/produksi.service');

const router = express.Router();

router.post('/produksi-harian', async (req, res, next) => {
  try {
    const result = await produksiService.createProduksi(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// ── POST /api/produksi-harian-update ───────────────────
// Login-gated — admin/Grup Head mengedit baris Resume Control Harian
// Produksi yang sudah tersimpan. Path flat, id di body (lihat catatan
// soal Vercel routing di CLAUDE.md).
router.post('/produksi-harian-update', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    const result = await produksiService.updateProduksi(id, req.body, req.admin.username);
    res.json(result);
  } catch (err) { next(err); }
});

// ── POST /api/produksi-harian-delete ───────────────────
// Login-gated — admin/Grup Head menghapus baris yang salah input total.
router.post('/produksi-harian-delete', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.body.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    await produksiService.deleteProduksi(id, req.admin.username);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Public — dipakai form Input Rejection (/lhp) buat pratinjau Total OK
// otomatis saat Part Name/Tanggal dipilih, sebelum baris Rejection-nya
// benar-benar disimpan.
router.get('/produksi-ok-for-part', async (req, res, next) => {
  try {
    const result = await produksiService.getOkForPart(req.query.part_name, req.query.tanggal);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/produksi-harian-summary', requireAuth, async (req, res, next) => {
  try {
    res.json(await produksiService.getSummary(req.query));
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian/ar-by-cluster ─────────────
// AR rata-rata per Cluster (AD/BC/EF/FI) dalam periode terpilih — untuk pie
// chart drill-down AR di dashboard.
router.get('/ar-by-cluster', requireAuth, async (req, res, next) => {
  try {
    res.json(await produksiService.getArByCluster(req.query));
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian/ar-by-line ────────────────
// AR rata-rata per Line Produksi dalam periode terpilih — untuk ranking
// 5 Line AR tertinggi/terendah di halaman detail AR.
router.get('/ar-by-line', requireAuth, async (req, res, next) => {
  try {
    res.json(await produksiService.getArByLine(req.query));
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian/jenis-problem-stats ───────
// Persentase Jenis Problem (4M + 1E) yang diakumulasi dari kolom
// ProduksiHarian.jenis_problem dalam periode terpilih -- dipakai untuk
// pie/bar chart di Detail AR.
router.get('/jenis-problem-stats', requireAuth, async (req, res, next) => {
  try {
    res.json(await produksiService.getJenisProblemStats(req.query));
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian/downtime-audit ────────────
// Rekap baris RC Harian Produksi yang punya Jenis Problem/Loss Time/
// Breakdown Mesin/Keterangan, ditandai baris yang belum lengkap datanya --
// dipakai menu Downtime Produksi.
router.get('/downtime-audit', requireAuth, async (req, res, next) => {
  try {
    res.json(await produksiService.getDowntimeAudit(req.query));
  } catch (err) { next(err); }
});

router.get('/ar-trend', requireAuth, async (req, res, next) => {
  try {
    res.json(await produksiService.getArTrend(req.query));
  } catch (err) { next(err); }
});

// ── GET /api/oee-by-cluster ─────────────────────────────
// OEE (+ komponen AVB/PERF/YIELD) per Cluster dalam periode terpilih --
// untuk halaman Detail OEE, sama pola dengan /ar-by-cluster.
router.get('/oee-by-cluster', requireAuth, async (req, res, next) => {
  try {
    res.json(await produksiService.getOeeByCluster(req.query));
  } catch (err) { next(err); }
});

// ── GET /api/oee-by-line ────────────────────────────────
// OEE rata-rata (tertimbang) per Line Produksi dalam periode terpilih --
// untuk ranking 5 Line OEE tertinggi/terendah di halaman Detail OEE.
router.get('/oee-by-line', requireAuth, async (req, res, next) => {
  try {
    res.json(await produksiService.getOeeByLine(req.query));
  } catch (err) { next(err); }
});

// ── GET /api/oee-trend ──────────────────────────────────
// Tren OEE untuk grafik drill-down di Detail OEE, ikut pola PeriodPicker
// yang sama dengan /ar-trend (today -> per tanggal, month -> per bulan,
// year -> per tahun).
router.get('/oee-trend', requireAuth, async (req, res, next) => {
  try {
    res.json(await produksiService.getOeeTrend(req.query));
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian ───────────────────────────
// Public — daftar seluruh baris Resume Control Harian Produksi dalam
// periode terpilih, dengan metrik AR/AVB/PERF/YIELD/OEE per baris, untuk
// tabel hasil input di halaman /rmo.
router.get('/produksi-harian', async (req, res, next) => {
  try {
    res.json(await produksiService.listProduksi(req.query));
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian-my-cluster ─────────────────
// Login-gated -- dipakai tab "Data Produksi" di /rmo (halaman publik
// tanpa login) yang minta login per Grup Head dulu (beda dari login admin
// dashboard utama, tapi akun-nya sama persis).
router.get('/produksi-harian-my-cluster', requireAuth, async (req, res, next) => {
  try {
    res.json(await produksiService.listMyClusterProduksi(req.admin.username, req.query));
  } catch (err) { next(err); }
});

module.exports = router;
