// Business logic & query Prisma untuk domain Input Rejection / Material NG
// (RejectionEntry) -- dipindah dari routes/rejection.routes.js.
const prisma = require('../lib/prisma');
const { getPeriodRange } = require('../lib/period');
const { buildTrendBuckets } = require('../utils/dateRange');
const { toDateOnly, roundTo, upper } = require('../utils/formatters');
const { rejectionMetrics, resolveTotalOkFromProduksi, pct } = require('./produksiMetrics.service');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function mapRejectionRow(r) {
  return {
    id: r.id,
    tanggal: toDateOnly(r.tanggal),
    waktu: r.waktu,
    cluster: r.cluster,
    partName: r.partName,
    price: r.price,
    totalOk: r.totalOk,
    totalLmr: r.totalLmr,
    kriteriaNg: r.kriteriaNg,
    keterangan: r.keterangan,
    ...rejectionMetrics(r),
  };
}

// Public — submit satu baris Input Rejection dari /lhp (tab "Input
// Rejection", tanpa login), mirip pola /produksi-harian. Cluster & Price
// diselesaikan di server dari Master Data Part Name (bukan dipercaya dari
// client) supaya konsisten dengan sumber aslinya. Total OK Input Rejection
// = jumlah OK1+OK2 dari RC Harian Produksi pada Proses Akhir/Finish Part
// Name itu, untuk tanggal yang sama.
async function createRejection(body) {
  const { tanggal, waktu, part_name, total_lmr, kriteria_ng, keterangan } = body;
  if (!tanggal || !part_name) throw httpError(400, 'tanggal dan part_name wajib diisi');

  const partNameRecord = await prisma.masterPartName.findFirst({
    where: { partName: { equals: part_name, mode: 'insensitive' } },
  });
  const kriteriaRecord = kriteria_ng
    ? await prisma.masterKriteriaNg.findFirst({ where: { nama: { equals: kriteria_ng, mode: 'insensitive' } } })
    : null;
  const { totalOk } = await resolveTotalOkFromProduksi(part_name, new Date(tanggal));

  const record = await prisma.rejectionEntry.create({
    data: {
      tanggal: new Date(tanggal),
      waktu: waktu || null,
      cluster: partNameRecord?.cluster || '',
      partName: upper(part_name),
      partNameId: partNameRecord?.id || null,
      price: partNameRecord?.price || 0,
      totalOk,
      totalLmr: total_lmr ? Number(total_lmr) : 0,
      kriteriaNg: kriteria_ng || null,
      kriteriaNgId: kriteriaRecord?.id || null,
      keterangan: keterangan || null,
    },
  });
  return { id: record.id, ...rejectionMetrics(record) };
}

// Login-gated — daftar semua Input Rejection untuk menu Data Rejection.
async function listRejection(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const rows = await prisma.rejectionEntry.findMany({
    where: { tanggal: { gte: start, lte: end } },
    orderBy: [{ tanggal: 'desc' }, { id: 'desc' }],
  });
  return rows.map(mapRejectionRow);
}

async function updateRejection(id, body) {
  const existing = await prisma.rejectionEntry.findUnique({ where: { id } });
  if (!existing) throw httpError(404, 'Not found');
  const { tanggal, waktu, part_name, total_lmr, kriteria_ng, keterangan } = body;
  const data = {};
  if (tanggal !== undefined) data.tanggal = new Date(tanggal);
  if (waktu !== undefined) data.waktu = waktu || null;
  if (total_lmr !== undefined) data.totalLmr = Number(total_lmr) || 0;
  if (keterangan !== undefined) data.keterangan = keterangan || null;
  if (part_name !== undefined) {
    const partNameRecord = await prisma.masterPartName.findFirst({
      where: { partName: { equals: part_name, mode: 'insensitive' } },
    });
    data.partName = upper(part_name);
    data.partNameId = partNameRecord?.id || null;
    data.cluster = partNameRecord?.cluster || '';
    data.price = partNameRecord?.price || 0;
  }
  if (kriteria_ng !== undefined) {
    const kriteriaRecord = kriteria_ng
      ? await prisma.masterKriteriaNg.findFirst({ where: { nama: { equals: kriteria_ng, mode: 'insensitive' } } })
      : null;
    data.kriteriaNg = kriteria_ng || null;
    data.kriteriaNgId = kriteriaRecord?.id || null;
  }
  // Total OK selalu di-resolve ulang dari RC Harian Produksi (Proses
  // Akhir) berdasar Part Name & Tanggal yang berlaku setelah update ini
  // -- tidak pernah dipercaya dari input client, dan otomatis nyinkron
  // ulang kalau Proses Akhir-nya baru diganti belakangan di Master Data.
  const effectivePartName = data.partName ?? existing.partName;
  const effectiveTanggal = data.tanggal ?? existing.tanggal;
  const { totalOk } = await resolveTotalOkFromProduksi(effectivePartName, effectiveTanggal);
  data.totalOk = totalOk;

  const record = await prisma.rejectionEntry.update({ where: { id }, data });
  return { id: record.id, ...rejectionMetrics(record) };
}

