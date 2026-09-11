const express = require('express');
const { getPeriodRange } = require('../lib/period');
const { requireAuth, isPrivilegedUsername } = require('../lib/auth');
const { parsePagination } = require('../lib/apiHelpers');
const { validateBody, validateId } = require('../middlewares/validate');
const produksiService = require('../services/produksi.service');

const router = express.Router();

// ── POST /api/produksi-harian ─────────────────────────
// Public — submit satu baris Resume Control Harian Produksi (Part + Proses +
// Mesin) dari halaman /rmo (tanpa login).
router.post('/produksi-harian', validateBody(
  ['tanggal', 'shift', 'cluster', 'line', 'part_name', 'proses', 'mesin'],
  'tanggal, shift, cluster, line, part, proses, dan mesin wajib diisi',
), async (req, res, next) => {
  try {
    const result = await produksiService.createProduksiHarian(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// ── POST /api/produksi-harian-update ───────────────────
// Login-gated — admin/Grup Head mengedit baris Resume Control Harian
// Produksi yang sudah tersimpan (mis. salah input Plan/OK/Reject). Path
// flat, id di body (lihat catatan di atas soal Vercel routing).
router.post('/produksi-harian-update', requireAuth, validateId(), async (req, res, next) => {
  try {
    const id = req.body.id;

    const existing = await produksiService.getProduksiHarianById(id);
    if (!existing) return res.status(404).json({ error: 'Data tidak ditemukan' });

    const canEdit = await produksiService.canEditCluster(req.admin.username, existing.cluster);
    if (!canEdit) return res.status(403).json({ error: 'Tidak punya akses untuk mengubah data cluster ini' });

    const result = await produksiService.updateProduksiHarian(id, req.body, {
      isPrivileged: isPrivilegedUsername(req.admin.username),
    });
    res.json(result);
  } catch (err) { next(err); }
});

// ── POST /api/produksi-harian-delete ───────────────────
// Login-gated — admin/Grup Head menghapus baris yang salah input total.
router.post('/produksi-harian-delete', requireAuth, validateId(), async (req, res, next) => {
  try {
    const id = req.body.id;

    const existing = await produksiService.getProduksiHarianById(id);
    if (!existing) return res.status(404).json({ error: 'Data tidak ditemukan' });

    const canEdit = await produksiService.canEditCluster(req.admin.username, existing.cluster);
    if (!canEdit) return res.status(403).json({ error: 'Tidak punya akses untuk mengubah data cluster ini' });

    await produksiService.deleteProduksiHarian(id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── GET /api/produksi-ok-for-part ──────────────────────
// Public — dipakai form Input Rejection (/lhp) buat pratinjau Total OK
// otomatis saat Part Name/Tanggal dipilih, sebelum baris Rejection-nya
// benar-benar disimpan.
router.get('/produksi-ok-for-part', async (req, res, next) => {
  try {
    const { part_name, tanggal } = req.query;
    if (!part_name || !tanggal) return res.json({ totalOk: 0, hasFinishProses: false });
    const result = await produksiService.getOkForPart(part_name, new Date(tanggal));
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian/summary ──────────────────
// Ringkasan OEE (Availability, Performance, Yield, AR, OEE) diagregasi dari
// semua baris Resume Control Harian Produksi dalam periode terpilih.
router.get('/produksi-harian-summary', requireAuth, async (req, res, next) => {
  try {
    const { start, end } = getPeriodRange(req.query.period, req.query.date, req.query.start, req.query.end);
    // Cluster opsional -- kalau tidak dikirim, semua Cluster (perilaku lama
    // tetap sama persis, dipakai Dashboard). Dikirim dari Detail OEE saat
    // filter Cluster dipilih.
    const result = await produksiService.getSummary({ start, end, cluster: req.query.cluster });
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /api/ar-breakdown ──────────────────────────────
// Gabungan /ar-by-cluster + /ar-by-line + /jenis-problem-stats -- lihat
// catatan lengkap di produksi.service.js#getArBreakdown.
router.get('/ar-breakdown', requireAuth, async (req, res, next) => {
  try {
    const { start, end } = getPeriodRange(req.query.period, req.query.date, req.query.start, req.query.end);
    const result = await produksiService.getArBreakdown({ start, end, cluster: req.query.cluster });
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /api/downtime-audit ─────────────────────────────
// Rekap baris RC Harian Produksi yang punya sinyal downtime (Jenis
// Problem/Loss Time/Breakdown Mesin/Keterangan) -- lihat catatan lengkap
// di produksi.service.js#getDowntimeAudit. Dipakai menu Downtime Produksi.
router.get('/downtime-audit', requireAuth, async (req, res, next) => {
  try {
    const { start, end } = getPeriodRange(req.query.period, req.query.date, req.query.start, req.query.end);
    const result = await produksiService.getDowntimeAudit({ start, end, cluster: req.query.cluster });
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian/ar-trend ──────────────────
// Tren AR untuk grafik drill-down AR di dashboard -- lihat catatan pola
// bucket di produksi.service.js#getArTrend.
router.get('/ar-trend', requireAuth, async (req, res, next) => {
  try {
    const period = req.query.period || 'today';
    const ref = req.query.date ? new Date(req.query.date) : new Date();
    const result = await produksiService.getArTrend({ period, ref, cluster: req.query.cluster });
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /api/ar-trend-by-cluster ────────────────────────
// Sama seperti /ar-trend, tapi sekali panggil buat SEMUA Cluster sekaligus
// -- lihat catatan lengkap di produksi.service.js#getArTrendByCluster.
router.get('/ar-trend-by-cluster', requireAuth, async (req, res, next) => {
  try {
    const period = req.query.period || 'today';
    const ref = req.query.date ? new Date(req.query.date) : new Date();
    const result = await produksiService.getArTrendByCluster({ period, ref });
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /api/oee-breakdown ──────────────────────────────
// Gabungan /oee-by-cluster + /oee-by-line + bagian OEE dari
// /produksi-harian-summary -- lihat catatan lengkap di
// produksi.service.js#getOeeBreakdown.
router.get('/oee-breakdown', requireAuth, async (req, res, next) => {
  try {
    const { start, end } = getPeriodRange(req.query.period, req.query.date, req.query.start, req.query.end);
    const result = await produksiService.getOeeBreakdown({ start, end, cluster: req.query.cluster });
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /api/oee-trend ──────────────────────────────────
// Tren OEE untuk grafik drill-down di Detail OEE, ikut pola PeriodPicker
// yang sama dengan /ar-trend (today -> per tanggal, month -> per bulan,
// year -> per tahun).
router.get('/oee-trend', requireAuth, async (req, res, next) => {
  try {
    const period = req.query.period || 'today';
    const ref = req.query.date ? new Date(req.query.date) : new Date();
    const result = await produksiService.getOeeTrend({ period, ref, cluster: req.query.cluster });
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian ───────────────────────────
// Public — daftar seluruh baris Resume Control Harian Produksi dalam
// periode terpilih, dengan metrik AR/AVB/PERF/YIELD/OEE per baris, untuk
// tabel hasil input di halaman /rmo. Dipaging (page/pageSize) -- dulu
// narik seluruh baris periode sekaligus, makin berat seiring data
// historis /rmo menumpuk.
router.get('/produksi-harian', async (req, res, next) => {
  try {
    const { start, end } = getPeriodRange(req.query.period, req.query.date, req.query.start, req.query.end);
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const { total, rows } = await produksiService.listProduksiHarian({ start, end, skip, take });
    res.json({ rows, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (err) { next(err); }
});

// ── GET /api/produksi-harian-my-cluster ─────────────────
// Login-gated -- dipakai tab "Data Produksi" di /rmo, dibatasi ke Cluster
// Grup Head yang login -- lihat catatan lengkap di
// produksi.service.js#listProduksiHarianMyCluster.
router.get('/produksi-harian-my-cluster', requireAuth, async (req, res, next) => {
  try {
    const { start, end } = getPeriodRange(req.query.period, req.query.date, req.query.start, req.query.end);
    const { page, pageSize, skip, take } = parsePagination(req.query);
    const result = await produksiService.listProduksiHarianMyCluster({
      username: req.admin.username, start, end, skip, take,
    });
    if (!result) return res.status(403).json({ error: 'Akun ini tidak terdaftar sebagai Grup Head' });
    const { cluster, total, rows } = result;
    res.json({ cluster, rows, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (err) { next(err); }
});

module.exports = router;
