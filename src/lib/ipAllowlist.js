// Restricts access by client IPv4 address/CIDR. No-op when ALLOWED_IPS is
// unset, so local dev and any deploy that hasn't configured it are unaffected.
const { ALLOWED_IPS } = require('../config/env');

function ipInCidr(ip, cidr) {
  const [range, bits] = cidr.split('/');
  if (!bits) return ip === range;
  const toInt = (addr) => addr.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0);
  const mask = ~(2 ** (32 - Number(bits)) - 1);
  return (toInt(ip) & mask) === (toInt(range) & mask);
}

function ipAllowlist(req, res, next) {
  if (ALLOWED_IPS.length === 0) return next();

  const clientIp = (req.ip || '').replace(/^::ffff:/, '');
  const ok = ALLOWED_IPS.some((entry) => (entry.includes('/') ? ipInCidr(clientIp, entry) : entry === clientIp));
  if (!ok) return res.status(403).json({ error: 'Access denied from this network' });
  next();
}

module.exports = ipAllowlist;
