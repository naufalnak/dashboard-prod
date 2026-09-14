// Fungsi hitung metrik murni (tidak ada req/res, tidak ada I/O selain
// Prisma read-only) -- dipindah dari routes/api.js supaya jadi SATU
// sumber kebenaran buat rumus AR/AVB/PERF/YIELD/OEE dkk, dan bisa ditest
// terpisah dari HTTP layer (lihat tests/unit/produksiMetrics.test.js).
const prisma = require('../lib/prisma');

// Rasio n/d dalam persen, dipatok 0-100 -- dipakai di semua service yang
// hitung persentase (AR/AVB/PERF/YIELD, Reject Ratio, Overtime, dst),
// diekspor supaya tidak perlu didefinisikan ulang di tiap service.
function pct(n, d) {
  return d > 0 ? Math.max(0, Math.min(100, (n / d) * 100)) : 0;
}

// ── Rejection / Material NG (RejectionEntry) ───────────
// Terpisah dari ProduksiHarian -- dimensinya per Part Name + harga, bukan
// per Proses/Mesin/Line. reject_ratio = Total LMR ÷ Total OK × 100%
// (bukan dibagi Total Proses), sesuai rumus laporan Material Reject yang
// sudah ada.
function rejectionMetrics(r) {
  const totalProses = r.totalOk + r.totalLmr;
  const rejectRatio = pct(r.totalLmr, r.totalOk);
  return {
    totalProses,
    rejectRatio: Number(rejectRatio.toFixed(2)),
    nilaiOk: Number((r.totalOk * r.price).toFixed(0)),
    nilaiLmr: Number((r.totalLmr * r.price).toFixed(0)),
  };
}

// Public — submit satu baris Input Rejection dari /lhp (tab "Input
// Rejection", tanpa login), mirip pola /produksi-harian. Cluster & Price
// diselesaikan di server dari Master Data Part Name (bukan dipercaya dari
// client) supaya konsisten dengan sumber aslinya.
// Total OK Input Rejection = jumlah OK1+OK2 dari RC Harian Produksi
// (ProduksiHarian) pada Proses Akhir/Finish Part Name itu (ditandai lewat
// Master Data -> Part Name & Proses), untuk tanggal yang sama dengan
// entri Rejection-nya. Kalau belum ada Proses Akhir yang ditandai buat
// Part Name itu, hasilnya 0 (hasFinishProses:false, dipakai frontend
// buat kasih peringatan supaya admin menandai Proses Akhir-nya dulu).
async function resolveTotalOkFromProduksi(partName, tanggalDate) {
  if (!partName || !tanggalDate || isNaN(tanggalDate.getTime())) return { totalOk: 0, hasFinishProses: false };
  const finishRows = await prisma.masterProses.findMany({
    where: { partName: { equals: partName, mode: 'insensitive' }, isFinishProses: true },
  });
  if (finishRows.length === 0) return { totalOk: 0, hasFinishProses: false };
  const prosesNames = finishRows.map((r) => r.proses);
  const dayStart = new Date(tanggalDate.getFullYear(), tanggalDate.getMonth(), tanggalDate.getDate());
  const dayEnd = new Date(tanggalDate.getFullYear(), tanggalDate.getMonth(), tanggalDate.getDate(), 23, 59, 59, 999);
  const rows = await prisma.produksiHarian.findMany({
    where: {
      partName: { equals: partName, mode: 'insensitive' },
      proses: { in: prosesNames },
      tanggal: { gte: dayStart, lte: dayEnd },
    },
  });
  const totalOk = rows.reduce((s, r) => s + r.ok1 + r.ok2, 0);
  return { totalOk, hasFinishProses: true };
}

