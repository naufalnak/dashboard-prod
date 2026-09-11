// ── Metrik per baris Resume Control Harian Produksi ─────────────────────
// Semua function di sini murni kalkulasi angka (tidak ada Prisma/req/res),
// dipisah dari produksi.service.js supaya bisa dipakai ulang tanpa bawa
// dependency database -- gampang di-unit-test langsung dengan objek biasa.

// Kolom mentah yang dibutuhkan rowMetrics() -- dipakai bareng select: {}
// di endpoint yang cuma butuh AVB/PERF/YIELD/AR/OEE per baris (bukan
// seluruh kolom ProduksiHarian), lihat ar-by-cluster/line/trend,
// oee-breakdown, oee-trend, dst.
const ROW_METRICS_SELECT = {
  ok1: true, ok2: true, rework: true, reject: true,
  waktuEfektif: true, breakdownMesin: true, cycleTime: true,
  lostTime: true, plan: true,
};

// Per-row AR/AVB/PERF/YIELD/OEE — sama persis dengan rumus di format Excel.
// Total OK = OK1 + OK2. Total Proses = OK1 + OK2 + Rework + Reject.
function rowMetrics(r) {
  const pct = (n, d) => d > 0 ? Math.max(0, Math.min(100, (n / d) * 100)) : 0;
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

// Rata-rata polos dari sekumpulan nilai AR per baris -- 0 kalau kosong
// (bukan NaN), dipakai tiap bucket (hari/bulan/tahun) di /ar-trend &
// /ar-trend-by-cluster.
function avgArValues(values) {
  return values.length ? Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1)) : 0;
}

module.exports = {
  ROW_METRICS_SELECT,
  rowMetrics,
  aggregateOee,
  avgArValues,
};
