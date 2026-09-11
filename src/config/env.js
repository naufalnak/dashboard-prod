require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// Wajib ada di semua environment -- tanpa ini app ga bisa connect ke DB
// sama sekali, jadi lebih baik gagal cepat & jelas di startup daripada
// nyangkut di error Prisma yang membingungkan belakangan.
const REQUIRED_ALWAYS = ['DATABASE_URL', 'DIRECT_URL'];

// JWT_SECRET punya fallback dev-only supaya local dev tetap bisa jalan
// tanpa .env lengkap, TAPI fallback itu predictable dan tidak boleh
// kepakai di production -- kalau ke-skip di sana, token admin jadi bisa
// dipalsukan siapa pun yang tahu source code ini publik/private.
const DEV_ONLY_JWT_SECRET = 'dev-only-insecure-secret-change-me';

const missing = REQUIRED_ALWAYS.filter((key) => !process.env[key]);
if (isProduction && !process.env.JWT_SECRET) missing.push('JWT_SECRET');

if (missing.length > 0) {
  console.error(`[config/env] Environment variable wajib belum diset: ${missing.join(', ')}`);
  console.error('[config/env] Cek .env / .env.example, atau env vars di dashboard hosting (Render/Vercel).');
  process.exit(1);
}

if (!isProduction && !process.env.JWT_SECRET) {
  console.warn('[config/env] JWT_SECRET belum diset -- pakai secret dev-only (TIDAK aman untuk production).');
}

module.exports = {
  NODE_ENV,
  isProduction,
  PORT: Number(process.env.PORT),
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  JWT_SECRET: process.env.JWT_SECRET || DEV_ONLY_JWT_SECRET,
  // Comma-separated IPs/CIDRs -- kosong berarti semua IP diizinkan (lihat
  // lib/ipAllowlist.js).
  ALLOWED_IPS: (process.env.ALLOWED_IPS || '').split(',').map((s) => s.trim()).filter(Boolean),
};
