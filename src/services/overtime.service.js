// Business logic & query Prisma untuk domain Input Overtime (OvertimeEntry)
// -- dipindah dari routes/overtime.routes.js.
const prisma = require('../lib/prisma');
const { getPeriodRange } = require('../lib/period');
const { buildTrendBuckets } = require('../utils/dateRange');
const { toDateOnly, roundTo } = require('../utils/formatters');

// Resolve Grup Head & Cluster dari nama Man Power (lewat roster Man Power
// -> Grup Head -> Cluster) -- dipakai saat create/update OvertimeEntry
// supaya Cluster & Grup Head-nya otomatis, sama pola dengan Cluster
// otomatis dari Part Name di RejectionEntry (cuma rantainya satu hop
// lebih panjang: Man Power -> Grup Head -> Cluster).
async function resolveManPowerChain(manPowerName) {
  if (!manPowerName) return { manPowerId: null, groupHead: null, cluster: null };
  const mp = await prisma.masterManPower.findFirst({
    where: { name: { equals: manPowerName, mode: 'insensitive' } },
  });
  if (!mp) return { manPowerId: null, groupHead: null, cluster: null };
  const gh = mp.groupHead
    ? await prisma.masterGroupHead.findFirst({ where: { name: { equals: mp.groupHead, mode: 'insensitive' } } })
    : null;
  return { manPowerId: mp.id, groupHead: mp.groupHead || null, cluster: gh?.cluster || null };
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Public — submit satu baris Input Overtime dari /lhp (tab "Overtime",
// tanpa login), mirip pola /rejection-entry.
async function createOvertime(body) {
  const { tanggal, waktu, man_power, durasi_jam, keterangan } = body;
  if (!tanggal) throw httpError(400, 'tanggal wajib diisi');
  const { manPowerId, groupHead, cluster } = await resolveManPowerChain(man_power);
  const record = await prisma.overtimeEntry.create({
    data: {
      tanggal: new Date(tanggal),
      waktu: waktu || null,
      manPower: man_power || null,
      manPowerId, groupHead, cluster,
      durasiJam: durasi_jam ? Number(durasi_jam) : 0,
      keterangan: keterangan || null,
    },
  });
  return { id: record.id, durasiJam: record.durasiJam };
}

// Login-gated — daftar semua Input Overtime untuk menu Data Overtime.
async function listOvertime(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const rows = await prisma.overtimeEntry.findMany({
    where: { tanggal: { gte: start, lte: end } },
    orderBy: [{ tanggal: 'desc' }, { id: 'desc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    tanggal: toDateOnly(r.tanggal),
    waktu: r.waktu,
    manPower: r.manPower,
    groupHead: r.groupHead,
    cluster: r.cluster,
    durasiJam: r.durasiJam,
    keterangan: r.keterangan,
  }));
}

async function updateOvertime(id, body) {
  const { tanggal, waktu, man_power, durasi_jam, keterangan } = body;
  const data = {};
  if (tanggal !== undefined) data.tanggal = new Date(tanggal);
  if (waktu !== undefined) data.waktu = waktu || null;
  if (durasi_jam !== undefined) data.durasiJam = Number(durasi_jam) || 0;
  if (keterangan !== undefined) data.keterangan = keterangan || null;
  if (man_power !== undefined) {
    const { manPowerId, groupHead, cluster } = await resolveManPowerChain(man_power);
    data.manPower = man_power || null;
    data.manPowerId = manPowerId;
    data.groupHead = groupHead;
    data.cluster = cluster;
  }
  const record = await prisma.overtimeEntry.update({ where: { id }, data });
  return { id: record.id, durasiJam: record.durasiJam };
}

async function deleteOvertime(id) {
  await prisma.overtimeEntry.delete({ where: { id } });
}

// Total jam lembur per Cluster dalam periode terpilih -- untuk kartu ring
// per-Cluster di halaman Detail Overtime.
async function getOvertimeByCluster(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
  const rows = await prisma.overtimeEntry.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

  const byCluster = {};
  for (const r of rows) {
    const c = r.cluster || 'Lainnya';
    byCluster[c] = (byCluster[c] || 0) + r.durasiJam;
  }
  return Object.entries(byCluster).map(([cluster, jam]) => ({ cluster, jam: roundTo(jam) }));
}

// Total jam lembur per Man Power dalam periode terpilih -- untuk ranking 5
// Man Power lembur tertinggi/terendah di halaman Detail Overtime.
async function getOvertimeByManPower(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
  const rows = await prisma.overtimeEntry.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter, manPower: { not: null } } });

  const byMp = {};
  for (const r of rows) {
    if (!r.manPower) continue;
    if (!byMp[r.manPower]) byMp[r.manPower] = { cluster: r.cluster || '—', jam: 0 };
    byMp[r.manPower].jam += r.durasiJam;
  }
  return Object.entries(byMp).map(([line, v]) => ({
    line, cluster: v.cluster, jam: roundTo(v.jam),
  })).sort((a, b) => b.jam - a.jam);
}

// Total jam lembur per Grup Head dalam periode terpilih -- untuk donut
// breakdown di halaman Detail Overtime (field "count" berisi jam, bukan
// jumlah kejadian, supaya bisa dipakai ulang lewat komponen chart yang
// sama dengan Kriteria NG/Jenis Problem).
async function getOvertimeByGroupHead(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
  const rows = await prisma.overtimeEntry.findMany({ where: { tanggal: { gte: start, lte: end }, groupHead: { not: null }, ...clusterFilter } });

  const byGh = {};
  for (const r of rows) {
    if (!r.groupHead) continue;
    byGh[r.groupHead] = (byGh[r.groupHead] || 0) + r.durasiJam;
  }
  const total = Object.values(byGh).reduce((a, b) => a + b, 0);
  return Object.entries(byGh).map(([jenis, jam]) => ({
    jenis, count: roundTo(jam), pct: total > 0 ? roundTo((jam / total) * 100) : 0,
  })).sort((a, b) => b.count - a.count);
}

async function findEarliestOvertimeYear() {
  const agg = await prisma.overtimeEntry.aggregate({ _min: { tanggal: true } });
  return agg._min.tanggal ? agg._min.tanggal.getUTCFullYear() : null;
}

// Tren total jam lembur. Harian = per tanggal dalam bulan, Mingguan = per
// minggu (Week 1..5) dalam bulan, Bulanan = per bulan dalam tahun,
// Tahunan = per tahun.
async function getOvertimeTrend(query) {
  const period = query.period || 'today';
  const ref = query.date ? new Date(query.date) : new Date();
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
  const { start, end, labels, keyOf } = await buildTrendBuckets(period, ref, findEarliestOvertimeYear);
  const rows = await prisma.overtimeEntry.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

  const buckets = labels.map(() => 0);
  for (const r of rows) {
    const idx = keyOf(r.tanggal);
    if (buckets[idx] !== undefined) buckets[idx] += r.durasiJam;
  }
  return labels.map((day, i) => ({ day, overtime: roundTo(buckets[i]) }));
}

module.exports = {
  createOvertime,
  listOvertime,
  updateOvertime,
  deleteOvertime,
  getOvertimeByCluster,
  getOvertimeByManPower,
  getOvertimeByGroupHead,
  getOvertimeTrend,
};