async function deleteRejection(id) {
  await prisma.rejectionEntry.delete({ where: { id } });
}

// Reject Ratio rata-rata (Total LMR ÷ Total OK) per Cluster dalam periode
// terpilih -- untuk halaman detail Rejection.
async function getRejectionByCluster(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
  const rows = await prisma.rejectionEntry.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

  const byCluster = {};
  for (const r of rows) {
    if (!byCluster[r.cluster]) byCluster[r.cluster] = { ok: 0, lmr: 0 };
    byCluster[r.cluster].ok += r.totalOk;
    byCluster[r.cluster].lmr += r.totalLmr;
  }
  return Object.entries(byCluster).map(([cluster, v]) => ({ cluster, rejection: roundTo(pct(v.lmr, v.ok)) }));
}

// Reject Ratio per Part Name dalam periode terpilih -- untuk ranking 5
// Part Name Reject tertinggi/terendah di halaman detail Rejection.
async function getRejectionByPartName(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
  const rows = await prisma.rejectionEntry.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

  const byPart = {};
  for (const r of rows) {
    if (!byPart[r.partName]) byPart[r.partName] = { cluster: r.cluster, ok: 0, lmr: 0 };
    byPart[r.partName].ok += r.totalOk;
    byPart[r.partName].lmr += r.totalLmr;
  }
  return Object.entries(byPart).map(([line, v]) => ({
    // nama field disamakan "line" supaya HorizontalBarList bisa dipakai ulang tanpa ubahan
    line, cluster: v.cluster, rejection: roundTo(pct(v.lmr, v.ok)),
  })).sort((a, b) => b.rejection - a.rejection);
}

// Persentase Kriteria NG (jenis cacat) yang diakumulasi dari RejectionEntry
// dalam periode terpilih -- dipakai untuk donut chart di Detail Rejection.
async function getKriteriaNgStats(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
  const rows = await prisma.rejectionEntry.findMany({
    where: { tanggal: { gte: start, lte: end }, kriteriaNg: { not: null }, ...clusterFilter },
    select: { kriteriaNg: true },
  });

  const counts = {};
  for (const r of rows) {
    if (!r.kriteriaNg) continue;
    counts[r.kriteriaNg] = (counts[r.kriteriaNg] || 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return Object.entries(counts).map(([jenis, count]) => ({
    jenis, count, pct: total > 0 ? roundTo((count / total) * 100) : 0,
  })).sort((a, b) => b.count - a.count);
}

async function findEarliestRejectionYear() {
  const agg = await prisma.rejectionEntry.aggregate({ _min: { tanggal: true } });
  return agg._min.tanggal ? agg._min.tanggal.getUTCFullYear() : null;
}

// Tren Reject Ratio. Harian = per tanggal dalam bulan, Mingguan = per
// minggu (Week 1..5) dalam bulan, Bulanan = per bulan dalam tahun,
// Tahunan = per tahun.
async function getRejectionTrend(query) {
  const period = query.period || 'today';
  const ref = query.date ? new Date(query.date) : new Date();
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
  const { start, end, labels, keyOf } = await buildTrendBuckets(period, ref, findEarliestRejectionYear);
  const rows = await prisma.rejectionEntry.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

  const buckets = labels.map(() => ({ ok: 0, lmr: 0 }));
  for (const r of rows) {
    const idx = keyOf(r.tanggal);
    if (buckets[idx]) { buckets[idx].ok += r.totalOk; buckets[idx].lmr += r.totalLmr; }
  }
  return labels.map((day, i) => ({ day, rejection: roundTo(pct(buckets[i].lmr, buckets[i].ok)) }));
}

module.exports = {
  createRejection,
  listRejection,
  updateRejection,
  deleteRejection,
  getRejectionByCluster,
  getRejectionByPartName,
  getKriteriaNgStats,
  getRejectionTrend,
};
