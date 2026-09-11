const prisma = require('../lib/prisma');
const { getPeriodRange } = require('../lib/period');
const { weekOfMonth } = require('../lib/apiHelpers');

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

// Submit satu baris Input Overtime, mirip pola rejection.service.
async function createOvertimeEntry({ tanggal, waktu, man_power, durasi_jam, keterangan }) {
  const { manPowerId, groupHead, cluster } = await resolveManPowerChain(man_power);
  const record = await prisma.overtimeEntry.create({
    data: {
      tanggal: new Date(tanggal),
      waktu: waktu || null,
      manPower: man_power || null,
      manPowerId,
      groupHead,
      cluster,
      durasiJam: durasi_jam ? Number(durasi_jam) : 0,
      keterangan: keterangan || null,
    },
  });
  return { id: record.id, durasiJam: record.durasiJam };
}

async function listOvertimeEntries({ period, date, start: qsStart, end: qsEnd, page, pageSize, skip, take }) {
  const { start, end } = getPeriodRange(period, date, qsStart, qsEnd);
  const where = { tanggal: { gte: start, lte: end } };
  const [total, rows] = await Promise.all([
    prisma.overtimeEntry.count({ where }),
    prisma.overtimeEntry.findMany({
      where,
      orderBy: [{ tanggal: 'desc' }, { id: 'desc' }],
      skip, take,
    }),
  ]);
  return {
    rows: rows.map((r) => ({
      id: r.id,
      tanggal: r.tanggal.toISOString().slice(0, 10),
      waktu: r.waktu,
      manPower: r.manPower,
      groupHead: r.groupHead,
      cluster: r.cluster,
      durasiJam: r.durasiJam,
      keterangan: r.keterangan,
    })),
    page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function updateOvertimeEntry(id, { tanggal, waktu, man_power, durasi_jam, keterangan }) {
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

async function deleteOvertimeEntry(id) {
  await prisma.overtimeEntry.delete({ where: { id } });
}

// Gabungan /overtime-by-cluster + /overtime-by-manpower +
// /overtime-by-group-head -- ketiganya dulu 4 query terpisah (2 groupBy +
// 2 findMany) ke OvertimeEntry dengan where (tanggal+cluster) yang PERSIS
// SAMA. Sekarang satu findMany (select kolom yang dibutuhkan saja) dipakai
// buat menurunkan ketiga breakdown itu sekaligus -- termasuk tag Cluster
// per Man Power yang sebelumnya butuh query distinct terpisah, sekarang
// didapat gratis dari baris yang sama.
async function getOvertimeBreakdown({ period, date, start: qsStart, end: qsEnd, cluster }) {
  const { start, end } = getPeriodRange(period, date, qsStart, qsEnd);
  const clusterFilter = cluster ? { cluster } : {};
  const rows = await prisma.overtimeEntry.findMany({
    where: { tanggal: { gte: start, lte: end }, ...clusterFilter },
    select: { cluster: true, manPower: true, groupHead: true, durasiJam: true },
  });

  const byCluster = {};
  const byMp = {};
  const byGh = {};
  for (const r of rows) {
    const c = r.cluster || 'Lainnya';
    byCluster[c] = (byCluster[c] || 0) + r.durasiJam;
    if (r.manPower) {
      if (!byMp[r.manPower]) byMp[r.manPower] = { cluster: r.cluster || '—', jam: 0 };
      byMp[r.manPower].jam += r.durasiJam;
    }
    if (r.groupHead) byGh[r.groupHead] = (byGh[r.groupHead] || 0) + r.durasiJam;
  }

  const byClusterResult = Object.entries(byCluster).map(([cluster, jam]) => ({ cluster, jam: Number(jam.toFixed(1)) }));
  const byManPowerResult = Object.entries(byMp)
    .map(([line, v]) => ({ line, cluster: v.cluster, jam: Number(v.jam.toFixed(1)) }))
    .sort((a, b) => b.jam - a.jam);
  const ghTotal = Object.values(byGh).reduce((a, b) => a + b, 0);
  const byGroupHeadResult = Object.entries(byGh)
    .map(([jenis, jam]) => ({ jenis, count: Number(jam.toFixed(1)), pct: ghTotal > 0 ? Number(((jam / ghTotal) * 100).toFixed(1)) : 0 }))
    .sort((a, b) => b.count - a.count);

  return { byCluster: byClusterResult, byManPower: byManPowerResult, byGroupHead: byGroupHeadResult };
}

// Tren total jam lembur. Harian = per tanggal dalam bulan, Mingguan = per
// minggu (Week 1..5) dalam bulan, Bulanan = per bulan dalam tahun, Tahunan
// = per tahun.
async function getOvertimeTrend({ period, date, cluster }) {
  const ref = date ? new Date(date) : new Date();
  const clusterFilter = cluster ? { cluster } : {};
  const p = period || 'today';

  if (p === 'today') {
    const year = ref.getFullYear(), month = ref.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const rows = await prisma.overtimeEntry.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

    const daysInMonth = end.getDate();
    const byDay = Array.from({ length: daysInMonth }, (_, i) => ({ day: String(i + 1).padStart(2, '0'), jam: 0 }));
    for (const r of rows) {
      const idx = r.tanggal.getUTCDate() - 1;
      if (byDay[idx]) byDay[idx].jam += r.durasiJam;
    }
    return byDay.map((d) => ({ day: d.day, overtime: Number(d.jam.toFixed(1)) }));
  }

  if (p === 'week') {
    const year = ref.getFullYear(), month = ref.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const rows = await prisma.overtimeEntry.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

    const weekCount = Math.ceil(end.getDate() / 7);
    const byWeek = Array.from({ length: weekCount }, (_, i) => ({ day: `Week ${i + 1}`, jam: 0 }));
    for (const r of rows) {
      const idx = weekOfMonth(r.tanggal) - 1;
      if (byWeek[idx]) byWeek[idx].jam += r.durasiJam;
    }
    return byWeek.map((d) => ({ day: d.day, overtime: Number(d.jam.toFixed(1)) }));
  }

  if (p === 'year') {
    const agg = await prisma.overtimeEntry.aggregate({ _min: { tanggal: true } });
    const earliestYear = agg._min.tanggal ? agg._min.tanggal.getUTCFullYear() : ref.getFullYear();
    const thisYear = new Date().getFullYear();
    const fromYear = Math.min(earliestYear, thisYear);
    const years = [];
    for (let y = fromYear; y <= thisYear; y++) years.push(y);

    const start = new Date(fromYear, 0, 1);
    const end = new Date(thisYear, 11, 31, 23, 59, 59, 999);
    const rows = await prisma.overtimeEntry.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

    const byYear = {};
    years.forEach((y) => { byYear[y] = 0; });
    for (const r of rows) {
      const y = r.tanggal.getUTCFullYear();
      if (byYear[y] !== undefined) byYear[y] += r.durasiJam;
    }
    return years.map((y) => ({ day: String(y), overtime: Number(byYear[y].toFixed(1)) }));
  }

  // default: month ("Bulanan") -> per bulan dalam tahun
  const year = ref.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  const rows = await prisma.overtimeEntry.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const byMonth = MONTHS.map((m) => ({ day: m, jam: 0 }));
  for (const r of rows) {
    const idx = r.tanggal.getUTCMonth();
    byMonth[idx].jam += r.durasiJam;
  }
  return byMonth.map((d) => ({ day: d.day, overtime: Number(d.jam.toFixed(1)) }));
}

module.exports = {
  createOvertimeEntry,
  listOvertimeEntries,
  updateOvertimeEntry,
  deleteOvertimeEntry,
  getOvertimeBreakdown,
  getOvertimeTrend,
};
