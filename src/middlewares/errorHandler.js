// Error handler terpusat -- sebelumnya didefinisikan ULANG identik di
// src/app.js (lokal) dan api/[...path].js (Vercel), gampang beda tanpa
// sengaja begitu salah satu diedit.
//
// Beda perilaku app.js vs api/[...path].js (sudah didokumentasikan di
// CLAUDE.md sejak awal, dipertahankan lewat opsi `exposeMessage`):
//   - src/app.js (lokal)       -> errorHandler()                  -- 500 generik
//   - api/[...path].js (Vercel) -> errorHandler({ exposeMessage: true }) -- 500 echo err.message
// Ini CUMA berlaku untuk error TAK TERDUGA (status 500 diam-diam, mis.
// bug/query Prisma gagal) -- error yang sengaja dilempar dari service/
// route dengan `err.status` eksplisit (400/403/404 dari validasi input,
// akses ditolak, dll) SELALU balas message-nya apa adanya di kedua entry
// point, karena itu memang pesan yang ditujukan buat ditampilkan ke user,
// bukan detail internal yang perlu disembunyikan.
function makeErrorHandler({ exposeMessage = false } = {}) {
  return function errorHandler(err, req, res, next) {
    console.error(err);
    const status = err.status || 500;
    const message = err.status || exposeMessage ? (err.message || 'Internal server error') : 'Internal server error';
    res.status(status).json({ error: message });
  };
}

module.exports = makeErrorHandler;
