// Error handler Express terpusat -- sebelumnya ada 2 salinan HAMPIR identik
// (satu di src/app.js untuk server biasa, satu di api/[...path].js untuk
// entry point serverless Vercel). Disatukan di sini supaya kalau nanti mau
// ditambah mis. bedain error Prisma (P2002 unique constraint, dst) dari
// error lain, cukup diubah di satu tempat, kepakai di kedua entry point.
//
// PENTING: harus didaftarkan PALING TERAKHIR (setelah semua route) --
// signature 4-argumen (err, req, res, next) ini yang bikin Express
// mengenalinya sebagai error-handling middleware, bukan middleware biasa.
//
// Error yang SENGAJA dilempar dari service/route dengan `err.status`
// eksplisit (400/403/404 dari validasi input, akses ditolak, dll --
// lihat mis. assertJenisProblemIfDowntime di produksi.service.js) dibalas
// dengan status & message aslinya, karena itu memang pesan yang ditujukan
// buat ditampilkan ke user. Error TAK TERDUGA (tanpa err.status, mis. bug/
// query Prisma gagal) tetap 500 generik seperti sebelumnya -- tidak ada
// detail internal yang bocor ke user.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);
  const status = err.status || 500;
  const message = err.status ? (err.message || 'Internal server error') : 'Internal server error';
  res.status(status).json({ error: message });
}

module.exports = errorHandler;