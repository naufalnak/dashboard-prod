const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { signToken } = require('../lib/auth');
const { loginLimiter } = require('../lib/rateLimit');
const requireAuth = require('../middlewares/requireAuth');

const router = express.Router();

// Akun yang boleh membuka kunci tab "Part Name & Proses" di Master Data --
// SENGAJA lebih sempit dari daftar privileged umum, lihat catatan di
// web/src/roles.js (PART_PROSES_USERNAMES, harus disamakan manual kalau
// daftarnya berubah -- frontend & backend sengaja tidak berbagi file
// karena frontend jalan di browser, backend di server).
const PART_PROSES_USERNAMES = ['sugeng', 'pradana', 'djk'];

// ── GET /api/health ──────────────────────────────────
// Quick diagnostic: confirms the function can reach Postgres. Left public
// (no auth) so it stays useful for uptime checks even when logged out.
router.get('/health', async (req, res) => {
  try {
    const [{ count }] = await prisma.$queryRaw`SELECT count(*)::int AS count FROM "ProduksiHarian"`;
    res.json({ ok: true, produksiRows: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Database unreachable' });
  }
});

// ── POST /api/login ───────────────────────────────────
// loginLimiter di atas apiLimiter umum -- percobaan login dibatasi lebih
// ketat (10/15 menit) supaya brute-force password lebih sulit.
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const admin = await prisma.admin.findUnique({ where: { username } });
    if (!admin) return res.status(401).json({ error: 'Invalid username or password' });

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

    res.json({ token: signToken(admin), username: admin.username, role: admin.role || 'maintenance' });
  } catch (err) { next(err); }
});

// ── POST /api/unlock-part-proses ──────────────────────
// Buka kunci tab "Part Name & Proses" di Master Data -- password yang
// dicek adalah password LOGIN akun yang sedang dipakai sendiri (bukan
// password terpisah), diverifikasi ulang lewat bcrypt.compare ke hash
// tersimpan (sama seperti /login), BUKAN dipercaya dari client. Cuma
// akun di PART_PROSES_USERNAMES yang bisa lolos -- akun lain ditolak
// 403 walau passwordnya sendiri benar, karena memang tidak seharusnya
// bisa mengakses tab ini sama sekali.
router.post('/unlock-part-proses', requireAuth, loginLimiter, async (req, res, next) => {
  try {
    const username = req.admin.username;
    if (!PART_PROSES_USERNAMES.includes(String(username || '').toLowerCase())) {
      return res.status(403).json({ error: 'Akun ini tidak punya akses ke Part Name & Proses' });
    }
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password wajib diisi' });

    const admin = await prisma.admin.findUnique({ where: { username } });
    if (!admin) return res.status(401).json({ error: 'Password salah' });
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Password salah' });

    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
