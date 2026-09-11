// Format Date -> "YYYY-MM-DD" pakai komponen UTC (sama seperti
// `date.toISOString().slice(0, 10)` yang sebelumnya ditulis berulang di
// rejection/overtime/rework/problemLog routes) -- dipakai buat serialisasi
// response JSON, BUKAN buat kalkulasi/perbandingan tanggal (untuk itu pakai
// lib/period.js). null-safe: mengembalikan null kalau date-nya null.
function toDateStr(date) {
  return date ? date.toISOString().slice(0, 10) : null;
}

module.exports = { toDateStr };