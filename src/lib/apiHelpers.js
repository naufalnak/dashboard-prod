const prisma = require('../lib/prisma');

// ── Pagination ──────────────────────────────────────────
// Dipakai endpoint listing (Data Rejection, Data Overtime, Data Rework,
// Data Produksi, Problem Log) -- page/pageSize dari query string, dipagar
// dengan MAX_PAGE_SIZE supaya ?pageSize=999999 tidak dipakai buat
// menyelundupkan balik perilaku "ambil semua baris sekaligus" yang justru
// mau dihindari lewat pagination ini.
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
function parsePagination(query) {
  const page = Math.max(1, Math.trunc(Number(query.page)) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(Number(query.pageSize)) || DEFAULT_PAGE_SIZE));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

// ── Minggu ke berapa dalam bulan ───────────────────────
// Dipakai /rejection-trend & /overtime-trend (period=week) -- 1-7=minggu1,
// 8-14=minggu2, dst. Bukan ISO week number, biar sesuai konvensi laporan
// Material Reject yang sudah ada (Week 1..Week 5 per bulan).
function weekOfMonth(date) {
  return Math.ceil(date.getUTCDate() / 7);
}

// ── Total OK dari RC Harian Produksi (Proses Akhir/Finish) ─────────────
// Dipakai /produksi-ok-for-part (routes/produksi.routes.js) DAN
// /rejection-entry, /rejection-entry-update (routes/rejection.routes.js)
// -- karena itu ditaruh di sini, bukan di salah satu file domain.
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
  // aggregate() -- Postgres yang jumlahin ok1+ok2, tidak perlu kirim baris
  // mentah ke Node. Dipanggil tiap kali form Input Rejection buka/submit,
  // jadi lumayan sering.
  const agg = await prisma.produksiHarian.aggregate({
    where: {
      partName: { equals: partName, mode: 'insensitive' },
      proses: { in: prosesNames },
      tanggal: { gte: dayStart, lte: dayEnd },
    },
    _sum: { ok1: true, ok2: true },
  });
  const totalOk = (agg._sum.ok1 || 0) + (agg._sum.ok2 || 0);
  return { totalOk, hasFinishProses: true };
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePagination,
  weekOfMonth,
  resolveTotalOkFromProduksi,
};
