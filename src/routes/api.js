// Kompatibilitas -- app.js (lokal) & api/[...path].js (Vercel) sama-sama
// require('./routes/api') / require('../src/routes/api'), jadi file ini
// dipertahankan sebagai entry point supaya keduanya tidak perlu diubah.
// Isi sesungguhnya sekarang dipecah per domain, lihat routes/index.js.
module.exports = require('./index');
