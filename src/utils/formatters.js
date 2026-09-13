// Helper format/serialize kecil yang berulang di semua service --
// sebelumnya diketik ulang inline (`r.tanggal.toISOString().slice(0, 10)`,
// `Number(x.toFixed(1))`) di puluhan tempat berbeda.

// Date -> "YYYY-MM-DD" (null kalau kosong) -- format tanggal standar yang
// dikirim ke frontend di semua response API.
function toDateOnly(date) {
  return date ? date.toISOString().slice(0, 10) : null;
}

// Number -> dibulatkan ke N desimal (default 1), tetap tipe Number
// (bukan string) supaya JSON-nya angka asli, bukan "12.3".
function roundTo(value, decimals = 1) {
  return Number(value.toFixed(decimals));
}

// Part Name & Line Produksi WAJIB huruf besar semua -- dipakai di semua
// endpoint yang menulis kedua field itu (Master Data, RC Harian Produksi,
// Input Rejection, Data Rework, Problem Produksi, import CSV/Excel),
// supaya konsisten di seluruh tabel/tampilan (sebelumnya campur besar-
// kecil tergantung ketikan operator). null/undefined dibiarkan apa adanya
// (field opsional yang memang boleh kosong).
function upper(str) {
  return str == null ? str : String(str).trim().toUpperCase();
}

module.exports = { toDateOnly, roundTo, upper };
