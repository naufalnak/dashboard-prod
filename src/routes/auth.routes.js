const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { signToken } = require('../lib/auth');
const { loginLimiter } = require('../lib/rateLimit');
const { validateBody } = require('../middlewares/validate');

const router = express.Router();

// ── GET /api/health ──────────────────────────────────
// Quick diagnostic: confirms the function can reach Postgres. Left public
// (no auth) so it stays useful for uptime checks even when logged out.
router.get('/health', async (req, res) => {
  try {
    const [{ count }] = await prisma.$queryRaw`SELECT count(*)::int AS count FROM "shared"."ProduksiHarian"`;
    res.json({ ok: true, produksiRows: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Database unreachable' });
  }
});

// ── POST /api/login ───────────────────────────────────
// loginLimiter di atas apiLimiter umum (dipasang sekali di routes/api.js)
// -- percobaan login dibatasi lebih ketat (10/15 menit) supaya
// brute-force password lebih sulit.
router.post('/login', loginLimiter, validateBody(['username', 'password'], 'username and password are required'), async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const admin = await prisma.admin.findUnique({ where: { username } });
    if (!admin) return res.status(401).json({ error: 'Invalid username or password' });

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

    res.json({ token: signToken(admin), username: admin.username, role: admin.role || 'maintenance' });
  } catch (err) { next(err); }
});

module.exports = router;