// Per-row AR/AVB/PERF/YIELD/OEE — sama persis dengan rumus di format Excel.
// Total OK = OK1 + OK2. Total Proses = OK1 + OK2 + Rework + Reject.
function rowMetrics(r) {
  const totalOk = r.ok1 + r.ok2;
  const totalProses = r.ok1 + r.ok2 + r.rework + r.reject;
  const waktuEfektifMin = r.waktuEfektif * 60;

  // Maksimal yang ditampilkan (bukan target/threshold warna) -- AR & YIELD
  // tetap 0-100 lewat pct(), AVB/PERF/OEE dipatok ke plafon masing-masing
  // sesuai standar yang dipakai.
  const avb  = Math.min(pct((waktuEfektifMin * 0.9) - r.breakdownMesin, waktuEfektifMin), 90);
  const perf = Math.min(pct((r.cycleTime * totalOk * 1.05) / 60, waktuEfektifMin - r.lostTime), 95);
  const yld  = pct(totalOk, totalProses);
  const ar   = pct(totalProses, r.plan);
  const oee  = Math.min(avb * perf * yld / 10000, 85);

  return {
    totalOk, totalProses,
    avb: Number(avb.toFixed(1)),
    perf: Number(perf.toFixed(1)),
    yield: Number(yld.toFixed(1)),
    ar: Number(ar.toFixed(1)),
    oee: Number(oee.toFixed(1)),
  };
}

// ── GET /api/produksi-harian/summary ──────────────────
// Ringkasan OEE (Availability, Performance, Yield, AR, OEE) diagregasi dari
// semua baris Resume Control Harian Produksi dalam periode terpilih.
// Jumlah target jam lembur (MasterOvertimeTarget) buat semua bulan yang
// tercakup dalam rentang [start, end] -- dijumlah kalau rentangnya lebih
// dari satu bulan (mis. period "month" yang mencakup satu tahun penuh).
async function sumOvertimeTargetHours(start, end) {
  const months = [];
  let y = start.getFullYear(), m = start.getMonth();
  const endY = end.getFullYear(), endM = end.getMonth();
  while (y < endY || (y === endY && m <= endM)) {
    months.push({ year: y, month: m + 1 });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  if (months.length === 0) return 0;
  const rows = await prisma.masterOvertimeTarget.findMany({ where: { OR: months } });
  return rows.reduce((s, r) => s + r.targetHours, 0);
}

// ── GET /api/produksi-harian/ar-trend ──────────────────
// Tren AR untuk grafik drill-down AR di dashboard, mengikuti pola PeriodPicker:
//   period=today -> per tanggal dalam 1 bulan dari ?date (bukan per jam --
//                   data produksi jarang cukup padat per jam untuk grafik
//                   jam berguna, beda dengan widget snapshot lain yang
//                   memang difilter ke tanggal spesifik lewat getPeriodRange)
//   period=month -> per bulan dalam tahun dari ?date
//   period=year  -> per tahun (semua tahun yang ada datanya)
// Rata-rata polos dari sekumpulan nilai AR per baris -- 0 kalau kosong
// (bukan NaN), dipakai tiap bucket (hari/bulan/tahun) di bawah.
function avgArValues(values) {
  return values.length ? Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1)) : 0;
}

// Agregat AVB/PERF/YIELD/OEE dari sekumpulan baris ProduksiHarian --
// rata-rata polos dari metrik tiap baris (rowMetrics), sama pola dengan
// footer "PENCAPAIAN RATA-RATA" di tabel Data Produksi (ProduksiTable.jsx)
// -- supaya ring AR/OEE Cluster & Line di dashboard selalu sama dengan
// rata-rata yang ditampilkan tabel untuk tanggal/Cluster yang sama.
function aggregateOee(rows) {
  if (rows.length === 0) return { avb: 0, perf: 0, yield: 0, oee: 0 };
  let avb = 0, perf = 0, yld = 0, oee = 0;
  for (const r of rows) {
    const m = rowMetrics(r);
    avb += m.avb; perf += m.perf; yld += m.yield; oee += m.oee;
  }
  const n = rows.length;
  return {
    avb: Number((avb / n).toFixed(1)), perf: Number((perf / n).toFixed(1)),
    yield: Number((yld / n).toFixed(1)), oee: Number((oee / n).toFixed(1)),
  };
}

// Minggu ke berapa dalam bulan (1-5), dihitung dari tanggal (1-7=minggu1,
// 8-14=minggu2, dst) -- bukan ISO week number, biar sesuai konvensi
// laporan Material Reject yang sudah ada (Week 1..Week 5 per bulan).
function weekOfMonth(date) {
  return Math.ceil(date.getUTCDate() / 7);
}

module.exports = {
  pct,
  rejectionMetrics,
  resolveTotalOkFromProduksi,
  rowMetrics,
  sumOvertimeTargetHours,
  avgArValues,
  aggregateOee,
  weekOfMonth,
};
