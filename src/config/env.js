// Baca & validasi environment variables di SATU tempat -- sebelumnya
// process.env.X tersebar di beberapa file (lib/auth.js, lib/ipAllowlist.js,
// server.js) masing-masing dengan fallback sendiri-sendiri. Kode baru
// import config ini, bukan process.env langsung.
//
// CATATAN: file ini dipakai baik oleh src/server.js (lokal, dotenv lewat
// require('dotenv').config() di sini) maupun lewat require chain dari
// api/[...path].js (Vercel) yang sudah panggil dotenv duluan di file-nya
// sendiri -- require('dotenv').config() aman dipanggil berkali-kali,
// cuma efektif sekali (dotenv tidak menimpa env var yang sudah diset).
require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

const env = {
  NODE_ENV,
  IS_PRODUCTION,
  PORT: Number(process.env.PORT) || 3001,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  // CIDR atau IP polos, dipisah koma -- lihat lib/ipAllowlist.js. Array
  // kosong = allowlist nonaktif (tidak membatasi apa pun).
  ALLOWED_IPS: (process.env.ALLOWED_IPS || '').split(',').map((s) => s.trim()).filter(Boolean),
  DATABASE_URL: process.env.DATABASE_URL || '',
  DIRECT_URL: process.env.DIRECT_URL || '',
};

// Peringatan (bukan crash -- supaya tidak bikin build/test lokal gagal
// total) kalau konfigurasi krusial untuk production belum diisi dengan
// benar. JWT_SECRET & DATABASE_URL WAJIB diset lewat Vercel Environment
// Variables di production, lihat catatan di CLAUDE.md.
if (env.IS_PRODUCTION && env.JWT_SECRET === 'dev-only-insecure-secret-change-me') {
  console.warn('[env] JWT_SECRET belum diset di production -- pakai default yang TIDAK aman.');
}
if (!env.DATABASE_URL) {
  console.warn('[env] DATABASE_URL belum diset -- Prisma tidak akan bisa konek ke database.');
}

module.exports = env;
