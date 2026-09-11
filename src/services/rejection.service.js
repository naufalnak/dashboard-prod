const prisma = require('../lib/prisma');
const { getPeriodRange } = require('../lib/period');
const { weekOfMonth, resolveTotalOkFromProduksi } = require('../lib/apiHelpers');

// ── Rejection / Material NG (RejectionEntry) ───────────
// Terpisah dari ProduksiHarian -- dimensinya per Part Name + harga, bukan
// per Proses/Mesin/Line. reject_ratio = Total LMR ÷ Total OK × 100%
// (bukan dibagi Total Proses), sesuai rumus laporan Material Reject yang
// sudah ada.
function rejectionMetrics(r) {
  const pct = (n, d) => d > 0 ? Math.max(0, Math.min(100, (n / d) * 100)) : 0;
  const totalProses = r.totalOk + r.totalLmr;
  const rejectRatio = pct(r.totalLmr, r.totalOk);
  return {
    totalProses,
    rejectRatio: Number(rejectRatio.toFixed(2)),
    nilaiOk: Number((r.totalOk * r.price).toFixed(0)),
    nilaiLmr: Number((r.totalLmr * r.price).toFixed(0)),
  };
}

function serializeRejectionRow(r) {
  return {
    id: r.id,
    tanggal: r.tanggal.toISOString().slice(0, 10),
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

// Cluster & Price diselesaikan di server dari Master Data Part Name (bukan
// dipercaya dari client) supaya konsisten dengan sumber aslinya. Total OK
// Input Rejection = jumlah OK1+OK2 dari RC Harian Produksi (ProduksiHarian)
// pada Proses Akhir/Finish Part Name itu, untuk tanggal yang sama dengan
// entri Rejection-nya.
async function createRejectionEntry({ tanggal, waktu, part_name, total_lmr, kriteria_ng, keterangan }) {
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
      partName: part_name,
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

// count & findMany jalan paralel supaya total halaman tidak nunggu query
// baris selesai duluan.
async function listRejectionEntries({ period, date, start: qsStart, end: qsEnd, page, pageSize, skip, take }) {
  const { start, end } = getPeriodRange(period, date, qsStart, qsEnd);
  const where = { tanggal: { gte: start, lte: end } };
  const [total, rows] = await Promise.all([
    prisma.rejectionEntry.count({ where }),
    prisma.rejectionEntry.findMany({
      where,
      orderBy: [{ tanggal: 'desc' }, { id: 'desc' }],
      skip, take,
    }),
  ]);
  return {
    rows: rows.map(serializeRejectionRow),
    page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function updateRejectionEntry(id, { tanggal, waktu, part_name, total_lmr, kriteria_ng, keterangan }) {
  const existing = await prisma.rejectionEntry.findUnique({ where: { id } });
  if (!existing) return null;

  const data = {};
  if (tanggal !== undefined) data.tanggal = new Date(tanggal);
  if (waktu !== undefined) data.waktu = waktu || null;
  if (total_lmr !== undefined) data.totalLmr = Number(total_lmr) || 0;
  if (keterangan !== undefined) data.keterangan = keterangan || null;
  if (part_name !== undefined) {
    const partNameRecord = await prisma.masterPartName.findFirst({
      where: { partName: { equals: part_name, mode: 'insensitive' } },
    });
    data.partName = part_name;
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
  // Akhir) berdasar Part Name & Tanggal yang berlaku setelah update ini --
  // tidak pernah dipercaya dari input client, dan otomatis nyinkron ulang
  // kalau Proses Akhir-nya baru diganti belakangan di Master Data.
  const effectivePartName = data.partName ?? existing.partName;
  const effectiveTanggal = data.tanggal ?? existing.tanggal;
  const { totalOk } = await resolveTotalOkFromProduksi(effectivePartName, effectiveTanggal);
  data.totalOk = totalOk;

  const record = await prisma.rejectionEntry.update({ where: { id }, data });
  return { id: record.id, ...rejectionMetrics(record) };
}

async function deleteRejectionEntry(id) {
  await prisma.rejectionEntry.delete({ where: { id } });
}

// Gabungan /rejection-by-cluster + /rejection-by-partname +
// /kriteria-ng-stats -- ketiganya dulu 3 findMany terpisah ke
// RejectionEntry dengan where (tanggal+cluster) yang PERSIS SAMA. Sekarang
// satu findMany (select kolom yang dibutuhkan saja) dipakai buat menurunkan
// ketiga breakdown itu.
async function getRejectionBreakdown({ period, date, start: qsStart, end: qsEnd, cluster }) {
  const { start, end } = getPeriodRange(period, date, qsStart, qsEnd);
  const clusterFilter = cluster ? { cluster } : {};
  const rows = await prisma.rejectionEntry.findMany({
    where: { tanggal: { gte: start, lte: end }, ...clusterFilter },
    select: { cluster: true, partName: true, kriteriaNg: true, totalOk: true, totalLmr: true },
  });

  const byCluster = {};
  const byPart = {};
  const kriteriaCounts = {};
  for (const r of rows) {
    if (!byCluster[r.cluster]) byCluster[r.cluster] = { ok: 0, lmr: 0 };
    byCluster[r.cluster].ok += r.totalOk;
    byCluster[r.cluster].lmr += r.totalLmr;
    if (!byPart[r.partName]) byPart[r.partName] = { cluster: r.cluster, ok: 0, lmr: 0 };
    byPart[r.partName].ok += r.totalOk;
    byPart[r.partName].lmr += r.totalLmr;
    if (r.kriteriaNg) kriteriaCounts[r.kriteriaNg] = (kriteriaCounts[r.kriteriaNg] || 0) + 1;
  }

  const pct = (n, d) => d > 0 ? Math.max(0, Math.min(100, (n / d) * 100)) : 0;
  const byClusterResult = Object.entries(byCluster).map(([cluster, v]) => ({
    cluster, rejection: Number(pct(v.lmr, v.ok).toFixed(1)),
  }));
  const byPartNameResult = Object.entries(byPart).map(([line, v]) => ({
    line, // nama field disamakan "line" supaya HorizontalBarList bisa dipakai ulang tanpa ubahan
    cluster: v.cluster,
    rejection: Number(pct(v.lmr, v.ok).toFixed(1)),
  })).sort((a, b) => b.rejection - a.rejection);
  const kriteriaTotal = Object.values(kriteriaCounts).reduce((a, b) => a + b, 0);
  const kriteriaNgResult = Object.entries(kriteriaCounts).map(([jenis, count]) => ({
    jenis, count,
    pct: kriteriaTotal > 0 ? Number(((count / kriteriaTotal) * 100).toFixed(1)) : 0,
  })).sort((a, b) => b.count - a.count);

  return { byCluster: byClusterResult, byPartName: byPartNameResult, kriteriaNg: kriteriaNgResult };
}

// Tren Reject Ratio. Harian = per tanggal dalam bulan, Mingguan = per
// minggu (Week 1..5) dalam bulan, Bulanan = per bulan dalam tahun, Tahunan
// = per tahun.
async function getRejectionTrend({ period, date, cluster }) {
  const ref = date ? new Date(date) : new Date();
  const pct = (n, d) => d > 0 ? Math.max(0, Math.min(100, (n / d) * 100)) : 0;
  const clusterFilter = cluster ? { cluster } : {};
  const p = period || 'today';

  if (p === 'today') {
    const year = ref.getFullYear(), month = ref.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const rows = await prisma.rejectionEntry.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

    const daysInMonth = end.getDate();
    const byDay = Array.from({ length: daysInMonth }, (_, i) => ({
      day: String(i + 1).padStart(2, '0'), ok: 0, lmr: 0,
    }));
    for (const r of rows) {
      const idx = r.tanggal.getUTCDate() - 1;
      if (byDay[idx]) { byDay[idx].ok += r.totalOk; byDay[idx].lmr += r.totalLmr; }
    }
    return byDay.map((d) => ({ day: d.day, rejection: Number(pct(d.lmr, d.ok).toFixed(1)) }));
  }

  if (p === 'week') {
    const year = ref.getFullYear(), month = ref.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const rows = await prisma.rejectionEntry.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

    const weekCount = Math.ceil(end.getDate() / 7);
    const byWeek = Array.from({ length: weekCount }, (_, i) => ({ day: `Week ${i + 1}`, ok: 0, lmr: 0 }));
    for (const r of rows) {
      const idx = weekOfMonth(r.tanggal) - 1;
      if (byWeek[idx]) { byWeek[idx].ok += r.totalOk; byWeek[idx].lmr += r.totalLmr; }
    }
    return byWeek.map((d) => ({ day: d.day, rejection: Number(pct(d.lmr, d.ok).toFixed(1)) }));
  }

  if (p === 'year') {
    const agg = await prisma.rejectionEntry.aggregate({ _min: { tanggal: true } });
    const earliestYear = agg._min.tanggal ? agg._min.tanggal.getUTCFullYear() : ref.getFullYear();
    const thisYear = new Date().getFullYear();
    const fromYear = Math.min(earliestYear, thisYear);
    const years = [];
    for (let y = fromYear; y <= thisYear; y++) years.push(y);

    const start = new Date(fromYear, 0, 1);
    const end = new Date(thisYear, 11, 31, 23, 59, 59, 999);
    const rows = await prisma.rejectionEntry.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

    const byYear = {};
    years.forEach((y) => { byYear[y] = { ok: 0, lmr: 0 }; });
    for (const r of rows) {
      const y = r.tanggal.getUTCFullYear();
      if (byYear[y]) { byYear[y].ok += r.totalOk; byYear[y].lmr += r.totalLmr; }
    }
    return years.map((y) => ({ day: String(y), rejection: Number(pct(byYear[y].lmr, byYear[y].ok).toFixed(1)) }));
  }

  // default: month ("Bulanan") -> per bulan dalam tahun
  const year = ref.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  const rows = await prisma.rejectionEntry.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const byMonth = MONTHS.map((m) => ({ day: m, ok: 0, lmr: 0 }));
  for (const r of rows) {
    const idx = r.tanggal.getUTCMonth();
    byMonth[idx].ok += r.totalOk;
    byMonth[idx].lmr += r.totalLmr;
  }
  return byMonth.map((d) => ({ day: d.day, rejection: Number(pct(d.lmr, d.ok).toFixed(1)) }));
}

module.exports = {
  createRejectionEntry,
  listRejectionEntries,
  updateRejectionEntry,
  deleteRejectionEntry,
  getRejectionBreakdown,
  getRejectionTrend,
};
